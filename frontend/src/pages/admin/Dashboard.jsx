import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import DashboardHome from "./DashboardHome";
import IndustriesView from "../views/IndustriesView";
import ProductsView from "../views/ProductsView";
import AnalyticsView from "../views/AnalyticsView";
import ActivityLogsView, { logAction } from "../views/ActivityLogsView";
import NotificationsView from "../views/NotificationsView";
import Settings from "./Settings";

const API = "http://localhost:5000";

function StatusBadge({ status }) {
  const map = {
    pending:              { label: "Pending Review",        color: "#f59e0b", bg: "#fff8e1" },
    pending_verification: { label: "Needs ID Verification", color: "#7c3aed", bg: "#f3e8ff" },
    approved:             { label: "Approved",              color: "#0a5c2f", bg: "#e8f5e9" },
    rejected:             { label: "Rejected",              color: "#dc2626", bg: "#fff5f5" },
    incomplete:           { label: "Incomplete",            color: "#888",    bg: "#f5f5f5" },
    suspended:            { label: "Suspended",             color: "#d97706", bg: "#fffbeb" },
    banned:               { label: "Banned",                color: "#dc2626", bg: "#fff5f5" },
  };
  const s = map[status] || map.incomplete;
  return (
    <span style={{ background: s.bg, color: s.color, padding: "4px 12px", borderRadius: "50px", fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

const NAV = [
  { id: "home",      icon: "📊", label: "Dashboard" },
  { id: "users",     icon: "👥", label: "Approvals" },
  { id: "purchases", icon: "📋", label: "Purchase Requests" },
  { id: "manage",    icon: "🛡️", label: "User Management" },
  { id: "industries",icon: "🏭", label: "Industries" },
  { id: "products",  icon: "📦", label: "Products" },
  { id: "analytics", icon: "📈", label: "Analytics" },
  { id: "notifs",    icon: "🔔", label: "Notifications" },
  { id: "logs",      icon: "📝", label: "Activity Logs" },
  { id: "settings",  icon: "⚙️", label: "Settings" },
];

function Dashboard() {
  const navigate = useNavigate();
  const tok = () => localStorage.getItem("adminToken");

  const [view, setView]           = useState("home");
  const [darkMode, setDarkMode]   = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  // Approvals
  const [users, setUsers]         = useState([]);
  const [filter, setFilter]       = useState("pending");
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [viewDetailsModal, setViewDetailsModal] = useState(null);

  // Purchases
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [prFilter, setPrFilter]   = useState("pending");
  const [prSearch, setPrSearch]   = useState("");

  // User management
  const [allUsers, setAllUsers]   = useState([]);
  const [umSearch, setUmSearch]   = useState("");
  const [umRole, setUmRole]       = useState("all");
  const [umStatus, setUmStatus]   = useState("all");
  const [actionModal, setActionModal] = useState(null);
  const [actionReason, setActionReason] = useState("");

  const handleLogout = () => { localStorage.removeItem("adminToken"); navigate("/login"); };

  const fetchUsers = async () => {
    setLoading(true); setError("");
    try {
      const ep = filter === "pending" ? `${API}/api/admin/pending` : `${API}/api/admin/users`;
      const res = await fetch(ep, { headers: { Authorization: `Bearer ${tok()}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setUsers(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const fetchPurchaseRequests = async () => {
    setLoading(true); setError("");
    try {
      const url = prFilter === "all" ? `${API}/api/admin/purchases` : `${API}/api/admin/purchases?status=${prFilter}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tok()}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setPurchaseRequests(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const fetchAllUsers = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/api/admin/users/all`, { headers: { Authorization: `Bearer ${tok()}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAllUsers(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (view === "users")          fetchUsers();
    else if (view === "purchases") fetchPurchaseRequests();
    else if (view === "manage")    fetchAllUsers();
  }, [view, filter, prFilter]); // eslint-disable-line

  const handleUserApprove = async (id, name) => {
    setActionLoading(id + "-approve");
    try {
      const res = await fetch(`${API}/api/admin/users/${id}/approve`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      logAction("approve", `Approved user: ${name || id}`);
      fetchUsers();
    } catch (e) { alert("Error: " + e.message); }
    finally { setActionLoading(null); }
  };

  const handleUserReject = async () => {
    if (!rejectReason.trim()) { alert("Please enter a rejection reason"); return; }
    setActionLoading(rejectModal.id + "-reject");
    try {
      const res = await fetch(`${API}/api/admin/users/${rejectModal.id}/reject`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ rejectionReason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      logAction("reject", `Rejected user #${rejectModal.id}: ${rejectReason}`);
      setRejectModal(null); setRejectReason(""); fetchUsers();
    } catch (e) { alert("Error: " + e.message); }
    finally { setActionLoading(null); }
  };

  const handleApprove = async (id) => {
    setActionLoading(id + "-approve");
    try {
      const res = await fetch(`${API}/api/admin/purchases/${id}/approve`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      logAction("approve", `Approved purchase request #${id}`);
      fetchPurchaseRequests();
    } catch (e) { alert("Error: " + e.message); }
    finally { setActionLoading(null); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { alert("Please enter a rejection reason"); return; }
    setActionLoading(rejectModal.id + "-reject");
    try {
      const res = await fetch(`${API}/api/admin/purchases/${rejectModal.id}/reject`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ admin_notes: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      logAction("reject", `Rejected purchase request #${rejectModal.id}: ${rejectReason}`);
      setRejectModal(null); setRejectReason(""); fetchPurchaseRequests();
    } catch (e) { alert("Error: " + e.message); }
    finally { setActionLoading(null); }
  };

  const handleStatusAction = async () => {
    if (!actionModal) return;
    const { user, action } = actionModal;
    const statusMap = { ban: "banned", suspend: "suspended", activate: "approved" };
    const newStatus = statusMap[action];
    setActionLoading(user.id + "-" + action);
    try {
      const res = await fetch(`${API}/api/admin/users/${user.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ status: newStatus, ban_reason: actionReason || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      logAction(action, `${action.charAt(0).toUpperCase()+action.slice(1)}ned user: ${user.display_name || user.email}`);
      setActionModal(null); setActionReason(""); fetchAllUsers();
    } catch (e) { alert("Error: " + e.message); }
    finally { setActionLoading(null); }
  };

  const filteredUsers = allUsers.filter(u => {
    const name = (u.display_name || u.email || "").toLowerCase();
    const matchSearch = !umSearch || name.includes(umSearch.toLowerCase()) || u.email.toLowerCase().includes(umSearch.toLowerCase());
    const matchRole   = umRole   === "all" || u.role   === umRole;
    const matchStatus = umStatus === "all" || u.status === umStatus;
    return matchSearch && matchRole && matchStatus;
  });

  const filteredPR = purchaseRequests.filter(r =>
    !prSearch || r.product_name?.toLowerCase().includes(prSearch.toLowerCase()) ||
    r.organization_name?.toLowerCase().includes(prSearch.toLowerCase()) ||
    r.industry_name?.toLowerCase().includes(prSearch.toLowerCase())
  );

  const navTo = (id) => { setView(id); setSidebarOpen(false); };

  return (
    <div className={`admin-dashboard${darkMode ? " dark-mode" : ""}`}>
      {/* Mobile overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar ── */}
      <aside className={`admin-sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="admin-logo">
          <span>🌉</span><span>EthioBridge</span>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        <div className="sidebar-section-label">MAIN MENU</div>
        <nav className="admin-nav">
          {NAV.slice(0, 4).map(n => (
            <button key={n.id} className={view === n.id ? "active" : ""}
              onClick={() => { navTo(n.id); if (n.id === "users") setFilter("pending"); if (n.id === "purchases") setPrFilter("pending"); }}>
              <span className="nav-icon">{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-section-label">MANAGEMENT</div>
        <nav className="admin-nav">
          {NAV.slice(4, 6).map(n => (
            <button key={n.id} className={view === n.id ? "active" : ""} onClick={() => navTo(n.id)}>
              <span className="nav-icon">{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-section-label">INSIGHTS</div>
        <nav className="admin-nav">
          {NAV.slice(6).map(n => (
            <button key={n.id} className={view === n.id ? "active" : ""} onClick={() => navTo(n.id)}>
              <span className="nav-icon">{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div style={{ marginTop: "auto", padding: "0 12px 24px" }}>
          <button className="logout-btn" onClick={handleLogout}><span>🚪</span> Logout</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="admin-body">
        {/* Top nav bar */}
        <header className="admin-header">
          <button className="hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="header-title">{NAV.find(n => n.id === view)?.label || "Dashboard"}</div>
          <div className="header-actions">
            <button className="header-icon-btn" onClick={() => setDarkMode(!darkMode)} title="Toggle dark mode">
              {darkMode ? "☀️" : "🌙"}
            </button>
            <button className="header-icon-btn" onClick={() => navTo("notifs")} title="Notifications">🔔</button>
            <div className="header-avatar">A</div>
          </div>
        </header>

        <main className="admin-main">
          {view === "home"       && <DashboardHome tok={tok} />}
          {view === "industries" && <IndustriesView tok={tok} />}
          {view === "products"   && <ProductsView tok={tok} />}
          {view === "analytics"  && <AnalyticsView tok={tok} />}
          {view === "logs"       && <ActivityLogsView />}
          {view === "notifs"     && <NotificationsView tok={tok} />}
          {view === "settings"   && <Settings />}

          {/* ════ APPROVALS VIEW ════ */}
          {view === "users" && (
            <>
              <div className="admin-topbar">
                <div>
                  <h1>{filter === "pending" ? "Pending Applications" : "All Users"}</h1>
                  <p>{users.length} {filter === "pending" ? "awaiting review" : "total users"}</p>
                </div>
                <div className="topbar-actions">
                  <button className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}>Pending</button>
                  <button className={filter === "all"     ? "active" : ""} onClick={() => setFilter("all")}>All</button>
                  <button className="refresh-btn" onClick={fetchUsers}>↻ Refresh</button>
                </div>
              </div>
              {error && <div className="admin-error">{error}</div>}
              {loading ? <div className="admin-loading">Loading...</div>
              : users.length === 0 ? (
                <div className="admin-empty"><span>✅</span><p>No {filter === "pending" ? "pending applications" : "users"} found.</p></div>
              ) : (
                <div className="users-grid">
                  {users.map(user => (
                    <div className="user-card" key={user.id}>
                      <div className="user-card-header">
                        <div className="user-avatar">{user.role === "industry" ? "🏭" : "🤝"}</div>
                        <div className="user-meta">
                          <h3>{user.company_name || user.organization_name || user.email}</h3>
                          <span className="user-role-tag">{user.role}</span>
                        </div>
                        <StatusBadge status={user.status} />
                      </div>
                      <div className="user-details">
                        <div className="detail-row"><span>📧</span><span>{user.email}</span></div>
                        {user.role === "industry" && user.sector && <div className="detail-row"><span>🏗️</span><span>{user.sector}</span></div>}
                        {user.role === "stakeholder" && user.organization_type && <div className="detail-row"><span>🏢</span><span>{user.organization_type}</span></div>}
                        <button className="view-details-btn" onClick={() => setViewDetailsModal(user)}>👁️ View Full Details</button>
                      </div>
                      {user.status === "pending" && (
                        <div className="user-actions">
                          <button className="approve-btn" onClick={() => handleUserApprove(user.id, user.company_name || user.organization_name)} disabled={actionLoading === user.id + "-approve"}>
                            {actionLoading === user.id + "-approve" ? "..." : "✓ Approve"}
                          </button>
                          <button className="reject-btn" onClick={() => { setRejectModal({ id: user.id, type: "user" }); setRejectReason(""); }}>✕ Reject</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ════ PURCHASE REQUESTS VIEW ════ */}
          {view === "purchases" && (
            <>
              <div className="admin-topbar">
                <div><h1>Purchase Requests</h1><p>{filteredPR.length} of {purchaseRequests.length} requests</p></div>
                <div className="topbar-actions">
                  {["pending","pending_verification","approved","rejected","all"].map(f => (
                    <button key={f} className={prFilter === f ? "active" : ""} onClick={() => setPrFilter(f)}>
                      {f === "pending_verification" ? "🛡️ ID Review" : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                  <button className="refresh-btn" onClick={fetchPurchaseRequests}>↻ Refresh</button>
                </div>
              </div>
              <div className="filter-bar" style={{ marginBottom: 24 }}>
                <div className="search-wrap">
                  <span>🔍</span>
                  <input className="search-input" placeholder="Search by product, stakeholder, industry..." value={prSearch} onChange={e => setPrSearch(e.target.value)} />
                </div>
              </div>
              {error && <div className="admin-error">{error}</div>}
              {loading ? <div className="admin-loading">Loading...</div>
              : filteredPR.length === 0 ? (
                <div className="admin-empty"><span>📋</span><p>No {prFilter} purchase requests</p></div>
              ) : (
                <div style={{ display: "grid", gap: "20px" }}>
                  {filteredPR.map(req => (
                    <div key={req.id} className="purchase-card">
                      <div className="purchase-status-bar" data-status={req.status} />
                      <div className="purchase-header">
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                            <span className="purchase-id">#{req.id}</span>
                            <StatusBadge status={req.status} />
                          </div>
                          <h3 className="purchase-title">📦 {req.product_name}</h3>
                          <p className="purchase-date">{new Date(req.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
                        </div>
                        <div className="purchase-qty-badge"><div className="qty-number">{req.quantity}</div><div className="qty-label">UNITS</div></div>
                      </div>
                      <div className="purchase-cards-grid">
                        <div className="info-card industry-card"><div style={{ fontSize: "22px", marginBottom: "6px" }}>🏭</div><div className="info-card-label">INDUSTRY</div><div className="info-card-value">{req.industry_name}</div><div className="info-card-sub">{req.sector}</div></div>
                        <div className="info-card stakeholder-card"><div style={{ fontSize: "22px", marginBottom: "6px" }}>🤝</div><div className="info-card-label">STAKEHOLDER</div><div className="info-card-value">{req.organization_name}</div><div className="info-card-sub">{req.full_name}</div></div>
                      </div>
                      <div className="purchase-meta">
                        <div><div className="meta-label">📞 PHONE</div><div className="meta-value">{req.phone}</div></div>
                        <div><div className="meta-label">📍 LOCATION</div><div className="meta-value">{req.location}</div></div>
                        {req.notes && <div style={{ gridColumn: "1 / -1" }}><div className="meta-label">📝 NOTES</div><div className="meta-value">{req.notes}</div></div>}
                      </div>
                      {req.id_document_url && (
                        <div className="id-doc-section">
                          <div className="id-doc-label">🛡️ Identity Document ({req.id_document_type?.replace(/_/g, ' ')})</div>
                          {req.id_document_url.match(/\.(jpg|jpeg|png)$/i)
                            ? <a href={`${API}${req.id_document_url}`} target="_blank" rel="noopener noreferrer"><img src={`${API}${req.id_document_url}`} alt="ID" className="id-doc-preview" /></a>
                            : <a href={`${API}${req.id_document_url}`} target="_blank" rel="noopener noreferrer" className="id-doc-link">📄 View Document (PDF)</a>}
                        </div>
                      )}
                      {(req.status === "pending" || req.status === "pending_verification") && req.id_document_url && (
                        <div className="purchase-actions">
                          <button className="approve-btn" onClick={() => handleApprove(req.id)} disabled={actionLoading === req.id + "-approve"}>
                            {actionLoading === req.id + "-approve" ? "⏳ Approving..." : "✓ Approve & Verify Identity"}
                          </button>
                          <button className="reject-btn" onClick={() => { setRejectModal({ id: req.id, type: "purchase" }); setRejectReason(""); }}>✕ Reject Request</button>
                        </div>
                      )}
                      {req.status === "pending_verification" && !req.id_document_url && (
                        <div style={{ padding: "12px 16px", background: "#fff8e1", borderRadius: "8px", color: "#92400e", fontSize: "13px" }}>
                          ⏳ Waiting for stakeholder to upload ID document...
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ════ USER MANAGEMENT VIEW ════ */}
          {view === "manage" && (
            <>
              <div className="admin-topbar">
                <div><h1>User Management</h1><p>{filteredUsers.length} of {allUsers.length} users shown</p></div>
                <button className="refresh-btn" onClick={fetchAllUsers}>↻ Refresh</button>
              </div>
              <div className="um-filters">
                <div className="um-search-wrap">
                  <span>🔍</span>
                  <input type="text" placeholder="Search by name or email..." value={umSearch} onChange={e => setUmSearch(e.target.value)} className="um-search" />
                </div>
                <select className="um-select" value={umRole} onChange={e => setUmRole(e.target.value)}>
                  <option value="all">All Roles</option>
                  <option value="industry">Industry</option>
                  <option value="stakeholder">Stakeholder</option>
                </select>
                <select className="um-select" value={umStatus} onChange={e => setUmStatus(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="approved">Active</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                  <option value="banned">Banned</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              {error && <div className="admin-error">{error}</div>}
              {loading ? <div className="admin-loading">Loading...</div>
              : filteredUsers.length === 0 ? (
                <div className="admin-empty"><span>👥</span><p>No users match your filters.</p></div>
              ) : (
                <div className="um-table-wrap">
                  <table className="um-table">
                    <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
                    <tbody>
                      {filteredUsers.map(u => (
                        <tr key={u.id} className={`um-row um-row-${u.status}`}>
                          <td className="um-id">#{u.id}</td>
                          <td className="um-name"><span className="um-role-icon">{u.role === "industry" ? "🏭" : "🤝"}</span>{u.display_name || "—"}</td>
                          <td className="um-email">{u.email}</td>
                          <td><span className={`um-role-badge um-role-${u.role}`}>{u.role === "industry" ? "Industry" : "Stakeholder"}</span></td>
                          <td><StatusBadge status={u.status} /></td>
                          <td className="um-date">{new Date(u.created_at).toLocaleDateString()}</td>
                          <td>
                            <div className="um-actions">
                              {u.status !== "banned" && <button className="um-btn um-ban" onClick={() => { setActionModal({ user: u, action: "ban" }); setActionReason(""); }}>🚫 Ban</button>}
                              {u.status !== "suspended" && u.status !== "banned" && <button className="um-btn um-suspend" onClick={() => { setActionModal({ user: u, action: "suspend" }); setActionReason(""); }}>⏸ Suspend</button>}
                              {(u.status === "suspended" || u.status === "banned") && <button className="um-btn um-activate" onClick={() => { setActionModal({ user: u, action: "activate" }); setActionReason(""); }}>🔓 Activate</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ── Reject Modal ── */}
      {rejectModal && (
        <div className="modal-overlay" onClick={() => setRejectModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Reject {rejectModal.type === "user" ? "User" : "Request"}</h2>
            <p>Please provide a reason for rejection.</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Enter rejection reason..." rows={4} />
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setRejectModal(null)}>Cancel</button>
              <button className="modal-reject" onClick={rejectModal.type === "user" ? handleUserReject : handleReject}
                disabled={actionLoading === (rejectModal.id + "-reject")}>
                {actionLoading === (rejectModal.id + "-reject") ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ban / Suspend / Activate Modal ── */}
      {actionModal && (
        <div className="modal-overlay" onClick={() => setActionModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="um-confirm-icon">
              {actionModal.action === "ban" ? "🚫" : actionModal.action === "suspend" ? "⏸️" : "🔓"}
            </div>
            <h2 style={{ textAlign: "center" }}>
              {actionModal.action === "ban" ? "Ban User" : actionModal.action === "suspend" ? "Suspend User" : "Activate User"}
            </h2>
            <p className="um-confirm-name">{actionModal.user.display_name || actionModal.user.email}</p>
            <p className="um-confirm-desc">
              {actionModal.action === "ban" ? "This user will be permanently blocked from the platform."
                : actionModal.action === "suspend" ? "This user will be temporarily restricted."
                : "This will restore full access for this user."}
            </p>
            {actionModal.action !== "activate" && (
              <div className="um-reason-field">
                <label>Reason {actionModal.action === "ban" ? "(required)" : "(optional)"}</label>
                <textarea value={actionReason} onChange={e => setActionReason(e.target.value)}
                  placeholder={`Reason for ${actionModal.action}ning...`} rows={3} />
              </div>
            )}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setActionModal(null)}>Cancel</button>
              <button className={actionModal.action === "activate" ? "approve-btn" : "reject-btn"}
                onClick={handleStatusAction}
                disabled={actionLoading === actionModal.user.id + "-" + actionModal.action || (actionModal.action === "ban" && !actionReason.trim())}>
                {actionLoading === actionModal.user.id + "-" + actionModal.action ? "Processing..."
                  : actionModal.action === "ban" ? "🚫 Confirm Ban"
                  : actionModal.action === "suspend" ? "⏸ Confirm Suspend"
                  : "🔓 Confirm Activate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Details Modal ── */}
      {viewDetailsModal && (
        <div className="modal-overlay" onClick={() => setViewDetailsModal(null)}>
          <div className="modal details-modal" onClick={e => e.stopPropagation()}>
            <div className={`details-modal-header ${viewDetailsModal.role}`}>
              <button className="modal-close-btn" onClick={() => setViewDetailsModal(null)}>✕</button>
              <div style={{ fontSize: "44px", marginBottom: "8px" }}>{viewDetailsModal.role === "industry" ? "🏭" : "🤝"}</div>
              <h2>{viewDetailsModal.company_name || viewDetailsModal.organization_name}</h2>
              <p>{viewDetailsModal.role === "industry" ? "Industry Profile" : "Stakeholder Profile"}</p>
            </div>
            <div style={{ padding: "28px" }}>
              <div style={{ marginBottom: "18px" }}><StatusBadge status={viewDetailsModal.status} /></div>
              <div style={{ display: "grid", gap: "16px" }}>
                <div className="details-section">
                  <h3>📋 Basic Information</h3>
                  <div className="details-row"><span>📧</span><div><div className="details-label">Email</div><div>{viewDetailsModal.email}</div></div></div>
                  <div className="details-row"><span>📅</span><div><div className="details-label">Registered</div><div>{new Date(viewDetailsModal.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div></div></div>
                </div>
                {viewDetailsModal.role === "industry" && (
                  <div className="details-section">
                    <h3>🏢 Company Details</h3>
                    {viewDetailsModal.sector && <div className="details-row"><span>🏗️</span><div><div className="details-label">Sector</div><div>{viewDetailsModal.sector}</div></div></div>}
                    {viewDetailsModal.industry_location && <div className="details-row"><span>📍</span><div><div className="details-label">Location</div><div>{viewDetailsModal.industry_location}</div></div></div>}
                  </div>
                )}
                {viewDetailsModal.role === "stakeholder" && (
                  <div className="details-section">
                    <h3>🏢 Organization Details</h3>
                    {viewDetailsModal.organization_type && <div className="details-row"><span>🏢</span><div><div className="details-label">Type</div><div>{viewDetailsModal.organization_type}</div></div></div>}
                    {viewDetailsModal.stakeholder_location && <div className="details-row"><span>📍</span><div><div className="details-label">Location</div><div>{viewDetailsModal.stakeholder_location}</div></div></div>}
                    {viewDetailsModal.contact_person && <div className="details-row"><span>👤</span><div><div className="details-label">Contact Person</div><div>{viewDetailsModal.contact_person}</div></div></div>}
                  </div>
                )}
              </div>
            </div>
            <div className="details-modal-footer">
              <button className="modal-cancel" onClick={() => setViewDetailsModal(null)}>Close</button>
              {viewDetailsModal.status === "pending" && (
                <>
                  <button className="approve-btn" style={{ flex: "unset", padding: "10px 20px" }}
                    onClick={() => { handleUserApprove(viewDetailsModal.id, viewDetailsModal.company_name || viewDetailsModal.organization_name); setViewDetailsModal(null); }}>✓ Approve</button>
                  <button className="reject-btn" style={{ flex: "unset", padding: "10px 20px" }}
                    onClick={() => { setRejectModal({ id: viewDetailsModal.id, type: "user" }); setViewDetailsModal(null); setRejectReason(""); }}>✕ Reject</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;