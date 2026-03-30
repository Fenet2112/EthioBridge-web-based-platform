import { useNavigate } from "react-router-dom";
import { useRecommendations } from "../hooks/useRecommendations";
import "./RecommendationSection.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function ScoreBar({ score }) {
  if (score === null || score === undefined) return null;
  const pct = Math.round(score * 100);
  return (
    <div className="rec-score-bar" title={`Match score: ${pct}%`}>
      <div className="rec-score-fill" style={{ width: `${pct}%` }} />
      <span>{pct}% match</span>
    </div>
  );
}

// ── Product recommendation card ──
function ProductCard({ rec, onNavigate }) {
  const imgSrc = rec.image_url ? `${API_BASE_URL}${rec.image_url}` : null;
  return (
    <div className="rec-card" onClick={() => onNavigate(`/industry/${rec.industry_id}`)}>
      <div className="rec-card-img">
        {imgSrc
          ? <img src={imgSrc} alt={rec.name} onError={e => { e.target.style.display = "none"; }} />
          : <div className="rec-card-img-placeholder">📦</div>
        }
        {rec.category && <span className="rec-category">{rec.category}</span>}
      </div>
      <div className="rec-card-body">
        <h4>{rec.name}</h4>
        <p className="rec-company">{rec.company_name}</p>
        {rec.price && (
          <p className="rec-price">
            {Number(rec.price).toLocaleString()} ETB
            {rec.unit && rec.unit !== "unit" ? ` / ${rec.unit}` : ""}
          </p>
        )}
        <ScoreBar score={rec.score} />
      </div>
    </div>
  );
}

// ── Industry recommendation card ──
function IndustryCard({ rec, onNavigate }) {
  return (
    <div className="rec-card" onClick={() => onNavigate(`/industry/${rec.industry_id}`)}>
      <div className="rec-card-img rec-card-img-industry">
        <span className="rec-industry-icon">🏭</span>
      </div>
      <div className="rec-card-body">
        <h4>{rec.company_name}</h4>
        <p className="rec-company">{rec.sector}</p>
        <p className="rec-meta">
          📦 {rec.product_count} products · 🤝 {rec.customer_count} connections
        </p>
        {rec.location && <p className="rec-location">📍 {rec.location}</p>}
        <ScoreBar score={rec.score} />
      </div>
    </div>
  );
}

// ── Main section ──
export default function RecommendationSection({
  type = "products",       // "products" | "industries"
  title,
  category = "",
  budget = 0,
  topN = 8,
}) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const enabled = !!localStorage.getItem("token") && user.role === "stakeholder";

  const { recommendations, loading, source } = useRecommendations({
    type, category, budget, topN, enabled,
  });

  if (!enabled || (!loading && recommendations.length === 0)) return null;

  const defaultTitle = type === "products" ? "🎯 Recommended for You" : "🏭 Industries You May Like";

  return (
    <section className="rec-section">
      <div className="rec-header">
        <h2>{title || defaultTitle}</h2>
        {source === "fallback" && (
          <span className="rec-fallback-badge">Trending</span>
        )}
        {source === "ml" && (
          <span className="rec-ml-badge">✨ AI Powered</span>
        )}
      </div>

      {loading ? (
        <div className="rec-loading">
          {[...Array(4)].map((_, i) => <div key={i} className="rec-skeleton" />)}
        </div>
      ) : (
        <div className="rec-grid">
          {recommendations.map(rec =>
            type === "products"
              ? <ProductCard key={rec.product_id} rec={rec} onNavigate={navigate} />
              : <IndustryCard key={rec.industry_id} rec={rec} onNavigate={navigate} />
          )}
        </div>
      )}
    </section>
  );
}
