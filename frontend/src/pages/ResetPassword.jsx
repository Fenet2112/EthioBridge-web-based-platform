import React, { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import "./ForgotPassword.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token  = searchParams.get("token");
  const status = searchParams.get("status");

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [showPw, setShowPw]       = useState(false);

  // Invalid / expired states (redirected here by backend)
  if (status === "invalid") {
    return (
      <div className="forgot-password-page">
        <div className="forgot-container">
          <div className="success-icon">❌</div>
          <h2>Invalid Link</h2>
          <p style={{ color: "#555", marginBottom: 24 }}>This password reset link is invalid or has already been used.</p>
          <Link to="/forgot-password" className="reset-btn" style={{ display: "inline-block", textDecoration: "none" }}>Request New Link</Link>
        </div>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="forgot-password-page">
        <div className="forgot-container">
          <div className="success-icon">⏰</div>
          <h2>Link Expired</h2>
          <p style={{ color: "#555", marginBottom: 24 }}>This reset link has expired. Links are valid for 1 hour.</p>
          <Link to="/forgot-password" className="reset-btn" style={{ display: "inline-block", textDecoration: "none" }}>Request New Link</Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="forgot-password-page">
        <div className="forgot-container">
          <div className="success-icon">🔑</div>
          <h2>No Reset Token</h2>
          <p style={{ color: "#555", marginBottom: 24 }}>Please use the link from your email.</p>
          <Link to="/forgot-password" className="reset-btn" style={{ display: "inline-block", textDecoration: "none" }}>Request Reset Link</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setDone(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setError(err.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="forgot-password-page">
        <div className="forgot-container">
          <div className="success-icon">✅</div>
          <h2>Password Reset!</h2>
          <p className="success-text">Your password has been updated successfully.</p>
          <p className="success-subtext">Redirecting to login in 3 seconds...</p>
          <Link to="/login" className="reset-btn" style={{ display: "inline-block", textDecoration: "none", marginTop: 16 }}>Log In Now →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="forgot-password-page">
      <div className="forgot-container">
        <div className="forgot-header">
          <h1>Set New Password</h1>
          <p>Enter your new password below</p>
        </div>

        {error && <p className="error-message">{error}</p>}

        <form className="forgot-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>New Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                autoFocus
                style={{ paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem" }}>
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Confirm New Password</label>
            <input
              type={showPw ? "text" : "password"}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat your new password"
              required
            />
          </div>

          <button type="submit" className="reset-btn" disabled={loading}>
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <p className="back-to-login">
          <Link to="/login">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}
