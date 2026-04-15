"""
EthioBridge Hybrid Recommendation Service — Inference API
==========================================================
FastAPI service that loads a pre-trained KNN model and serves recommendations.

Startup:
    1. Run  python train_model.py  to build models/knn_model.pkl
    2. Run  uvicorn main:app --reload --port 8000

If no model file exists the service falls back to content-based scoring only
(no collaborative filtering) so it always returns something useful.
"""

from fastapi import FastAPI, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
import psycopg2.extras
import numpy as np
from dotenv import load_dotenv
import os
import threading
import time

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../backend/.env"))

from model_store import (
    load_model, CATEGORIES,
    cat_vec, normalize_price,
    product_feature_vec, user_query_vec,
)

app = FastAPI(title="EthioBridge ML Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global model state ─────────────────────────────────────────────────────────
_model: dict | None = None
_model_lock = threading.Lock()

def get_model() -> dict | None:
    return _model

@app.on_event("startup")
def startup_event():
    global _model
    payload = load_model()
    if payload:
        _model = payload
        print(f"[startup] Loaded model version {payload.get('version')} "
              f"trained at {payload.get('trained_at')}")
    else:
        print("[startup] No pre-trained model found. "
              "Run  python train_model.py  to build one. "
              "Falling back to content-based scoring.")

# ── DB helpers (still needed for live data: interactions, product list) ────────
def get_conn():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        dbname=os.getenv("DB_NAME", "ethiobridge"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "1234"),
        port=int(os.getenv("DB_PORT", 5432)),
    )

def query(sql, params=None):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params or ())
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

# ── Live helpers (small, cheap queries) ───────────────────────────────────────
def user_product_interactions(user_id: int) -> set:
    rows = query("""
        SELECT DISTINCT pr.product_id
        FROM purchase_requests pr
        JOIN stakeholders s ON s.id = pr.stakeholder_id
        WHERE s.user_id = %s
    """, (user_id,))
    return {r["product_id"] for r in rows}

def user_industry_interactions(user_id: int) -> set:
    rows = query("""
        SELECT DISTINCT pr.industry_id
        FROM purchase_requests pr
        JOIN stakeholders s ON s.id = pr.stakeholder_id
        WHERE s.user_id = %s
    """, (user_id,))
    return {r["industry_id"] for r in rows}

# ── Cosine similarity ──────────────────────────────────────────────────────────
def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom > 0 else 0.0

# ── KNN collaborative boost (uses pre-trained model) ──────────────────────────
def knn_boost_from_model(user_id: int, model: dict) -> dict:
    """
    Use the pre-trained KNN to find similar users, then return
    a {product_id: boost_score} dict.
    """
    knn      = model.get("knn_model")
    user_idx = model.get("user_index", {})
    all_users = model.get("all_users", [])
    all_products = model.get("all_products", [])
    product_pop = model.get("product_pop", {})

    if knn is None or user_id not in user_idx or len(all_users) < 2:
        return {}

    # Reconstruct the user's row from the stored interaction data
    # We need the matrix row — rebuild it from live interactions for this user
    user_interactions = user_product_interactions(user_id)
    product_index = model.get("product_index", {})

    row = np.zeros(len(all_products), dtype=float)
    for pid in user_interactions:
        if pid in product_index:
            row[product_index[pid]] = 1.0

    try:
        distances, indices = knn.kneighbors(row.reshape(1, -1))
    except Exception:
        return {}

    similar_user_ids = [
        all_users[idx] for idx, dist in zip(indices[0], distances[0])
        if all_users[idx] != user_id
    ]

    if not similar_user_ids:
        return {}

    # Products liked by similar users
    placeholders = ",".join(["%s"] * len(similar_user_ids))
    rows = query(f"""
        SELECT pr.product_id, COUNT(*) AS cnt
        FROM purchase_requests pr
        JOIN stakeholders s ON s.id = pr.stakeholder_id
        WHERE s.user_id IN ({placeholders}) AND pr.status = 'approved'
        GROUP BY pr.product_id
    """, tuple(similar_user_ids))

    if not rows:
        return {}
    max_cnt = max(r["cnt"] for r in rows)
    return {r["product_id"]: r["cnt"] / max_cnt for r in rows}

# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT: /recommend/products
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/recommend/products")
def recommend_products(
    user_id: int = Query(...),
    category: str = Query(default=""),
    budget: float = Query(default=0),
    top_n: int = Query(default=10),
):
    model = get_model()

    # Check if user has any meaningful input or interaction history
    has_category = category and category.strip()
    has_budget = budget > 0
    already_seen = user_product_interactions(user_id)
    has_history = len(already_seen) > 0

    # Log when generating recommendations without input
    if not has_category and not has_budget and not has_history:
        print(f"[WARN] User {user_id} requesting recommendations with no input or history. Returning popular products.")

    # Use cached product list from model if available, else query live
    if model and model.get("product_lookup"):
        products = list(model["product_lookup"].values())
        product_pop = model.get("product_pop", {})
    else:
        products = query("""
            SELECT p.id, p.name, p.category, p.price, p.unit,
                   p.image_url, i.company_name, i.sector, i.location, i.id AS industry_id
            FROM products p
            JOIN industries i ON i.id = p.industry_id
            JOIN users u ON u.id = i.user_id
            WHERE p.is_available = TRUE AND u.status = 'approved'
        """)
        # Compute popularity live
        pop_rows = query("SELECT product_id, COUNT(*) AS cnt FROM purchase_requests WHERE status='approved' GROUP BY product_id")
        max_cnt = max((r["cnt"] for r in pop_rows), default=1) or 1
        product_pop = {r["product_id"]: r["cnt"] / max_cnt for r in pop_rows}

    if not products:
        return {"recommendations": [], "model_version": None, "recommendation_type": "none"}

    # If no meaningful input, return popular products explicitly
    if not has_category and not has_budget and not has_history:
        popular = [
            {
                "product_id":    p["id"],
                "name":          p.get("name"),
                "category":      p.get("category"),
                "price":         float(p["price"]) if p.get("price") else None,
                "unit":          p.get("unit"),
                "image_url":     p.get("image_url"),
                "company_name":  p.get("company_name"),
                "industry_id":   p.get("industry_id"),
                "location":      p.get("location"),
                "score":         product_pop.get(p["id"], 0.0),
                "similarity":    0.0,
                "popularity":    product_pop.get(p["id"], 0.0),
                "over_budget":   False,
            }
            for p in products
            if p["id"] not in already_seen
        ]
        popular.sort(key=lambda x: x["popularity"], reverse=True)
        return {
            "recommendations": popular[:top_n],
            "model_version": model.get("version") if model else None,
            "recommendation_type": "popular"
        }

    # Soft filter — budget is a scoring signal, NOT a hard cutoff
    # All products matching the category are included; over-budget ones get penalised
    filtered = [
        p for p in products
        if not category
        or category.lower() in (p.get("category") or "").lower()
        or category.lower() in (p.get("name") or "").lower()
    ]
    if not filtered:
        return {"recommendations": [], "model_version": None, "recommendation_type": "none"}

    user_vec     = user_query_vec(category, budget)
    knn_boost    = knn_boost_from_model(user_id, model) if model else {}

    scored = []
    for p in filtered:
        pid = p["id"]
        if pid in already_seen:
            continue

        p_vec      = product_feature_vec(p.get("category"), p.get("name"), p.get("price"))
        sim        = cosine_sim(user_vec, p_vec)
        popularity = product_pop.get(pid, 0.0)
        knn_score  = knn_boost.get(pid, 0.0)

        # Soft budget penalty: reduce score proportionally if over budget
        budget_penalty = 0.0
        if budget > 0 and p.get("price"):
            price = float(p["price"])
            if price > budget:
                # penalty grows with how far over budget (capped at 0.3 reduction)
                over_ratio = min((price - budget) / budget, 1.0)
                budget_penalty = 0.3 * over_ratio

        score = (0.45 * sim) + (0.30 * popularity) + (0.25 * knn_score) - budget_penalty

        scored.append({
            "product_id":    pid,
            "name":          p.get("name"),
            "category":      p.get("category"),
            "price":         float(p["price"]) if p.get("price") else None,
            "unit":          p.get("unit"),
            "image_url":     p.get("image_url"),
            "company_name":  p.get("company_name"),
            "industry_id":   p.get("industry_id"),
            "location":      p.get("location"),
            "score":         round(score, 4),
            "similarity":    round(sim, 4),
            "popularity":    round(popularity, 4),
            "over_budget":   budget > 0 and p.get("price") and float(p["price"]) > budget,
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    
    # Determine recommendation type for UI feedback
    rec_type = "personalized"
    if has_history and knn_boost:
        rec_type = "collaborative"
    elif has_category or has_budget:
        rec_type = "content_based"
    
    return {
        "recommendations": scored[:top_n],
        "model_version": model.get("version") if model else None,
        "recommendation_type": rec_type,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT: /recommend/industries
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/recommend/industries")
def recommend_industries(
    user_id: int = Query(...),
    category: str = Query(default=""),
    budget: float = Query(default=0),
    top_n: int = Query(default=10),
):
    model = get_model()

    # Check if user has any meaningful input or interaction history
    has_category = category and category.strip()
    has_budget = budget > 0
    already_seen = user_industry_interactions(user_id)
    has_history = len(already_seen) > 0

    # Log when generating recommendations without input
    if not has_category and not has_budget and not has_history:
        print(f"[WARN] User {user_id} requesting industry recommendations with no input or history. Returning popular industries.")

    if model and model.get("industry_lookup"):
        industries  = list(model["industry_lookup"].values())
        industry_pop = model.get("industry_pop", {})
    else:
        industries = query("""
            SELECT i.id, i.company_name, i.sector, i.location,
                   COUNT(DISTINCT p.id) AS product_count,
                   COUNT(DISTINCT pr.stakeholder_id) AS customer_count
            FROM industries i
            JOIN users u ON u.id = i.user_id
            LEFT JOIN products p ON p.industry_id = i.id AND p.is_available = TRUE
            LEFT JOIN purchase_requests pr ON pr.industry_id = i.id AND pr.status = 'approved'
            WHERE u.status = 'approved'
            GROUP BY i.id, i.company_name, i.sector, i.location
        """)
        pop_rows = query("SELECT industry_id, COUNT(*) AS cnt FROM purchase_requests WHERE status='approved' GROUP BY industry_id")
        max_cnt = max((r["cnt"] for r in pop_rows), default=1) or 1
        industry_pop = {r["industry_id"]: r["cnt"] / max_cnt for r in pop_rows}

    if not industries:
        return {"recommendations": [], "model_version": None, "recommendation_type": "none"}

    # If no meaningful input, return popular industries explicitly
    if not has_category and not has_budget and not has_history:
        popular = [
            {
                "industry_id":   ind["id"],
                "company_name":  ind.get("company_name"),
                "sector":        ind.get("sector"),
                "location":      ind.get("location"),
                "product_count": ind.get("product_count"),
                "customer_count":ind.get("customer_count"),
                "score":         industry_pop.get(ind["id"], 0.0),
                "similarity":    0.0,
                "popularity":    industry_pop.get(ind["id"], 0.0),
            }
            for ind in industries
            if ind["id"] not in already_seen
        ]
        popular.sort(key=lambda x: x["popularity"], reverse=True)
        return {
            "recommendations": popular[:top_n],
            "model_version": model.get("version") if model else None,
            "recommendation_type": "popular"
        }

    filtered = [
        i for i in industries
        if not category or category.lower() in (i.get("sector") or "").lower()
    ]
    if not filtered:
        return {"recommendations": [], "model_version": None, "recommendation_type": "none"}

    user_vec     = user_query_vec(category, budget)

    max_products  = max((i.get("product_count") or 0 for i in filtered), default=1) or 1
    max_customers = max((i.get("customer_count") or 0 for i in filtered), default=1) or 1

    scored = []
    for ind in filtered:
        iid = ind["id"]
        if iid in already_seen:
            continue

        ind_vec    = np.concatenate([cat_vec(ind.get("sector") or ""), [0.5]])
        sim        = cosine_sim(user_vec, ind_vec)
        popularity = industry_pop.get(iid, 0.0)
        prod_score = (ind.get("product_count") or 0) / max_products
        cust_score = (ind.get("customer_count") or 0) / max_customers

        score = (0.40 * sim) + (0.25 * popularity) + (0.20 * prod_score) + (0.15 * cust_score)

        scored.append({
            "industry_id":   iid,
            "company_name":  ind.get("company_name"),
            "sector":        ind.get("sector"),
            "location":      ind.get("location"),
            "product_count": ind.get("product_count"),
            "customer_count":ind.get("customer_count"),
            "score":         round(score, 4),
            "similarity":    round(sim, 4),
            "popularity":    round(popularity, 4),
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    
    # Determine recommendation type for UI feedback
    rec_type = "personalized"
    if has_category or has_budget:
        rec_type = "content_based"
    
    return {
        "recommendations": scored[:top_n],
        "model_version": model.get("version") if model else None,
        "recommendation_type": rec_type,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT: /train  (trigger retraining without restarting the service)
# ══════════════════════════════════════════════════════════════════════════════
@app.post("/train")
def trigger_training(background_tasks: BackgroundTasks):
    """
    Kick off a background retraining job.
    The new model is hot-swapped into memory when done.
    """
    def _retrain():
        global _model
        print("[/train] Background retraining started...")
        try:
            from train_model import train
            train()
            with _model_lock:
                from model_store import load_model
                _model = load_model()
            print("[/train] Model hot-swapped successfully.")
        except Exception as e:
            print(f"[/train] Retraining failed: {e}")

    background_tasks.add_task(_retrain)
    return {"message": "Retraining started in background. Model will be hot-swapped when done."}


# ── Health / info ──────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    model = get_model()
    return {
        "status":        "ok",
        "service":       "EthioBridge ML Service",
        "model_loaded":  model is not None,
        "model_version": model.get("version") if model else None,
        "trained_at":    model.get("trained_at") if model else None,
    }
