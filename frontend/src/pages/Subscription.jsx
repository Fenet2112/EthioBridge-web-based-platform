import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../utils/api";
import "./Subscription.css";
import PaymentModal from "../components/PaymentModal";

function Subscription() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [plans, setPlans] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("monthly");
  const [pageLoading, setPageLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user.role || "stakeholder";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }

    Promise.all([
      fetch(`${API_BASE_URL}/api/subscription/status`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/subscription/plans`).then(r => r.json()),
    ]).then(([statusData, plansData]) => {
      setStatus(statusData);
      setPlans(plansData);
    }).catch(console.error)
      .finally(() => setPageLoading(false));
  }, [navigate]);

  const handlePaymentSuccess = async () => {
    setShowPayment(false);
    const token = localStorage.getItem("token");
    const statusRes = await fetch(`${API_BASE_URL}/api/subscription/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setStatus(await statusRes.json());
  };

  if (pageLoading) return (
    <div className="sub-page-loading">
      <div className="sub-spinner"></div>
      <p>Loading subscription info...</p>
    </div>
  );

  const rolePlans = plans?.[role] || {};
  const isPremium = status?.is_subscribed;
  const expiresAt = status?.subscription_expires_at
    ? new Date(status.subscription_expires_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  const prices = role === "industry"
    ? { monthly: { label: "1 ETB", amount: 1 }, yearly: { label: "1 ETB", amount: 1 } }
    : { monthly: { label: "1 ETB", amount: 1 }, yearly: { label: "1 ETB", amount: 1 } };

  return (
    <div className="sub-page">
      {showPayment && (
        <PaymentModal
          plan={selectedPlan}
          amount={prices[selectedPlan].amount}
          amountLabel={prices[selectedPlan].label}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
      {/* Header */}
      <div className="sub-page-header">
        <button className="sub-back-btn" onClick={() => navigate(-1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          Back
        </button>
        <div className="sub-page-title">
          <h1>EthioBridge Premium</h1>
          <p>Unlock the full power of Ethiopia's leading construction B2B platform</p>
        </div>
      </div>

      {/* Current Status Banner */}
      {isPremium ? (
        <div className="sub-status-banner premium">
          <span className="status-icon">★</span>
          <div>
            <strong>You're on Premium</strong>
            <p>Expires {expiresAt || "never"} · All features unlocked</p>
          </div>
        </div>
      ) : (
        <div className="sub-status-banner free">
          <span className="status-icon">○</span>
          <div>
            <strong>Free Plan</strong>
            <p>
              {role === "stakeholder"
                ? `${status?.free_requests_used || 0}/${status?.free_requests_limit || 1} requests used · ${status?.messages_used_this_month || 0}/${status?.messages_limit || 3} messages this month`
                : `${status?.max_products ? "Up to " + status.max_products + " products" : "Unlimited products"} · Basic analytics`
              }
            </p>
          </div>
          <span className="upgrade-tag">Upgrade Available</span>
        </div>
      )}

      {/* Comparison Table */}
      <div className="sub-comparison">
        <div className="sub-plan-card free-card">
          <div className="plan-card-header">
            <span className="plan-badge free-badge">Free</span>
            <div className="plan-card-price">0 ETB<span>/month</span></div>
          </div>
          <ul className="plan-features-list">
            {(rolePlans.free?.features || []).map((f, i) => (
              <li key={i} className="feature-item included">
                <span className="feat-icon">✓</span>{f}
              </li>
            ))}
          </ul>
          {!isPremium && (
            <div className="current-plan-tag">Your current plan</div>
          )}
        </div>

        <div className="sub-plan-card premium-card">
          <div className="plan-card-header">
            <span className="plan-badge premium-badge">★ Premium</span>
            <div className="plan-card-price">
              {selectedPlan === "monthly" ? prices.monthly.label : prices.yearly.label}
              <span>/{selectedPlan === "monthly" ? "month" : "year"}</span>
            </div>
            {selectedPlan === "yearly" && (
              <div className="yearly-save">Save ~30%</div>
            )}
          </div>
          <ul className="plan-features-list">
            {(rolePlans.premium?.features || []).map((f, i) => (
              <li key={i} className="feature-item included premium-feat">
                <span className="feat-icon">★</span>{f}
              </li>
            ))}
          </ul>
          {isPremium && (
            <div className="current-plan-tag premium-tag">Active plan</div>
          )}
        </div>
      </div>

      {/* Upgrade Section */}
      {!isPremium && (
        <div className="sub-upgrade-section">
          <h2>Upgrade to Premium</h2>

          {/* Billing period */}
          <div className="billing-toggle">
            <button
              className={selectedPlan === "monthly" ? "active" : ""}
              onClick={() => setSelectedPlan("monthly")}
            >
              Monthly · {prices.monthly.label}
            </button>
            <button
              className={selectedPlan === "yearly" ? "active" : ""}
              onClick={() => setSelectedPlan("yearly")}
            >
              Yearly · {prices.yearly.label}
              <span className="save-chip">Save 30%</span>
            </button>
          </div>

          {/* Payment method */}
          <div className="payment-section">
            <h3>Payment Method</h3>
            <div className="payment-methods">
              {[
                { id: "card", label: "Credit / Debit Card", icon: "◉" },
                { id: "telebirr", label: "Telebirr", icon: "◉" },
                { id: "cbe_birr", label: "CBE Birr", icon: "◉" },
                { id: "amole", label: "Amole", icon: "◉" },
              ].map((pm) => (
                <div
                  key={pm.id}
                  className={`payment-method ${pm.id === "card" ? "active" : ""}`}
                  style={pm.id !== "card" ? { opacity: 0.5, cursor: "default" } : {}}
                  title={pm.id !== "card" ? "Coming soon" : undefined}
                >
                  <span className="pm-icon">{pm.icon}</span>
                  <span>{pm.label}</span>
                  {pm.id !== "card" && <span style={{ fontSize: "0.7rem", color: "#999" }}> (soon)</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="sub-summary">
            <div className="summary-row">
              <span>Plan</span>
              <span>Premium ({selectedPlan})</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>{selectedPlan === "monthly" ? prices.monthly.label : prices.yearly.label}</span>
            </div>
          </div>

          <button className="sub-activate-btn" onClick={() => setShowPayment(true)}>
            Pay with Card — {selectedPlan === "monthly" ? prices.monthly.label : prices.yearly.label}
          </button>
          <p className="sub-disclaimer">
            Cancel anytime. No hidden fees. Subscription auto-renews unless cancelled.
          </p>
        </div>
      )}

      {/* Already premium — manage section */}
      {isPremium && (
        <div className="sub-manage-section">
          <h2>Manage Subscription</h2>
          <p>Your premium subscription is active until <strong>{expiresAt}</strong>.</p>
          <p className="sub-disclaimer">To cancel or change your plan, contact support at support@ethiobridge.et</p>
        </div>
      )}

      {/* FAQ */}
      <div className="sub-faq">
        <h2>Frequently Asked Questions</h2>
        <div className="faq-grid">
          {[
            { q: "Can I cancel anytime?", a: "Yes. Your premium access continues until the end of your billing period." },
            { q: "What payment methods are accepted?", a: "Telebirr, CBE Birr, Amole, and bank transfer are all supported." },
            { q: "What happens when my subscription expires?", a: "Your account automatically reverts to the Free plan. Your data is never deleted." },
            { q: "Is there a free trial?", a: "Every account starts on the Free plan with 1 free purchase request and 3 messages per month." },
          ].map((item, i) => (
            <div key={i} className="faq-item">
              <h4>{item.q}</h4>
              <p>{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Subscription;
