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
        i.id,
        i.company_name,
        i.sector,
        i.location,
        i.description,
        i.latitude,
        i.longitude,
        i.created_at,
        i.popularity_score,
        COUNT(DISTINCT p.id) AS product_count,
        COUNT(DISTINCT pr.id) AS request_count
      FROM industries i
      JOIN users u ON u.id = i.user_id
      LEFT JOIN products p ON p.industry_id = i.id AND p.is_available = true
      LEFT JOIN purchase_requests pr ON pr.industry_id = i.id
      WHERE u.status = 'approved'
    `;

    const queryParams = [];
    let paramCount = 1;

    // Filters
    if (sector) {
      query += ` AND LOWER(i.sector) LIKE LOWER($${paramCount++})`;
      queryParams.push(`%${sector}%`);
    }

    if (location) {
      query += ` AND LOWER(i.location) LIKE LOWER($${paramCount++})`;
      queryParams.push(`%${location}%`);
    }

    if (minProducts) {
      query += ` HAVING COUNT(DISTINCT p.id) >= $${paramCount++}`;
      queryParams.push(parseInt(minProducts));
    }

    if (maxProducts) {
      query += ` HAVING COUNT(DISTINCT p.id) <= $${paramCount++}`;
      queryParams.push(parseInt(maxProducts));
    }

    if (minPopularity) {
      query += ` AND i.popularity_score >= $${paramCount++}`;
      queryParams.push(parseInt(minPopularity));
    }

    if (search) {
      query += ` AND (
        LOWER(i.company_name) LIKE LOWER($${paramCount++}) OR
        LOWER(i.description) LIKE LOWER($${paramCount++})
      )`;
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm);
    }

    // Group by for aggregate counts
    query += ` GROUP BY i.id, i.company_name, i.sector, i.location, i.description, i.latitude, i.longitude, i.created_at, i.popularity_score`;

    // Sorting
    const allowedSortColumns = ["i.created_at", "i.company_name", "i.location", "product_count", "request_count", "popularity_score"];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : "i.created_at";
    const sortDirection = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";
    query += ` ORDER BY ${sortColumn} ${sortDirection}`;

    // Get total count
    const countQuery = query.replace(
      /SELECT[\s\S]*?FROM/s,
      "SELECT COUNT(*) FROM"
    ).split("ORDER BY")[0];

    const totalResult = await pool.query(countQuery, queryParams);
    const total = parseInt(totalResult.rows[0].count);

    // Pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    queryParams.push(limitNum, offset);

    const result = await pool.query(query, queryParams);

    res.json({
      industries: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error("Get industries for explore error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ========================================
// GET ALL APPROVED INDUSTRIES (for Stakeholders page) - with filtering
// ========================================
router.get("/", authenticateToken, async (req, res) => {
  try {
    const {
      sector,
      location,
      minProducts,
      maxProducts,
      search,
      sortBy = "created_at",
      sortOrder = "DESC",
      page = "1",
      limit = "20"
    } = req.query;

    let query = `
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
        i.popularity_score,
        COUNT(DISTINCT p.id) AS product_count
      FROM industries i
      JOIN users u ON u.id = i.user_id
      LEFT JOIN products p ON p.industry_id = i.id AND p.is_available = true
      WHERE u.status = 'approved'
    `;

    const queryParams = [];
    let paramCount = 1;

    if (sector) {
      query += ` AND LOWER(i.sector) LIKE LOWER($${paramCount++})`;
      queryParams.push(`%${sector}%`);
    }

    if (location) {
      query += ` AND LOWER(i.location) LIKE LOWER($${paramCount++})`;
      queryParams.push(`%${location}%`);
    }

    if (search) {
      query += ` AND (
        LOWER(i.company_name) LIKE LOWER($${paramCount++}) OR
        LOWER(i.description) LIKE LOWER($${paramCount++})
      )`;
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm);
    }

    query += ` GROUP BY i.id, i.user_id, i.company_name, i.sector, i.location, i.description, i.phone, i.website, i.established_year, i.created_at, i.popularity_score`;

    // Having clause for product count filters
    if (minProducts) {
      query += ` HAVING COUNT(DISTINCT p.id) >= $${paramCount++}`;
      queryParams.push(parseInt(minProducts));
    }
    if (maxProducts) {
      query += ` HAVING COUNT(DISTINCT p.id) <= $${paramCount++}`;
      queryParams.push(parseInt(maxProducts));
    }

    // Sorting
    const allowedSortColumns = ["i.created_at", "i.company_name", "product_count", "popularity_score"];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : "i.created_at";
    const sortDirection = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";
    query += ` ORDER BY ${sortColumn} ${sortDirection}`;

    // Get total count
    const countQuery = query.replace(
      /SELECT[\s\S]*?FROM/s,
      "SELECT COUNT(*) FROM"
    ).split("ORDER BY")[0];

    const totalResult = await pool.query(countQuery, queryParams);
    const total = parseInt(totalResult.rows[0].count);

    // Pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    queryParams.push(limitNum, offset);

    const result = await pool.query(query, queryParams);

    res.json({
      industries: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error("Get industries error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ========================================
// GET SINGLE INDUSTRY DETAIL + PRODUCTS
// ========================================
router.get("/:id", authenticateToken, async (req, res) => {
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
        i.created_at,
        i.popularity_score
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
