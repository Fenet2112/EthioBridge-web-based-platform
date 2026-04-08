import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle, FaSpinner } from "react-icons/fa";
import "./PaymentSuccess.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("verifying"); // verifying, success, failed
  const [paymentDetails, setPaymentDetails] = useState(null);

  useEffect(() => {
    const txRef = searchParams.get("tx_ref") || searchParams.get("trx_ref");
    
    if (!txRef) {
      setStatus("failed");
      return;
    }

    verifyPayment(txRef);
  }, [searchParams]);

  const verifyPayment = async (txRef) => {
    const token = localStorage.getItem("token");
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/chapa/payment/verify/${txRef}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      if (data.success && data.status === "success") {
        setStatus("success");
        setPaymentDetails(data);
        
        // Refresh subscription status
        const subRes = await fetch(`${API_BASE_URL}/api/subscription/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        await subRes.json();
      } else {
        setStatus("failed");
      }
    } catch (error) {
      console.error("Payment verification error:", error);
      setStatus("failed");
    }
  };

  return (
    <div className="payment-success-page">
      <div className="payment-success-card">
        {status === "verifying" && (
          <div className="payment-status verifying">
            <FaSpinner className="spin-icon" />
            <h2>Verifying Payment...</h2>
            <p>Please wait while we confirm your payment</p>
          </div>
        )}

        {status === "success" && (
          <div className="payment-status success">
            <FaCheckCircle className="success-icon" />
            <h2>Payment Successful!</h2>
            <p>Your subscription has been activated</p>
            
            {paymentDetails && (
              <div className="payment-details">
                <div className="detail-row">
                  <span>Amount:</span>
                  <span>{paymentDetails.amount} {paymentDetails.currency}</span>
                </div>
              </div>
            )}

            <div className="payment-actions">
              <button className="btn-primary" onClick={() => navigate("/subscription")}>
                View Subscription
              </button>
              <button className="btn-secondary" onClick={() => navigate("/")}>
                Go to Home
              </button>
            </div>
          </div>
        )}

        {status === "failed" && (
          <div className="payment-status failed">
            <FaTimesCircle className="error-icon" />
            <h2>Payment Failed</h2>
            <p>We couldn't verify your payment. Please try again.</p>
            
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
