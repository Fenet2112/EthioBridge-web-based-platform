import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from '../utils/api';

export function useRecommendations({ type = "products", category = "", budget = 0, topN = 8, enabled = true }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState(null); // "ml" | "fallback"
  const [recommendationType, setRecommendationType] = useState(null); // "popular" | "personalized" | "collaborative" | "content_based"

  const fetch_ = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token || !enabled) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({ category, budget, top_n: topN });
      const res = await fetch(
        `${API_BASE_URL}/api/recommendations/${type}?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      const data = await res.json();
      setRecommendations(data.recommendations || []);
      setSource(data.source);
      setRecommendationType(data.recommendation_type);
    } catch (e) {
      console.error("Recommendations error:", e);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, [type, category, budget, topN, enabled]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { recommendations, loading, source, recommendationType, refetch: fetch_ };
}
