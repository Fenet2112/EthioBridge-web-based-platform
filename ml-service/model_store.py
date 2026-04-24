"""
model_store.py — kept for backward compatibility.
All functionality has moved to preprocessor.py.
"""
from preprocessor import (
    DataPreprocessor,
    CATEGORIES,
    MODEL_DIR,
    MODEL_PATH,
    MAX_PRICE,
)

# Legacy aliases so any old imports still work
def cat_vec(text):
    return DataPreprocessor().query_vector(text, 0)[:len(CATEGORIES)]

def normalize_price(price, max_price=MAX_PRICE):
    if price is None:
        return 0.5
    return float(min(float(price) / max_price, 1.0))

def product_feature_vec(category, name, price):
    p = {"category": category or "", "name": name or "",
         "sector": "other", "business_role": "other", "price": price}
    return DataPreprocessor().product_feature_vector(p)

def user_query_vec(category, budget):
    return DataPreprocessor().query_vector(category or "", budget or 0)

import pickle, os

def save_model(payload):
    os.makedirs(MODEL_DIR, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(payload, f)
    print(f"[model_store] Saved → {MODEL_PATH}")

def load_model():
    if not os.path.exists(MODEL_PATH):
        return None
    with open(MODEL_PATH, "rb") as f:
        return pickle.load(f)
