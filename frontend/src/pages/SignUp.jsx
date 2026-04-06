import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "./SignUp.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function SignUp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({ email: "", password: "", confirmPassword: "", role: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(null); // email address after successful signup
  const [googleAvailable, setGoogleAvailable] = useState(false);

  useEffect(() => {
    // Show error from Google OAuth redirect if any
    const oauthError = searchParams.get("error");
    if (oauthError) setError("Google sign-in failed. Please try again or use email.");

    // Check if Google OAuth is configured on the backend
    fetch(`${API_BASE_URL}/api/auth/google/status`)
      .then(r => r.json())
      .then(d => setGoogleAvailable(d.configured))
      .catch(() => setGoogleAvailable(false));
  }, [searchParams]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.role) { setError("Please select your role"); return; }
    if (formData.password !== formData.confirmPassword) { setError("Passwords do not match"); return; }
    if (formData.password.length < 8) { setError("Password must be at least 8 characters"); return; }

    setLoading(true);
    try {
      const signupRes = await fetch(`${API_BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, password: formData.password, role: formData.role }),
      });
      const signupData = await signupRes.json();
      
      if (!signupRes.ok) {
        // Handle specific error cases
        if (signupRes.status === 409) {
          throw new Error("This email is already registered. Please log in or use a different email.");
        }
        throw new Error(signupData.message || "Signup failed");
      }

      // Show "check your email" — don't auto-login until verified
      setEmailSent(formData.email);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <Link to="/" className="home-icon-btn" title="Back to Home">
        🏠
      </Link>
      <div className="signup-container">

        {/* ── Email sent confirmation screen ── */}
        {emailSent ? (
          <>
            <div className="signup-icon">✉️</div>
            <h1>Check Your Email</h1>
            <p style={{ color: "#555", marginBottom: 20 }}>
              We sent a verification link to <strong>{emailSent}</strong>.
              Click the link in the email to activate your account.
            </p>
            <div style={{ background: "#e8f5e9", borderRadius: 12, padding: "16px 20px", marginBottom: 20, fontSize: "0.9rem", color: "#0a5c2f" }}>
              ✅ Verification email sent! Check your inbox (and spam folder).
            </div>
            <p style={{ fontSize: "0.85rem", color: "#888" }}>
              Didn't receive it?{" "}
              <button style={{ background: "none", border: "none", color: "#0a5c2f", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem" }}
                onClick={async () => {
                  await fetch(`${API_BASE_URL}/api/resend-verification`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: emailSent }),
                  });
                  alert("Verification email resent!");
                }}>
                Resend email
              </button>
            </p>
            <p className="login-link" style={{ marginTop: 16 }}>
              Already verified? <Link to="/login">Log in</Link>
            </p>
          </>
        ) : (
          <>
            <div className="signup-icon">🏗️</div>
            <h1>Create Your EthioBridge Account</h1>
            <p>Join Ethiopia's construction network today</p>

            {error && <p className="error-message">{error}</p>}

            <form className="signup-form" onSubmit={handleSubmit}>
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
          </>
        )}
      </div>
    </div>
  );
}

export default SignUp;
