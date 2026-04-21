import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import StakeholderNav from "../components/StakeholderNav";
import "./Recommendations.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const CATEGORIES = [
  { value: "Cement",      icon: null },
  { value: "Steel",       icon: null },
  { value: "Brick",       icon: null },
  { value: "Wood",        icon: null },
  { value: "Paint",       icon: null },
  { value: "Sand",        icon: null },
  { value: "Glass",       icon: null },
  { value: "Tile",        icon: null },
  { value: "Concrete",    icon: null },
  { value: "Pipe",        icon: null },
  { value: "Electrical",  icon: null },
  { value: "Tool",        icon: null },
  { value: "Roof",        icon: null },
  { value: "Other",       icon: null },
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
  const [recommendationType, setRecommendationType] = useState(null);

  const handleSearch = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError("");
    setResults(null);
    setRecommendationType(null);

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
      setRecommendationType(data.recommendation_type);
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
    setRecommendationType(null);
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
            <span className="rp-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              AI-Powered Recommendations
            </span>
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Preferences
          </div>

          {/* Mode tabs */}
          <div className="rp-mode-tabs">
            <button className={tab === "products"   ? "active" : ""} onClick={() => handleTabChange("products")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
              Products
            </button>
            <button className={tab === "industries" ? "active" : ""} onClick={() => handleTabChange("industries")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              Industries
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
                    {c.value}
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  Clear
                </button>
              )}
            </div>

            <button type="submit" className="rp-search-btn" disabled={loading}>
              {loading ? (
                <>
                  <span className="rp-spinner" />
                  Searching...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                  Get Recommendations
                </>
              )}
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
              <div className="rp-idle-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </div>
              <h3>Ready to find your match</h3>
              <p>Select a category and budget on the left, then click <strong>Get Recommendations</strong>.</p>
              <div className="rp-idle-hints">
                <div className="rp-hint">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  Personalized to your activity
                </div>
                <div className="rp-hint">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                  Powered by cosine similarity + KNN
                </div>
                <div className="rp-hint">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  Results in under 2 seconds
                </div>
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
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p>{error}</p>
              <button onClick={handleSearch}>Try again</button>
            </div>
          )}

          {/* Empty */}
          {!loading && results !== null && results.length === 0 && (
            <div className="rp-idle">
              <div className="rp-idle-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
              </div>
              <h3>No matches found</h3>
              <p>Try a different category or remove the budget limit.</p>
            </div>
          )}

          {/* Results */}
          {!loading && results !== null && results.length > 0 && (
            <>
              <div className="rp-results-header">
                <h2>{results.length} recommendation{results.length !== 1 ? "s" : ""}</h2>
                {recommendationType === "popular" && (
                  <span className="rp-ai-badge">Trending</span>
                )}
                {recommendationType === "collaborative" && (
                  <span className="rp-ai-badge">Based on Similar Users</span>
                )}
                {recommendationType === "content_based" && (
                  <span className="rp-ai-badge">Based on Your Preferences</span>
                )}
                {recommendationType === "personalized" && (
                  <span className="rp-ai-badge">AI Scored</span>
                )}
                {!recommendationType && (
                  <span className="rp-ai-badge">AI Scored</span>
                )}
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
                      {i === 0 && <div className="rp-ribbon">#1 Pick</div>}

                      {/* Card header */}
                      <div className="rp-card-head">
                        <div className="rp-card-avatar">
                          {isProduct ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                            </svg>
                          ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="7" height="7"/>
                              <rect x="14" y="3" width="7" height="7"/>
                              <rect x="14" y="14" width="7" height="7"/>
                              <rect x="3" y="14" width="7" height="7"/>
                            </svg>
                          )}
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
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                                </svg>
                                <span>{r.category}</span>
                              </div>
                            )}
                            <div className="rp-detail-row rp-price">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="1" x2="12" y2="23"/>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                              </svg>
                              <span>
                                {r.price
                                  ? `${Number(r.price).toLocaleString()} ETB${r.unit && r.unit !== "unit" ? ` / ${r.unit}` : ""}`
                                  : "Price on request"}
                              </span>
                            </div>
                            {r.location && (
                              <div className="rp-detail-row">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                  <circle cx="12" cy="10" r="3"/>
                                </svg>
                                <span>{r.location}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {r.location && (
                              <div className="rp-detail-row">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                  <circle cx="12" cy="10" r="3"/>
                                </svg>
                                <span>{r.location}</span>
                              </div>
                            )}
                            <div className="rp-detail-row">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                              </svg>
                              <span>{r.product_count} products listed</span>
                            </div>
                            <div className="rp-detail-row">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                <circle cx="9" cy="7" r="4"/>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                              </svg>
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
