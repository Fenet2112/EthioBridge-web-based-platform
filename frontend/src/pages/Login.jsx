import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Logo from "../components/Logo";
import "./Login.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

async function syncGuestCartOnLogin(token) {
  try {
    const guest = JSON.parse(localStorage.getItem("cart_guest") || "[]");
    if (guest.length === 0) return;
    await fetch(`${API_BASE_URL}/api/cart/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items: guest.map(i => ({ product_id: i.product_id ?? i.id, quantity: i.quantity })) }),
    });
    localStorage.removeItem("cart_guest");
  } catch (e) { console.error("Cart sync error:", e); }
}

function Login() {
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);
  const [resendSent, setResendSent] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.status === 'unverified') {
          setUnverifiedEmail(data.email || formData.email);
          return;
        }
        throw new Error(data.message || "Login failed");
      }

      // Use AuthContext to store authentication
      authLogin(data.user, data.token);

      const { role, status } = data.user;

      // Redirect based on role
      if (status === "rejected") {
        setError("Your application was rejected. Please contact support.");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } else {
        // Sync guest cart to DB for stakeholders
        if (role === "stakeholder") await syncGuestCartOnLogin(data.token);
        if (role === "industry") navigate("/industry");
        else if (role === "stakeholder") navigate("/stakeholders");
        else navigate("/");
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <Link to="/" className="home-icon-btn" title="Back to Home">
        🏠
      </Link>
      <div className="login-container">
        <div className="login-icon">
          <Logo size={80} color="#667eea" />
        </div>
        <div className="login-header">
          <h1>Welcome Back</h1>
          <p>Log in to your EthioBridge account</p>
        </div>

        {error && <p className="error-message">{error}</p>}

        {unverifiedEmail && (
          <div style={{ background: "#fff8e1", border: "1px solid #f59e0b", borderRadius: 10, padding: "14px 16px", marginBottom: 16, fontSize: "0.88rem", color: "#92400e" }}>
            <strong>✉️ Email not verified.</strong> Please check your inbox for the verification link.
            <br />
            <button
              style={{ background: "none", border: "none", color: "#0a5c2f", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", padding: "6px 0 0", textDecoration: "underline" }}
              onClick={async () => {
                await fetch(`${API_BASE_URL}/api/resend-verification`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: unverifiedEmail }),
                });
                setResendSent(true);
              }}
              disabled={resendSent}
            >
              {resendSent ? "✅ Email resent!" : "Resend verification email"}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email" id="email" name="email"
              value={formData.email} onChange={handleChange}
              placeholder="yourname@example.com" required autoFocus
            />
          </div>

          <div className="form-group password-group">
            <label htmlFor="password">Password</label>
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password" name="password"
                value={formData.password} onChange={handleChange}
                placeholder="••••••••" required
              />
              <button type="button" className="toggle-password" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div className="form-options">
            <label className="remember-me">
              <input type="checkbox" /> Remember me
            </label>
            <Link to="/forgot-password" className="forgot-password">Forgot password?</Link>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="signup-link">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
