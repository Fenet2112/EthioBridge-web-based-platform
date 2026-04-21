/**
 * TransactionHistory — reusable transaction table for stakeholders, industries, and admin.
 *
 * Props:
 *   role        "stakeholder" | "industry" | "admin"
 *   tok         function returning auth token (admin) OR undefined (user token from localStorage)
 */
import { useState, useEffect, useCallback } from "react";
import { FaSearch, FaFilter, FaDownload, FaSync, FaEye, FaTimes, FaSort, FaSortUp, FaSortDown } from "react-icons/fa";
import "./TransactionHistory.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const STATUS_META = {
  pending:              { label: "Pending",     bg: "#fff8e1", color: "#b45309" },
  pending_verification: { label: "ID Review",   bg: "#f3e8ff", color: "#7c3aed" },
  approved:             { label: "Approved",    bg: "#e8f5e9", color: "#0a5c2f" },
  rejected:             { label: "Rejected",    bg: "#fff5f5", color: "#dc2626" },
  completed:            { label: "Completed",   bg: "#e0f2fe", color: "#0369a1" },
};

function StatusPill({ status }) {
  const m = STATUS_META[status] || { label: status, bg: "#f5f5f5", color: "#6b7280" };
  return <span className="th-status-pill" style={{ background: m.bg, color: m.color }}>{m.label}</span>;
}

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <FaSort className="th-sort-icon dim" />;
  return sort.dir === "asc" ? <FaSortUp className="th-sort-icon active" /> : <FaSortDown className="th-sort-icon active" />;
}

const fmtETB = (v) => v ? `${Number(v).toLocaleString()} ETB` : "—";
const fmtDate = (d) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default function TransactionHistory({ role = "stakeholder", tok }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");
  const [showFilters, setShowFilters]   = useState(false);
  const [sort, setSort]                 = useState({ col: "created_at", dir: "desc" });
  const [detail, setDetail]             = useState(null);
  const [page, setPage]                 = useState(1);
  const [hasMore, setHasMore]           = useState(false);

  const getToken = () => tok ? tok() : localStorage.getItem("token");

  const endpoint = role === "stakeholder"
    ? `${API}/api/purchases/my-requests`
    : role === "industry"
    ? `${API}/api/purchases/industry-requests`
    : `${API}/api/admin/transactions`;

  const load = useCallback(async (p = 1) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: p, limit: 50 });
      if (statusFilter) params.set("status", statusFilter);
      if (dateFrom)     params.set("dateFrom", dateFrom);
      if (dateTo)       params.set("dateTo", dateTo);

      const res = await fetch(`${endpoint}?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to load");
      const data = await res.json();

      // Handle both array and {transactions:[]} response shapes
      const rows = Array.isArray(data) ? data : (data.transactions || data.sellers || []);
      setTransactions(rows);
      setHasMore(rows.length === 50);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [endpoint, statusFilter, dateFrom, dateTo]); // eslint-disable-line

  useEffect(() => { setPage(1); load(1); }, [load]);

  // Client-side search + sort (data already filtered server-side by status/date)
  const displayed = transactions
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        t.product_name?.toLowerCase().includes(q) ||
        t.industry_name?.toLowerCase().includes(q) ||
        t.stakeholder_org?.toLowerCase().includes(q) ||
        t.organization_name?.toLowerCase().includes(q) ||
        t.stakeholder_email?.toLowerCase().includes(q) ||
        String(t.id).includes(q)
      );
    })
    .sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.col === "created_at") return dir * (new Date(a.created_at) - new Date(b.created_at));
      if (sort.col === "total_price") return dir * ((a.total_price || 0) - (b.total_price || 0));
      if (sort.col === "quantity")    return dir * (a.quantity - b.quantity);
      if (sort.col === "status")      return dir * a.status.localeCompare(b.status);
      return 0;
    });

  const toggleSort = (col) => setSort(s => s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "desc" });

  const exportCSV = () => {
    const headers = ["ID", "Product", "Industry", "Stakeholder", "Qty", "Total (ETB)", "Status", "Date"];
    const rows = displayed.map(t => [
      t.id, t.product_name, t.industry_name || "—",
      t.stakeholder_org || t.organization_name || "—",
      t.quantity, t.total_price || "", t.status,
      fmtDate(t.created_at)
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `transactions_${Date.now()}.csv`;
    a.click();
  };

  // Summary counts
  const counts = transactions.reduce((acc, t) => {
    acc.total++;
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, { total: 0 });

  const totalValue = transactions.reduce((s, t) => s + (parseFloat(t.total_price) || 0), 0);
  const activeFilters = [statusFilter, dateFrom, dateTo].filter(Boolean).length;

  return (
    <div className="th-container">

      {/* ── Summary pills ── */}
      <div className="th-summary-row">
        {[
          { label: "Total",    value: counts.total,     color: "#0a5c2f" },
          { label: "Pending",  value: counts.pending || 0, color: "#f59e0b" },
          { label: "Approved", value: counts.approved || 0, color: "#10b981" },
          { label: "Rejected", value: counts.rejected || 0, color: "#dc2626" },
          { label: "Value",    value: fmtETB(totalValue), color: "#0369a1" },
        ].map(s => (
          <div key={s.label} className="th-summary-pill" style={{ borderColor: s.color }}>
            <span className="th-summary-value" style={{ color: s.color }}>{s.value}</span>
            <span className="th-summary-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="th-toolbar">
        <div className="th-search-wrap">
          <FaSearch className="th-search-icon" />
          <input
            className="th-search"
            placeholder="Search product, industry, stakeholder…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="th-toolbar-actions">
          <button className={`th-btn th-btn-outline ${showFilters ? "active" : ""}`} onClick={() => setShowFilters(v => !v)}>
            <FaFilter /> Filters {activeFilters > 0 && <span className="th-badge">{activeFilters}</span>}
          </button>
          <button className="th-btn th-btn-outline" onClick={() => load(page)}><FaSync /></button>
          <button className="th-btn th-btn-outline" onClick={exportCSV}><FaDownload /> Export</button>
        </div>
      </div>

      {/* ── Filter panel ── */}
      {showFilters && (
        <div className="th-filter-panel">
          <div className="th-filter-grid">
            <div className="th-filter-field">
              <label>Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="pending_verification">ID Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="th-filter-field">
              <label>From Date</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="th-filter-field">
              <label>To Date</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
          <button className="th-btn th-btn-ghost" onClick={() => { setStatusFilter(""); setDateFrom(""); setDateTo(""); }}>
            <FaTimes /> Clear Filters
          </button>
        </div>
      )}

      {error && <div className="th-error">⚠️ {error}</div>}

      {/* ── Table ── */}
      {loading ? (
        <div className="th-loading"><div className="th-spinner" /><p>Loading transactions…</p></div>
      ) : displayed.length === 0 ? (
        <div className="th-empty">
          <span>📋</span>
          <p>No transactions found.</p>
          {(search || activeFilters > 0) && <small>Try clearing your filters.</small>}
        </div>
      ) : (
        <div className="th-table-wrap">
          <table className="th-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                {role !== "stakeholder" && <th>Stakeholder</th>}
                {role !== "industry"    && <th>Industry</th>}
                <th className="th-sortable" onClick={() => toggleSort("quantity")}>
                  Qty <SortIcon col="quantity" sort={sort} />
                </th>
                <th className="th-sortable" onClick={() => toggleSort("total_price")}>
                  Total <SortIcon col="total_price" sort={sort} />
                </th>
                <th className="th-sortable" onClick={() => toggleSort("status")}>
                  Status <SortIcon col="status" sort={sort} />
                </th>
                <th className="th-sortable" onClick={() => toggleSort("created_at")}>
                  Date <SortIcon col="created_at" sort={sort} />
                </th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(t => (
                <tr key={t.id} className={`th-row th-row-${t.status}`}>
                  <td className="th-id">#{t.id}</td>
                  <td>
                    <div className="th-product-cell">
                      {t.product_image && (
                        <img src={`${API}${t.product_image}`} alt="" className="th-product-thumb" onError={e => e.target.style.display = "none"} />
                      )}
                      <div>
                        <div className="th-product-name">{t.product_name}</div>
                        {t.unit && <div className="th-product-unit">per {t.unit}</div>}
                      </div>
                    </div>
                  </td>
                  {role !== "stakeholder" && (
                    <td>
                      <div className="th-name">{t.stakeholder_org || t.organization_name || "—"}</div>
                      <div className="th-sub">{t.stakeholder_email}</div>
                    </td>
                  )}
                  {role !== "industry" && (
                    <td>
                      <div className="th-name">{t.industry_name || "—"}</div>
                      <div className="th-sub">{t.sector}</div>
                    </td>
                  )}
                  <td className="th-qty">{Number(t.quantity).toLocaleString()}</td>
                  <td className="th-price">{fmtETB(t.total_price)}</td>
                  <td><StatusPill status={t.status} /></td>
                  <td className="th-date">{fmtDate(t.created_at)}</td>
                  <td>
                    <button className="th-view-btn" onClick={() => setDetail(t)} title="View details">
                      <FaEye />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="th-table-footer">
            Showing {displayed.length} of {transactions.length} transactions
            {hasMore && (
              <button className="th-btn th-btn-outline" style={{ marginLeft: 12 }} onClick={() => { const p = page + 1; setPage(p); load(p); }}>
                Load more
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detail && (
        <div className="th-modal-overlay" onClick={() => setDetail(null)}>
          <div className="th-modal" onClick={e => e.stopPropagation()}>
            <div className="th-modal-header">
              <h3>Transaction #{detail.id}</h3>
              <button className="th-modal-close" onClick={() => setDetail(null)}><FaTimes /></button>
            </div>
            <div className="th-modal-body">
              <div className="th-modal-status-row">
                <StatusPill status={detail.status} />
                <span className="th-modal-date">{fmtDate(detail.created_at)}</span>
              </div>

              <div className="th-modal-grid">
                <Section title="📦 Product">
                  <Row label="Name"     value={detail.product_name} />
                  <Row label="Unit Price" value={fmtETB(detail.price)} />
                  <Row label="Quantity" value={detail.quantity} />
                  <Row label="Total"    value={fmtETB(detail.total_price)} />
                </Section>
                <Section title="🏭 Industry">
                  <Row label="Company"  value={detail.industry_name} />
                  <Row label="Sector"   value={detail.sector} />
                  <Row label="Location" value={detail.industry_location} />
                </Section>
                <Section title="🤝 Stakeholder">
                  <Row label="Organization" value={detail.stakeholder_org || detail.organization_name} />
                  <Row label="Contact"      value={detail.full_name || detail.contact_person} />
                  <Row label="Phone"        value={detail.phone} />
                  <Row label="Location"     value={detail.location} />
                  <Row label="Email"        value={detail.stakeholder_email} />
                </Section>
                <Section title="📋 Notes">
                  <Row label="Notes"       value={detail.notes} />
                  <Row label="Admin Notes" value={detail.admin_notes} />
                  <Row label="Updated"     value={detail.updated_at ? fmtDate(detail.updated_at) : null} />
                </Section>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="th-modal-section">
      <h4 className="th-modal-section-title">{title}</h4>
      {children}
    </div>
  );
}
function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="th-modal-row">
      <span className="th-modal-label">{label}</span>
      <span className="th-modal-value">{value}</span>
    </div>
  );
}
