import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function AccountStatus() {
  const navigate = useNavigate();
  const [statusInfo, setStatusInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      const token = localStorage.getItem("token");
      const userData = JSON.parse(localStorage.getItem("user") || "{}");

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        // Decode JWT token
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        
        // Fetch current status from database
        let dbStatus = null;
        if (userData.role === "stakeholder") {
          const res = await fetch(`${API_BASE_URL}/api/profile/stakeholder/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            dbStatus = data.status;
          }
        }

        setStatusInfo({
          localStorage: userData.status,
          jwtToken: tokenPayload.status,
          database: dbStatus,
          role: userData.role,
          email: userData.email,
          needsRefresh: dbStatus === "approved" && tokenPayload.status !== "approved"
        });
      } catch (err) {
        console.error("Status check error:", err);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Loading...</div>;
  }

  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Account Status Diagnostic</h1>
      
      <div style={{ 
        background: "#f5f5f5", 
        padding: "20px", 
        borderRadius: "8px",
        marginTop: "20px"
      }}>
        <h2>Status Information</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "12px", fontWeight: "bold" }}>Email:</td>
              <td style={{ padding: "12px" }}>{statusInfo?.email}</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "12px", fontWeight: "bold" }}>Role:</td>
              <td style={{ padding: "12px" }}>{statusInfo?.role}</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "12px", fontWeight: "bold" }}>Status (LocalStorage):</td>
              <td style={{ padding: "12px" }}>
                <span style={{ 
                  padding: "4px 12px", 
                  borderRadius: "4px",
                  background: statusInfo?.localStorage === "approved" ? "#4caf50" : "#ff9800",
                  color: "white"
                }}>
                  {statusInfo?.localStorage}
                </span>
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "12px", fontWeight: "bold" }}>Status (JWT Token):</td>
              <td style={{ padding: "12px" }}>
                <span style={{ 
                  padding: "4px 12px", 
                  borderRadius: "4px",
                  background: statusInfo?.jwtToken === "approved" ? "#4caf50" : "#ff9800",
                  color: "white"
                }}>
                  {statusInfo?.jwtToken}
                </span>
              </td>
            </tr>
            {statusInfo?.database && (
              <tr style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "12px", fontWeight: "bold" }}>Status (Database):</td>
                <td style={{ padding: "12px" }}>
                  <span style={{ 
                    padding: "4px 12px", 
                    borderRadius: "4px",
                    background: statusInfo?.database === "approved" ? "#4caf50" : "#ff9800",
                    color: "white"
                  }}>
                    {statusInfo?.database}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {statusInfo?.needsRefresh && (
        <div style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          padding: "20px",
          borderRadius: "8px",
          marginTop: "20px"
        }}>
          <h3>⚠️ Session Refresh Required</h3>
          <p>
            Your account has been approved in the database, but your JWT token still has the old status.
            You need to log out and log back in to get a fresh token.
          </p>
          <button
            onClick={handleLogout}
            style={{
              background: "white",
              color: "#667eea",
              border: "none",
              padding: "12px 24px",
              borderRadius: "6px",
              fontWeight: "600",
              cursor: "pointer",
              marginTop: "10px"
            }}
          >
            Log Out Now
          </button>
        </div>
      )}

      {statusInfo?.jwtToken === "incomplete" && (
        <div style={{
          background: "#fff3cd",
          border: "1px solid #ffc107",
          padding: "20px",
          borderRadius: "8px",
          marginTop: "20px"
        }}>
          <h3>📝 Profile Incomplete</h3>
          <p>You need to complete your profile before you can make purchase requests.</p>
          <button
            onClick={() => navigate("/profile/stakeholder")}
            style={{
              background: "#ffc107",
              color: "#000",
              border: "none",
              padding: "12px 24px",
              borderRadius: "6px",
              fontWeight: "600",
              cursor: "pointer",
              marginTop: "10px"
            }}
          >
            Complete Profile
          </button>
        </div>
      )}

      {statusInfo?.jwtToken === "pending" && (
        <div style={{
          background: "#e3f2fd",
          border: "1px solid #2196f3",
          padding: "20px",
          borderRadius: "8px",
          marginTop: "20px"
        }}>
          <h3>⏳ Pending Admin Approval</h3>
          <p>Your profile has been submitted and is waiting for admin approval.</p>
        </div>
      )}

      {statusInfo?.jwtToken === "approved" && !statusInfo?.needsRefresh && (
        <div style={{
          background: "#d4edda",
          border: "1px solid #28a745",
          padding: "20px",
          borderRadius: "8px",
          marginTop: "20px"
        }}>
          <h3>✅ Account Approved</h3>
          <p>Your account is approved and you can make purchase requests!</p>
          <button
            onClick={() => navigate("/stakeholders")}
            style={{
              background: "#28a745",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: "6px",
              fontWeight: "600",
              cursor: "pointer",
              marginTop: "10px"
            }}
          >
            Browse Industries
          </button>
        </div>
      )}

      <div style={{ marginTop: "30px" }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "#6c757d",
            color: "white",
            border: "none",
            padding: "12px 24px",
            borderRadius: "6px",
            cursor: "pointer",
            marginRight: "10px"
          }}
        >
          ← Back
        </button>
        <button
          onClick={handleLogout}
          style={{
            background: "#dc3545",
            color: "white",
            border: "none",
            padding: "12px 24px",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          Log Out
        </button>
      </div>
    </div>
  );
}

export default AccountStatus;
