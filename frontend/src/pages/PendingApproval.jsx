import React from "react";
import { Link } from "react-router-dom";
import "./PendingApproval.css";

function PendingApproval() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  return (
    <div className="pending-page">
      <div className="pending-container">
        <div className="pending-icon">⏳</div>
        <h1>Profile Sent for Admin Approval</h1>
        <p>
          Thank you, <strong>{user.email || "valued user"}</strong>! Your profile has been successfully submitted
          and sent to our admin team for review.
        </p>
        <div className="pending-steps">
          <div className="step done">
            <span className="step-dot">✓</span>
            <span>Account Created</span>
          </div>
          <div className="step done">
            <span className="step-dot">✓</span>
            <span>Profile Submitted</span>
          </div>
          <div className="step active">
            <span className="step-dot">⏳</span>
            <span>Pending Admin Approval</span>
          </div>
          <div className="step">
            <span className="step-dot">4</span>
            <span>Access Granted</span>
          </div>
        </div>
        <p className="pending-note">
          Your application is now in the admin's pending queue. You will receive an email notification once your profile is approved or if additional information is needed. This typically takes 1-3 business days.
        </p>
        <Link to="/" className="pending-home-btn">← Back to Home</Link>
      </div>
    </div>
  );
}

export default PendingApproval;
