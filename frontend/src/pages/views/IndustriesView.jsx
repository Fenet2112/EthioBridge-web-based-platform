import { useState, useEffect } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function IndustriesView({ tok }) {
  const [industries, setIndustries]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [search, setSearch]             = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchIndustries = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/admin/industries`, {
        headers: { Authorization: `Bearer ${tok()}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load industries");
      // Backend returns { industries: [...], pagination: {...} }
      const list = Array.isArray(data) ? data : (data.industries || []);
      setIndustries(list);
    } catch (err) {
      setError(err.message || "Failed to load industries");
      setIndustries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIndustries(); }, []); // eslint-disable-line

  const handleDelete = async (id) => {
    setActionLoading(id);
    try {
      const res = await fetch(`${API}/api/admin/industries/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tok()}` }
      });
      if (!res.ok) throw new Error("Delete failed");
      setIndustries(prev => prev.filter(i => i.id !== id));
      setConfirmDelete(null);
    } catch {
      alert("Failed to delete industry");
    } finally {
      setActionLoading(null);
    }
  };

  const sectors = ["all", ...new Set(industries.map(i => i.sector).filter(Boolean))];

  const filtered = industries.filter(i => {
    const matchSearch = !search
      || i.company_name?.toLowerCase().includes(search.toLowerCase())
      || i.email?.toLowerCase().includes(search.toLowerCase())
      || i.location?.toLowerCase().includes(search.toLowerCase());
    const matchSector = sectorFilter === "all" || i.sector === sectorFilter;
    return matchSearch && matchSector;
  });

  return (
    <div className="view-wrap">
      <div className="view-header">
        <div>
          <h2>Industries</h2>
          <p>{filtered.length} of {industries.length} industries</p>
        </div>
        <button className="refresh-btn" onClick={fetchIndustries}>↻ Refresh</button>
      </div>

      <div className="filter-bar">
        <div className="search-wrap">
          <span>🔍</span>
          <input
            className="search-input"
            placeholder="Search by name, email or location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={sectorFilter}
          onChange={e => setSectorFilter(e.target.value)}
        >
          {sectors.map(s => (
            <option key={s} value={s}>{s === "all" ? "All Sectors" : s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="admin-loading">Loading industries...</div>
      ) : error ? (
        <div className="admin-empty">
          <span>⚠️</span>
          <p>{error}</p>
          <button className="refresh-btn" onClick={fetchIndustries} style={{ marginTop: 12 }}>
            Try Again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="admin-empty">
          <span>🏭</span>
          <p>{industries.length === 0 ? "No industries found in the database." : "No industries match your search."}</p>
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Sector</th>
                <th>Location</th>
                <th>Email</th>
                <th>Products</th>
                <th>Requests</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(ind => (
                <tr key={ind.id}>
                  <td>
                    <div className="cell-primary">🏭 {ind.company_name || "—"}</div>
                    {ind.website && (
                      <div className="cell-sub">
                        <a href={ind.website} target="_blank" rel="noopener noreferrer">
                          {ind.website}
                        </a>
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="tag tag-purple">{ind.sector || "—"}</span>
                  </td>
                  <td className="cell-sub">{ind.location || "—"}</td>
                  <td className="cell-sub">{ind.email || "—"}</td>
                  <td className="cell-primary">{ind.product_count ?? 0}</td>
                  <td className="cell-primary">{ind.request_count ?? 0}</td>
                  <td>
                    <span className={`status-pill ${ind.status === "approved" ? "status-approved" : ind.status === "pending" ? "status-pending" : "status-rejected"}`}>
                      {ind.status || "—"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="tbl-btn tbl-btn-danger"
                      onClick={() => setConfirmDelete(ind)}
                      disabled={actionLoading === ind.id}
                    >
                      🗑 Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "2.5rem", textAlign: "center", marginBottom: 12 }}>⚠️</div>
            <h2 style={{ textAlign: "center" }}>Remove Industry?</h2>
            <p style={{ textAlign: "center" }}>
              This will permanently remove <strong>{confirmDelete.company_name}</strong> and all its products.
            </p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                className="modal-reject"
                onClick={() => handleDelete(confirmDelete.id)}
                disabled={actionLoading === confirmDelete.id}
              >
                {actionLoading === confirmDelete.id ? "Removing..." : "Confirm Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
