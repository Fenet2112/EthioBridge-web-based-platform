import React, { useState } from "react";
import { FaPhone, FaLock, FaShieldAlt } from "react-icons/fa";
import "./PaymentModal.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function PaymentModal({ plan, amount, amountLabel, onClose, onSuccess }) {
  const [step, setStep] = useState("phone"); // phone | processing | error
  const [phoneNumber, setPhoneNumber] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const validatePhone = (phone) => {
    // Ethiopian phone format: +251 or 0 followed by 9 digits
    const cleaned = phone.replace(/\s/g, "");
    const ethiopianPattern = /^(\+251|0)?[79]\d{8}$/;
    return ethiopianPattern.test(cleaned);
  };

  const formatPhone = (value) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, "");
    
    // Format as: 0912 345 678 or +251 912 345 678
    if (digits.startsWith("251")) {
      const formatted = digits.slice(0, 12);
      if (formatted.length <= 3) return `+${formatted}`;
      if (formatted.length <= 6) return `+${formatted.slice(0, 3)} ${formatted.slice(3)}`;
      if (formatted.length <= 9) return `+${formatted.slice(0, 3)} ${formatted.slice(3, 6)} ${formatted.slice(6)}`;
      return `+${formatted.slice(0, 3)} ${formatted.slice(3, 6)} ${formatted.slice(6, 9)} ${formatted.slice(9)}`;
    } else {
      const formatted = digits.slice(0, 10);
      if (formatted.length <= 4) return formatted;
      if (formatted.length <= 7) return `${formatted.slice(0, 4)} ${formatted.slice(4)}`;
      return `${formatted.slice(0, 4)} ${formatted.slice(4, 7)} ${formatted.slice(7)}`;
    }
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhone(e.target.value);
    setPhoneNumber(formatted);
    setPhoneError("");
  };

  const handlePay = async () => {
    // Validate phone
    if (!validatePhone(phoneNumber)) {
      setPhoneError("Please enter a valid Ethiopian phone number");
      return;
    }

    setStep("processing");

    const token = localStorage.getItem("token");
    const cleanPhone = phoneNumber.replace(/\s/g, "");

    try {
      const res = await fetch(`${API_BASE_URL}/api/chapa/payment/initialize`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          plan,
          amount,
          phone_number: cleanPhone,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || "Payment initialization failed");

      // Redirect to Chapa checkout
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err) {
      setErrorMsg(err.message || "Payment failed. Please try again.");
      setStep("error");
    }
  };

  return (
    <div className="pay-overlay" onClick={step === "phone" ? onClose : undefined}>
      <div className="pay-modal chapa-modal" onClick={e => e.stopPropagation()}>

        {/* ── PHONE ENTRY STEP ── */}
        {step === "phone" && (
          <>
            <button className="pay-close" onClick={onClose}>✕</button>

            <div className="pay-header">
              <div className="pay-lock-icon chapa-icon">
                <img 
                  src="https://chapa.co/favicon.ico" 
                  alt="Chapa" 
                  style={{ width: "40px", height: "40px" }}
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              </div>
              <h2>Chapa Payment</h2>
              <p>EthioBridge Premium · <strong>{amountLabel}</strong></p>
            </div>

            <div className="chapa-info">
              <FaShieldAlt className="info-icon" />
              <p>You will be redirected to Chapa's secure payment page to complete your transaction</p>
            </div>

            <div className="pay-form">
              <div className="pay-field">
                <label>
                  <FaPhone style={{ marginRight: "8px" }} />
                  Phone Number
                </label>
                <div className={`pay-input-wrap ${phoneError ? "error" : ""}`}>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    placeholder="0912 345 678 or +251 912 345 678"
                    maxLength={20}
                    inputMode="tel"
                    autoFocus
                  />
                </div>
                {phoneError && <span className="field-error">{phoneError}</span>}
                <small className="field-hint">
                  Enter your Ethiopian phone number for payment confirmation
                </small>
              </div>

              <div className="payment-summary">
                <div className="summary-row">
                  <span>Plan</span>
                  <span className="summary-value">Premium ({plan})</span>
                </div>
                <div className="summary-row total">
                  <span>Total Amount</span>
                  <span className="summary-value">{amountLabel}</span>
                </div>
              </div>
            </div>

            <button className="pay-btn chapa-btn" onClick={handlePay}>
              <FaLock style={{ marginRight: "8px" }} />
              Continue to Chapa Payment
            </button>

            <div className="pay-security-row">
              <span>🛡️ Secured by Chapa</span>
              <span>·</span>
              <span>Ethiopian Payment Gateway</span>
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
            <h2>Redirecting to Chapa...</h2>
            <p>Please wait while we redirect you to the secure payment page</p>
          </div>
        )}

        {/* ── ERROR STEP ── */}
        {step === "error" && (
          <div className="pay-error-state">
            <div className="error-icon">❌</div>
            <h2>Payment Failed</h2>
            <p>{errorMsg}</p>
            <button className="pay-btn" onClick={() => setStep("phone")}>
              Try Again
            </button>
            <button className="pay-btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        )}

      </div>
    </div>
  );
}

export default PaymentModal;
