import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import "./VerifyEmail.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [resendEmail, setResendEmail] = useState("");
  const [resendSent, setResendSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // Backend redirects here with ?status=success|expired|invalid|already_verified
  // OR frontend links here with ?token=... (legacy — call API directly)
  const statusParam = searchParams.get("status");
  const tokenParam  = searchParams.get("token");

  const [status, setStatus] = useState(statusParam || (tokenParam ? "loading" : "invalid"));

  useEffect(() => {
    // If we got a raw token (old-style link), call the API ourselves
    if (tokenParam && !statusParam) {
      fetch(`${API}/api/verify-email?token=${tokenParam}`)
        .then(r => r.json())
        .then(data => {
          if (data.code === "success")               setStatus("success");
          else if (data.code === "already_verified") setStatus("already_verified");
          else if (data.code === "expired")          setStatus("expired");
          else                                       setStatus("invalid");
        })
        .catch(() => setStatus("invalid"));
    }
  }, [tokenParam, statusParam]); // eslint-disable-line

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail) return;
    setResendLoading(true);
    try {
      await fetch(`${API}/api/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      setResendSent(true);
    } catch { /* silent */ }
    finally { setResendLoading(false); }
  };

  const resendForm = resendSent ? (
    <div className="ve-success-msg">✅ Verification email sent! Check your inbox.</div>
  ) : (
    <form onSubmit={handleResend} className="ve-resend-form">
      <input type="email" placeholder="your@email.com" value={resendEmail}
        onChange={e => setResendEmail(e.target.value)} required className="ve-input" />
      <button type="submit" className="ve-btn" disabled={resendLoading}>
        {resendLoading ? "Sending..." : "Resend Verification Email"}
      </button>
    </form>
  );

  const content = {
    loading: {
      icon: "⏳", title: "Verifying your email...",
      body: <p>Please wait while we verify your email address.</p>,
      color: "#3b82f6",
    },
    success: {
      icon: "✅", title: "Email Verified!",
      body: <>
        <p>Your email address has been successfully verified. You can now log in to your EthioBridge account.</p>
        <Link to="/login" className="ve-btn">Log In Now →</Link>
      </>,
      color: "#0a5c2f",
    },
    already_verified: {
      icon: "✓", title: "Already Verified",
      body: <>
        <p>This email address has already been verified. You can log in directly.</p>
        <Link to="/login" className="ve-btn">Log In →</Link>
      </>,
      color: "#0a5c2f",
    },
    expired: {
      icon: "⏰", title: "Link Expired",
      body: <>
        <p>This verification link has expired. Links are valid for 24 hours.</p>
        <p>Enter your email below to receive a new one:</p>
        {resendForm}
      </>,
      color: "#f59e0b",
    },
    invalid: {
      icon: "❌", title: "Invalid Link",
      body: <>
        <p>This verification link is invalid or has already been used.</p>
        <p>Enter your email to get a new verification link:</p>
        {resendForm}
        <Link to="/login" className="ve-link">Back to Login</Link>
      </>,
      color: "#ef4444",
    },
  };

  const c = content[status] || content.invalid;

  return (
    <div className="ve-page">
      <div className="ve-card">
        <div className="ve-logo">🌉 EthioBridge</div>
        <div className="ve-icon" style={{ color: c.color }}>{c.icon}</div>
        <h1 className="ve-title" style={{ color: c.color }}>{c.title}</h1>
        <div className="ve-body">{c.body}</div>
      </div>
    </div>
  );
}
