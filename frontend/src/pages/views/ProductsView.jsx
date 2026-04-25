import { useState, useEffect } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ProductsView({ tok }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/products`, { headers: { Authorization: `Bearer ${tok()}` } });
      const data = await res.json();
      // Backend returns { products: [...], pagination: {...} }
      const list = Array.isArray(data) ? data : (data.products || []);
      setProducts(list);
    } catch { setProducts([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, []); // eslint-disable-line

  const handleDelete = async (id) => {
    setActionLoading(id);
    try {
      await fetch(`${API}/api/admin/products/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${tok()}` } });
      setProducts(prev => prev.filter(p => p.id !== id));
      setConfirmDelete(null);
    } catch { alert("Failed to delete product"); }
    finally { setActionLoading(null); }
  };

  const categories = ["all", ...new Set(products.map(p => p.category).filter(Boolean))];

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.industry_name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "all" || p.category === catFilter;
    return matchSearch && matchCat;
  });

  const maxRequests = Math.max(...products.map(p => Number(p.request_count) || 0), 1);

  return (
    <div className="view-wrap">
      <div className="view-header">
        <div><h2>Products</h2><p>{filtered.length} of {products.length} products</p></div>
        <button className="refresh-btn" onClick={fetchProducts}>↻ Refresh</button>
      </div>

      <div className="filter-bar">
        <div className="search-wrap">
          <span>🔍</span>
          <input className="search-input" placeholder="Search by name or industry..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          {categories.map(c => <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>)}
        </select>
      </div>

      {loading ? <div className="admin-loading">Loading...</div> : filtered.length === 0 ? (
        <div className="admin-empty"><span>📦</span><p>No products found.</p></div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Product</th><th>Industry</th><th>Category</th><th>Price</th><th>Popularity</th><th>Available</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="cell-primary">📦 {p.name}</div>
                    <div className="cell-sub">{p.unit}</div>
                  </td>
                  <td>
                    <div className="cell-primary">{p.industry_name}</div>
                    <div className="cell-sub">{p.sector}</div>
                  </td>
                  <td><span className="tag tag-purple">{p.category || "—"}</span></td>
                  <td className="cell-primary">{p.price ? `$${Number(p.price).toLocaleString()}` : "—"}</td>
                  <td>
                    <div className="popularity-bar">
                      <div className="popularity-fill" style={{ width: `${(Number(p.request_count) / maxRequests) * 100}%` }} />
                      <span>{p.request_count} req</span>
                    </div>
                  </td>
                  <td>
                    <span className={`status-pill ${p.is_available ? "status-approved" : "status-rejected"}`}>
                      {p.is_available ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <button className="tbl-btn tbl-btn-danger" onClick={() => setConfirmDelete(p)}
                      disabled={actionLoading === p.id}>🗑 Remove</button>
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
            <h2 style={{ textAlign: "center" }}>Remove Product?</h2>
            <p style={{ textAlign: "center" }}>This will permanently remove <strong>{confirmDelete.name}</strong>.</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="modal-reject" onClick={() => handleDelete(confirmDelete.id)}
                disabled={actionLoading === confirmDelete.id}>
                {actionLoading === confirmDelete.id ? "Removing..." : "Confirm Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
