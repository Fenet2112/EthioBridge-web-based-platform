import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import StakeholderNav from "../components/StakeholderNav";
import "./Recommendations.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const CATEGORIES = [
  { value: "Cement",      icon: "🏗️" },
  { value: "Steel",       icon: "⚙️" },
  { value: "Brick",       icon: "🧱" },
  { value: "Wood",        icon: "🪵" },
  { value: "Paint",       icon: "🎨" },
  { value: "Sand",        icon: "⛱️" },
  { value: "Glass",       icon: "🪟" },
  { value: "Tile",        icon: "🔲" },
  { value: "Concrete",    icon: "🏗️" },
  { value: "Pipe",        icon: "🚰" },
  { value: "Electrical",  icon: "⚡" },
  { value: "Tool",        icon: "🔧" },
  { value: "Roof",        icon: "🏠" },
  { value: "Other",       icon: "📦" },
];

function scoreTag(score, popularity) {
  if (score >= 0.7)      return { text: "Best Match",  cls: "tag-best"    };
  if (popularity >= 0.6) return { text: "Popular",     cls: "tag-pop"     };
  if (score >= 0.4)      return { text: "Good Fit",    cls: "tag-good"    };
  return null;
}

export default function Recommendations() {
  const navigate  = useNavigate();
  const resultsRef = useRef(null);

  const [tab,      setTab]      = useState("products");
  const [category, setCategory] = useState("");
  const [budget,   setBudget]   = useState("");
  const [results,  setResults]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleSearch = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError("");
    setResults(null);

    const token  = localStorage.getItem("token");
    const params = new URLSearchParams({
      category: category || "",
      budget:   parseFloat(budget) || 0,
      top_n:    12,
    });

    try {
      const res  = await fetch(`${API}/api/recommendations/${tab}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setResults(data.recommendations || []);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err) {
      console.error("Recommendation fetch error:", err);
      setError("Could not load recommendations. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (t) => {
    setTab(t);
    setResults(null);
    setError("");
  };

  return (
    <div className="rp-page">
      <StakeholderNav />

      {/* ── Hero ── */}
      <div className="rp-hero">
        <div className="rp-hero-blob rp-blob-1" />
        <div className="rp-hero-blob rp-blob-2" />
        <div className="rp-hero-inner">
          <div className="rp-hero-left">
            <span className="rp-badge">✨ AI-Powered Recommendations</span>
            <h1>
              Find Opportunities<br />
              <span className="rp-hero-highlight">Tailored for You</span>
            </h1>
            <p>
              Our machine learning engine analyzes your preferences, budget, and
              activity to surface the most relevant products and industries.
            </p>
          </div>
          <div className="rp-hero-stats">
            <div className="rp-stat"><strong>200+</strong><span>Industries</span></div>
            <div className="rp-stat-div" />
            <div className="rp-stat"><strong>500+</strong><span>Products</span></div>
            <div className="rp-stat-div" />
            <div className="rp-stat"><strong>ML</strong><span>Powered</span></div>
          </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="rp-layout">

        {/* ── Filter panel ── */}
        <aside className="rp-sidebar">
          <div className="rp-sidebar-title">
            <span>🎯</span> Preferences
          </div>

          {/* Mode tabs */}
          <div className="rp-mode-tabs">
            <button className={tab === "products"   ? "active" : ""} onClick={() => handleTabChange("products")}>
              📦 Products
            </button>
            <button className={tab === "industries" ? "active" : ""} onClick={() => handleTabChange("industries")}>
              🏭 Industries
            </button>
          </div>

          <form onSubmit={handleSearch} className="rp-filter-form">
            {/* Category chips */}
            <div className="rp-filter-group">
              <label>Category</label>
              <div className="rp-chips">
                <button
                  type="button"
                  className={`rp-chip ${category === "" ? "active" : ""}`}
                  onClick={() => setCategory("")}
                >
                  All
                </button>
                {CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    className={`rp-chip ${category === c.value ? "active" : ""}`}
                    onClick={() => setCategory(c.value)}
                  >
                    {c.icon} {c.value}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div className="rp-filter-group">
              <label>{tab === "industries" ? "Investment Amount (ETB)" : "Max Budget (ETB)"}</label>
              <div className="rp-budget-wrap">
                <span className="rp-budget-prefix">ETB</span>
                <input
                  type="number"
                  min="0"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  placeholder="No limit"
                  className="rp-budget-input"
                />
              </div>
              {budget > 0 && (
                <button type="button" className="rp-clear-budget" onClick={() => setBudget("")}>
                  ✕ Clear
                </button>
              )}
            </div>

            <button type="submit" className="rp-search-btn" disabled={loading}>
              {loading
                ? <><span className="rp-spinner" /> Searching...</>
                : <><span>🔍</span> Get Recommendations</>
              }
            </button>
          </form>

          {/* Active filters summary */}
          {(category || budget) && (
            <div className="rp-active-filters">
              <span className="rp-af-label">Active filters:</span>
              {category && <span className="rp-af-chip">{category}</span>}
              {budget   && <span className="rp-af-chip">≤ {Number(budget).toLocaleString()} ETB</span>}
            </div>
          )}
        </aside>

        {/* ── Results panel ── */}
        <div className="rp-results-panel" ref={resultsRef}>
          {/* Idle state */}
          {!loading && results === null && !error && (
            <div className="rp-idle">
              <div className="rp-idle-icon">✨</div>
              <h3>Ready to find your match</h3>
              <p>Select a category and budget on the left, then click <strong>Get Recommendations</strong>.</p>
              <div className="rp-idle-hints">
                <div className="rp-hint"><span>🎯</span> Personalized to your activity</div>
                <div className="rp-hint"><span>🤖</span> Powered by cosine similarity + KNN</div>
                <div className="rp-hint"><span>⚡</span> Results in under 2 seconds</div>
              </div>
            </div>
          )}

          {/* Loading skeletons */}
          {loading && (
            <div className="rp-skeleton-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rp-skeleton" style={{ animationDelay: `${i * 0.08}s` }} />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rp-error-state">
              <span>⚠️</span>
              <p>{error}</p>
              <button onClick={handleSearch}>Try again</button>
            </div>
          )}

          {/* Empty */}
          {!loading && results !== null && results.length === 0 && (
            <div className="rp-idle">
              <div className="rp-idle-icon">🔍</div>
              <h3>No matches found</h3>
              <p>Try a different category or remove the budget limit.</p>
            </div>
          )}

          {/* Results */}
          {!loading && results !== null && results.length > 0 && (
            <>
              <div className="rp-results-header">
                <h2>{results.length} recommendation{results.length !== 1 ? "s" : ""}</h2>
                <span className="rp-ai-badge">✨ AI Scored</span>
              </div>

              <div className="rp-grid">
                {results.map((r, i) => {
                  const isProduct = tab === "products";
                  const tag       = scoreTag(r.score, r.popularity);
                  const pct       = r.score !== null ? Math.round(r.score * 100) : null;

                  return (
                    <div
                      key={isProduct ? r.product_id : r.industry_id}
                      className={`rp-card ${i === 0 ? "rp-card-top" : ""}`}
                      onClick={() => navigate(`/industry/${r.industry_id}`)}
                    >
                      {/* Top ribbon */}
                      {i === 0 && <div className="rp-ribbon">🏆 #1 Pick</div>}

                      {/* Card header */}
                      <div className="rp-card-head">
                        <div className="rp-card-avatar">
                          {isProduct ? "📦" : "🏭"}
                        </div>
                        <div className="rp-card-meta">
                          {tag && <span className={`rp-tag ${tag.cls}`}>{tag.text}</span>}
                          <h4>{isProduct ? r.name : r.company_name}</h4>
                          <p className="rp-card-sub">
                            {isProduct ? r.company_name : r.sector}
                          </p>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="rp-card-details">
                        {isProduct ? (
                          <>
                            {r.category && (
                              <div className="rp-detail-row">
                                <span>🏷️</span>
                                <span>{r.category}</span>
                              </div>
                            )}
                            <div className="rp-detail-row rp-price">
                              <span>💰</span>
                              <span>
                                {r.price
                                  ? `${Number(r.price).toLocaleString()} ETB${r.unit && r.unit !== "unit" ? ` / ${r.unit}` : ""}`
                                  : "Price on request"}
                              </span>
                            </div>
                            {r.location && (
                              <div className="rp-detail-row">
                                <span>📍</span>
                                <span>{r.location}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {r.location && (
                              <div className="rp-detail-row">
                                <span>📍</span>
                                <span>{r.location}</span>
                              </div>
                            )}
                            <div className="rp-detail-row">
                              <span>📦</span>
                              <span>{r.product_count} products listed</span>
                            </div>
                            <div className="rp-detail-row">
                              <span>🤝</span>
                              <span>{r.customer_count} connections</span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Match score */}
                      {pct !== null && (
                        <div className="rp-match">
                          <div className="rp-match-bar">
                            <div
                              className="rp-match-fill"
                              style={{ width: `${pct}%`, background: pct >= 70 ? "#0a5c2f" : pct >= 40 ? "#667eea" : "#aaa" }}
                            />
                          </div>
                          <span className="rp-match-pct">{pct}% match</span>
                        </div>
                      )}

                      <div className="rp-card-cta">View Details →</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
