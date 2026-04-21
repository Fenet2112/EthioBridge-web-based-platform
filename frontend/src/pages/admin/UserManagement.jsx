import { useState, useEffect, useCallback } from "react";
import {
  FaSearch, FaFilter, FaEye, FaBan, FaPause, FaUnlock,
  FaIndustry, FaUsers, FaSync, FaDownload, FaChevronDown,
  FaChevronUp, FaTimes, FaSort, FaSortUp, FaSortDown
} from "react-icons/fa";
import "./UserManagement.css";

const API = process.env.REACT_APP_API_URL || "https://ethiobridge-web-based-platform.onrender.com";

const STATUS_META = {
  approved:   { label: "Active",      bg: "#e8f5e9", color: "#0a5c2f" },
  pending:    { label: "Pending",     bg: "#fff8e1", color: "#b45309" },
  incomplete: { label: "Incomplete",  bg: "#f5f5f5", color: "#6b7280" },
  suspended:  { label: "Suspended",   bg: "#fffbeb", color: "#d97706" },
  banned:     { label: "Banned",      bg: "#fff5f5", color: "#dc2626" },
  rejected:   { label: "Rejected",    bg: "#fff5f5", color: "#dc2626" },
};

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.incomplete;
  return (
    <span className="um2-status-pill" style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <FaSort className="um2-sort-icon dim" />;
  return sort.dir === "asc"
    ? <FaSortUp className="um2-sort-icon active" />
    : <FaSortDown className="um2-sort-icon active" />;
}

const EMPTY_FILTERS = {
  search: "", role: "", status: "",
  startDate: "", endDate: "",
  minProducts: "", maxProducts: "",
  minRequests: "", maxRequests: "",
};

export default function UserManagement({ fetchUserDetails, setActionModal, setActionReason }) {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [filters, setFilters]     = useState(EMPTY_FILTERS);
  const [draft, setDraft]         = useState(EMPTY_FILTERS);   // uncommitted filter state
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort]           = useState({ col: "created_at", dir: "desc" });
  const [page, setPage]           = useState(1);
  const [pagination, setPagination] = useState({ total: 0, hasNext: false, hasPrev: false });

  const tok = () => localStorage.getItem("adminToken");

  const load = useCallback(async (f = filters, p = page, s = sort) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: p, limit: 20, sortBy: s.col, sortOrder: s.dir });
      if (f.search)      params.set("search",      f.search);
      if (f.role)        params.set("role",         f.role);
      if (f.status)      params.set("status",       f.status);
      if (f.startDate)   params.set("startDate",    f.startDate);
      if (f.endDate)     params.set("endDate",      f.endDate);
      if (f.minProducts) params.set("minProducts",  f.minProducts);
      if (f.maxProducts) params.set("maxProducts",  f.maxProducts);
      if (f.minRequests) params.set("minRequests",  f.minRequests);
      if (f.maxRequests) params.set("maxRequests",  f.maxRequests);

      const res = await fetch(`${API}/api/admin/users/all?${params}`, {
        headers: { Authorization: `Bearer ${tok()}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load users");
      setUsers(Array.isArray(data) ? data : (data.users || []));
      setPagination(data.pagination || { total: 0, hasNext: false, hasPrev: false });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [filters, page, sort]);

  useEffect(() => { load(); }, []); // eslint-disable-line

  const applyFilters = () => {
    setFilters(draft);
    setPage(1);
    load(draft, 1, sort);
    setShowFilters(false);
  };

  const resetFilters = () => {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(1);
    load(EMPTY_FILTERS, 1, sort);
    setShowFilters(false);
  };

  const toggleSort = (col) => {
    const newSort = sort.col === col
      ? { col, dir: sort.dir === "asc" ? "desc" : "asc" }
      : { col, dir: "desc" };
    setSort(newSort);
    load(filters, page, newSort);
  };

  const changePage = (p) => {
    setPage(p);
    load(filters, p, sort);
  };

  const exportCSV = () => {
    const headers = ["ID", "Name", "Email", "Role", "Status", "Products", "Requests", "Joined"];
    const rows = users.map(u => [
      u.id, u.display_name || "", u.email, u.role, u.status,
      u.product_count || 0, u.request_count || 0,
      new Date(u.created_at).toLocaleDateString()
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `users_${Date.now()}.csv`;
    a.click();
  };

  // Summary counts from loaded users
  const counts = users.reduce((acc, u) => {
    acc.total++;
    acc[u.status] = (acc[u.status] || 0) + 1;
    return acc;
  }, { total: 0 });

  const activeFilterCount = Object.entries(filters).filter(([, v]) => v).length;

  return (
    <div className="um2-container">

      {/* ── Header ── */}
      <div className="um2-header">
        <div>
          <h1 className="um2-title">User Management</h1>
          <p className="um2-sub">
            {pagination.total > 0 ? `${pagination.total} total users` : `${users.length} users`}
            {activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} active`}
          </p>
        </div>
        <div className="um2-header-actions">
          <button className="um2-btn um2-btn-outline" onClick={() => load()}><FaSync /> Refresh</button>
          <button className="um2-btn um2-btn-outline" onClick={exportCSV}><FaDownload /> Export</button>
          <button
            className={`um2-btn um2-btn-outline ${showFilters ? "active" : ""}`}
            onClick={() => setShowFilters(v => !v)}
          >
            <FaFilter /> Filters
            {activeFilterCount > 0 && <span className="um2-filter-badge">{activeFilterCount}</span>}
            {showFilters ? <FaChevronUp /> : <FaChevronDown />}
          </button>
        </div>
      </div>

      {/* ── Summary stat pills ── */}
      <div className="um2-stats-row">
        {[
          { label: "Total",     value: pagination.total || users.length, color: "#0a5c2f" },
          { label: "Active",    value: counts.approved  || 0, color: "#10b981" },
          { label: "Pending",   value: counts.pending   || 0, color: "#f59e0b" },
          { label: "Suspended", value: counts.suspended || 0, color: "#d97706" },
          { label: "Banned",    value: counts.banned    || 0, color: "#dc2626" },
          { label: "Incomplete",value: counts.incomplete|| 0, color: "#9ca3af" },
        ].map(s => (
          <div key={s.label} className="um2-stat-pill" style={{ borderColor: s.color }}>
            <span className="um2-stat-value" style={{ color: s.color }}>{s.value}</span>
            <span className="um2-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Filter Panel ── */}
      {showFilters && (
        <div className="um2-filter-panel">
          <div className="um2-filter-grid">
            {/* Search */}
            <div className="um2-filter-field um2-filter-wide">
              <label>Search</label>
              <div className="um2-search-wrap">
                <FaSearch className="um2-search-icon" />
                <input
                  placeholder="Name, email, company…"
                  value={draft.search}
                  onChange={e => setDraft(d => ({ ...d, search: e.target.value }))}
                />
              </div>
            </div>

            {/* Role */}
            <div className="um2-filter-field">
              <label>Role</label>
              <select value={draft.role} onChange={e => setDraft(d => ({ ...d, role: e.target.value }))}>
                <option value="">All Roles</option>
                <option value="industry">Industry</option>
                <option value="stakeholder">Stakeholder</option>
              </select>
            </div>

            {/* Status */}
            <div className="um2-filter-field">
              <label>Status</label>
              <select value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}>
                <option value="">All Statuses</option>
                <option value="approved">Active</option>
                <option value="pending">Pending</option>
                <option value="incomplete">Incomplete</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Date range */}
            <div className="um2-filter-field">
              <label>Registered After</label>
              <input type="date" value={draft.startDate} onChange={e => setDraft(d => ({ ...d, startDate: e.target.value }))} />
            </div>
            <div className="um2-filter-field">
              <label>Registered Before</label>
              <input type="date" value={draft.endDate} onChange={e => setDraft(d => ({ ...d, endDate: e.target.value }))} />
            </div>

            {/* Products range */}
            <div className="um2-filter-field">
              <label>Min Products</label>
              <input type="number" min="0" placeholder="0" value={draft.minProducts} onChange={e => setDraft(d => ({ ...d, minProducts: e.target.value }))} />
            </div>
            <div className="um2-filter-field">
              <label>Max Products</label>
              <input type="number" min="0" placeholder="∞" value={draft.maxProducts} onChange={e => setDraft(d => ({ ...d, maxProducts: e.target.value }))} />
            </div>

            {/* Requests range */}
            <div className="um2-filter-field">
              <label>Min Requests</label>
              <input type="number" min="0" placeholder="0" value={draft.minRequests} onChange={e => setDraft(d => ({ ...d, minRequests: e.target.value }))} />
            </div>
            <div className="um2-filter-field">
              <label>Max Requests</label>
              <input type="number" min="0" placeholder="∞" value={draft.maxRequests} onChange={e => setDraft(d => ({ ...d, maxRequests: e.target.value }))} />
            </div>
          </div>

          <div className="um2-filter-actions">
            <button className="um2-btn um2-btn-primary" onClick={applyFilters}>Apply Filters</button>
            <button className="um2-btn um2-btn-ghost" onClick={resetFilters}>
              <FaTimes /> Clear All
            </button>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && <div className="um2-error">⚠️ {error}</div>}

      {/* ── Table ── */}
      {loading ? (
        <div className="um2-loading"><div className="um2-spinner" /><p>Loading users…</p></div>
      ) : users.length === 0 ? (
        <div className="um2-empty">
          <FaUsers />
          <p>No users match your filters.</p>
          {activeFilterCount > 0 && <button className="um2-btn um2-btn-ghost" onClick={resetFilters}>Clear filters</button>}
        </div>
      ) : (
        <div className="um2-table-wrap">
          <table className="um2-table">
            <thead>
              <tr>
                <th className="um2-th-sortable" onClick={() => toggleSort("u.id")}>
                  # <SortIcon col="u.id" sort={sort} />
                </th>
                <th className="um2-th-sortable" onClick={() => toggleSort("display_name")}>
                  User <SortIcon col="display_name" sort={sort} />
                </th>
                <th>Email</th>
                <th className="um2-th-sortable" onClick={() => toggleSort("u.role")}>
                  Role <SortIcon col="u.role" sort={sort} />
                </th>
                <th className="um2-th-sortable" onClick={() => toggleSort("u.status")}>
                  Status <SortIcon col="u.status" sort={sort} />
                </th>
                <th className="um2-th-sortable" onClick={() => toggleSort("product_count")}>
                  Products <SortIcon col="product_count" sort={sort} />
                </th>
                <th className="um2-th-sortable" onClick={() => toggleSort("request_count")}>
                  Requests <SortIcon col="request_count" sort={sort} />
                </th>
                <th className="um2-th-sortable" onClick={() => toggleSort("u.created_at")}>
                  Joined <SortIcon col="u.created_at" sort={sort} />
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={`um2-row um2-row-${u.status}`}>
                  <td className="um2-id">#{u.id}</td>
                  <td className="um2-user-cell">
                    <div className="um2-avatar" data-role={u.role}>
                      {u.role === "industry" ? <FaIndustry /> : <FaUsers />}
                    </div>
                    <div>
                      <div className="um2-name">{u.display_name || "—"}</div>
                      <div className="um2-sector">{u.sector || u.organization_type || ""}</div>
                    </div>
                  </td>
                  <td className="um2-email">{u.email}</td>
                  <td>
                    <span className={`um2-role-badge um2-role-${u.role}`}>
                      {u.role === "industry" ? "Industry" : "Stakeholder"}
                    </span>
                  </td>
                  <td><StatusPill status={u.status} /></td>
                  <td className="um2-count">{u.product_count || 0}</td>
                  <td className="um2-count">{u.request_count || 0}</td>
                  <td className="um2-date">{new Date(u.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td>
                    <div className="um2-actions">
                      <button className="um2-action-btn view" title="View details" onClick={() => fetchUserDetails(u.id)}>
                        <FaEye />
                      </button>
                      {u.status !== "banned" && (
                        <button className="um2-action-btn ban" title="Ban user" onClick={() => { setActionModal({ user: u, action: "ban" }); setActionReason(""); }}>
                          <FaBan />
                        </button>
                      )}
                      {u.status !== "suspended" && u.status !== "banned" && (
                        <button className="um2-action-btn suspend" title="Suspend user" onClick={() => { setActionModal({ user: u, action: "suspend" }); setActionReason(""); }}>
                          <FaPause />
                        </button>
                      )}
                      {(u.status === "suspended" || u.status === "banned") && (
                        <button className="um2-action-btn activate" title="Activate user" onClick={() => { setActionModal({ user: u, action: "activate" }); setActionReason(""); }}>
                          <FaUnlock />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {(pagination.hasNext || pagination.hasPrev || page > 1) && (
            <div className="um2-pagination">
              <button className="um2-page-btn" disabled={!pagination.hasPrev && page <= 1} onClick={() => changePage(page - 1)}>
                ← Prev
              </button>
              <span className="um2-page-info">Page {page}</span>
              <button className="um2-page-btn" disabled={!pagination.hasNext} onClick={() => changePage(page + 1)}>
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
