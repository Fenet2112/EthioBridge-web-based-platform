"""
Shared preprocessing constants and model persistence helpers.
Both train_model.py and main.py import from here to guarantee
identical feature engineering in training and inference.
"""

import os
import pickle
import numpy as np

# ── Feature constants ──────────────────────────────────────────────────────────
CATEGORIES = [
    "cement", "steel", "brick", "wood", "paint", "sand", "glass",
    "tile", "concrete", "pipe", "electrical", "tool", "roof", "other",
]

MAX_PRICE = 500_000   # normalisation ceiling

MODEL_DIR  = os.path.join(os.path.dirname(__file__), "models")
MODEL_PATH = os.path.join(MODEL_DIR, "knn_model.pkl")

# ── Feature engineering ────────────────────────────────────────────────────────
def cat_vec(text: str) -> np.ndarray:
    """One-hot encode a category / sector string against CATEGORIES."""
    t = (text or "").lower()
    return np.array([1.0 if c in t else 0.0 for c in CATEGORIES], dtype=float)

def normalize_price(price, max_price: float = MAX_PRICE) -> float:
    if price is None:
        return 0.5
    return float(min(float(price) / max_price, 1.0))

def product_feature_vec(category: str, name: str, price) -> np.ndarray:
    """Build the (len(CATEGORIES)+1,) feature vector for a product."""
    cv = cat_vec((category or "") + " " + (name or ""))
    pv = np.array([normalize_price(price)], dtype=float)
    return np.concatenate([cv, pv])

def user_query_vec(category: str, budget: float) -> np.ndarray:
    """Build the query vector from user-supplied filters."""
    cv = cat_vec(category) if category else np.full(len(CATEGORIES), 0.5)
    pv = np.array([normalize_price(budget) if budget > 0 else 0.5], dtype=float)
    return np.concatenate([cv, pv])

# ── Persistence ────────────────────────────────────────────────────────────────
def save_model(payload: dict):
    os.makedirs(MODEL_DIR, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(payload, f)
    print(f"[model_store] Model saved → {MODEL_PATH}")

def load_model() -> dict | None:
    if not os.path.exists(MODEL_PATH):
        return None
    with open(MODEL_PATH, "rb") as f:
        payload = pickle.load(f)
    print(f"[model_store] Model loaded ← {MODEL_PATH}")
    return payload
