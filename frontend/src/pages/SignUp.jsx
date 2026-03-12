import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./SignUp.css";

function SignUp() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "", confirmPassword: "", role: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.role) { setError("Please select your role"); return; }
    if (formData.password !== formData.confirmPassword) { setError("Passwords do not match"); return; }
    if (formData.password.length < 8) { setError("Password must be at least 8 characters"); return; }

    setLoading(true);
    try {
      // Step 1: Create account
      const signupRes = await fetch("http://localhost:5000/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, password: formData.password, role: formData.role }),
      });
      const signupData = await signupRes.json();
      if (!signupRes.ok) throw new Error(signupData.message || "Signup failed");

      // Step 2: Auto-login
      const loginRes = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error(loginData.message || "Login failed");

      localStorage.setItem("token", loginData.token);
      localStorage.setItem("user", JSON.stringify(loginData.user));

      // Step 3: Redirect to role dashboard
      if (loginData.user.role === "industry") {
        navigate("/industry");
      } else {
        navigate("/stakeholders");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-container">
        <div className="signup-icon">🏗️</div>
        <h1>Create Your EthioBridge Account</h1>
        <p>Join Ethiopia's construction network today</p>

        {error && <p className="error-message">{error}</p>}

        <form className="signup-form" onSubmit={handleSubmit}>
          {/* Role selection */}
          <div className="role-buttons">
            <label className={`role-btn ${formData.role === "stakeholder" ? "active" : ""}`}>
              <input type="radio" name="role" value="stakeholder" checked={formData.role === "stakeholder"} onChange={handleChange} required />
              🤝 Stakeholder (Contractor, Engineer, Developer, Buyer...)
            </label>
            <label className={`role-btn ${formData.role === "industry" ? "active" : ""}`}>
              <input type="radio" name="role" value="industry" checked={formData.role === "industry"} onChange={handleChange} />
              🏭 Industry (Manufacturer, Supplier, Producer...)
            </label>
          </div>

          {formData.role && (
            <>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} placeholder="yourname@example.com" required />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} placeholder="At least 8 characters" required />
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input type="password" id="confirmPassword" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Confirm your password" required />
              </div>
              <button type="submit" className="signup-btn" disabled={loading}>
                {loading ? "Creating Account..." : "Create Account & Continue →"}
              </button>
            </>
          )}
        </form>

        <p className="login-link">Already have an account? <Link to="/login">Log in</Link></p>
      </div>
    </div>
  );
}

export default SignUp;
