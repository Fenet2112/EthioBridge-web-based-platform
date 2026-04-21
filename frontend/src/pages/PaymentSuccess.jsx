import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle, FaSpinner } from "react-icons/fa";
import { API_BASE_URL } from "../utils/api";
import "./PaymentSuccess.css";

function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("verifying"); // verifying, success, failed
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const txRef = searchParams.get("tx_ref") || searchParams.get("trx_ref");
    const chapaStatus = searchParams.get("status");
    
    console.log("Payment callback received:", { txRef, chapaStatus });
    
    if (!txRef) {
      setStatus("failed");
      setErrorMessage("No transaction reference found");
      return;
    }

    verifyPayment(txRef);
  }, [searchParams]);

  const verifyPayment = async (txRef) => {
    const token = localStorage.getItem("token");
    
    if (!token) {
      setStatus("failed");
      setErrorMessage("Please login to verify payment");
      return;
    }
    
    try {
      console.log("Verifying payment:", txRef);
      
      const res = await fetch(`${API_BASE_URL}/api/chapa/payment/verify/${txRef}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      console.log("Verification response:", data);
      
      if (res.ok && data.success && data.status === "success") {
        setStatus("success");
        setPaymentDetails(data);
        
        // Refresh subscription status
        try {
          const subRes = await fetch(`${API_BASE_URL}/api/subscription/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const subData = await subRes.json();
          console.log("Subscription status:", subData);
        } catch (err) {
          console.error("Failed to refresh subscription:", err);
        }
      } else {
        setStatus("failed");
        setErrorMessage(data.message || "Payment verification failed");
      }
    } catch (error) {
      console.error("Payment verification error:", error);
      setStatus("failed");
      setErrorMessage(error.message || "Failed to verify payment");
    }
  };

  return (
    <div className="payment-success-page">
      <div className="payment-success-card">
        {status === "verifying" && (
          <div className="payment-status verifying">
            <FaSpinner className="spin-icon" />
            <h2>Verifying Payment...</h2>
            <p>Please wait while we confirm your payment with Chapa</p>
          </div>
        )}

        {status === "success" && (
          <div className="payment-status success">
            <FaCheckCircle className="success-icon" />
            <h2>Payment Successful!</h2>
            <p>Your premium subscription has been activated</p>
            
            {paymentDetails && (
              <div className="payment-details">
                <div className="detail-row">
                  <span>Amount Paid:</span>
                  <span>{paymentDetails.amount} {paymentDetails.currency || "ETB"}</span>
                </div>
                <div className="detail-row">
                  <span>Status:</span>
                  <span className="status-badge success-badge">Confirmed</span>
                </div>
              </div>
            )}

            <div className="payment-actions">
              <button className="btn-primary" onClick={() => navigate("/subscription")}>
                View Subscription
              </button>
              <button className="btn-secondary" onClick={() => navigate("/stakeholders")}>
                Go to Dashboard
              </button>
            </div>
          </div>
        )}

        {status === "failed" && (
          <div className="payment-status failed">
            <FaTimesCircle className="error-icon" />
            <h2>Payment Verification Failed</h2>
            <p>{errorMessage || "We couldn't verify your payment. Please contact support if you were charged."}</p>
            
            <div className="payment-actions">
              <button className="btn-primary" onClick={() => navigate("/subscription")}>
                Try Again
              </button>
              <button className="btn-secondary" onClick={() => navigate("/")}>
                Go to Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PaymentSuccess;
