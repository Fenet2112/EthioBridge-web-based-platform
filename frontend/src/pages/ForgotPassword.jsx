// src/pages/ForgotPassword.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
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

    if (!email.trim()) {
      setError("Please enter your registered email address");
      setLoading(false);
      return;
    }

    try {
      // Simulate real backend call (replace with your actual API later)
      // Example: await fetch("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      await new Promise(resolve => setTimeout(resolve, 1800)); // fake network delay

      // Mock success (in real app, backend sends email if account exists)
      setMessage(
        "If an account with this email exists, you will receive a password reset link shortly. " +
        "Please check your inbox (and spam/junk folder)."
      );
      setSubmitted(true);
      setError("");
    } catch (err) {
      setError("Failed to send reset link. Please try again later.");
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