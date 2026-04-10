const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticateToken } = require("../middleware/auth");

// ── GET INDUSTRIES FOR EXPLORE MAP (Public - No Auth Required) ──
// MUST be before /industries/:id to avoid route collision
router.get("/explore", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        i.id,
        i.company_name,
        i.sector,
        i.location,
        i.description,
        i.created_at
      FROM industries i
      JOIN users u ON u.id = i.user_id
      WHERE u.status = 'approved'
      ORDER BY i.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Get industries for explore error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET ALL APPROVED INDUSTRIES (for Stakeholders page) ──
// Public endpoint – approved industries are visible to all logged-in users
router.get("/industries", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        i.id,
        i.user_id,
        i.company_name,
        i.sector,
        i.location,
        i.description,
        i.phone,
        i.website,
        i.established_year,
        i.created_at,
        COUNT(p.id) AS product_count
      FROM industries i
      JOIN users u ON u.id = i.user_id
      LEFT JOIN products p ON p.industry_id = i.id AND p.is_available = true
      WHERE u.status = 'approved'
      GROUP BY i.id, i.user_id, i.company_name, i.sector, i.location,
               i.description, i.phone, i.website, i.established_year, i.created_at
      ORDER BY i.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Get industries error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET SINGLE INDUSTRY DETAIL + PRODUCTS ──
router.get("/industries/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Get industry profile
    const industryResult = await pool.query(`
      SELECT
        i.id,
        i.user_id,
        i.company_name,
        i.sector,
        i.location,
        i.description,
        i.phone,
        i.website,
        i.established_year,
        i.created_at
      FROM industries i
      JOIN users u ON u.id = i.user_id
      WHERE i.id = $1 AND u.status = 'approved'
    `, [id]);

    if (industryResult.rows.length === 0) {
      return res.status(404).json({ message: "Industry not found" });
    }

    // Get products for this industry
    const productsResult = await pool.query(`
      SELECT id, name, description, price, unit, category, image_url, is_available, created_at
      FROM products
      WHERE industry_id = $1 AND is_available = true
      ORDER BY category, name
    `, [id]);

    res.json({
      industry: industryResult.rows[0],
      products: productsResult.rows,
    });
  } catch (error) {
    console.error("Get industry detail error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
