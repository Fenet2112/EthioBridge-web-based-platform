// src/pages/ForgotPassword.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../utils/api";
import "./ForgotPassword.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to send reset link.");

      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Failed to send reset link. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-page">
      <div className="forgot-container">
        <div className="forgot-header">
          <h1>Forgot Your Password?</h1>
          <p>Don't worry — we'll send you a reset link</p>
        </div>

        {error && <p className="error-message">{error}</p>}

        {!submitted ? (
          <form className="forgot-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Registered Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                autoFocus
                autoComplete="email"
              />
              <small className="hint">
                We'll send a password reset link if this email is registered
              </small>
            </div>

            <button type="submit" className="reset-btn" disabled={loading}>
              {loading ? (
                <span className="loading">Sending...</span>
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>
        ) : (
          <div className="success-section">
            <div className="success-icon">✉️</div>
            <h2>Check Your Email</h2>
            <p className="success-text">
              We’ve sent a password reset link to <strong>{email}</strong>.
            </p>
            <p className="success-subtext">
              The link will expire in 1 hour. If you don’t see it, check your spam/junk folder.
            </p>
          </div>
        )}

        <p className="back-to-login">
          Remember your password? <Link to="/login">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;