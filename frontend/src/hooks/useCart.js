import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from '../utils/api';
const LS_KEY = "cart_guest";

function getToken() { return localStorage.getItem("token"); }
function getUser()  { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } }
function isLoggedInStakeholder() {
  const u = getUser();
  return !!getToken() && u.role === "stakeholder";
}

// ── localStorage helpers ──
function loadGuestCart() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function saveGuestCart(items) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}
function clearGuestCart() {
  localStorage.removeItem(LS_KEY);
}

export function useCart() {
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);

  // ── Load cart on mount ──
  const loadCart = useCallback(async () => {
    if (isLoggedInStakeholder()) {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/cart`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) setCart(await res.json());
      } catch (e) { console.error("Load cart error:", e); }
      finally { setLoading(false); }
    } else {
      setCart(loadGuestCart());
    }
  }, []);

  useEffect(() => { loadCart(); }, [loadCart]);

  // ── Sync guest cart to DB on login ──
  const syncOnLogin = useCallback(async () => {
    const guest = loadGuestCart();
    if (guest.length > 0 && isLoggedInStakeholder()) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/cart/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ items: guest.map(i => ({ product_id: i.product_id ?? i.id, quantity: i.quantity })) }),
        });
        if (res.ok) {
          setCart(await res.json());
          clearGuestCart();
        }
      } catch (e) { console.error("Cart sync error:", e); }
    } else {
      await loadCart();
    }
  }, [loadCart]);

  // ── Add to cart ──
  const addToCart = useCallback(async (product, quantity = 1) => {
    if (isLoggedInStakeholder()) {
      const res = await fetch(`${API_BASE_URL}/api/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ product_id: product.id, quantity }),
      });
      if (res.ok) await loadCart();
    } else {
      const guest = loadGuestCart();
      const existing = guest.find(i => (i.product_id ?? i.id) === product.id);
      const updated = existing
        ? guest.map(i => (i.product_id ?? i.id) === product.id ? { ...i, quantity: i.quantity + quantity } : i)
        : [...guest, { ...product, product_id: product.id, quantity }];
      saveGuestCart(updated);
      setCart(updated);
    }
  }, [loadCart]);

  // ── Update quantity ──
  const updateQty = useCallback(async (productId, quantity) => {
    if (quantity < 1) return removeItem(productId);
    if (isLoggedInStakeholder()) {
      await fetch(`${API_BASE_URL}/api/cart/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ quantity }),
      });
      await loadCart();
    } else {
      const updated = loadGuestCart().map(i =>
        (i.product_id ?? i.id) === productId ? { ...i, quantity } : i
      );
      saveGuestCart(updated);
      setCart(updated);
    }
  }, [loadCart]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Remove item ──
  const removeItem = useCallback(async (productId) => {
    if (isLoggedInStakeholder()) {
      await fetch(`${API_BASE_URL}/api/cart/${productId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      await loadCart();
    } else {
      const updated = loadGuestCart().filter(i => (i.product_id ?? i.id) !== productId);
      saveGuestCart(updated);
      setCart(updated);
    }
  }, [loadCart]);

  // ── Clear cart ──
  const clearCart = useCallback(async () => {
    if (isLoggedInStakeholder()) {
      await fetch(`${API_BASE_URL}/api/cart`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
    }
    clearGuestCart();
    setCart([]);
  }, []);

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = cart.reduce((s, i) => s + (Number(i.price) || 0) * i.quantity, 0);

  return { cart, loading, totalItems, totalPrice, addToCart, updateQty, removeItem, clearCart, syncOnLogin, loadCart };
}
