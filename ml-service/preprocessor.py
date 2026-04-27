"""
EthioBridge Data Preprocessor
==============================
Handles all data cleaning, encoding, and feature engineering.
Used by both train_model.py (offline) and main.py (online inference).

Pipeline:
    1. Clean missing values
    2. Remove duplicates
    3. Encode categorical features (category, sector, business_role)
    4. Normalize numerical features (price)
    5. Build user preference vectors from purchase history
    6. Build product feature matrix
"""

import numpy as np
from sklearn.preprocessing import LabelEncoder, MinMaxScaler
import pickle
import os
from typing import Optional, List, Dict, Tuple

# ── Constants ──────────────────────────────────────────────────────────────────
CATEGORIES = [
    "cement", "steel", "brick", "wood", "paint", "sand", "glass",
    "tile", "concrete", "pipe", "electrical", "tool", "roof",
    "machinery", "chemical", "textile", "food", "other",
]

SECTORS = [
    "construction", "manufacturing", "mining", "agriculture",
    "energy", "textile", "food", "chemical", "logistics", "other",
]

BUSINESS_ROLES = [
    "supplier", "manufacturer", "producer", "distributor", "contractor", "other",
]

MAX_PRICE = 500_000.0
MODEL_DIR  = os.path.join(os.path.dirname(__file__), "models")
MODEL_PATH = os.path.join(MODEL_DIR, "knn_model.pkl")


class DataPreprocessor:
    """
    Stateful preprocessor — fit on training data, reuse for inference.
    Stores encoders so inference uses identical mappings.
    """

    def __init__(self):
        self.category_encoder    = LabelEncoder()
        self.sector_encoder      = LabelEncoder()
        self.role_encoder        = LabelEncoder()
        self.price_scaler        = MinMaxScaler()
        self._fitted             = False

    # ── Cleaning ──────────────────────────────────────────────────────────────

    @staticmethod
    def clean_products(products: List[Dict]) -> List[Dict]:
        """Remove duplicates and fill missing values."""
        seen_ids = set()
        cleaned  = []
        for p in products:
            if p.get("id") in seen_ids:
                continue
            seen_ids.add(p["id"])
            p["name"]          = (p.get("name") or "unknown").strip()
            p["category"]      = (p.get("category") or "other").strip().lower()
            p["sector"]        = (p.get("sector") or "other").strip().lower()
            p["business_role"] = (p.get("business_role") or "other").strip().lower()
            p["price"]         = float(p["price"]) if p.get("price") else 0.0
            p["location"]      = (p.get("location") or "").strip()
            cleaned.append(p)
        return cleaned

    @staticmethod
    def clean_interactions(interactions: List[Dict]) -> List[Dict]:
        """Remove duplicate (user_id, product_id) pairs."""
        seen = set()
        cleaned = []
        for r in interactions:
            key = (r.get("user_id"), r.get("product_id"))
            if None in key or key in seen:
                continue
            seen.add(key)
            cleaned.append(r)
        return cleaned

    # ── Encoding ──────────────────────────────────────────────────────────────

    def _safe_encode(self, encoder: LabelEncoder, values: list, known: list) -> np.ndarray:
        """Encode values; unseen labels map to the 'other' class."""
        result = []
        for v in values:
            v_clean = (v or "other").strip().lower()
            if v_clean not in encoder.classes_:
                v_clean = "other"
            result.append(encoder.transform([v_clean])[0])
        return np.array(result, dtype=float)

    def fit(self, products: List[Dict]):
        """Fit encoders on the full product catalogue."""
        cats   = [p["category"]      for p in products] + CATEGORIES
        sects  = [p["sector"]        for p in products] + SECTORS
        roles  = [p["business_role"] for p in products] + BUSINESS_ROLES

        self.category_encoder.fit(cats)
        self.sector_encoder.fit(sects)
        self.role_encoder.fit(roles)

        prices = np.array([[p["price"]] for p in products], dtype=float)
        if len(prices) > 0:
            self.price_scaler.fit(prices)

        self._fitted = True
        return self

    def product_feature_vector(self, product: dict) -> np.ndarray:
        """
        Build a feature vector for one product.
        Dimensions:
          - len(CATEGORIES)  : multi-hot category keywords
          - 1                : encoded category label (normalised)
          - 1                : encoded sector label (normalised)
          - 1                : encoded business_role label (normalised)
          - 1                : normalised price
          Total: len(CATEGORIES) + 4
        """
        # Multi-hot keyword match
        text = f"{product.get('category','')} {product.get('name','')}".lower()
        keyword_vec = np.array([1.0 if c in text else 0.0 for c in CATEGORIES], dtype=float)

        # Label-encoded scalars
        cat_enc  = self._safe_encode(self.category_encoder,  [product.get("category","other")],  CATEGORIES)[0]
        sect_enc = self._safe_encode(self.sector_encoder,     [product.get("sector","other")],     SECTORS)[0]
        role_enc = self._safe_encode(self.role_encoder,       [product.get("business_role","other")], BUSINESS_ROLES)[0]

        # Normalise encoded labels to [0,1]
        n_cats  = max(len(self.category_encoder.classes_), 1)
        n_sects = max(len(self.sector_encoder.classes_), 1)
        n_roles = max(len(self.role_encoder.classes_), 1)

        # Normalised price
        price = float(product.get("price") or 0.0)
        price_norm = min(price / MAX_PRICE, 1.0)

        return np.concatenate([
            keyword_vec,
            [cat_enc / n_cats, sect_enc / n_sects, role_enc / n_roles, price_norm],
        ]).astype(float)

    def build_product_matrix(self, products: List[Dict]) -> Tuple[np.ndarray, list]:
        """Returns (feature_matrix, product_ids)."""
        if not self._fitted:
            self.fit(products)
        ids      = [p["id"] for p in products]
        matrix   = np.array([self.product_feature_vector(p) for p in products], dtype=float)
        return matrix, ids

    # ── User preference vector ─────────────────────────────────────────────────

    def user_preference_vector(
        self,
        user_id: int,
        interactions: List[Dict],
        product_lookup: dict,
    ) -> np.ndarray:
        """
        Aggregate feature vectors of products the user has purchased.
        Returns the mean vector (or zero vector if no history).
        """
        user_products = [
            product_lookup[r["product_id"]]
            for r in interactions
            if r["user_id"] == user_id and r["product_id"] in product_lookup
        ]
        if not user_products:
            dim = len(CATEGORIES) + 4
            return np.zeros(dim, dtype=float)

        vecs = np.array([self.product_feature_vector(p) for p in user_products], dtype=float)
        return vecs.mean(axis=0)

    def query_vector(self, category: str = "", budget: float = 0.0) -> np.ndarray:
        """Build a query vector from user-supplied filters (for inference)."""
        text = (category or "").lower()
        keyword_vec = np.array([1.0 if c in text else 0.0 for c in CATEGORIES], dtype=float)

        if category and self._fitted:
            cat_enc  = self._safe_encode(self.category_encoder, [category], CATEGORIES)[0]
            n_cats   = max(len(self.category_encoder.classes_), 1)
            cat_norm = cat_enc / n_cats
        else:
            cat_norm = 0.5

        price_norm = min(budget / MAX_PRICE, 1.0) if budget > 0 else 0.5

        return np.concatenate([
            keyword_vec,
            [cat_norm, 0.5, 0.5, price_norm],
        ]).astype(float)

    # ── Interaction matrix ─────────────────────────────────────────────────────

    @staticmethod
    def build_interaction_matrix(
        interactions: List[Dict],
    ) -> Tuple[Optional[np.ndarray], list, list]:
        """
        Build a binary user × product interaction matrix.
        Returns (matrix, all_user_ids, all_product_ids).
        """
        if not interactions:
            return None, [], []

        all_users    = sorted({r["user_id"]    for r in interactions})
        all_products = sorted({r["product_id"] for r in interactions})
        user_idx     = {u: i for i, u in enumerate(all_users)}
        prod_idx     = {p: i for i, p in enumerate(all_products)}

        matrix = np.zeros((len(all_users), len(all_products)), dtype=float)
        for r in interactions:
            matrix[user_idx[r["user_id"]]][prod_idx[r["product_id"]]] = 1.0

        return matrix, all_users, all_products

    # ── Persistence ───────────────────────────────────────────────────────────

    def save(self, path: str):
        import pickle
        with open(path, "wb") as f:
            pickle.dump(self, f)

    @staticmethod
    def load(path: str) -> "DataPreprocessor":
        import pickle
        with open(path, "rb") as f:
            return pickle.load(f)

