import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from '../utils/api';
import "./RecommendWidget.css";

const CATEGORIES = [
  "Cement", "Steel", "Brick", "Wood", "Paint",
  "Sand", "Glass", "Tile", "Concrete", "Pipe",
  "Electrical", "Tool", "Roof", "Other",
];

const LABEL_MAP = {
  products:   { title: "Find Products for You",      btn: "Get Recommendations", type: "products"   },
  industries: { title: "Find Industries to Invest In", btn: "Find Industries",    type: "industries" },
};

function scoreLabel(score, popularity) {
  if (score >= 0.7)       return { text: "Best Match",  cls: "tag-best"    };
  if (popularity >= 0.6)  return { text: "Popular",     cls: "tag-popular" };
  if (score >= 0.4)       return { text: "Good Fit",    cls: "tag-good"    };
  return null;
}

export default function RecommendWidget({ mode = "products" }) {
  const navigate = useNavigate();
  const cfg = LABEL_MAP[mode];

  const [category, setCategory] = useState("");
  const [budget, setBudget]     = useState("");
  const [results, setResults]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResults(null);

    const token = localStorage.getItem("token");
    const params = new URLSearchParams({
      category: category || "",
      budget:   parseFloat(budget) || 0,
      top_n:    8,
    });

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/recommendations/${cfg.type}?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setResults(data.recommendations || []);
    } catch (err) {
      setError("Could not load recommendations. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rw-wrap">
      <div className="rw-header">
        <span className="rw-icon">✨</span>
        <div>
          <h2>{cfg.title}</h2>
          <p>Tell us what you're looking for and we'll find the best matches.</p>
        </div>
      </div>

      <form className="rw-form" onSubmit={handleSubmit}>
        <div className="rw-field">
          <label>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="rw-field">
          <label>{mode === "industries" ? "Investment Amount (ETB)" : "Budget (ETB)"}</label>
          <input
            type="number"
            min="0"
            value={budget}
            onChange={e => setBudget(e.target.value)}
            placeholder="e.g. 50000"
          />
        </div>

        <button type="submit" className="rw-btn" disabled={loading}>
          {loading ? <span className="rw-spinner" /> : "🔍"} {cfg.btn}
        </button>
      </form>

      {error && <p className="rw-error">{error}</p>}

      {results !== null && (
        results.length === 0 ? (
          <p className="rw-empty">No matches found. Try a different category or budget.</p>
        ) : (
          <div className="rw-results">
            <p className="rw-count">{results.length} recommendation{results.length !== 1 ? "s" : ""} found</p>
            <div className="rw-grid">
              {results.map((r, i) => {
                const tag = scoreLabel(r.score, r.popularity);
                const isProduct = mode === "products";
                return (
                  <div
                    key={isProduct ? r.product_id : r.industry_id}
                    className="rw-card"
                    onClick={() => navigate(isProduct ? `/industry/${r.industry_id}` : `/industry/${r.industry_id}`)}
                  >
                    {i === 0 && <span className="rw-rank-badge">#1 Pick</span>}
                    {tag && <span className={`rw-tag ${tag.cls}`}>{tag.text}</span>}

                    <div className="rw-card-icon">
                      {isProduct ? "📦" : "🏭"}
                    </div>

                    <h4>{isProduct ? r.name : r.company_name}</h4>

                    {isProduct ? (
                      <>
                        {r.category && <span className="rw-cat">{r.category}</span>}
                        <p className="rw-detail">
                          {r.price ? `${Number(r.price).toLocaleString()} ETB${r.unit && r.unit !== "unit" ? ` / ${r.unit}` : ""}` : "Price on request"}
                        </p>
                        <p className="rw-sub">{r.company_name}</p>
                      </>
                    ) : (
                      <>
                        {r.sector && <span className="rw-cat">{r.sector}</span>}
                        <p className="rw-detail">📦 {r.product_count} products</p>
                        <p className="rw-sub">🤝 {r.customer_count} connections</p>
                        {r.location && <p className="rw-sub">📍 {r.location}</p>}
                      </>
                    )}

                    {r.score !== null && r.score !== undefined && (
                      <div className="rw-score-row">
                        <div className="rw-score-bar">
                          <div className="rw-score-fill" style={{ width: `${Math.round(r.score * 100)}%` }} />
                        </div>
                        <span>{Math.round(r.score * 100)}% match</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}
