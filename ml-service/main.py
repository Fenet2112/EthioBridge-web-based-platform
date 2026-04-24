"""
EthioBridge Hybrid Recommendation Service — Inference API v2
=============================================================
FastAPI service that loads a pre-trained model and serves recommendations.

Startup:
    1. Run  python train_model.py  to build models/knn_model.pkl
    2. Run  uvicorn main:app --reload --port 8000

Recommendation strategy (in priority order):
    1. Collaborative (KNN/SVD) — if user has purchase history
    2. Content-based — if user provides category/budget filter
    3. Popular — fallback when no signal available
"""

from fastapi import FastAPI, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
import psycopg2.extras
import numpy as np
import pickle
import os
import threading
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../backend/.env"))

from preprocessor import DataPreprocessor, MODEL_PATH

app = FastAPI(title="EthioBridge ML Service", version="3.0.0")

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
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            _model = pickle.load(f)
        print(f"[startup] Model v{_model.get('version')} loaded "
              f"(trained {_model.get('trained_at')})")
        if _model.get("hit_rate_at_10") is not None:
            print(f"[startup] Hit Rate@10 = {_model['hit_rate_at_10']:.3f}")
    else:
        print("[startup] No model found. Run  python train_model.py  first.")
        print("[startup] Falling back to popularity-based recommendations.")

# ── DB helpers ─────────────────────────────────────────────────────────────────
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

# ── Live data helpers ──────────────────────────────────────────────────────────
def user_product_interactions(user_id: int) -> list[dict]:
    return query("""
        SELECT s.user_id, pr.product_id
        FROM purchase_requests pr
        JOIN stakeholders s ON s.id = pr.stakeholder_id
        WHERE s.user_id = %s AND pr.status IN ('approved', 'completed')
    """, (user_id,))

def user_industry_interactions(user_id: int) -> set:
    rows = query("""
        SELECT DISTINCT pr.industry_id
        FROM purchase_requests pr
        JOIN stakeholders s ON s.id = pr.stakeholder_id
        WHERE s.user_id = %s AND pr.status IN ('approved', 'completed')
    """, (user_id,))
    return {r["industry_id"] for r in rows}

def live_products():
    return query("""
        SELECT p.id, p.name, p.category, p.price, p.unit,
               p.image_url, p.is_available, p.discount_percentage,
               i.company_name, i.sector, i.location, i.id AS industry_id,
               COALESCE(i.business_role, 'other') AS business_role
        FROM products p
        JOIN industries i ON i.id = p.industry_id
        JOIN users u ON u.id = i.user_id
        WHERE p.is_available = TRUE AND u.status = 'approved'
    """)

def live_popularity():
    rows = query("""
        SELECT product_id, COUNT(*) AS cnt
        FROM purchase_requests
        WHERE status IN ('approved', 'completed')
        GROUP BY product_id
    """)
    if not rows:
        return {}
    max_cnt = max(r["cnt"] for r in rows)
    return {r["product_id"]: r["cnt"] / max_cnt for r in rows}

# ── Cosine similarity ──────────────────────────────────────────────────────────
def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom > 0 else 0.0

# ── Collaborative boost via KNN ────────────────────────────────────────────────
def knn_collaborative_boost(user_id: int, model: dict, interactions: list[dict]) -> dict:
    """
    Find similar users via KNN, return {product_id: boost_score}.
    Uses the pre-trained interaction matrix row for the user.
    """
    knn         = model.get("knn_model")
    user_index  = model.get("user_index", {})
    all_users   = model.get("all_users", [])
    all_products = model.get("all_products", [])
    matrix      = model.get("interaction_matrix")

    if knn is None or matrix is None or user_id not in user_index:
        return {}

    ui  = user_index[user_id]
    row = matrix[ui].copy()

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

    placeholders = ",".join(["%s"] * len(similar_user_ids))
    rows = query(f"""
        SELECT pr.product_id, COUNT(*) AS cnt
        FROM purchase_requests pr
        JOIN stakeholders s ON s.id = pr.stakeholder_id
        WHERE s.user_id IN ({placeholders})
          AND pr.status IN ('approved', 'completed')
        GROUP BY pr.product_id
    """, tuple(similar_user_ids))

    if not rows:
        return {}
    max_cnt = max(r["cnt"] for r in rows)
    return {r["product_id"]: r["cnt"] / max_cnt for r in rows}

# ── SVD collaborative boost ────────────────────────────────────────────────────
def svd_collaborative_boost(user_id: int, model: dict) -> dict:
    """
    Use SVD latent factors to find similar users and their products.
    Complements KNN for users with sparse history.
    """
    svd          = model.get("svd_model")
    user_factors = model.get("user_factors")
    user_index   = model.get("user_index", {})
    all_users    = model.get("all_users", [])
    matrix       = model.get("interaction_matrix")

    if svd is None or user_factors is None or user_id not in user_index:
        return {}

    ui         = user_index[user_id]
    user_vec   = user_factors[ui]
    sims       = user_factors @ user_vec / (
        np.linalg.norm(user_factors, axis=1) * np.linalg.norm(user_vec) + 1e-9
    )
    sims[ui]   = -1  # exclude self
    top_k      = np.argsort(sims)[-5:][::-1]
    similar_ids = [all_users[i] for i in top_k if sims[i] > 0]

    if not similar_ids or matrix is None:
        return {}

    boost = {}
    for su_id in similar_ids:
        su_idx = user_index.get(su_id)
        if su_idx is None:
            continue
        for pi, val in enumerate(matrix[su_idx]):
            if val > 0:
                pid = model["all_products"][pi] if pi < len(model["all_products"]) else None
                if pid:
                    boost[pid] = boost.get(pid, 0.0) + val * sims[user_index[su_id]]

    if not boost:
        return {}
    max_b = max(boost.values())
    return {k: v / max_b for k, v in boost.items()}

# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT: /recommend/products
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/recommend/products")
def recommend_products(
    user_id: int   = Query(...),
    category: str  = Query(default=""),
    budget: float  = Query(default=0),
    top_n: int     = Query(default=10),
):
    model = get_model()

    # ── Get user's purchase history ──────────────────────────────────────────
    interactions  = user_product_interactions(user_id)
    already_seen  = {r["product_id"] for r in interactions}
    has_history   = len(already_seen) > 0
    has_category  = bool(category and category.strip())
    has_budget    = budget > 0

    # ── Get products (from model cache or live DB) ───────────────────────────
    if model and model.get("product_lookup"):
        products    = list(model["product_lookup"].values())
        product_pop = model.get("product_pop", {})
        preprocessor: DataPreprocessor = model.get("preprocessor")
    else:
        products    = live_products()
        product_pop = live_popularity()
        preprocessor = None

    if not products:
        return {"recommendations": [], "recommendation_type": "none", "model_version": None}

    # ── Pure popularity fallback (no signal at all) ──────────────────────────
    if not has_history and not has_category and not has_budget:
        popular = sorted(
            [
                {
                    "product_id":   p["id"],
                    "name":         p.get("name"),
                    "category":     p.get("category"),
                    "price":        float(p["price"]) if p.get("price") else None,
                    "unit":         p.get("unit"),
                    "image_url":    p.get("image_url"),
                    "company_name": p.get("company_name"),
                    "industry_id":  p.get("industry_id"),
                    "location":     p.get("location"),
                    "business_role":p.get("business_role"),
                    "discount_percentage": p.get("discount_percentage"),
                    "score":        product_pop.get(p["id"], 0.0),
                    "recommendation_basis": "popular",
                }
                for p in products if p["id"] not in already_seen
            ],
            key=lambda x: x["score"],
            reverse=True,
        )
        return {
            "recommendations":    popular[:top_n],
            "recommendation_type": "popular",
            "model_version":      model.get("version") if model else None,
        }

    # ── Collaborative boosts ─────────────────────────────────────────────────
    knn_boost = knn_collaborative_boost(user_id, model, interactions) if model else {}
    svd_boost = svd_collaborative_boost(user_id, model) if model else {}

    # ── Content-based query vector ───────────────────────────────────────────
    if preprocessor:
        query_vec = preprocessor.query_vector(category, budget)
    else:
        # Fallback: simple keyword + price vector
        from preprocessor import DataPreprocessor as DP
        tmp = DP()
        query_vec = tmp.query_vector(category, budget)

    # ── Filter by category (soft) ────────────────────────────────────────────
    if has_category:
        cat_lower = category.lower()
        candidates = [
            p for p in products
            if cat_lower in (p.get("category") or "").lower()
            or cat_lower in (p.get("name") or "").lower()
        ] or products  # fall back to all if no match
    else:
        candidates = products

    # ── Score each candidate ─────────────────────────────────────────────────
    scored = []
    for p in candidates:
        pid = p["id"]
        if pid in already_seen:
            continue

        # Content similarity
        if preprocessor:
            p_vec = preprocessor.product_feature_vector(p)
        else:
            from preprocessor import DataPreprocessor as DP
            tmp = DP()
            p_vec = tmp.product_feature_vector(p)

        content_sim  = cosine_sim(query_vec, p_vec)
        popularity   = product_pop.get(pid, 0.0)
        knn_score    = knn_boost.get(pid, 0.0)
        svd_score    = svd_boost.get(pid, 0.0)
        collab_score = 0.6 * knn_score + 0.4 * svd_score

        # Soft budget penalty
        budget_penalty = 0.0
        if has_budget and p.get("price"):
            price = float(p["price"])
            if price > budget:
                over_ratio     = min((price - budget) / budget, 1.0)
                budget_penalty = 0.25 * over_ratio

        # Weighted hybrid score
        if has_history:
            # Personalised: collaborative dominates
            score = (0.35 * content_sim + 0.25 * popularity
                     + 0.40 * collab_score - budget_penalty)
            basis = "collaborative"
        else:
            # No history: content + popularity
            score = (0.55 * content_sim + 0.45 * popularity - budget_penalty)
            basis = "content_based"

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
            "business_role": p.get("business_role"),
            "discount_percentage": p.get("discount_percentage"),
            "score":         round(score, 4),
            "content_sim":   round(content_sim, 4),
            "popularity":    round(popularity, 4),
            "collab_score":  round(collab_score, 4),
            "over_budget":   has_budget and p.get("price") and float(p["price"]) > budget,
            "recommendation_basis": basis,
        })

    scored.sort(key=lambda x: x["score"], reverse=True)

    rec_type = "collaborative" if has_history and (knn_boost or svd_boost) else "content_based"

    return {
        "recommendations":    scored[:top_n],
        "recommendation_type": rec_type,
        "model_version":      model.get("version") if model else None,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT: /recommend/industries
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/recommend/industries")
def recommend_industries(
    user_id: int   = Query(...),
    category: str  = Query(default=""),
    budget: float  = Query(default=0),
    top_n: int     = Query(default=10),
):
    model = get_model()

    already_seen = user_industry_interactions(user_id)
    has_category = bool(category and category.strip())

    if model and model.get("industry_lookup"):
        industries   = list(model["industry_lookup"].values())
        industry_pop = model.get("industry_pop", {})
        preprocessor = model.get("preprocessor")
    else:
        industries   = query("""
            SELECT i.id, i.company_name, i.sector, i.location,
                   COALESCE(i.business_role,'other') AS business_role,
                   COUNT(DISTINCT p.id) AS product_count,
                   COUNT(DISTINCT pr.stakeholder_id) AS customer_count
            FROM industries i JOIN users u ON u.id = i.user_id
            LEFT JOIN products p ON p.industry_id = i.id AND p.is_available = TRUE
            LEFT JOIN purchase_requests pr ON pr.industry_id = i.id
                      AND pr.status IN ('approved','completed')
            WHERE u.status = 'approved'
            GROUP BY i.id, i.company_name, i.sector, i.location, i.business_role
        """)
        rows = query("""
            SELECT industry_id, COUNT(*) AS cnt FROM purchase_requests
            WHERE status IN ('approved','completed') GROUP BY industry_id
        """)
        max_cnt = max((r["cnt"] for r in rows), default=1) or 1
        industry_pop = {r["industry_id"]: r["cnt"] / max_cnt for r in rows}
        preprocessor = None

    if not industries:
        return {"recommendations": [], "recommendation_type": "none", "model_version": None}

    if preprocessor:
        query_vec = preprocessor.query_vector(category, budget)
    else:
        from preprocessor import DataPreprocessor as DP
        query_vec = DP().query_vector(category, budget)

    max_products  = max((i.get("product_count") or 0 for i in industries), default=1) or 1
    max_customers = max((i.get("customer_count") or 0 for i in industries), default=1) or 1

    scored = []
    for ind in industries:
        iid = ind["id"]
        if iid in already_seen:
            continue

        # Build industry vector using same preprocessor
        if preprocessor:
            ind_p = {
                "category": ind.get("sector", "other"),
                "name": ind.get("company_name", ""),
                "sector": ind.get("sector", "other"),
                "business_role": ind.get("business_role", "other"),
                "price": 0,
            }
            ind_vec = preprocessor.product_feature_vector(ind_p)
        else:
            from preprocessor import DataPreprocessor as DP
            ind_vec = DP().query_vector(ind.get("sector", ""), 0)

        sim        = cosine_sim(query_vec, ind_vec)
        popularity = industry_pop.get(iid, 0.0)
        prod_score = (ind.get("product_count") or 0) / max_products
        cust_score = (ind.get("customer_count") or 0) / max_customers

        score = 0.35 * sim + 0.25 * popularity + 0.25 * prod_score + 0.15 * cust_score

        scored.append({
            "industry_id":   iid,
            "company_name":  ind.get("company_name"),
            "sector":        ind.get("sector"),
            "location":      ind.get("location"),
            "business_role": ind.get("business_role"),
            "product_count": ind.get("product_count"),
            "customer_count":ind.get("customer_count"),
            "score":         round(score, 4),
            "similarity":    round(sim, 4),
            "popularity":    round(popularity, 4),
        })

    scored.sort(key=lambda x: x["score"], reverse=True)

    return {
        "recommendations":    scored[:top_n],
        "recommendation_type": "content_based" if has_category else "popular",
        "model_version":      model.get("version") if model else None,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT: /train
# ══════════════════════════════════════════════════════════════════════════════
@app.post("/train")
def trigger_training(background_tasks: BackgroundTasks):
    def _retrain():
        global _model
        print("[/train] Background retraining started...")
        try:
            from train_model import train
            train()
            with _model_lock:
                with open(MODEL_PATH, "rb") as f:
                    _model = pickle.load(f)
            print("[/train] Model hot-swapped successfully.")
        except Exception as e:
            print(f"[/train] Retraining failed: {e}")

    background_tasks.add_task(_retrain)
    return {"message": "Retraining started in background."}


# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    model = get_model()
    return {
        "status":          "ok",
        "service":         "EthioBridge ML Service v3",
        "model_loaded":    model is not None,
        "model_version":   model.get("version") if model else None,
        "trained_at":      model.get("trained_at") if model else None,
        "hit_rate_at_10":  model.get("hit_rate_at_10") if model else None,
    }
