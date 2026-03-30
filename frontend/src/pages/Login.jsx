import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Login failed");

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

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
      <div className="login-container">
        <div className="login-icon">
          <Logo size={80} color="#667eea" />
        </div>
        <div className="login-header">
          <h1>Welcome Back</h1>
          <p>Log in to your EthioBridge account</p>
        </div>

        {error && <p className="error-message">{error}</p>}

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
