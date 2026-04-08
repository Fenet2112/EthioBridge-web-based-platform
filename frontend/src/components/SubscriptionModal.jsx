import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SubscriptionModal.css";
import PaymentModal from "./PaymentModal";

const FEATURES = {
  stakeholder: [
    "Unlimited purchase requests",
    "Full business details & contact info",
    "Unlimited direct messaging",
    "Advanced filtering & recommendations",
    "Market insights & trends",
  ],
  industry: [
    "Unlimited product listings",
    "Featured listing (top of search)",
    "Full analytics dashboard",
    "Direct messages from stakeholders",
    "Verified badge",
  ],
};

const PRICES = {
  stakeholder: { monthly: "1 ETB", yearly: "1 ETB" },
  industry:    { monthly: "1 ETB", yearly: "1 ETB" },
};

function SubscriptionModal({ onClose, onSuccess, reason }) {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState("monthly");
  const [showPayment, setShowPayment] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user.role || "stakeholder";
  const features = FEATURES[role] || FEATURES.stakeholder;
  const prices = PRICES[role] || PRICES.stakeholder;
  const amountLabel = prices[selectedPlan];

  const reasonText = reason || (
    role === "stakeholder"
      ? "You've reached your free plan limit. Subscribe to continue."
      : "Upgrade to post more products and access premium features."
  );

  if (showPayment) {
    return (
      <PaymentModal
        plan={selectedPlan}
        amount={1}
        amountLabel={amountLabel}
        onClose={() => setShowPayment(false)}
        onSuccess={() => { setShowPayment(false); onSuccess && onSuccess(); }}
      />
    );
  }

  return (
    <div className="sub-overlay" onClick={onClose}>
      <div className="sub-modal" onClick={(e) => e.stopPropagation()}>
        <button className="sub-close" onClick={onClose}>✕</button>

        <div className="sub-header">
          <div className="sub-icon">⭐</div>
          <h2>Upgrade to Premium</h2>
          <p>{reasonText}</p>
        </div>

        <div className="sub-features">
          {features.map((f) => (
            <div key={f} className="sub-feature">
              <span className="sub-check">✓</span>
              <span>{f}</span>
            </div>
          ))}
        </div>

        <div className="sub-plans">
          {[
            { key: "monthly", label: "Monthly", price: prices.monthly, save: null },
            { key: "yearly",  label: "Yearly",  price: prices.yearly,  save: "Save 30%" },
          ].map((plan) => (
            <div
              key={plan.key}
              className={`sub-plan ${selectedPlan === plan.key ? "active" : ""}`}
              onClick={() => setSelectedPlan(plan.key)}
            >
              <div className="plan-top">
                <span className="plan-label">{plan.label}</span>
                {plan.save && <span className="plan-save">{plan.save}</span>}
              </div>
              <div className="plan-price">{plan.price}</div>
            </div>
          ))}
        </div>

        <button className="sub-btn" onClick={() => setShowPayment(true)}>
          Subscribe — {prices[selectedPlan]}
        </button>

        <button className="sub-view-plans" onClick={() => { onClose(); navigate("/subscription"); }}>
          View full plan details →
        </button>

        <p className="sub-note">Cancel anytime. No hidden fees.</p>
      </div>
    </div>
  );
}

export default SubscriptionModal;
