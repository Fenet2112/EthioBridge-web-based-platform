import React, { useState, useRef, useEffect } from "react";
import "./PaymentModal.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Luhn algorithm for basic card validation
function luhn(num) {
  const digits = num.replace(/\D/g, "").split("").reverse().map(Number);
  const sum = digits.reduce((acc, d, i) => {
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    return acc + d;
  }, 0);
  return sum % 10 === 0;
}

function detectCardType(num) {
  const n = num.replace(/\D/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  return "unknown";
}

function formatCardNumber(val) {
  const digits = val.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(val) {
  const digits = val.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits;
}

const CARD_ICONS = {
  visa: (
    <svg viewBox="0 0 48 32" width="40" height="26">
      <rect width="48" height="32" rx="4" fill="#1a1f71"/>
      <text x="8" y="22" fill="white" fontSize="14" fontWeight="bold" fontFamily="Arial">VISA</text>
    </svg>
  ),
  mastercard: (
    <svg viewBox="0 0 48 32" width="40" height="26">
      <rect width="48" height="32" rx="4" fill="#252525"/>
      <circle cx="18" cy="16" r="10" fill="#eb001b"/>
      <circle cx="30" cy="16" r="10" fill="#f79e1b"/>
      <path d="M24 8.4a10 10 0 0 1 0 15.2A10 10 0 0 1 24 8.4z" fill="#ff5f00"/>
    </svg>
  ),
  amex: (
    <svg viewBox="0 0 48 32" width="40" height="26">
      <rect width="48" height="32" rx="4" fill="#2557d6"/>
      <text x="6" y="22" fill="white" fontSize="11" fontWeight="bold" fontFamily="Arial">AMEX</text>
    </svg>
  ),
  unknown: (
    <svg viewBox="0 0 48 32" width="40" height="26">
      <rect width="48" height="32" rx="4" fill="#e0e0e0"/>
      <rect x="4" y="10" width="40" height="12" rx="2" fill="#bdbdbd"/>
    </svg>
  ),
};

// ── STEP 1: Plan selection (passed in, just confirm) ──
// ── STEP 2: Card details ──
// ── STEP 3: Processing ──
// ── STEP 4: Success ──

function PaymentModal({ plan, amount, amountLabel, onClose, onSuccess }) {
  const [step, setStep] = useState("card"); // card | processing | success | error
  const [errorMsg, setErrorMsg] = useState("");

  const [card, setCard] = useState({
    number: "",
    name: "",
    expiry: "",
    cvv: "",
  });
  const [cardType, setCardType] = useState("unknown");
  const [flipped, setFlipped] = useState(false);
  const [errors, setErrors] = useState({});
  const cvvRef = useRef(null);

  useEffect(() => {
    setCardType(detectCardType(card.number));
  }, [card.number]);

  const handleCardChange = (e) => {
    const { name, value } = e.target;
    let formatted = value;
    if (name === "number") formatted = formatCardNumber(value);
    if (name === "expiry") formatted = formatExpiry(value);
    if (name === "cvv") formatted = value.replace(/\D/g, "").slice(0, 4);
    setCard(prev => ({ ...prev, [name]: formatted }));
    setErrors(prev => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const errs = {};
    const rawNum = card.number.replace(/\s/g, "");
    if (rawNum.length < 13 || !luhn(rawNum)) errs.number = "Invalid card number";
    if (!card.name.trim() || card.name.trim().length < 2) errs.name = "Enter cardholder name";
    const [mm, yy] = card.expiry.split("/");
    const now = new Date();
    const expMonth = parseInt(mm, 10);
    const expYear = 2000 + parseInt(yy, 10);
    if (!mm || !yy || expMonth < 1 || expMonth > 12 || expYear < now.getFullYear() ||
        (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)) {
      errs.expiry = "Invalid or expired date";
    }
    if (card.cvv.length < 3) errs.cvv = "Invalid CVV";
    return errs;
  };

  const handlePay = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setStep("processing");

    // Simulate payment processing delay
    await new Promise(r => setTimeout(r, 2200));

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE_URL}/api/subscription/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          plan,
          payment_method: "card",
          card_last4: card.number.replace(/\s/g, "").slice(-4),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStep("success");
    } catch (err) {
      setErrorMsg(err.message || "Payment failed. Please try again.");
      setStep("error");
    }
  };

  return (
    <div className="pay-overlay" onClick={step === "card" ? onClose : undefined}>
      <div className="pay-modal" onClick={e => e.stopPropagation()}>

        {/* ── CARD ENTRY STEP ── */}
        {step === "card" && (
          <>
            <button className="pay-close" onClick={onClose}>✕</button>

            <div className="pay-header">
              <div className="pay-lock-icon">🔒</div>
              <h2>Secure Payment</h2>
              <p>EthioBridge Premium · <strong>{amountLabel}</strong></p>
            </div>

            {/* Visual card preview */}
            <div className={`card-preview ${flipped ? "flipped" : ""}`}>
              <div className="card-front">
                <div className="card-front-top">
                  <div className="card-chip">
                    <div className="chip-line h"></div>
                    <div className="chip-line v"></div>
                  </div>
                  <div className="card-brand-icon">{CARD_ICONS[cardType]}</div>
                </div>
                <div className="card-number-display">
                  {(card.number || "•••• •••• •••• ••••").padEnd(19, "•").replace(/(.{4})/g, "$1 ").trim()}
                </div>
                <div className="card-front-bottom">
                  <div>
                    <div className="card-label">Card Holder</div>
                    <div className="card-value">{card.name || "FULL NAME"}</div>
                  </div>
                  <div>
                    <div className="card-label">Expires</div>
                    <div className="card-value">{card.expiry || "MM/YY"}</div>
                  </div>
                </div>
              </div>
              <div className="card-back">
                <div className="card-stripe"></div>
                <div className="card-cvv-row">
                  <div className="card-cvv-label">CVV</div>
                  <div className="card-cvv-box">{card.cvv ? "•".repeat(card.cvv.length) : "•••"}</div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="pay-form">
              <div className="pay-field">
                <label>Card Number</label>
                <div className={`pay-input-wrap ${errors.number ? "error" : ""}`}>
                  <input
                    type="text"
                    name="number"
                    value={card.number}
                    onChange={handleCardChange}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                    inputMode="numeric"
                    autoComplete="cc-number"
                  />
                  <span className="input-card-icon">{CARD_ICONS[cardType]}</span>
                </div>
                {errors.number && <span className="field-error">{errors.number}</span>}
              </div>

              <div className="pay-field">
                <label>Cardholder Name</label>
                <div className={`pay-input-wrap ${errors.name ? "error" : ""}`}>
                  <input
                    type="text"
                    name="name"
                    value={card.name}
                    onChange={handleCardChange}
                    placeholder="Name as on card"
                    autoComplete="cc-name"
                    onInput={e => { e.target.value = e.target.value.toUpperCase(); }}
                  />
                </div>
                {errors.name && <span className="field-error">{errors.name}</span>}
              </div>

              <div className="pay-row">
                <div className="pay-field">
                  <label>Expiry Date</label>
                  <div className={`pay-input-wrap ${errors.expiry ? "error" : ""}`}>
                    <input
                      type="text"
                      name="expiry"
                      value={card.expiry}
                      onChange={handleCardChange}
                      placeholder="MM/YY"
                      maxLength={5}
                      inputMode="numeric"
                      autoComplete="cc-exp"
                    />
                  </div>
                  {errors.expiry && <span className="field-error">{errors.expiry}</span>}
                </div>

                <div className="pay-field">
                  <label>CVV</label>
                  <div className={`pay-input-wrap ${errors.cvv ? "error" : ""}`}>
                    <input
                      ref={cvvRef}
                      type="password"
                      name="cvv"
                      value={card.cvv}
                      onChange={handleCardChange}
                      placeholder="•••"
                      maxLength={4}
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      onFocus={() => setFlipped(true)}
                      onBlur={() => setFlipped(false)}
                    />
                    <span className="cvv-hint" title="3-digit code on back of card">?</span>
                  </div>
                  {errors.cvv && <span className="field-error">{errors.cvv}</span>}
                </div>
              </div>
            </div>

            <button className="pay-btn" onClick={handlePay}>
              <span className="pay-btn-lock">🔒</span>
              Pay {amountLabel}
            </button>

            <div className="pay-security-row">
              <span>🛡️ 256-bit SSL encrypted</span>
              <span>·</span>
              <span>PCI DSS compliant</span>
            </div>
          </>
        )}

        {/* ── PROCESSING STEP ── */}
        {step === "processing" && (
          <div className="pay-processing">
            <div className="processing-ring">
              <div className="processing-spinner"></div>
              <div className="processing-icon">💳</div>
            </div>
            <h2>Processing Payment</h2>
            <p>Please wait while we securely process your payment...</p>
            <div className="processing-steps">
              <ProcessingStep label="Verifying card details" delay={0} />
              <ProcessingStep label="Authorizing payment" delay={700} />
              <ProcessingStep label="Activating subscription" delay={1500} />
            </div>
          </div>
        )}

        {/* ── SUCCESS STEP ── */}
        {step === "success" && (
          <div className="pay-success">
            <div className="success-circle">
              <svg viewBox="0 0 52 52" className="success-checkmark">
                <circle cx="26" cy="26" r="25" fill="none" stroke="#0a5c2f" strokeWidth="2"/>
                <path fill="none" stroke="#0a5c2f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                  d="M14 27l8 8 16-16"/>
              </svg>
            </div>
            <h2>Payment Successful!</h2>
            <p>Welcome to EthioBridge Premium. Your subscription is now active.</p>
            <div className="success-details">
              <div className="success-detail-row">
                <span>Plan</span>
                <span>Premium ({plan})</span>
              </div>
              <div className="success-detail-row">
                <span>Amount charged</span>
                <span>{amountLabel}</span>
              </div>
              <div className="success-detail-row">
                <span>Card</span>
                <span>•••• {card.number.replace(/\s/g, "").slice(-4)}</span>
              </div>
            </div>
            <button className="pay-btn success-btn" onClick={onSuccess}>
              Continue to Premium →
            </button>
          </div>
        )}

        {/* ── ERROR STEP ── */}
        {step === "error" && (
          <div className="pay-error-state">
            <div className="error-icon">❌</div>
            <h2>Payment Failed</h2>
            <p>{errorMsg}</p>
            <button className="pay-btn" onClick={() => setStep("card")}>
              Try Again
            </button>
            <button className="pay-btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        )}

      </div>
    </div>
  );
}

function ProcessingStep({ label, delay }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), delay + 600);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div className={`proc-step ${done ? "done" : "pending"}`}>
      <span className="proc-dot">{done ? "✓" : ""}</span>
      <span>{label}</span>
    </div>
  );
}

export default PaymentModal;
