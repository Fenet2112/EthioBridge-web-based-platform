import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../hooks/useCart";
import StakeholderNav from "../components/StakeholderNav";
import "./CartCheckout.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function CartCheckout() {
  const navigate = useNavigate();
  const { cart, totalItems, totalPrice, updateQty, removeItem, clearCart } = useCart();

  const [step, setStep] = useState("cart"); // "cart" | "checkout" | "success"
  const [notes, setNotes] = useState({});   // { product_id: note }
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const token = localStorage.getItem("token");

  // Redirect if not logged in
  if (!token) {
    navigate("/login");
    return null;
  }

  // Group cart items by industry
  const byIndustry = cart.reduce((acc, item) => {
    const key = item.company_name || "Unknown Industry";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    setError("");

    const successes = [];
    const failures  = [];

    for (const item of cart) {
      const pid = item.product_id ?? item.id;
      try {
        const res = await fetch(`${API_BASE_URL}/api/purchases`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            industry_id: item.industry_id,
            product_id:  pid,
            quantity:    item.quantity,
            notes:       notes[pid] || null,
          }),
        });

        const data = await res.json();

        if (res.status === 402) {
          failures.push({ name: item.name, reason: "Subscription required" });
        } else if (!res.ok) {
          failures.push({ name: item.name, reason: data.message || "Failed" });
        } else {
          successes.push({ name: item.name, id: data.request?.id });
        }
      } catch (e) {
        failures.push({ name: item.name, reason: "Network error" });
      }
    }

    setResults({ successes, failures });

    if (successes.length > 0) {
      await clearCart();
      setStep("success");
    } else {
      setError("All requests failed. See details below.");
    }

    setSubmitting(false);
  };

  // ── CART STEP ──
  if (step === "cart") {
    return (
      <div className="cc-page">
        <StakeholderNav />
        <div className="cc-container">
          <div className="cc-breadcrumb">
            <span className="cc-bc-active">🛒 Cart</span>
            <span className="cc-bc-sep">›</span>
            <span className="cc-bc-inactive">Checkout</span>
            <span className="cc-bc-sep">›</span>
            <span className="cc-bc-inactive">Confirmation</span>
          </div>

          <h1 className="cc-title">Your Cart</h1>

          {cart.length === 0 ? (
            <div className="cc-empty">
              <div className="cc-empty-icon">🛒</div>
              <h2>Your cart is empty</h2>
              <p>Browse products and add items to get started.</p>
              <button className="cc-btn-primary" onClick={() => navigate("/products")}>
                Browse Products
              </button>
            </div>
          ) : (
            <div className="cc-layout">
              {/* Items */}
              <div className="cc-items">
                {Object.entries(byIndustry).map(([industry, items]) => (
                  <div key={industry} className="cc-industry-group">
                    <div className="cc-industry-label">🏭 {industry}</div>
                    {items.map(item => {
                      const pid = item.product_id ?? item.id;
                      return (
                        <div key={pid} className="cc-item">
                          <div className="cc-item-img">
                            {item.image_url
                              ? <img src={item.image_url} alt={item.name} />
                              : <span className="cc-item-placeholder">📦</span>
                            }
                          </div>
                          <div className="cc-item-body">
                            <div className="cc-item-name">{item.name}</div>
                            {item.category && <div className="cc-item-cat">{item.category}</div>}
                            <div className="cc-item-price">
                              {item.price
                                ? `${(Number(item.price) * item.quantity).toLocaleString()} ETB`
                                : "Price on request"}
                            </div>
                          </div>
                          <div className="cc-item-right">
                            <div className="cc-qty">
                              <button onClick={() => updateQty(pid, item.quantity - 1)}>−</button>
                              <span>{item.quantity}</span>
                              <button onClick={() => updateQty(pid, item.quantity + 1)}>+</button>
                            </div>
                            <button className="cc-remove" onClick={() => removeItem(pid)}>🗑 Remove</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="cc-summary">
                <h3>Order Summary</h3>
                <div className="cc-summary-row">
                  <span>Items ({totalItems})</span>
                  <span>{totalPrice > 0 ? `${totalPrice.toLocaleString()} ETB` : "—"}</span>
                </div>
                <div className="cc-summary-note">
                  Final pricing confirmed by industry after request
                </div>
                <button
                  className="cc-btn-primary cc-btn-full"
                  onClick={() => setStep("checkout")}
                >
                  Proceed to Checkout →
                </button>
                <button className="cc-btn-ghost cc-btn-full" onClick={() => navigate("/products")}>
                  ← Continue Shopping
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── CHECKOUT STEP ──
  if (step === "checkout") {
    return (
      <div className="cc-page">
        <StakeholderNav />
        <div className="cc-container">
          <div className="cc-breadcrumb">
            <span className="cc-bc-done" onClick={() => setStep("cart")}>✓ Cart</span>
            <span className="cc-bc-sep">›</span>
            <span className="cc-bc-active">Checkout</span>
            <span className="cc-bc-sep">›</span>
            <span className="cc-bc-inactive">Confirmation</span>
          </div>

          <h1 className="cc-title">Review & Submit</h1>

          {error && <div className="cc-error">{error}</div>}

          <div className="cc-layout">
            <div className="cc-items">
              {Object.entries(byIndustry).map(([industry, items]) => (
                <div key={industry} className="cc-industry-group">
                  <div className="cc-industry-label">🏭 {industry}</div>
                  {items.map(item => {
                    const pid = item.product_id ?? item.id;
                    return (
                      <div key={pid} className="cc-item cc-item-checkout">
                        <div className="cc-item-img">
                          {item.image_url
                            ? <img src={item.image_url} alt={item.name} />
                            : <span className="cc-item-placeholder">📦</span>
                          }
                        </div>
                        <div className="cc-item-body">
                          <div className="cc-item-name">{item.name}</div>
                          <div className="cc-item-qty">Qty: {item.quantity} {item.unit && item.unit !== "unit" ? item.unit : ""}</div>
                          <div className="cc-item-price">
                            {item.price ? `${(Number(item.price) * item.quantity).toLocaleString()} ETB` : "Price on request"}
                          </div>
                          <textarea
                            className="cc-notes"
                            placeholder="Optional note to industry (e.g. delivery preference)..."
                            value={notes[pid] || ""}
                            onChange={e => setNotes(n => ({ ...n, [pid]: e.target.value }))}
                            rows={2}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="cc-summary">
              <h3>Order Summary</h3>
              <div className="cc-summary-row">
                <span>Items ({totalItems})</span>
                <span>{totalPrice > 0 ? `${totalPrice.toLocaleString()} ETB` : "—"}</span>
              </div>
              <div className="cc-summary-note">
                Each item becomes a separate purchase request sent to the industry.
              </div>

              <div className="cc-user-info">
                <div className="cc-user-label">Sending as</div>
                <div className="cc-user-email">{user.email}</div>
              </div>

              <button
                className="cc-btn-primary cc-btn-full"
                onClick={handleCheckout}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : `Submit ${totalItems} Request${totalItems !== 1 ? "s" : ""}`}
              </button>
              <button className="cc-btn-ghost cc-btn-full" onClick={() => setStep("cart")} disabled={submitting}>
                ← Back to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── SUCCESS STEP ──
  return (
    <div className="cc-page">
      <StakeholderNav />
      <div className="cc-container cc-success-container">
        <div className="cc-success-icon">✅</div>
        <h1 className="cc-success-title">Requests Submitted!</h1>
        <p className="cc-success-sub">
          {results.successes?.length} purchase request{results.successes?.length !== 1 ? "s" : ""} sent to the industries.
          They will review and respond shortly.
        </p>

        {results.failures?.length > 0 && (
          <div className="cc-partial-fail">
            <strong>⚠️ {results.failures.length} item{results.failures.length !== 1 ? "s" : ""} failed:</strong>
            <ul>
              {results.failures.map((f, i) => (
                <li key={i}>{f.name} — {f.reason}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="cc-success-actions">
          <button className="cc-btn-primary" onClick={() => navigate("/my-requests")}>
            View My Requests
          </button>
          <button className="cc-btn-ghost" onClick={() => navigate("/products")}>
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}

export default CartCheckout;
