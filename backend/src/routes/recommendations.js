const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticateToken } = require("../middleware/auth");

const ML_SERVICE = process.env.ML_SERVICE_URL || "http://localhost:8000";

// ── Fallback: popular products when ML service is down ──
async function fallbackProducts(category = "", limit = 10) {
  let sql = `
    SELECT p.id AS product_id, p.name, p.category, p.price, p.unit,
           p.image_url, i.company_name, i.id AS industry_id, i.location,
           COUNT(pr.id) AS request_count
    FROM products p
    JOIN industries i ON i.id = p.industry_id
    JOIN users u ON u.id = i.user_id
    LEFT JOIN purchase_requests pr ON pr.product_id = p.id AND pr.status = 'approved'
    WHERE p.is_available = TRUE AND u.status = 'approved'
  `;
  const params = [];

  if (category && category.trim()) {
    params.push(`%${category.toLowerCase()}%`);
    sql += ` AND (LOWER(p.category) LIKE $1 OR LOWER(p.name) LIKE $1)`;
  }

  sql += ` GROUP BY p.id, p.name, p.category, p.price, p.unit, p.image_url,
             i.company_name, i.id, i.location
    ORDER BY request_count DESC, p.created_at DESC
    LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await pool.query(sql, params);
  return result.rows.map(r => ({ ...r, score: null, fallback: true }));
}

async function fallbackIndustries(category = "", limit = 10) {
  let sql = `
    SELECT i.id AS industry_id, i.company_name, i.sector, i.location,
           COUNT(DISTINCT p.id) AS product_count,
           COUNT(DISTINCT pr.stakeholder_id) AS customer_count
    FROM industries i
    JOIN users u ON u.id = i.user_id
    LEFT JOIN products p ON p.industry_id = i.id AND p.is_available = TRUE
    LEFT JOIN purchase_requests pr ON pr.industry_id = i.id AND pr.status = 'approved'
    WHERE u.status = 'approved'
  `;
  const params = [];

  if (category && category.trim()) {
    params.push(`%${category.toLowerCase()}%`);
    sql += ` AND LOWER(i.sector) LIKE $1`;
  }

  sql += ` GROUP BY i.id, i.company_name, i.sector, i.location
    ORDER BY customer_count DESC, product_count DESC
    LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await pool.query(sql, params);
  return result.rows.map(r => ({ ...r, score: null, fallback: true }));
}

// ── GET /api/recommendations/products ──
router.get("/recommendations/products", authenticateToken, async (req, res) => {
  const { category = "", budget = 0, top_n = 10 } = req.query;
  const user_id = req.user.id;

  try {
    const params = new URLSearchParams({
      user_id,
      category,
      budget: parseFloat(budget) || 0,
      top_n: parseInt(top_n) || 10,
    });

    const mlRes = await fetch(`${ML_SERVICE}/recommend/products?${params}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!mlRes.ok) throw new Error(`ML service returned ${mlRes.status}`);
    const data = await mlRes.json();
    return res.json({ 
      source: "ml", 
      recommendation_type: data.recommendation_type || "personalized",
      ...data 
    });
  } catch (err) {
    console.warn("ML service unavailable, using fallback:", err.message);
    try {
      const recs = await fallbackProducts(category, parseInt(top_n) || 10);
      return res.json({ 
        source: "fallback", 
        recommendation_type: "popular",
        recommendations: recs 
      });
    } catch (dbErr) {
      return res.status(500).json({ message: "Recommendation service error" });
    }
  }
});

// ── GET /api/recommendations/industries ──
router.get("/recommendations/industries", authenticateToken, async (req, res) => {
  const { category = "", budget = 0, top_n = 10 } = req.query;
  const user_id = req.user.id;

  try {
    const params = new URLSearchParams({
      user_id,
      category,
      budget: parseFloat(budget) || 0,
      top_n: parseInt(top_n) || 10,
    });

    const mlRes = await fetch(`${ML_SERVICE}/recommend/industries?${params}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!mlRes.ok) throw new Error(`ML service returned ${mlRes.status}`);
    const data = await mlRes.json();
    return res.json({ 
      source: "ml", 
      recommendation_type: data.recommendation_type || "personalized",
      ...data 
    });
  } catch (err) {
    console.warn("ML service unavailable, using fallback:", err.message);
    try {
      const recs = await fallbackIndustries(category, parseInt(top_n) || 10);
      return res.json({ 
        source: "fallback", 
        recommendation_type: "popular",
        recommendations: recs 
      });
    } catch (dbErr) {
      return res.status(500).json({ message: "Recommendation service error" });
    }
  }
});

module.exports = router;
