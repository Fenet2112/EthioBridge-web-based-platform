import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Dashboard.css";
import FilterPanel from "../../components/FilterPanel";
import DashboardHome from "./DashboardHome";
import IndustriesView from "../views/IndustriesView";
import ProductsView from "../views/ProductsView";
import AnalyticsView from "../views/AnalyticsView";
import ActivityLogsView, { logAction } from "../views/ActivityLogsView";
import NotificationsView from "../views/NotificationsView";
import Settings from "./Settings";
import Testimonials from "./Testimonials";
import ContactMessages from "./ContactMessages";
import TransactionsView from "./TransactionsView";
import UserManagement from "./UserManagement";
import { 
  FaChartBar, 
  FaUsers, 
  FaClipboardList, 
  FaShieldAlt, 
  FaIndustry, 
  FaBox, 
  FaChartLine, 
  FaBell, 
  FaFileAlt, 
  FaCog, 
  FaQuestionCircle,
  FaHome,
  FaDoorOpen,
  FaSun,
  FaMoon,
  FaEye,
  FaBan,
  FaPause,
  FaUnlock,
  FaTimes,
  FaCheck,
  FaEnvelope,
  FaCalendar,
  FaBuilding,
  FaPhone,
  FaGlobe,
  FaIdCard,
  FaUser,
  FaExclamationTriangle,
  FaComments,
  FaLifeRing
} from "react-icons/fa";

const API = process.env.REACT_APP_API_URL || "https://ethiobridge-web-based-platform.onrender.com";

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
  { id: "home",      icon: <FaChartBar />, label: "Dashboard" },
  { id: "users",     icon: <FaUsers />, label: "Approvals" },
  { id: "purchases", icon: <FaClipboardList />, label: "Purchase Requests" },
  { id: "transactions", icon: <FaChartLine />, label: "Transactions" },
  { id: "manage",    icon: <FaShieldAlt />, label: "User Management" },
  { id: "industries",icon: <FaIndustry />, label: "Industries" },
  { id: "products",  icon: <FaBox />, label: "Products" },
  { id: "testimonials", icon: <FaComments />, label: "Testimonials" },
  { id: "messages",  icon: <FaLifeRing />, label: "Support Tickets" },
  { id: "analytics", icon: <FaChartLine />, label: "Analytics" },
  { id: "notifs",    icon: <FaBell />, label: "Notifications" },
  { id: "logs",      icon: <FaFileAlt />, label: "Activity Logs" },
  { id: "settings",  icon: <FaCog />, label: "Settings" },
  { id: "help",      icon: <FaQuestionCircle />, label: "Help", external: true, path: "/help" },
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
  const [userFilters, setUserFilters] = useState({});
  const [userPagination, setUserPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [actionModal, setActionModal] = useState(null);
  const [actionReason, setActionReason] = useState("");
  const [userDetailsModal, setUserDetailsModal] = useState(null);
  const [userDetailsLoading, setUserDetailsLoading] = useState(false);
  
  // Approval criteria details
  const [approvalDetails, setApprovalDetails] = useState(null);
  const [approvalDetailsLoading, setApprovalDetailsLoading] = useState(false);

  const handleLogout = () => { localStorage.removeItem("adminToken"); navigate("/login"); };

  const fetchUsers = async () => {
    setLoading(true); setError("");
    try {
      const ep = filter === "pending" ? `${API}/api/admin/pending` : `${API}/api/admin/users`;
      const res = await fetch(ep, { headers: { Authorization: `Bearer ${tok()}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      // Handle both plain array and paginated {users:[]} response
      setUsers(Array.isArray(data) ? data : (data.users || []));
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

  const fetchAllUsers = async (filters = {}, page = 1) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', '20');
      
      // Add filters
      if (filters.search) params.append('search', filters.search);
      if (filters.role && filters.role !== 'all') params.append('role', filters.role);
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.minLoginCount) params.append('minLoginCount', filters.minLoginCount);
      if (filters.maxLoginCount) params.append('maxLoginCount', filters.maxLoginCount);
      if (filters.minProducts) params.append('minProducts', filters.minProducts);
      if (filters.maxProducts) params.append('maxProducts', filters.maxProducts);
      if (filters.minRequests) params.append('minRequests', filters.minRequests);
      if (filters.maxRequests) params.append('maxRequests', filters.maxRequests);
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
      
      const res = await fetch(`${API}/api/admin/users/all?${params.toString()}`, { headers: { Authorization: `Bearer ${tok()}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAllUsers(data.users || []);
      setUserPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
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

  const fetchUserDetails = async (userId) => {
    setUserDetailsLoading(true);
    setApprovalDetailsLoading(true);
    try {
      // Fetch basic user details
      const res = await fetch(`${API}/api/admin/users/${userId}/details`, {
        headers: { Authorization: `Bearer ${tok()}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setUserDetailsModal(data);
      
      // Fetch approval criteria details
      try {
        const approvalRes = await fetch(`${API}/api/admin/structured-approval/user/${userId}/details`, {
          headers: { Authorization: `Bearer ${tok()}` }
        });
        if (approvalRes.ok) {
          const approvalData = await approvalRes.json();
          setApprovalDetails(approvalData);
        } else {
          // If no approval data exists, calculate it
          const calculateRes = await fetch(`${API}/api/admin/structured-approval/user/${userId}/recalculate`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tok()}` }
          });
          if (calculateRes.ok) {
            // Fetch again after calculation
            const newApprovalRes = await fetch(`${API}/api/admin/structured-approval/user/${userId}/details`, {
              headers: { Authorization: `Bearer ${tok()}` }
            });
            if (newApprovalRes.ok) {
              const newApprovalData = await newApprovalRes.json();
              setApprovalDetails(newApprovalData);
            }
          }
        }
      } catch (approvalError) {
        console.error('Failed to fetch approval details:', approvalError);
        setApprovalDetails(null);
      }
    } catch (e) {
      alert("Error loading user details: " + e.message);
    } finally {
      setUserDetailsLoading(false);
      setApprovalDetailsLoading(false);
    }
  };

  // Filtering is done server-side via API
  
  const filteredPR = purchaseRequests.filter(r =>
    !prSearch || r.product_name?.toLowerCase().includes(prSearch.toLowerCase()) ||
    r.organization_name?.toLowerCase().includes(prSearch.toLowerCase()) ||
    r.industry_name?.toLowerCase().includes(prSearch.toLowerCase())
  );

  const navTo = (id) => { setView(id); setSidebarOpen(false); };

  return (
    <div className={`admin-dashboard${darkMode ? " dark-mode" : ""}`}>
      <Link to="/" className="home-icon-btn" title="Back to Home">
        🏠
      </Link>
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
          {NAV.slice(0, 5).map(n => (
            <button key={n.id} className={view === n.id ? "active" : ""}
              onClick={() => { navTo(n.id); if (n.id === "users") setFilter("pending"); if (n.id === "purchases") setPrFilter("pending"); }}>
              <span className="nav-icon">{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-section-label">MANAGEMENT</div>
        <nav className="admin-nav">
          {NAV.slice(5, 9).map(n => (
            <button key={n.id} className={view === n.id ? "active" : ""} onClick={() => navTo(n.id)}>
              <span className="nav-icon">{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-section-label">INSIGHTS</div>
        <nav className="admin-nav">
          {NAV.slice(9).map(n => (
            n.external ? (
              <Link key={n.id} to={n.path} className="admin-nav-link">
                <span className="nav-icon">{n.icon}</span>{n.label}
              </Link>
            ) : (
              <button key={n.id} className={view === n.id ? "active" : ""} onClick={() => navTo(n.id)}>
                <span className="nav-icon">{n.icon}</span>{n.label}
              </button>
            )
          ))}
        </nav>
        <div style={{ marginTop: "auto", padding: "0 12px 24px" }}>
          <button className="logout-btn" onClick={handleLogout}><FaDoorOpen /> Logout</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="admin-body">
        {/* Top nav bar */}
        <header className="admin-header">
          <button className="hamburger" onClick={() => setSidebarOpen(true)}>
            <span style={{ fontSize: "1.3rem" }}>☰</span>
          </button>
          <div className="header-title">{NAV.find(n => n.id === view)?.label || "Dashboard"}</div>
          <div className="header-actions">
            <button className="header-icon-btn" onClick={() => setDarkMode(!darkMode)} title="Toggle dark mode">
              {darkMode ? <FaSun /> : <FaMoon />}
            </button>
            <button className="header-icon-btn" onClick={() => navTo("notifs")} title="Notifications"><FaBell /></button>
            <div className="header-avatar">A</div>
          </div>
        </header>

        <main className="admin-main">
          {view === "home"       && <DashboardHome tok={tok} />}
          {view === "transactions" && <TransactionsView tok={tok} />}
          {view === "industries" && <IndustriesView tok={tok} />}
          {view === "products"   && <ProductsView tok={tok} />}
          {view === "testimonials" && <Testimonials />}
          {view === "messages"   && <ContactMessages />}
          {view === "analytics"  && <AnalyticsView tok={tok} />}
          {view === "logs"       && <ActivityLogsView />}
          {view === "notifs"     && <NotificationsView tok={tok} />}
          {view === "settings"   && <Settings darkMode={darkMode} setDarkMode={setDarkMode} />}

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
                        <button className="view-details-btn" onClick={() => {
                          setViewDetailsModal(user);
                          // Also fetch approval details for this user
                          if (user.status === 'pending') {
                            setApprovalDetailsLoading(true);
                            fetch(`${API}/api/admin/structured-approval/user/${user.id}/details`, {
                              headers: { Authorization: `Bearer ${tok()}` }
                            })
                            .then(res => res.ok ? res.json() : null)
                            .then(data => setApprovalDetails(data))
                            .catch(() => setApprovalDetails(null))
                            .finally(() => setApprovalDetailsLoading(false));
                          }
                        }}>👁️ View Full Details</button>
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
            <UserManagement
              allUsers={allUsers}
              loading={loading}
              error={error}
              fetchAllUsers={fetchAllUsers}
              setActionModal={setActionModal}
              setActionReason={setActionReason}
              fetchUserDetails={fetchUserDetails}
            />
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

                {/* Approval Criteria Section for Pending Users */}
                {viewDetailsModal.status === 'pending' && (
                  <>
                    {approvalDetailsLoading ? (
                      <div className="details-section">
                        <h3>🔍 Approval Analysis</h3>
                        <div style={{ textAlign: "center", padding: "20px", color: "#6b7280" }}>
                          <div className="loading-spinner" style={{ width: "24px", height: "24px", margin: "0 auto 12px" }}></div>
                          Loading approval criteria...
                        </div>
                      </div>
                    ) : approvalDetails ? (
                      <>
                        {/* Approval Score Summary */}
                        <div className="details-section" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
                          <h3>🔍 Approval Analysis</h3>
                          <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "16px" }}>
                            <div style={{ 
                              width: "70px", height: "70px", borderRadius: "50%", 
                              background: `conic-gradient(#10b981 ${(approvalDetails.score?.score_percentage || 0) * 3.6}deg, #f3f4f6 0deg)`,
                              display: "flex", alignItems: "center", justifyContent: "center"
                            }}>
                              <div style={{ 
                                width: "54px", height: "54px", borderRadius: "50%", 
                                background: "white", display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center"
                              }}>
                                <div style={{ fontSize: "1rem", fontWeight: "800", color: "#1f2937" }}>
                                  {Math.round(approvalDetails.score?.score_percentage || 0)}%
                                </div>
                                <div style={{ fontSize: "0.5rem", color: "#6b7280" }}>SCORE</div>
                              </div>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div className="details-row">
                                <span>🎯</span>
                                <div>
                                  <div className="details-label">Risk Level</div>
                                  <div>
                                    <span style={{
                                      padding: "3px 10px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: "600",
                                      background: approvalDetails.score?.risk_level === 'low' ? '#dcfce7' : 
                                                approvalDetails.score?.risk_level === 'medium' ? '#fef3c7' : '#fee2e2',
                                      color: approvalDetails.score?.risk_level === 'low' ? '#166534' : 
                                            approvalDetails.score?.risk_level === 'medium' ? '#92400e' : '#dc2626'
                                    }}>
                                      {approvalDetails.score?.risk_level?.toUpperCase() || 'UNKNOWN'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="details-row">
                                <span>🤖</span>
                                <div>
                                  <div className="details-label">Recommendation</div>
                                  <div>
                                    <span style={{
                                      padding: "3px 10px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: "600",
                                      background: approvalDetails.score?.recommendation === 'approve' ? '#dcfce7' : 
                                                approvalDetails.score?.recommendation === 'reject' ? '#fee2e2' : '#e0e7ff',
                                      color: approvalDetails.score?.recommendation === 'approve' ? '#166534' : 
                                            approvalDetails.score?.recommendation === 'reject' ? '#dc2626' : '#3730a3'
                                    }}>
                                      {approvalDetails.score?.recommendation?.toUpperCase() || 'REVIEW'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Validation Criteria */}
                        <div className="details-section">
                          <h3>✅ Validation Criteria ({approvalDetails.criteria?.length || 0})</h3>
                          <div style={{ display: "grid", gap: "6px" }}>
                            {approvalDetails.criteria?.map((criteria, index) => (
                              <div key={index} style={{
                                padding: "10px 12px", borderRadius: "6px", border: "1px solid",
                                background: criteria.status === 'passed' ? '#f0fdf4' : '#fef2f2',
                                borderColor: criteria.status === 'passed' ? '#bbf7d0' : '#fecaca',
                                display: "flex", alignItems: "center", gap: "10px"
                              }}>
                                <span style={{ 
                                  fontSize: "0.9rem", 
                                  color: criteria.status === 'passed' ? '#16a34a' : '#dc2626' 
                                }}>
                                  {criteria.status === 'passed' ? '✅' : '❌'}
                                </span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ 
                                    fontWeight: "600", color: "#374151", fontSize: "0.8rem",
                                    textTransform: "capitalize"
                                  }}>
                                    {criteria.criteria_type?.replace(/_/g, ' ') || 'Unknown Criteria'}
                                  </div>
                                  {criteria.notes && (
                                    <div style={{ fontSize: "0.7rem", color: "#6b7280", marginTop: "1px" }}>
                                      {criteria.notes}
                                    </div>
                                  )}
                                </div>
                                <div style={{ 
                                  fontSize: "0.7rem", fontWeight: "700", color: "#059669",
                                  display: "flex", alignItems: "center", gap: "3px"
                                }}>
                                  +{criteria.score || 0}
                                  {criteria.is_required && (
                                    <span style={{
                                      background: "#fef3c7", color: "#92400e", padding: "1px 4px",
                                      borderRadius: "6px", fontSize: "0.6rem"
                                    }}>
                                      REQ
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Fraud Indicators */}
                        {approvalDetails.fraudIndicators?.length > 0 && (
                          <div className="details-section" style={{ background: "#fef2f2", borderColor: "#fecaca" }}>
                            <h3>🚨 Fraud Indicators ({approvalDetails.fraudIndicators.length})</h3>
                            <div style={{ display: "grid", gap: "6px" }}>
                              {approvalDetails.fraudIndicators.map((fraud, index) => (
                                <div key={index} style={{
                                  padding: "8px 12px", borderRadius: "6px", 
                                  background: fraud.severity === 'high' ? '#fef2f2' : 
                                            fraud.severity === 'medium' ? '#fffbeb' : '#f0f9ff',
                                  border: "1px solid",
                                  borderColor: fraud.severity === 'high' ? '#fecaca' : 
                                             fraud.severity === 'medium' ? '#fed7aa' : '#bae6fd',
                                  display: "flex", alignItems: "center", gap: "8px"
                                }}>
                                  <span>⚠️</span>
                                  <div style={{ flex: 1, fontSize: "0.8rem" }}>
                                    <strong>{fraud.detection_type}:</strong> {fraud.details}
                                  </div>
                                  <span style={{
                                    fontSize: "0.65rem", fontWeight: "700", textTransform: "uppercase",
                                    color: fraud.severity === 'high' ? '#dc2626' : 
                                          fraud.severity === 'medium' ? '#d97706' : '#0369a1'
                                  }}>
                                    {fraud.severity}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="details-section">
                        <h3>🔍 Approval Analysis</h3>
                        <div style={{ textAlign: "center", padding: "16px", color: "#6b7280" }}>
                          <span style={{ fontSize: "1.5rem", marginBottom: "6px", display: "block" }}>📊</span>
                          No approval analysis available
                          <div style={{ fontSize: "0.75rem", marginTop: "3px" }}>
                            Click "Analyze" to calculate approval criteria
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="details-modal-footer">
              <button className="modal-cancel" onClick={() => {setViewDetailsModal(null); setApprovalDetails(null);}}>Close</button>
              {viewDetailsModal.status === "pending" && (
                <>
                  {!approvalDetails && !approvalDetailsLoading && (
                    <button className="action-btn" style={{ flex: "unset", padding: "10px 20px", background: "#667eea", color: "white" }}
                      onClick={async () => {
                        setApprovalDetailsLoading(true);
                        try {
                          const calculateRes = await fetch(`${API}/api/admin/structured-approval/user/${viewDetailsModal.id}/recalculate`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${tok()}` }
                          });
                          if (calculateRes.ok) {
                            const approvalRes = await fetch(`${API}/api/admin/structured-approval/user/${viewDetailsModal.id}/details`, {
                              headers: { Authorization: `Bearer ${tok()}` }
                            });
                            if (approvalRes.ok) {
                              const approvalData = await approvalRes.json();
                              setApprovalDetails(approvalData);
                            }
                          }
                        } catch (error) {
                          console.error('Failed to calculate approval criteria:', error);
                        } finally {
                          setApprovalDetailsLoading(false);
                        }
                      }}>
                      🔍 Analyze Criteria
                    </button>
                  )}
                  <button className="approve-btn" style={{ flex: "unset", padding: "10px 20px" }}
                    onClick={() => { handleUserApprove(viewDetailsModal.id, viewDetailsModal.company_name || viewDetailsModal.organization_name); setViewDetailsModal(null); setApprovalDetails(null); }}>✓ Approve</button>
                  <button className="reject-btn" style={{ flex: "unset", padding: "10px 20px" }}
                    onClick={() => { setRejectModal({ id: viewDetailsModal.id, type: "user" }); setViewDetailsModal(null); setApprovalDetails(null); setRejectReason(""); }}>✕ Reject</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── User Details Modal (User Management) ── */}
      {userDetailsModal && (
        <div className="modal-overlay" onClick={() => setUserDetailsModal(null)}>
          <div className="modal user-details-modal" onClick={e => e.stopPropagation()}>
            <div className={`details-modal-header ${userDetailsModal.role}`}>
              <button className="modal-close-btn" onClick={() => setUserDetailsModal(null)}>✕</button>
              <div style={{ fontSize: "44px", marginBottom: "8px" }}>{userDetailsModal.role === "industry" ? "🏭" : "🤝"}</div>
              <h2>{userDetailsModal.company_name || userDetailsModal.organization_name || userDetailsModal.email}</h2>
              <p>{userDetailsModal.role === "industry" ? "Industry Profile" : "Stakeholder Profile"}</p>
            </div>
            <div style={{ padding: "28px" }}>
              <div style={{ marginBottom: "18px" }}><StatusBadge status={userDetailsModal.status} /></div>
              
              <div style={{ display: "grid", gap: "16px" }}>
                {/* Basic Information */}
                <div className="details-section">
                  <h3>📋 Basic Information</h3>
                  <div className="details-row"><span>🆔</span><div><div className="details-label">User ID</div><div>#{userDetailsModal.id}</div></div></div>
                  <div className="details-row"><span>📧</span><div><div className="details-label">Email</div><div>{userDetailsModal.email}</div></div></div>
                  <div className="details-row"><span>👤</span><div><div className="details-label">Role</div><div style={{ textTransform: "capitalize" }}>{userDetailsModal.role}</div></div></div>
                  <div className="details-row"><span>📅</span><div><div className="details-label">Registration Date</div><div>{new Date(userDetailsModal.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div></div></div>
                  <div className="details-row">
                    <span>{userDetailsModal.email_verified ? "✅" : "❌"}</span>
                    <div><div className="details-label">Email Verification</div><div>{userDetailsModal.email_verified ? "Verified" : "Not Verified"}</div></div>
                  </div>
                </div>

                {/* Industry-specific details */}
                {userDetailsModal.role === "industry" && (
                  <>
                    <div className="details-section">
                      <h3>🏢 Company Information</h3>
                      {userDetailsModal.company_name && <div className="details-row"><span>🏭</span><div><div className="details-label">Company Name</div><div>{userDetailsModal.company_name}</div></div></div>}
                      {userDetailsModal.sector && <div className="details-row"><span>🏗️</span><div><div className="details-label">Sector</div><div>{userDetailsModal.sector}</div></div></div>}
                      {userDetailsModal.industry_location && <div className="details-row"><span>📍</span><div><div className="details-label">Location</div><div>{userDetailsModal.industry_location}</div></div></div>}
                      {userDetailsModal.established_year && <div className="details-row"><span>📆</span><div><div className="details-label">Established Year</div><div>{userDetailsModal.established_year}</div></div></div>}
                    </div>
                    
                    <div className="details-section">
                      <h3>📞 Contact Information</h3>
                      {userDetailsModal.industry_phone && <div className="details-row"><span>📱</span><div><div className="details-label">Phone</div><div>{userDetailsModal.industry_phone}</div></div></div>}
                      {userDetailsModal.website && <div className="details-row"><span>🌐</span><div><div className="details-label">Website</div><div><a href={userDetailsModal.website} target="_blank" rel="noopener noreferrer" style={{ color: "#0a5c2f", textDecoration: "underline" }}>{userDetailsModal.website}</a></div></div></div>}
                    </div>

                    {userDetailsModal.industry_description && (
                      <div className="details-section">
                        <h3>📝 Description</h3>
                        <p style={{ margin: 0, color: "#555", lineHeight: "1.6", fontSize: "0.9rem" }}>{userDetailsModal.industry_description}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Stakeholder-specific details */}
                {userDetailsModal.role === "stakeholder" && (
                  <>
                    <div className="details-section">
                      <h3>🏢 Organization Information</h3>
                      {userDetailsModal.organization_name && <div className="details-row"><span>🤝</span><div><div className="details-label">Organization Name</div><div>{userDetailsModal.organization_name}</div></div></div>}
                      {userDetailsModal.organization_type && <div className="details-row"><span>🏢</span><div><div className="details-label">Organization Type</div><div>{userDetailsModal.organization_type}</div></div></div>}
                      {userDetailsModal.stakeholder_location && <div className="details-row"><span>📍</span><div><div className="details-label">Location</div><div>{userDetailsModal.stakeholder_location}</div></div></div>}
                      {userDetailsModal.contact_person && <div className="details-row"><span>👤</span><div><div className="details-label">Contact Person</div><div>{userDetailsModal.contact_person}</div></div></div>}
                    </div>
                    
                    {userDetailsModal.stakeholder_phone && (
                      <div className="details-section">
                        <h3>📞 Contact Information</h3>
                        <div className="details-row"><span>📱</span><div><div className="details-label">Phone</div><div>{userDetailsModal.stakeholder_phone}</div></div></div>
                      </div>
                    )}

                    {userDetailsModal.stakeholder_description && (
                      <div className="details-section">
                        <h3>📝 Description</h3>
                        <p style={{ margin: 0, color: "#555", lineHeight: "1.6", fontSize: "0.9rem" }}>{userDetailsModal.stakeholder_description}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Account Status Details */}
                {(userDetailsModal.status === "banned" || userDetailsModal.status === "suspended") && (
                  <div className="details-section" style={{ background: "#fff5f5", borderColor: "#fecaca" }}>
                    <h3>⚠️ Account Restrictions</h3>
                    <div className="details-row"><span>🚫</span><div><div className="details-label">Status</div><div style={{ textTransform: "capitalize", fontWeight: "700", color: "#dc2626" }}>{userDetailsModal.status}</div></div></div>
                    {userDetailsModal.ban_reason && <div className="details-row"><span>📝</span><div><div className="details-label">Reason</div><div>{userDetailsModal.ban_reason}</div></div></div>}
                    {userDetailsModal.suspended_until && <div className="details-row"><span>⏰</span><div><div className="details-label">Suspended Until</div><div>{new Date(userDetailsModal.suspended_until).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div></div></div>}
                  </div>
                )}

                {/* Approval Criteria Section */}
                {approvalDetailsLoading ? (
                  <div className="details-section">
                    <h3>🔍 Approval Analysis</h3>
                    <div style={{ textAlign: "center", padding: "20px", color: "#6b7280" }}>
                      <div className="loading-spinner" style={{ width: "24px", height: "24px", margin: "0 auto 12px" }}></div>
                      Loading approval criteria...
                    </div>
                  </div>
                ) : approvalDetails ? (
                  <>
                    {/* Approval Score Summary */}
                    <div className="details-section" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
                      <h3>🔍 Approval Analysis</h3>
                      <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "16px" }}>
                        <div style={{ 
                          width: "80px", height: "80px", borderRadius: "50%", 
                          background: `conic-gradient(#10b981 ${(approvalDetails.score?.score_percentage || 0) * 3.6}deg, #f3f4f6 0deg)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          position: "relative"
                        }}>
                          <div style={{ 
                            width: "60px", height: "60px", borderRadius: "50%", 
                            background: "white", display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center"
                          }}>
                            <div style={{ fontSize: "1.2rem", fontWeight: "800", color: "#1f2937" }}>
                              {Math.round(approvalDetails.score?.score_percentage || 0)}%
                            </div>
                            <div style={{ fontSize: "0.6rem", color: "#6b7280" }}>SCORE</div>
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="details-row">
                            <span>🎯</span>
                            <div>
                              <div className="details-label">Risk Level</div>
                              <div>
                                <span style={{
                                  padding: "4px 12px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "600",
                                  background: approvalDetails.score?.risk_level === 'low' ? '#dcfce7' : 
                                            approvalDetails.score?.risk_level === 'medium' ? '#fef3c7' : '#fee2e2',
                                  color: approvalDetails.score?.risk_level === 'low' ? '#166534' : 
                                        approvalDetails.score?.risk_level === 'medium' ? '#92400e' : '#dc2626'
                                }}>
                                  {approvalDetails.score?.risk_level?.toUpperCase() || 'UNKNOWN'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="details-row">
                            <span>🤖</span>
                            <div>
                              <div className="details-label">Recommendation</div>
                              <div>
                                <span style={{
                                  padding: "4px 12px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "600",
                                  background: approvalDetails.score?.recommendation === 'approve' ? '#dcfce7' : 
                                            approvalDetails.score?.recommendation === 'reject' ? '#fee2e2' : '#e0e7ff',
                                  color: approvalDetails.score?.recommendation === 'approve' ? '#166534' : 
                                        approvalDetails.score?.recommendation === 'reject' ? '#dc2626' : '#3730a3'
                                }}>
                                  {approvalDetails.score?.recommendation?.toUpperCase() || 'REVIEW'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="details-row">
                        <span>📊</span>
                        <div>
                          <div className="details-label">Score Breakdown</div>
                          <div>{approvalDetails.score?.total_score || 0} / {approvalDetails.score?.max_possible_score || 100} points</div>
                        </div>
                      </div>
                    </div>

                    {/* Validation Criteria */}
                    <div className="details-section">
                      <h3>✅ Validation Criteria ({approvalDetails.criteria?.length || 0})</h3>
                      <div style={{ display: "grid", gap: "8px" }}>
                        {approvalDetails.criteria?.map((criteria, index) => (
                          <div key={index} style={{
                            padding: "12px 16px", borderRadius: "8px", border: "1px solid",
                            background: criteria.status === 'passed' ? '#f0fdf4' : '#fef2f2',
                            borderColor: criteria.status === 'passed' ? '#bbf7d0' : '#fecaca',
                            display: "flex", alignItems: "center", gap: "12px"
                          }}>
                            <span style={{ 
                              fontSize: "1.1rem", 
                              color: criteria.status === 'passed' ? '#16a34a' : '#dc2626' 
                            }}>
                              {criteria.status === 'passed' ? '✅' : '❌'}
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={{ 
                                fontWeight: "600", color: "#374151", fontSize: "0.9rem",
                                textTransform: "capitalize"
                              }}>
                                {criteria.criteria_type?.replace(/_/g, ' ') || 'Unknown Criteria'}
                              </div>
                              {criteria.notes && (
                                <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "2px" }}>
                                  {criteria.notes}
                                </div>
                              )}
                            </div>
                            <div style={{ 
                              fontSize: "0.8rem", fontWeight: "700", color: "#059669",
                              display: "flex", alignItems: "center", gap: "4px"
                            }}>
                              +{criteria.score || 0}
                              {criteria.is_required && (
                                <span style={{
                                  background: "#fef3c7", color: "#92400e", padding: "2px 6px",
                                  borderRadius: "8px", fontSize: "0.7rem"
                                }}>
                                  REQ
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Fraud Indicators */}
                    {approvalDetails.fraudIndicators?.length > 0 && (
                      <div className="details-section" style={{ background: "#fef2f2", borderColor: "#fecaca" }}>
                        <h3>🚨 Fraud Indicators ({approvalDetails.fraudIndicators.length})</h3>
                        <div style={{ display: "grid", gap: "8px" }}>
                          {approvalDetails.fraudIndicators.map((fraud, index) => (
                            <div key={index} style={{
                              padding: "10px 14px", borderRadius: "6px", 
                              background: fraud.severity === 'high' ? '#fef2f2' : 
                                        fraud.severity === 'medium' ? '#fffbeb' : '#f0f9ff',
                              border: "1px solid",
                              borderColor: fraud.severity === 'high' ? '#fecaca' : 
                                         fraud.severity === 'medium' ? '#fed7aa' : '#bae6fd',
                              display: "flex", alignItems: "center", gap: "10px"
                            }}>
                              <span>⚠️</span>
                              <div style={{ flex: 1, fontSize: "0.85rem" }}>
                                <strong>{fraud.detection_type}:</strong> {fraud.details}
                              </div>
                              <span style={{
                                fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase",
                                color: fraud.severity === 'high' ? '#dc2626' : 
                                      fraud.severity === 'medium' ? '#d97706' : '#0369a1'
                              }}>
                                {fraud.severity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="details-section">
                    <h3>🔍 Approval Analysis</h3>
                    <div style={{ textAlign: "center", padding: "20px", color: "#6b7280" }}>
                      <span style={{ fontSize: "2rem", marginBottom: "8px", display: "block" }}>📊</span>
                      No approval analysis available
                      <div style={{ fontSize: "0.8rem", marginTop: "4px" }}>
                        Criteria will be calculated when user status changes to pending
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="details-modal-footer">
              <button className="modal-cancel" onClick={() => {setUserDetailsModal(null); setApprovalDetails(null);}}>Close</button>
              {userDetailsModal.status !== "banned" && (
                <button className="reject-btn" style={{ flex: "unset", padding: "10px 20px" }}
                  onClick={() => { setActionModal({ user: userDetailsModal, action: "ban" }); setUserDetailsModal(null); setApprovalDetails(null); setActionReason(""); }}>
                  🚫 Ban User
                </button>
              )}
              {userDetailsModal.status !== "suspended" && userDetailsModal.status !== "banned" && (
                <button className="um-btn um-suspend" style={{ flex: "unset", padding: "10px 20px" }}
                  onClick={() => { setActionModal({ user: userDetailsModal, action: "suspend" }); setUserDetailsModal(null); setApprovalDetails(null); setActionReason(""); }}>
                  ⏸ Suspend User
                </button>
              )}
              {(userDetailsModal.status === "suspended" || userDetailsModal.status === "banned") && (
                <button className="approve-btn" style={{ flex: "unset", padding: "10px 20px" }}
                  onClick={() => { setActionModal({ user: userDetailsModal, action: "activate" }); setUserDetailsModal(null); setApprovalDetails(null); setActionReason(""); }}>
                  🔓 Activate User
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay for user details */}
      {userDetailsLoading && (
        <div className="modal-overlay">
          <div className="admin-loading">Loading user details...</div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;