import React, { useState, useEffect } from "react";
import Logo from "../components/Logo";
import "./AdminDashboard.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("pending");
  const [view, setView] = useState("users"); // "users" or "purchases"
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [viewDetailsModal, setViewDetailsModal] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("adminToken");
      const endpoint = filter === "pending"
        ? "http://localhost:5000/api/admin/pending"
        : "http://localhost:5000/api/admin/users";
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load users");
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("adminToken");
      const url = filter === "all" 
        ? `${API_BASE_URL}/api/admin/purchases`
        : `${API_BASE_URL}/api/admin/purchases?status=${filter}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load purchase requests");
      setPurchaseRequests(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (view === "users") {
      fetchUsers();
    } else {
      fetchPurchaseRequests();
    }
  }, [filter, view]);

  const handleApprove = async (id) => {
    setActionLoading(id + "-approve");
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/purchases/${id}/approve`, { 
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      alert("Purchase request approved!");
      fetchPurchaseRequests();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUserApprove = async (id) => {
    setActionLoading(id + "-approve");
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${id}/approve`, { 
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      alert("User approved successfully!");
      fetchUsers();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUserReject = async () => {
    if (!rejectReason.trim()) { alert("Please enter a rejection reason"); return; }
    setActionLoading(rejectModal + "-reject");
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${rejectModal}/reject`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ rejectionReason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      alert("User rejected.");
      setRejectModal(null);
      setRejectReason("");
      fetchUsers();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { alert("Please enter a rejection reason"); return; }
    setActionLoading(rejectModal.id + "-reject");
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE_URL}/api/admin/purchases/${rejectModal.id}/reject`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ admin_notes: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      alert("Purchase request rejected.");
      setRejectModal(null);
      setRejectReason("");
      fetchPurchaseRequests();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      pending: { label: "Pending", color: "#f59e0b", bg: "#fff8e1" },
      approved: { label: "Approved", color: "#0a5c2f", bg: "#e8f5e9" },
      rejected: { label: "Rejected", color: "#dc2626", bg: "#fff5f5" },
      incomplete: { label: "Incomplete", color: "#888", bg: "#f5f5f5" },
    };
    const s = map[status] || map.incomplete;
    return (
      <span style={{ background: s.bg, color: s.color, padding: "4px 12px", borderRadius: "50px", fontSize: "0.8rem", fontWeight: 700 }}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <Logo size={32} color="#667eea" />
          <span>EthioBridge Admin</span>
        </div>
        <nav className="admin-nav">
          <button className={view === "users" ? "active" : ""} onClick={() => setView("users")}>
            👥 User Management
          </button>
          <button className={view === "purchases" ? "active" : ""} onClick={() => setView("purchases")}>
            📋 Purchase Requests
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <main className="admin-main">
        {view === "users" ? (
          <>
            <div className="admin-topbar">
              <div>
                <h1>{filter === "pending" ? "Pending Applications" : "All Users"}</h1>
                <p>{users.length} {filter === "pending" ? "applications awaiting review" : "total users"}</p>
              </div>
              <div className="topbar-actions">
                <button className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}>
                  Pending
                </button>
                <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
                  All
                </button>
                <button className="refresh-btn" onClick={fetchUsers}>↻ Refresh</button>
              </div>
            </div>

            {error && <div className="admin-error">{error}</div>}

            {loading ? (
              <div className="admin-loading">Loading...</div>
            ) : users.length === 0 ? (
              <div className="admin-empty">
                <span>✅</span>
                <p>No {filter === "pending" ? "pending applications" : "users"} found.</p>
              </div>
            ) : (
              <div className="users-grid">
                {users.map((user) => (
                  <div className="user-card" key={user.id}>
                    <div className="user-card-header">
                      <div className="user-avatar">
                        {user.role === "industry" ? "🏭" : "🤝"}
                      </div>
                      <div className="user-meta">
                        <h3>{user.company_name || user.organization_name || user.email}</h3>
                        <span className="user-role-tag">{user.role}</span>
                      </div>
                      {getStatusBadge(user.status)}
                    </div>

                    <div className="user-details">
                      <div className="detail-row"><span>📧</span><span>{user.email}</span></div>
                      {user.role === "industry" && (
                        <>
                          {user.sector && <div className="detail-row"><span>🏗️</span><span>{user.sector}</span></div>}
                          {user.industry_location && <div className="detail-row"><span>📍</span><span>{user.industry_location}</span></div>}
                        </>
                      )}
                      {user.role === "stakeholder" && (
                        <>
                          {user.organization_type && <div className="detail-row"><span>🏢</span><span>{user.organization_type}</span></div>}
                          {user.stakeholder_location && <div className="detail-row"><span>📍</span><span>{user.stakeholder_location}</span></div>}
                        </>
                      )}
                      <button 
                        className="view-details-btn" 
                        onClick={() => setViewDetailsModal(user)}
                        style={{
                          marginTop: '10px',
                          padding: '8px 16px',
                          background: '#f0f0f0',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.9em'
                        }}
                      >
                        👁️ View Full Details
                      </button>
                    </div>

                    {user.status === "pending" && (
                      <div className="user-actions">
                        <button
                          className="approve-btn"
                          onClick={() => handleUserApprove(user.id)}
                          disabled={actionLoading === user.id + "-approve"}
                        >
                          {actionLoading === user.id + "-approve" ? "..." : "✓ Approve"}
                        </button>
                        <button
                          className="reject-btn"
                          onClick={() => { setRejectModal({ id: user.id, type: 'user' }); setRejectReason(""); }}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          // Purchase Requests View
          <>
            <div className="admin-topbar">
              <div>
                <h1>Purchase Requests</h1>
                <p>{purchaseRequests.length} total requests</p>
              </div>
              <div className="topbar-actions">
                <button className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}>
                  Pending
                </button>
                <button className={filter === "approved" ? "active" : ""} onClick={() => setFilter("approved")}>
                  Approved
                </button>
                <button className={filter === "rejected" ? "active" : ""} onClick={() => setFilter("rejected")}>
                  Rejected
                </button>
                <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
                  All
                </button>
                <button className="refresh-btn" onClick={fetchPurchaseRequests}>↻ Refresh</button>
              </div>
            </div>

            {error && <div className="admin-error">{error}</div>}

            {loading ? (
              <div style={{textAlign: 'center', padding: '60px', color: '#999'}}>
                <div style={{fontSize: '48px', marginBottom: '16px'}}>⏳</div>
                <p>Loading purchase requests...</p>
              </div>
            ) : purchaseRequests.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '80px 20px',
                background: '#f8f9fa',
                borderRadius: '16px',
                border: '2px dashed #dee2e6'
              }}>
                <div style={{fontSize: '72px', marginBottom: '20px'}}>📋</div>
                <h3 style={{color: '#6c757d', marginBottom: '10px', fontSize: '20px'}}>No Purchase Requests</h3>
                <p style={{color: '#adb5bd', fontSize: '14px'}}>
                  {filter === 'all' ? 'No purchase requests have been submitted yet' : `No ${filter} purchase requests`}
                </p>
              </div>
            ) : (
              <div style={{display: 'grid', gap: '20px'}}>
                {purchaseRequests.map((req) => (
                  <div key={req.id} style={{
                    background: 'white',
                    border: '1px solid #e9ecef',
                    borderRadius: '16px',
                    padding: '24px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    transition: 'all 0.3s',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                    e.currentTarget.style.transform = 'translateY(-4px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}>
                    {/* Status Indicator Bar */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '4px',
                      background: req.status === 'approved' ? 'linear-gradient(90deg, #10b981, #059669)' : 
                                 req.status === 'rejected' ? 'linear-gradient(90deg, #ef4444, #dc2626)' : 
                                 'linear-gradient(90deg, #f59e0b, #d97706)'
                    }} />

                    {/* Header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '20px',
                      paddingBottom: '16px',
                      borderBottom: '2px solid #f1f3f5'
                    }}>
                      <div style={{flex: 1}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px'}}>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#6c757d',
                            background: '#f8f9fa',
                            padding: '4px 10px',
                            borderRadius: '6px'
                          }}>
                            #{req.id}
                          </span>
                          {getStatusBadge(req.status)}
                        </div>
                        <h3 style={{
                          margin: '0',
                          fontSize: '22px',
                          color: '#212529',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          📦 {req.product_name}
                        </h3>
                        <p style={{
                          margin: '8px 0 0',
                          fontSize: '14px',
                          color: '#6c757d'
                        }}>
                          Requested on {new Date(req.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      <div style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        padding: '16px 20px',
                        borderRadius: '12px',
                        textAlign: 'center',
                        minWidth: '100px',
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                      }}>
                        <div style={{fontSize: '28px', fontWeight: '800', lineHeight: '1'}}>
                          {req.quantity}
                        </div>
                        <div style={{fontSize: '11px', marginTop: '4px', opacity: 0.9, fontWeight: '600'}}>
                          UNITS
                        </div>
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '20px',
                      marginBottom: '20px'
                    }}>
                      {/* Industry Card */}
                      <div style={{
                        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                        padding: '16px',
                        borderRadius: '12px',
                        color: 'white'
                      }}>
                        <div style={{fontSize: '24px', marginBottom: '8px'}}>🏭</div>
                        <div style={{fontSize: '11px', opacity: 0.9, marginBottom: '4px', fontWeight: '600'}}>
                          INDUSTRY
                        </div>
                        <div style={{fontSize: '16px', fontWeight: '700'}}>
                          {req.industry_name}
                        </div>
                        <div style={{fontSize: '13px', opacity: 0.9, marginTop: '4px'}}>
                          {req.sector}
                        </div>
                      </div>

                      {/* Stakeholder Card */}
                      <div style={{
                        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                        padding: '16px',
                        borderRadius: '12px',
                        color: 'white'
                      }}>
                        <div style={{fontSize: '24px', marginBottom: '8px'}}>🤝</div>
                        <div style={{fontSize: '11px', opacity: 0.9, marginBottom: '4px', fontWeight: '600'}}>
                          STAKEHOLDER
                        </div>
                        <div style={{fontSize: '16px', fontWeight: '700'}}>
                          {req.organization_name}
                        </div>
                        <div style={{fontSize: '13px', opacity: 0.9, marginTop: '4px'}}>
                          {req.full_name}
                        </div>
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '12px',
                      padding: '16px',
                      background: '#f8f9fa',
                      borderRadius: '12px',
                      marginBottom: req.status === 'pending' ? '20px' : '0'
                    }}>
                      <div>
                        <div style={{fontSize: '11px', color: '#6c757d', marginBottom: '4px', fontWeight: '600'}}>
                          📞 PHONE
                        </div>
                        <div style={{fontSize: '14px', fontWeight: '600', color: '#212529'}}>
                          {req.phone}
                        </div>
                      </div>
                      <div>
                        <div style={{fontSize: '11px', color: '#6c757d', marginBottom: '4px', fontWeight: '600'}}>
                          📍 LOCATION
                        </div>
                        <div style={{fontSize: '14px', fontWeight: '600', color: '#212529'}}>
                          {req.location}
                        </div>
                      </div>
                      {req.notes && (
                        <div style={{gridColumn: '1 / -1'}}>
                          <div style={{fontSize: '11px', color: '#6c757d', marginBottom: '4px', fontWeight: '600'}}>
                            📝 NOTES
                          </div>
                          <div style={{fontSize: '14px', color: '#495057', lineHeight: '1.5'}}>
                            {req.notes}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {req.status === 'pending' && (
                      <div style={{display: 'flex', gap: '12px', marginTop: '20px'}}>
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={actionLoading === req.id + "-approve"}
                          style={{
                            flex: 1,
                            padding: '14px 24px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '15px',
                            fontWeight: '700',
                            cursor: actionLoading === req.id + "-approve" ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                            opacity: actionLoading === req.id + "-approve" ? 0.6 : 1
                          }}
                          onMouseOver={(e) => {
                            if (!actionLoading) {
                              e.target.style.transform = 'translateY(-2px)';
                              e.target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
                            }
                          }}
                          onMouseOut={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                          }}
                        >
                          {actionLoading === req.id + "-approve" ? '⏳ Approving...' : '✓ Approve Request'}
                        </button>
                        <button
                          onClick={() => { setRejectModal({ id: req.id, type: 'purchase' }); setRejectReason(""); }}
                          style={{
                            flex: 1,
                            padding: '14px 24px',
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '15px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                          }}
                          onMouseOver={(e) => {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.4)';
                          }}
                          onMouseOut={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                          }}
                        >
                          ✕ Reject Request
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="modal-overlay" onClick={() => setRejectModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Reject {rejectModal.type === 'user' ? 'User' : 'Request'}</h2>
            <p>Please provide a reason for rejection.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
            />
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setRejectModal(null)}>Cancel</button>
              <button
                className="modal-reject"
                onClick={rejectModal.type === 'user' ? handleUserReject : handleReject}
                disabled={actionLoading === rejectModal.id + "-reject"}
              >
                {actionLoading === rejectModal.id + "-reject" ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewDetailsModal && (
        <div className="modal-overlay" onClick={() => setViewDetailsModal(null)} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{
            maxWidth: '700px',
            width: '90%',
            maxHeight: '85vh',
            overflow: 'auto',
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            padding: '0'
          }}>
            {/* Modal Header */}
            <div style={{
              background: viewDetailsModal.role === 'industry' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              padding: '30px',
              borderRadius: '16px 16px 0 0',
              color: 'white',
              position: 'relative'
            }}>
              <button 
                onClick={() => setViewDetailsModal(null)}
                style={{
                  position: 'absolute',
                  top: '15px',
                  right: '15px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '35px',
                  height: '35px',
                  cursor: 'pointer',
                  fontSize: '20px',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
              >
                ✕
              </button>
              <div style={{fontSize: '48px', marginBottom: '10px'}}>
                {viewDetailsModal.role === 'industry' ? '🏭' : '🤝'}
              </div>
              <h2 style={{margin: '0', fontSize: '28px', fontWeight: '600'}}>
                {viewDetailsModal.company_name || viewDetailsModal.organization_name}
              </h2>
              <p style={{margin: '8px 0 0', opacity: 0.9, fontSize: '14px'}}>
                {viewDetailsModal.role === 'industry' ? 'Industry Profile' : 'Stakeholder Profile'}
              </p>
            </div>
            
            {/* Modal Body */}
            <div style={{padding: '30px'}}>
              <div style={{
                display: 'inline-block',
                marginBottom: '20px'
              }}>
                {getStatusBadge(viewDetailsModal.status)}
              </div>
              
              <div style={{display: 'grid', gap: '20px'}}>
                {/* Basic Info Card */}
                <div style={{
                  background: '#f8f9fa',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid #e9ecef'
                }}>
                  <h3 style={{margin: '0 0 15px', fontSize: '16px', color: '#495057', fontWeight: '600'}}>
                    📋 Basic Information
                  </h3>
                  <div style={{display: 'grid', gap: '12px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <span style={{fontSize: '18px'}}>📧</span>
                      <div>
                        <div style={{fontSize: '12px', color: '#6c757d'}}>Email</div>
                        <div style={{fontWeight: '500'}}>{viewDetailsModal.email}</div>
                      </div>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <span style={{fontSize: '18px'}}>📅</span>
                      <div>
                        <div style={{fontSize: '12px', color: '#6c757d'}}>Registered</div>
                        <div style={{fontWeight: '500'}}>{new Date(viewDetailsModal.created_at).toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'})}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Industry Specific Info */}
                {viewDetailsModal.role === 'industry' && (
                  <div style={{
                    background: '#f8f9fa',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid #e9ecef'
                  }}>
                    <h3 style={{margin: '0 0 15px', fontSize: '16px', color: '#495057', fontWeight: '600'}}>
                      🏢 Company Details
                    </h3>
                    <div style={{display: 'grid', gap: '12px'}}>
                      {viewDetailsModal.sector && (
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                          <span style={{fontSize: '18px'}}>🏗️</span>
                          <div>
                            <div style={{fontSize: '12px', color: '#6c757d'}}>Sector</div>
                            <div style={{fontWeight: '500'}}>{viewDetailsModal.sector}</div>
                          </div>
                        </div>
                      )}
                      {viewDetailsModal.industry_location && (
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                          <span style={{fontSize: '18px'}}>📍</span>
                          <div>
                            <div style={{fontSize: '12px', color: '#6c757d'}}>Location</div>
                            <div style={{fontWeight: '500'}}>{viewDetailsModal.industry_location}</div>
                          </div>
                        </div>
                      )}
                      {viewDetailsModal.industry_phone && (
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                          <span style={{fontSize: '18px'}}>📞</span>
                          <div>
                            <div style={{fontSize: '12px', color: '#6c757d'}}>Phone</div>
                            <div style={{fontWeight: '500'}}>{viewDetailsModal.industry_phone}</div>
                          </div>
                        </div>
                      )}
                      {viewDetailsModal.website && (
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                          <span style={{fontSize: '18px'}}>🌐</span>
                          <div>
                            <div style={{fontSize: '12px', color: '#6c757d'}}>Website</div>
                            <a href={viewDetailsModal.website} target="_blank" rel="noopener noreferrer" style={{
                              fontWeight: '500',
                              color: '#667eea',
                              textDecoration: 'none'
                            }}>
                              {viewDetailsModal.website}
                            </a>
                          </div>
                        </div>
                      )}
                      {viewDetailsModal.established_year && (
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                          <span style={{fontSize: '18px'}}>🎂</span>
                          <div>
                            <div style={{fontSize: '12px', color: '#6c757d'}}>Established</div>
                            <div style={{fontWeight: '500'}}>{viewDetailsModal.established_year}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Stakeholder Specific Info */}
                {viewDetailsModal.role === 'stakeholder' && (
                  <div style={{
                    background: '#f8f9fa',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid #e9ecef'
                  }}>
                    <h3 style={{margin: '0 0 15px', fontSize: '16px', color: '#495057', fontWeight: '600'}}>
                      🏢 Organization Details
                    </h3>
                    <div style={{display: 'grid', gap: '12px'}}>
                      {viewDetailsModal.organization_type && (
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                          <span style={{fontSize: '18px'}}>🏢</span>
                          <div>
                            <div style={{fontSize: '12px', color: '#6c757d'}}>Type</div>
                            <div style={{fontWeight: '500'}}>{viewDetailsModal.organization_type}</div>
                          </div>
                        </div>
                      )}
                      {viewDetailsModal.stakeholder_location && (
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                          <span style={{fontSize: '18px'}}>📍</span>
                          <div>
                            <div style={{fontSize: '12px', color: '#6c757d'}}>Location</div>
                            <div style={{fontWeight: '500'}}>{viewDetailsModal.stakeholder_location}</div>
                          </div>
                        </div>
                      )}
                      {viewDetailsModal.stakeholder_phone && (
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                          <span style={{fontSize: '18px'}}>📞</span>
                          <div>
                            <div style={{fontSize: '12px', color: '#6c757d'}}>Phone</div>
                            <div style={{fontWeight: '500'}}>{viewDetailsModal.stakeholder_phone}</div>
                          </div>
                        </div>
                      )}
                      {viewDetailsModal.contact_person && (
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                          <span style={{fontSize: '18px'}}>👤</span>
                          <div>
                            <div style={{fontSize: '12px', color: '#6c757d'}}>Contact Person</div>
                            <div style={{fontWeight: '500'}}>{viewDetailsModal.contact_person}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Description */}
                {(viewDetailsModal.industry_description || viewDetailsModal.stakeholder_description) && (
                  <div style={{
                    background: '#f8f9fa',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid #e9ecef'
                  }}>
                    <h3 style={{margin: '0 0 15px', fontSize: '16px', color: '#495057', fontWeight: '600'}}>
                      📝 Description
                    </h3>
                    <p style={{
                      margin: 0,
                      color: '#6c757d',
                      lineHeight: '1.6',
                      fontSize: '14px'
                    }}>
                      {viewDetailsModal.industry_description || viewDetailsModal.stakeholder_description}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Modal Footer */}
            <div style={{
              padding: '20px 30px',
              borderTop: '1px solid #e9ecef',
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end',
              background: '#f8f9fa',
              borderRadius: '0 0 16px 16px'
            }}>
              <button 
                onClick={() => setViewDetailsModal(null)}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#f8f9fa'}
                onMouseOut={(e) => e.target.style.background = 'white'}
              >
                Close
              </button>
              {viewDetailsModal.status === 'pending' && (
                <>
                  <button
                    onClick={() => {
                      handleUserApprove(viewDetailsModal.id);
                      setViewDetailsModal(null);
                    }}
                    style={{
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                    }}
                    onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                    onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => {
                      setRejectModal({ id: viewDetailsModal.id, type: 'user' });
                      setViewDetailsModal(null);
                      setRejectReason("");
                    }}
                    style={{
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 12px rgba(245, 87, 108, 0.4)'
                    }}
                    onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                    onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
                  >
                    ✕ Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
