const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticateToken } = require("../middleware/auth");

// ========================================
// GET INDUSTRIES FOR EXPLORE MAP (Public - with filtering)
// ========================================
router.get("/explore", async (req, res) => {
  try {
    const {
      sector,
      location,
      minProducts,
      maxProducts,
      minPopularity,
      search,
      sortBy = "created_at",
      sortOrder = "DESC",
      page = "1",
      limit = "20"
    } = req.query;

    let query = `
      SELECT
        i.id, i.company_name, i.sector, i.location, i.description,
        i.latitude, i.longitude, i.created_at, i.popularity_score,
        COUNT(DISTINCT p.id)  AS product_count,
        COUNT(DISTINCT pr.id) AS request_count
      FROM industries i
      JOIN users u ON u.id = i.user_id
      LEFT JOIN products p ON p.industry_id = i.id AND p.is_available = true
      LEFT JOIN purchase_requests pr ON pr.industry_id = i.id
      WHERE u.status = 'approved'
    `;

    const queryParams = [];
    let n = 1;

    if (sector) {
      query += ` AND LOWER(i.sector) LIKE LOWER($${n++})`;
      queryParams.push(`%${sector}%`);
    }
    if (location) {
      query += ` AND LOWER(i.location) LIKE LOWER($${n++})`;
      queryParams.push(`%${location}%`);
    }
    if (minPopularity) {
      query += ` AND i.popularity_score >= $${n++}`;
      queryParams.push(parseInt(minPopularity));
    }
    if (search) {
      query += ` AND (LOWER(i.company_name) LIKE LOWER($${n++}) OR LOWER(i.description) LIKE LOWER($${n++}))`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    query += ` GROUP BY i.id, i.company_name, i.sector, i.location, i.description, i.latitude, i.longitude, i.created_at, i.popularity_score`;

    // HAVING must come after GROUP BY
    if (minProducts) {
      query += ` HAVING COUNT(DISTINCT p.id) >= $${n++}`;
      queryParams.push(parseInt(minProducts));
    }
    if (maxProducts) {
      query += minProducts
        ? ` AND COUNT(DISTINCT p.id) <= $${n++}`
        : ` HAVING COUNT(DISTINCT p.id) <= $${n++}`;
      queryParams.push(parseInt(maxProducts));
    }

    const allowedSort = {
      "created_at": "i.created_at", "company_name": "i.company_name",
      "location": "i.location", "product_count": "product_count",
      "request_count": "request_count", "popularity_score": "i.popularity_score"
    };
    const sortCol = allowedSort[sortBy] || "i.created_at";
    const sortDir = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";
    query += ` ORDER BY ${sortCol} ${sortDir}`;

    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const offset   = (pageNum - 1) * limitNum;

    query += ` LIMIT $${n++} OFFSET $${n++}`;
    queryParams.push(limitNum, offset);

    const result = await pool.query(query, queryParams);

    res.json({
      industries: result.rows,
      pagination: {
        page: pageNum, limit: limitNum,
        total: result.rows.length,
        hasNext: result.rows.length === limitNum,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error("Get industries for explore error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ========================================
// GET ALL APPROVED INDUSTRIES (for Stakeholders page)
// ========================================
router.get("/", authenticateToken, async (req, res) => {
  try {
    const {
      sector, location, minProducts, maxProducts, search,
      sortBy = "created_at", sortOrder = "DESC",
      page = "1", limit = "20"
    } = req.query;

    let query = `
      SELECT
        i.id, i.user_id, i.company_name, i.sector, i.location,
        i.description, i.phone, i.website, i.established_year,
        i.latitude, i.longitude, i.created_at, i.popularity_score,
        COUNT(DISTINCT p.id) AS product_count
      FROM industries i
      JOIN users u ON u.id = i.user_id
      LEFT JOIN products p ON p.industry_id = i.id AND p.is_available = true
      WHERE u.status = 'approved'
    `;

    const queryParams = [];
    let n = 1;

    if (sector) {
      query += ` AND LOWER(i.sector) LIKE LOWER($${n++})`;
      queryParams.push(`%${sector}%`);
    }
    if (location) {
      query += ` AND LOWER(i.location) LIKE LOWER($${n++})`;
      queryParams.push(`%${location}%`);
    }
    if (search) {
      query += ` AND (LOWER(i.company_name) LIKE LOWER($${n++}) OR LOWER(i.description) LIKE LOWER($${n++}))`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    query += ` GROUP BY i.id, i.user_id, i.company_name, i.sector, i.location, i.description, i.phone, i.website, i.established_year, i.latitude, i.longitude, i.created_at, i.popularity_score`;

    if (minProducts) {
      query += ` HAVING COUNT(DISTINCT p.id) >= $${n++}`;
      queryParams.push(parseInt(minProducts));
    }
    if (maxProducts) {
      query += minProducts
        ? ` AND COUNT(DISTINCT p.id) <= $${n++}`
        : ` HAVING COUNT(DISTINCT p.id) <= $${n++}`;
      queryParams.push(parseInt(maxProducts));
    }

    const allowedSort = {
      "created_at": "i.created_at", "company_name": "i.company_name",
      "product_count": "product_count", "popularity_score": "i.popularity_score"
    };
    const sortCol = allowedSort[sortBy] || "i.created_at";
    const sortDir = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";
    query += ` ORDER BY ${sortCol} ${sortDir}`;

    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const offset   = (pageNum - 1) * limitNum;

    query += ` LIMIT $${n++} OFFSET $${n++}`;
    queryParams.push(limitNum, offset);

    const result = await pool.query(query, queryParams);

    res.json({
      industries: result.rows,
      pagination: {
        page: pageNum, limit: limitNum,
        total: result.rows.length,
        hasNext: result.rows.length === limitNum,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error("Get industries error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ========================================
// GET SINGLE INDUSTRY DETAIL + PRODUCTS
// ========================================
router.get("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const industryResult = await pool.query(`
      SELECT i.id, i.user_id, i.company_name, i.sector, i.location,
             i.description, i.phone, i.website, i.established_year,
             i.latitude, i.longitude, i.created_at, i.popularity_score
      FROM industries i
      JOIN users u ON u.id = i.user_id
      WHERE i.id = $1 AND u.status = 'approved'
    `, [id]);

    if (industryResult.rows.length === 0) {
      return res.status(404).json({ message: "Industry not found" });
    }

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
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
