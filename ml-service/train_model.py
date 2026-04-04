"""
EthioBridge ML Training Pipeline
=================================
Offline script — run manually or on a schedule.

Usage:
    python train_model.py

What it does:
    1. Fetches purchase history, products, and users from PostgreSQL
    2. Builds a user-item interaction matrix (stakeholder users × products)
    3. Trains a KNN model (cosine similarity) on that matrix
    4. Computes product and industry popularity scores
    5. Saves everything to models/knn_model.pkl

The FastAPI service (main.py) loads this file at startup.
"""

import os
import sys
import time
import numpy as np
from sklearn.neighbors import NearestNeighbors
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras

# ── Load env from backend ──────────────────────────────────────────────────────
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../backend/.env"))

from model_store import (
    CATEGORIES, product_feature_vec, save_model,
    normalize_price, cat_vec
)

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

# ── 1. Fetch data ──────────────────────────────────────────────────────────────
def fetch_interactions():
    """Approved purchase requests: stakeholder user_id → product_id."""
    return query("""
        SELECT s.user_id, pr.product_id
        FROM purchase_requests pr
        JOIN stakeholders s ON s.id = pr.stakeholder_id
        WHERE pr.status = 'approved'
    """)

def fetch_products():
    return query("""
        SELECT p.id, p.name, p.category, p.price, p.unit,
               p.image_url, p.is_available,
               i.company_name, i.sector, i.location, i.id AS industry_id
        FROM products p
        JOIN industries i ON i.id = p.industry_id
        JOIN users u ON u.id = i.user_id
        WHERE p.is_available = TRUE AND u.status = 'approved'
    """)

def fetch_industries():
    return query("""
        SELECT i.id, i.company_name, i.sector, i.location,
               COUNT(DISTINCT p.id)  AS product_count,
               COUNT(DISTINCT pr.stakeholder_id) AS customer_count
        FROM industries i
        JOIN users u ON u.id = i.user_id
        LEFT JOIN products p  ON p.industry_id = i.id AND p.is_available = TRUE
        LEFT JOIN purchase_requests pr ON pr.industry_id = i.id AND pr.status = 'approved'
        WHERE u.status = 'approved'
        GROUP BY i.id, i.company_name, i.sector, i.location
    """)

# ── 2. Build user-item matrix ──────────────────────────────────────────────────
def build_interaction_matrix(interactions):
    if not interactions:
        return None, [], []

    all_users   = sorted({r["user_id"]   for r in interactions})
    all_products = sorted({r["product_id"] for r in interactions})

    user_idx    = {u: i for i, u in enumerate(all_users)}
    product_idx = {p: i for i, p in enumerate(all_products)}

    matrix = np.zeros((len(all_users), len(all_products)), dtype=float)
    for r in interactions:
        ui = user_idx[r["user_id"]]
        pi = product_idx[r["product_id"]]
        matrix[ui][pi] = 1.0

    return matrix, all_users, all_products

# ── 3. Compute popularity scores ───────────────────────────────────────────────
def compute_product_popularity(interactions):
    counts = {}
    for r in interactions:
        counts[r["product_id"]] = counts.get(r["product_id"], 0) + 1
    if not counts:
        return {}
    max_cnt = max(counts.values())
    return {pid: cnt / max_cnt for pid, cnt in counts.items()}

def compute_industry_popularity(interactions):
    # Use purchase_requests directly for industry counts
    rows = query("""
        SELECT industry_id, COUNT(*) AS cnt
        FROM purchase_requests WHERE status = 'approved'
        GROUP BY industry_id
    """)
    counts = {r["industry_id"]: r["cnt"] for r in rows}
    if not counts:
        return {}
    max_cnt = max(counts.values())
    return {iid: cnt / max_cnt for iid, cnt in counts.items()}

# ── 4. Build product feature matrix ───────────────────────────────────────────
def build_product_features(products):
    """Returns (feature_matrix, product_ids) aligned by row index."""
    product_ids = [p["id"] for p in products]
    features = np.array([
        product_feature_vec(p["category"], p["name"], p["price"])
        for p in products
    ], dtype=float)
    return features, product_ids

# ── 5. Train KNN ───────────────────────────────────────────────────────────────
def train_knn(matrix, n_neighbors=10):
    if matrix is None or matrix.shape[0] < 2:
        print("[train] Not enough users for KNN — skipping KNN training.")
        return None
    k = min(n_neighbors + 1, matrix.shape[0])
    knn = NearestNeighbors(n_neighbors=k, metric="cosine", algorithm="brute")
    knn.fit(matrix)
    print(f"[train] KNN trained on {matrix.shape[0]} users × {matrix.shape[1]} products")
    return knn

# ── Main ───────────────────────────────────────────────────────────────────────
def train():
    start = time.time()
    print("=" * 55)
    print("  EthioBridge ML Training Pipeline")
    print("=" * 55)

    # Fetch
    print("\n[1/5] Fetching data from database...")
    interactions = fetch_interactions()
    products     = fetch_products()
    industries   = fetch_industries()
    print(f"      {len(interactions)} interactions | {len(products)} products | {len(industries)} industries")

    # Interaction matrix
    print("\n[2/5] Building user-item interaction matrix...")
    matrix, all_users, all_products = build_interaction_matrix(interactions)
    if matrix is not None:
        print(f"      Matrix shape: {matrix.shape}")
    else:
        print("      No interactions yet — KNN will be skipped.")

    # Popularity
    print("\n[3/5] Computing popularity scores...")
    product_pop  = compute_product_popularity(interactions)
    industry_pop = compute_industry_popularity(interactions)
    print(f"      {len(product_pop)} products with popularity | {len(industry_pop)} industries")

    # Product feature matrix (for content-based similarity)
    print("\n[4/5] Building product feature vectors...")
    product_features, product_ids = build_product_features(products)
    print(f"      Feature matrix: {product_features.shape}")

    # Train KNN
    print("\n[5/5] Training KNN model...")
    knn_model = train_knn(matrix)

    # Build product lookup dict
    product_lookup = {p["id"]: p for p in products}
    industry_lookup = {i["id"]: i for i in industries}

    # Save
    payload = {
        "version":         time.strftime("%Y%m%d_%H%M%S"),
        "knn_model":       knn_model,
        "user_index":      {u: i for i, u in enumerate(all_users)} if all_users else {},
        "product_index":   {p: i for i, p in enumerate(all_products)} if all_products else {},
        "all_users":       all_users,
        "all_products":    all_products,
        "product_features": product_features,
        "product_ids":     product_ids,
        "product_lookup":  product_lookup,
        "industry_lookup": industry_lookup,
        "product_pop":     product_pop,
        "industry_pop":    industry_pop,
        "categories":      CATEGORIES,
        "trained_at":      time.strftime("%Y-%m-%d %H:%M:%S"),
    }

    save_model(payload)

    elapsed = time.time() - start
    print(f"\n✅ Training complete in {elapsed:.2f}s")
    print(f"   Model version : {payload['version']}")
    print(f"   Saved to      : models/knn_model.pkl")
    print("=" * 55)

if __name__ == "__main__":
    train()
