"""
EthioBridge ML Training Pipeline
=================================
Offline script — run manually or on a schedule.

Usage:
    python train_model.py

Pipeline:
    1. Fetch raw data from PostgreSQL
    2. Clean & deduplicate (DataPreprocessor)
    3. Encode categorical features (category, sector, business_role)
    4. Normalise numerical features (price)
    5. Build user-item interaction matrix
    6. Build product feature matrix
    7. Train KNN collaborative filter on interaction matrix
    8. Train SVD (TruncatedSVD) on interaction matrix for latent factors
    9. Compute popularity scores
   10. Save model + preprocessor to models/knn_model.pkl
"""

import os
import sys
import time
import numpy as np
import pickle
from sklearn.neighbors import NearestNeighbors
from sklearn.decomposition import TruncatedSVD
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../backend/.env"))

from preprocessor import DataPreprocessor, MODEL_DIR, MODEL_PATH

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

# ── 1. Fetch raw data ──────────────────────────────────────────────────────────
def fetch_interactions():
    """All approved purchase requests: stakeholder user_id → product_id."""
    return query("""
        SELECT s.user_id, pr.product_id, pr.quantity,
               pr.created_at, pr.status
        FROM purchase_requests pr
        JOIN stakeholders s ON s.id = pr.stakeholder_id
        WHERE pr.status IN ('approved', 'completed')
    """)

def fetch_products():
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

def fetch_industries():
    return query("""
        SELECT i.id, i.company_name, i.sector, i.location,
               COALESCE(i.business_role, 'other') AS business_role,
               COUNT(DISTINCT p.id)  AS product_count,
               COUNT(DISTINCT pr.stakeholder_id) AS customer_count
        FROM industries i
        JOIN users u ON u.id = i.user_id
        LEFT JOIN products p  ON p.industry_id = i.id AND p.is_available = TRUE
        LEFT JOIN purchase_requests pr ON pr.industry_id = i.id
                  AND pr.status IN ('approved', 'completed')
        WHERE u.status = 'approved'
        GROUP BY i.id, i.company_name, i.sector, i.location, i.business_role
    """)

def fetch_users():
    """Stakeholder users with their profile data."""
    return query("""
        SELECT u.id, u.role, u.status,
               s.organization_type, s.location AS stakeholder_location
        FROM users u
        LEFT JOIN stakeholders s ON s.user_id = u.id
        WHERE u.role = 'stakeholder' AND u.status = 'approved'
    """)

# ── 2. Popularity scores ───────────────────────────────────────────────────────
def compute_popularity(interactions: list[dict], key: str) -> dict:
    counts = {}
    for r in interactions:
        k = r.get(key)
        if k:
            counts[k] = counts.get(k, 0) + 1
    if not counts:
        return {}
    max_cnt = max(counts.values())
    return {k: v / max_cnt for k, v in counts.items()}

def compute_industry_popularity() -> dict:
    rows = query("""
        SELECT industry_id, COUNT(*) AS cnt
        FROM purchase_requests
        WHERE status IN ('approved', 'completed')
        GROUP BY industry_id
    """)
    if not rows:
        return {}
    max_cnt = max(r["cnt"] for r in rows)
    return {r["industry_id"]: r["cnt"] / max_cnt for r in rows}

# ── 3. Train KNN collaborative filter ─────────────────────────────────────────
def train_knn(matrix: np.ndarray, n_neighbors: int = 10):
    if matrix is None or matrix.shape[0] < 2:
        print("[train] Not enough users for KNN — skipping.")
        return None
    k = min(n_neighbors + 1, matrix.shape[0])
    knn = NearestNeighbors(n_neighbors=k, metric="cosine", algorithm="brute")
    knn.fit(matrix)
    print(f"[train] KNN trained: {matrix.shape[0]} users × {matrix.shape[1]} products")
    return knn

# ── 4. Train SVD for latent factors ───────────────────────────────────────────
def train_svd(matrix: np.ndarray, n_components: int = 20):
    if matrix is None or matrix.shape[0] < 2 or matrix.shape[1] < 2:
        print("[train] Not enough data for SVD — skipping.")
        return None, None
    n_comp = min(n_components, min(matrix.shape) - 1)
    svd = TruncatedSVD(n_components=n_comp, random_state=42)
    user_factors = svd.fit_transform(matrix)
    print(f"[train] SVD trained: {n_comp} latent factors, "
          f"explained variance: {svd.explained_variance_ratio_.sum():.2%}")
    return svd, user_factors

# ── 5. Evaluate (basic) ────────────────────────────────────────────────────────
def evaluate_model(knn, matrix, all_users, all_products):
    """
    Simple leave-one-out evaluation on users with ≥2 interactions.
    Reports Hit Rate@10: fraction of users where the held-out item
    appears in the top-10 KNN recommendations.
    """
    if knn is None or matrix is None:
        return None

    eligible = [i for i in range(matrix.shape[0]) if matrix[i].sum() >= 2]
    if not eligible:
        return None

    hits = 0
    for ui in eligible[:min(100, len(eligible))]:  # cap at 100 for speed
        row = matrix[ui].copy()
        # Hold out one random positive
        pos_indices = np.where(row > 0)[0]
        held_out = np.random.choice(pos_indices)
        row[held_out] = 0.0

        distances, indices = knn.kneighbors(row.reshape(1, -1))
        # Get products liked by similar users
        similar_users = [idx for idx in indices[0] if idx != ui]
        rec_products = set()
        for su in similar_users:
            rec_products.update(np.where(matrix[su] > 0)[0])
        if held_out in list(rec_products)[:10]:
            hits += 1

    hit_rate = hits / len(eligible[:100])
    print(f"[eval] Hit Rate@10 = {hit_rate:.3f} ({hits}/{min(100, len(eligible))} users)")
    return hit_rate

# ── Main ───────────────────────────────────────────────────────────────────────
def train():
    start = time.time()
    print("=" * 60)
    print("  EthioBridge ML Training Pipeline v2")
    print("=" * 60)

    # ── Step 1: Fetch ──────────────────────────────────────────────────────────
    print("\n[1/7] Fetching data from database...")
    raw_interactions = fetch_interactions()
    raw_products     = fetch_products()
    industries       = fetch_industries()
    users            = fetch_users()
    print(f"      {len(raw_interactions)} interactions | {len(raw_products)} products | "
          f"{len(industries)} industries | {len(users)} stakeholders")

    # ── Step 2: Preprocess ─────────────────────────────────────────────────────
    print("\n[2/7] Preprocessing & feature engineering...")
    preprocessor = DataPreprocessor()

    products     = preprocessor.clean_products(raw_products)
    interactions = preprocessor.clean_interactions(raw_interactions)
    preprocessor.fit(products)

    print(f"      After cleaning: {len(products)} products, {len(interactions)} interactions")
    print(f"      Categories encoded: {len(preprocessor.category_encoder.classes_)}")
    print(f"      Sectors encoded:    {len(preprocessor.sector_encoder.classes_)}")
    print(f"      Roles encoded:      {len(preprocessor.role_encoder.classes_)}")

    # ── Step 3: Build matrices ─────────────────────────────────────────────────
    print("\n[3/7] Building feature matrices...")
    product_matrix, product_ids = preprocessor.build_product_matrix(products)
    print(f"      Product feature matrix: {product_matrix.shape}")

    interaction_matrix, all_users, all_products = \
        preprocessor.build_interaction_matrix(interactions)
    if interaction_matrix is not None:
        sparsity = 1.0 - interaction_matrix.sum() / interaction_matrix.size
        print(f"      Interaction matrix: {interaction_matrix.shape}, "
              f"sparsity: {sparsity:.1%}")
    else:
        print("      No interactions — collaborative filtering will be skipped.")

    # ── Step 4: Popularity ─────────────────────────────────────────────────────
    print("\n[4/7] Computing popularity scores...")
    product_pop  = compute_popularity(interactions, "product_id")
    industry_pop = compute_industry_popularity()
    print(f"      {len(product_pop)} products with scores | {len(industry_pop)} industries")

    # ── Step 5: Train KNN ──────────────────────────────────────────────────────
    print("\n[5/7] Training KNN collaborative filter...")
    knn_model = train_knn(interaction_matrix)

    # ── Step 6: Train SVD ──────────────────────────────────────────────────────
    print("\n[6/7] Training SVD latent factor model...")
    svd_model, user_factors = train_svd(interaction_matrix)

    # ── Step 7: Evaluate ───────────────────────────────────────────────────────
    print("\n[7/7] Evaluating model...")
    hit_rate = evaluate_model(knn_model, interaction_matrix, all_users, all_products)

    # ── Save ───────────────────────────────────────────────────────────────────
    product_lookup  = {p["id"]: p for p in products}
    industry_lookup = {i["id"]: i for i in industries}

    payload = {
        # Metadata
        "version":          time.strftime("%Y%m%d_%H%M%S"),
        "trained_at":       time.strftime("%Y-%m-%d %H:%M:%S"),
        "hit_rate_at_10":   hit_rate,

        # Collaborative filtering
        "knn_model":        knn_model,
        "svd_model":        svd_model,
        "user_factors":     user_factors,
        "user_index":       {u: i for i, u in enumerate(all_users)} if all_users else {},
        "product_index":    {p: i for i, p in enumerate(all_products)} if all_products else {},
        "all_users":        all_users,
        "all_products":     all_products,
        "interaction_matrix": interaction_matrix,

        # Content-based
        "product_features": product_matrix,
        "product_ids":      product_ids,

        # Lookups
        "product_lookup":   product_lookup,
        "industry_lookup":  industry_lookup,

        # Popularity
        "product_pop":      product_pop,
        "industry_pop":     industry_pop,

        # Preprocessor (for identical inference encoding)
        "preprocessor":     preprocessor,
    }

    os.makedirs(MODEL_DIR, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(payload, f)

    elapsed = time.time() - start
    print(f"\n✅ Training complete in {elapsed:.2f}s")
    print(f"   Model version : {payload['version']}")
    print(f"   Saved to      : {MODEL_PATH}")
    if hit_rate is not None:
        print(f"   Hit Rate@10   : {hit_rate:.3f}")
    print("=" * 60)

if __name__ == "__main__":
    train()
