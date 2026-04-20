import { useState, useEffect, useCallback } from "react";
import {
  FaSearch, FaFilter, FaExclamationTriangle, FaEye, FaCheck, FaTimes,
  FaDownload, FaSync, FaChartBar, FaUsers, FaIndustry, FaClipboardList,
  FaMoneyBillWave, FaCalendarAlt, FaShieldAlt, FaBan, FaSort,
  FaSortUp, FaSortDown, FaTimes as FaClose
} from "react-icons/fa";
import "./TransactionsView.css";

const API = process.env.REACT_APP_API_URL || "https://ethiobridge-web-based-platform.onrender.com";

// ── Risk thresholds ──
const RISK = {
  HIGH_QTY: 500,
  HIGH_PRICE: 500000,
  LOW_PRICE: 1,
  BURST_COUNT: 5,   // same stakeholder, same day
};

function riskFlags(tx, allTx) {
  const flags = [];
  if (tx.quantity >= RISK.HIGH_QTY) flags.push("High quantity");
  if (tx.total_price >= RISK.HIGH_PRICE) flags.push("Unusually high price");
  if (tx.unit_price > 0 && tx.unit_price < RISK.LOW_PRICE) flags.push("Suspiciously low price");
  const sameDay = allTx.filter(t =>
    t.stakeholder_id === tx.stakeholder_id &&
    t.id !== tx.id &&
    new Date(t.created_at).toDateString() === new Date(tx.created_at).toDateString()
  );
  if (sameDay.length >= RISK.BURST_COUNT) flags.push("Burst activity");
  return flags;
}

const STATUS_COLORS = {
  approved:             { bg: "#e8f5e9", color: "#0a5c2f", label: "Approved" },
  pending:              { bg: "#fff8e1", color: "#b45309", label: "Pending" },
  pending_verification: { bg: "#f3e8ff", color: "#7c3aed", label: "ID Review" },
  rejected:             { bg: "#fff5f5", color: "#dc2626", label: "Rejected" },
  completed:            { bg: "#e0f2fe", color: "#0369a1", label: "Completed" },
};

function StatusPill({ status }) {
  const s = STATUS_COLORS[status] || { bg: "#f5f5f5", color: "#888", label: status };
  return (
    <span style={{ background: s.bg, color: s.color, padding: "3px 10px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function RiskBadge({ flags }) {
  if (!flags.length) return null;
  return (
    <span title={flags.join(" · ")} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fff3cd", color: "#92400e", padding: "2px 8px", borderRadius: 12, fontSize: "0.7rem", fontWeight: 700, cursor: "help" }}>
      <FaExclamationTriangle style={{ fontSize: "0.65rem" }} /> Risk
    </span>
  );
}

export default function TransactionsView({ tok }) {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [filters, setFilters] = useState({
    status: "", industry: "", stakeholder: "",
    minPrice: "", maxPrice: "", dateFrom: "", dateTo: "", search: ""
  });
  const [showFilters, setShowFilters] = useState(false);

  // Sort
  const [sort, setSort] = useState({ col: "created_at", dir: "desc" });

  // Detail modal
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Action state
  const [actionLoading, setActionLoading] = useState(null);

  // ── Fetch ──
  const fetchAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      params.set("sortBy", sort.col);
      params.set("sortOrder", sort.dir);

      const [txRes, sumRes] = await Promise.all([
        fetch(`${API}/api/admin/transactions?${params}`, { headers: { Authorization: `Bearer ${tok()}` } }),
        fetch(`${API}/api/admin/transactions/summary`, { headers: { Authorization: `Bearer ${tok()}` } }),
      ]);

      if (!txRes.ok) throw new Error((await txRes.json()).message || "Failed to load");
      const txData = await txRes.json();
      setTransactions(txData.transactions || txData);

      if (sumRes.ok) setSummary(await sumRes.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [filters, sort, tok]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Open detail ──
  const openDetail = async (id) => {
    setDetailLoading(true); setDetail({ id });
    try {
      const res = await fetch(`${API}/api/admin/transactions/${id}`, { headers: { Authorization: `Bearer ${tok()}` } });
      if (res.ok) setDetail(await res.json());
    } catch (e) { console.error(e); }
    finally { setDetailLoading(false); }
  };

  // ── Status action ──
  const handleAction = async (id, status, reason = "") => {
    setActionLoading(id + status);
    try {
      const res = await fetch(`${API}/api/admin/transactions/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ status, admin_notes: reason }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      setDetail(null);
      fetchAll();
    } catch (e) { alert("Error: " + e.message); }
    finally { setActionLoading(null); }
  };

  // ── Sort toggle ──
  const toggleSort = (col) => {
    setSort(s => s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "desc" });
  };
  const SortIcon = ({ col }) => {
    if (sort.col !== col) return <FaSort style={{ opacity: 0.3, fontSize: "0.7rem" }} />;
    return sort.dir === "asc" ? <FaSortUp style={{ fontSize: "0.7rem", color: "#0a5c2f" }} /> : <FaSortDown style={{ fontSize: "0.7rem", color: "#0a5c2f" }} />;
  };

  // ── CSV export ──
  const exportCSV = () => {
    const headers = ["ID", "Stakeholder", "Industry", "Product", "Qty", "Price", "Status", "Date"];
    const rows = transactions.map(t => [
      t.id, t.stakeholder_name || t.organization_name, t.industry_name,
      t.product_name, t.quantity, t.total_price || "", t.status,
      new Date(t.created_at).toLocaleDateString()
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `transactions_${Date.now()}.csv`;
    a.click();
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="txn-container">

      {/* ── Summary Cards ── */}
      {summary && (
        <div className="txn-summary-grid">
          {[
            { icon: <FaClipboardList />, label: "Total", value: summary.total, color: "#667eea" },
            { icon: <FaCheck />, label: "Approved", value: summary.approved, color: "#0a5c2f" },
            { icon: <FaExclamationTriangle />, label: "Pending", value: summary.pending, color: "#f59e0b" },
            { icon: <FaTimes />, label: "Rejected", value: summary.rejected, color: "#dc2626" },
            { icon: <FaMoneyBillWave />, label: "Total Value", value: summary.total_value ? `${Number(summary.total_value).toLocaleString()} ETB` : "—", color: "#0369a1" },
            { icon: <FaExclamationTriangle />, label: "Flagged", value: summary.flagged || 0, color: "#92400e" },
          ].map(c => (
            <div key={c.label} className="txn-summary-card" style={{ "--card-color": c.color }}>
              <div className="txn-summary-icon">{c.icon}</div>
              <div className="txn-summary-value">{c.value}</div>
              <div className="txn-summary-label">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Top bar ── */}
      <div className="txn-topbar">
        <div className="txn-search-wrap">
          <FaSearch className="txn-search-icon" />
          <input
            className="txn-search"
            placeholder="Search stakeholder, industry, product…"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          />
        </div>
        <div className="txn-topbar-actions">
          <button className={`txn-btn txn-btn-outline ${showFilters ? "active" : ""}`} onClick={() => setShowFilters(v => !v)}>
            <FaFilter /> Filters {activeFilterCount > 0 && <span className="txn-filter-badge">{activeFilterCount}</span>}
          </button>
          <button className="txn-btn txn-btn-outline" onClick={fetchAll}><FaSync /> Refresh</button>
          <button className="txn-btn txn-btn-outline" onClick={exportCSV}><FaDownload /> Export</button>
        </div>
      </div>

      {/* ── Filter Panel ── */}
      {showFilters && (
        <div className="txn-filter-panel">
          <div className="txn-filter-grid">
            <div className="txn-filter-field">
              <label>Status</label>
              <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="pending_verification">ID Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="txn-filter-field">
              <label>Industry</label>
              <input placeholder="Industry name…" value={filters.industry} onChange={e => setFilters(f => ({ ...f, industry: e.target.value }))} />
            </div>
            <div className="txn-filter-field">
              <label>Stakeholder</label>
              <input placeholder="Stakeholder name…" value={filters.stakeholder} onChange={e => setFilters(f => ({ ...f, stakeholder: e.target.value }))} />
            </div>
            <div className="txn-filter-field">
              <label>Min Price (ETB)</label>
              <input type="number" placeholder="0" value={filters.minPrice} onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))} />
            </div>
            <div className="txn-filter-field">
              <label>Max Price (ETB)</label>
              <input type="number" placeholder="∞" value={filters.maxPrice} onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))} />
            </div>
            <div className="txn-filter-field">
              <label>From Date</label>
              <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
            </div>
            <div className="txn-filter-field">
              <label>To Date</label>
              <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
            </div>
          </div>
          <button className="txn-btn txn-btn-ghost" onClick={() => setFilters({ status: "", industry: "", stakeholder: "", minPrice: "", maxPrice: "", dateFrom: "", dateTo: "", search: "" })}>
            Clear All Filters
          </button>
        </div>
      )}

      {/* ── Table ── */}
      {error && <div className="txn-error">{error}</div>}

      {loading ? (
        <div className="txn-loading">
          <div className="txn-spinner" />
          <p>Loading transactions…</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="txn-empty">
          <FaClipboardList />
          <p>No transactions found</p>
        </div>
      ) : (
        <div className="txn-table-wrap">
          <table className="txn-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort("id")}># <SortIcon col="id" /></th>
                <th onClick={() => toggleSort("stakeholder_name")}>Stakeholder <SortIcon col="stakeholder_name" /></th>
                <th onClick={() => toggleSort("industry_name")}>Industry <SortIcon col="industry_name" /></th>
                <th onClick={() => toggleSort("product_name")}>Product <SortIcon col="product_name" /></th>
                <th onClick={() => toggleSort("quantity")}>Qty <SortIcon col="quantity" /></th>
                <th onClick={() => toggleSort("total_price")}>Value <SortIcon col="total_price" /></th>
                <th onClick={() => toggleSort("status")}>Status <SortIcon col="status" /></th>
                <th onClick={() => toggleSort("created_at")}>Date <SortIcon col="created_at" /></th>
                <th>Risk</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => {
                const flags = riskFlags(tx, transactions);
                return (
                  <tr key={tx.id} className={flags.length ? "txn-row-risk" : ""}>
                    <td className="txn-id">#{tx.id}</td>
                    <td>
                      <div className="txn-cell-primary">{tx.stakeholder_name || tx.organization_name || "—"}</div>
                      <div className="txn-cell-sub">{tx.stakeholder_email}</div>
                    </td>
                    <td>
                      <div className="txn-cell-primary">{tx.industry_name}</div>
                      <div className="txn-cell-sub">{tx.sector}</div>
                    </td>
                    <td className="txn-cell-primary">{tx.product_name}</td>
                    <td className="txn-qty">{Number(tx.quantity).toLocaleString()}</td>
                    <td className="txn-price">
                      {tx.total_price ? `${Number(tx.total_price).toLocaleString()} ETB` : "—"}
                    </td>
                    <td><StatusPill status={tx.status} /></td>
                    <td className="txn-date">{new Date(tx.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td><RiskBadge flags={flags} /></td>
                    <td>
                      <div className="txn-actions">
                        <button className="txn-action-btn view" title="View details" onClick={() => openDetail(tx.id)}><FaEye /></button>
                        {(tx.status === "pending" || tx.status === "pending_verification") && (
                          <>
                            <button className="txn-action-btn approve" title="Approve" disabled={actionLoading === tx.id + "approved"} onClick={() => handleAction(tx.id, "approved")}><FaCheck /></button>
                            <button className="txn-action-btn reject" title="Reject" disabled={actionLoading === tx.id + "rejected"} onClick={() => { const r = prompt("Rejection reason:"); if (r) handleAction(tx.id, "rejected", r); }}><FaTimes /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="txn-table-footer">
            Showing {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detail && (
        <div className="txn-modal-overlay" onClick={() => setDetail(null)}>
          <div className="txn-modal" onClick={e => e.stopPropagation()}>
            <div className="txn-modal-header">
              <h2>Transaction #{detail.id}</h2>
              <button className="txn-modal-close" onClick={() => setDetail(null)}><FaClose /></button>
            </div>

            {detailLoading ? (
              <div className="txn-loading" style={{ padding: "40px" }}><div className="txn-spinner" /></div>
            ) : (
              <div className="txn-modal-body">
                {/* Status + Risk */}
                <div className="txn-modal-status-row">
                  <StatusPill status={detail.status} />
                  {detail.risk_flags?.length > 0 && (
                    <div className="txn-modal-risk-alert">
                      <FaExclamationTriangle /> Risk Flags: {detail.risk_flags.join(" · ")}
                    </div>
                  )}
                </div>

                {/* Info grid */}
                <div className="txn-modal-grid">
                  <Section title="👤 Stakeholder">
                    <Row label="Name" value={detail.stakeholder_name || detail.organization_name} />
                    <Row label="Email" value={detail.stakeholder_email} />
                    <Row label="Phone" value={detail.phone} />
                    <Row label="Location" value={detail.location} />
                    <Row label="Organization" value={detail.organization_name} />
                  </Section>
                  <Section title="🏭 Industry">
                    <Row label="Company" value={detail.industry_name} />
                    <Row label="Sector" value={detail.sector} />
                  </Section>
                  <Section title="📦 Product">
                    <Row label="Product" value={detail.product_name} />
                    <Row label="Unit Price" value={detail.unit_price ? `${Number(detail.unit_price).toLocaleString()} ETB` : "—"} />
                    <Row label="Quantity" value={detail.quantity} />
                    <Row label="Total Value" value={detail.total_price ? `${Number(detail.total_price).toLocaleString()} ETB` : "—"} />
                    <Row label="Notes" value={detail.notes} />
                  </Section>
                  <Section title="📋 Audit Trail">
                    <Row label="Submitted" value={detail.created_at ? new Date(detail.created_at).toLocaleString() : "—"} />
                    <Row label="Last Updated" value={detail.updated_at ? new Date(detail.updated_at).toLocaleString() : "—"} />
                    <Row label="Admin Notes" value={detail.admin_notes} />
                    {detail.id_document_url && (
                      <div className="txn-id-doc">
                        <span className="txn-row-label">ID Document</span>
                        {/\.(jpg|jpeg|png)$/i.test(detail.id_document_url)
                          ? <a href={`${API}${detail.id_document_url}`} target="_blank" rel="noopener noreferrer"><img src={`${API}${detail.id_document_url}`} alt="ID" className="txn-id-preview" /></a>
                          : <a href={`${API}${detail.id_document_url}`} target="_blank" rel="noopener noreferrer" className="txn-doc-link">📄 View Document</a>
                        }
                      </div>
                    )}
                  </Section>
                </div>

                {/* Actions */}
                {(detail.status === "pending" || detail.status === "pending_verification") && (
                  <div className="txn-modal-actions">
                    <button className="txn-btn txn-btn-approve" disabled={!!actionLoading} onClick={() => handleAction(detail.id, "approved")}>
                      <FaCheck /> Approve Transaction
                    </button>
                    <button className="txn-btn txn-btn-reject" disabled={!!actionLoading} onClick={() => { const r = prompt("Rejection reason (required):"); if (r) handleAction(detail.id, "rejected", r); }}>
                      <FaTimes /> Reject Transaction
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ──
function Section({ title, children }) {
  return (
    <div className="txn-modal-section">
      <h4 className="txn-modal-section-title">{title}</h4>
      {children}
    </div>
  );
}
function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="txn-modal-row">
      <span className="txn-row-label">{label}</span>
      <span className="txn-row-value">{value}</span>
    </div>
  );
}
