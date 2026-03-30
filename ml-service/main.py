"""
EthioBridge Hybrid Recommendation Service
FastAPI + scikit-learn (cosine similarity + KNN)
Port: 8000
"""

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
import psycopg2.extras
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.neighbors import NearestNeighbors
from dotenv import load_dotenv
import os
import re

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../backend/.env"))

app = FastAPI(title="EthioBridge ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── DB connection ──────────────────────────────────────────────────────────────
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

# ── Category encoding ──────────────────────────────────────────────────────────
CATEGORIES = [
    "cement", "steel", "brick", "wood", "paint", "sand", "glass",
    "tile", "concrete", "pipe", "electrical", "tool", "roof", "other",
]

def cat_vec(text: str) -> list:
    """One-hot encode a category string."""
    t = (text or "").lower()
    return [1.0 if c in t else 0.0 for c in CATEGORIES]

def normalize_price(price, max_price=500_000):
    if price is None:
        return 0.5
    return min(float(price) / max_price, 1.0)

# ── Cosine similarity helper ───────────────────────────────────────────────────
def cosine_sim(a, b):
    a, b = np.array(a, dtype=float), np.array(b, dtype=float)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom > 0 else 0.0

# ── Popularity score (purchase request count) ─────────────────────────────────
def product_popularity() -> dict:
    rows = query("""
        SELECT product_id, COUNT(*) AS cnt
        FROM purchase_requests
        WHERE status = 'approved'
        GROUP BY product_id
    """)
    counts = {r["product_id"]: r["cnt"] for r in rows}
    if not counts:
        return {}
    max_cnt = max(counts.values())
    return {pid: cnt / max_cnt for pid, cnt in counts.items()}

def industry_popularity() -> dict:
    rows = query("""
        SELECT industry_id, COUNT(*) AS cnt
        FROM purchase_requests
        WHERE status = 'approved'
        GROUP BY industry_id
    """)
    counts = {r["industry_id"]: r["cnt"] for r in rows}
    if not counts:
        return {}
    max_cnt = max(counts.values())
    return {iid: cnt / max_cnt for iid, cnt in counts.items()}

# ── User interaction history ───────────────────────────────────────────────────
def user_product_interactions(user_id: int) -> set:
    """Products this user has already requested."""
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

# ── KNN: find similar users ────────────────────────────────────────────────────
def knn_similar_users(user_id: int, role: str, n_neighbors: int = 5) -> list:
    """
    Build a user-item interaction matrix and find the N most similar users.
    Returns list of similar user_ids.
    """
    if role == "stakeholder":
        rows = query("""
            SELECT s.user_id, pr.product_id
            FROM purchase_requests pr
            JOIN stakeholders s ON s.id = pr.stakeholder_id
            WHERE pr.status = 'approved'
        """)
        item_key = "product_id"
    else:
        return []

    if not rows:
        return []

    # Build interaction matrix
    all_users = list({r["user_id"] for r in rows})
    all_items = list({r[item_key] for r in rows})
    if len(all_users) < 2:
        return []

    user_idx = {u: i for i, u in enumerate(all_users)}
    item_idx = {it: i for i, it in enumerate(all_items)}

    matrix = np.zeros((len(all_users), len(all_items)))
    for r in rows:
        ui = user_idx.get(r["user_id"])
        ii = item_idx.get(r[item_key])
        if ui is not None and ii is not None:
            matrix[ui][ii] = 1.0

    if user_id not in user_idx:
        return []

    k = min(n_neighbors + 1, len(all_users))
    knn = NearestNeighbors(n_neighbors=k, metric="cosine", algorithm="brute")
    knn.fit(matrix)

    target_vec = matrix[user_idx[user_id]].reshape(1, -1)
    distances, indices = knn.kneighbors(target_vec)

    similar = []
    for dist, idx in zip(distances[0], indices[0]):
        uid = all_users[idx]
        if uid != user_id:
            similar.append(uid)
    return similar[:n_neighbors]

def knn_boosted_products(similar_users: list) -> dict:
    """Products liked by similar users → boost scores."""
    if not similar_users:
        return {}
    placeholders = ",".join(["%s"] * len(similar_users))
    rows = query(f"""
        SELECT pr.product_id, COUNT(*) AS cnt
        FROM purchase_requests pr
        JOIN stakeholders s ON s.id = pr.stakeholder_id
        WHERE s.user_id IN ({placeholders}) AND pr.status = 'approved'
        GROUP BY pr.product_id
    """, tuple(similar_users))
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
    # 1. Fetch all available products
    products = query("""
        SELECT p.id, p.name, p.category, p.price, p.description,
               p.image_url, p.unit,
               i.company_name, i.sector, i.location, i.id AS industry_id
        FROM products p
        JOIN industries i ON i.id = p.industry_id
        JOIN users u ON u.id = i.user_id
        WHERE p.is_available = TRUE AND u.status = 'approved'
    """)

    if not products:
        return {"recommendations": []}

    # 2. Rule-based filter
    filtered = []
    for p in products:
        price = float(p["price"] or 0)
        if budget > 0 and price > budget:
            continue
        if category and category.lower() not in (p["category"] or "").lower() \
                and category.lower() not in (p["name"] or "").lower():
            continue
        filtered.append(p)

    if not filtered:
        filtered = products  # fallback: no filter

    # 3. User preference vector
    user_cat_vec = cat_vec(category) if category else [0.5] * len(CATEGORIES)
    user_price_norm = normalize_price(budget) if budget > 0 else 0.5
    user_vec = user_cat_vec + [user_price_norm]

    # 4. Popularity & KNN
    pop = product_popularity()
    already_seen = user_product_interactions(user_id)
    similar_users = knn_similar_users(user_id, "stakeholder")
    knn_boost = knn_boosted_products(similar_users)

    # 5. Score each product
    scored = []
    for p in filtered:
        pid = p["id"]
        if pid in already_seen:
            continue  # don't re-recommend already requested

        p_cat_vec = cat_vec((p["category"] or "") + " " + (p["name"] or ""))
        p_price_norm = normalize_price(p["price"])
        p_vec = p_cat_vec + [p_price_norm]

        sim = cosine_sim(user_vec, p_vec)
        popularity = pop.get(pid, 0.0)
        knn_score = knn_boost.get(pid, 0.0)

        # Hybrid score
        score = (0.45 * sim) + (0.30 * popularity) + (0.25 * knn_score)

        scored.append({
            "product_id": pid,
            "name": p["name"],
            "category": p["category"],
            "price": float(p["price"]) if p["price"] else None,
            "unit": p["unit"],
            "image_url": p["image_url"],
            "company_name": p["company_name"],
            "industry_id": p["industry_id"],
            "location": p["location"],
            "score": round(score, 4),
            "similarity": round(sim, 4),
            "popularity": round(popularity, 4),
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return {"recommendations": scored[:top_n]}


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
    industries = query("""
        SELECT i.id, i.company_name, i.sector, i.location,
               i.description, i.established_year,
               COUNT(p.id) AS product_count,
               COUNT(DISTINCT pr.stakeholder_id) AS customer_count
        FROM industries i
        JOIN users u ON u.id = i.user_id
        LEFT JOIN products p ON p.industry_id = i.id AND p.is_available = TRUE
        LEFT JOIN purchase_requests pr ON pr.industry_id = i.id AND pr.status = 'approved'
        WHERE u.status = 'approved'
        GROUP BY i.id, i.company_name, i.sector, i.location, i.description, i.established_year
    """)

    if not industries:
        return {"recommendations": []}

    # Rule-based filter
    filtered = []
    for ind in industries:
        if category and category.lower() not in (ind["sector"] or "").lower():
            continue
        filtered.append(ind)

    if not filtered:
        filtered = industries

    # Popularity
    ind_pop = industry_popularity()
    already_seen = user_industry_interactions(user_id)

    # User vector
    user_cat_vec = cat_vec(category) if category else [0.5] * len(CATEGORIES)
    user_vec = user_cat_vec + [normalize_price(budget)]

    # Max values for normalization
    max_products = max((i["product_count"] or 0 for i in filtered), default=1) or 1
    max_customers = max((i["customer_count"] or 0 for i in filtered), default=1) or 1

    scored = []
    for ind in filtered:
        iid = ind["id"]
        if iid in already_seen:
            continue

        ind_cat_vec = cat_vec(ind["sector"] or "")
        ind_vec = ind_cat_vec + [0.5]  # no price for industries

        sim = cosine_sim(user_vec, ind_vec)
        popularity = ind_pop.get(iid, 0.0)
        product_score = (ind["product_count"] or 0) / max_products
        customer_score = (ind["customer_count"] or 0) / max_customers

        score = (0.40 * sim) + (0.25 * popularity) + (0.20 * product_score) + (0.15 * customer_score)

        scored.append({
            "industry_id": iid,
            "company_name": ind["company_name"],
            "sector": ind["sector"],
            "location": ind["location"],
            "product_count": ind["product_count"],
            "customer_count": ind["customer_count"],
            "score": round(score, 4),
            "similarity": round(sim, 4),
            "popularity": round(popularity, 4),
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return {"recommendations": scored[:top_n]}


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "EthioBridge ML Service"}
