const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticateToken, requireRole, requireApproved } = require("../middleware/auth");
const { resolveSubType } = require("./subscription");
const { createUpload, getFileUrl, deleteFile } = require("../utils/cloudinaryUpload");
const path = require("path");
const fs = require("fs");

const FREE_PRODUCT_LIMIT = 5;

// ── Product image upload (Cloudinary or local fallback) ──
const uploadProductImage = createUpload("products", "products", 2);

// Helper: verify the requesting user owns the industry resource
async function getIndustryForUser(userId) {
  const result = await pool.query(
    "SELECT id FROM industries WHERE user_id = $1",
    [userId]
  );
  return result.rows[0] || null;
}

// ========================================
// GET ALL PRODUCTS WITH ADVANCED FILTERING (Public)
// ========================================
router.get("/products/all", async (req, res) => {
  try {
    const {
      // Filter parameters
      category,
      minPrice,
      maxPrice,
      is_available,
      location,
      industry_id,
      business_role,
      search,
      // Sorting
      sortBy = "created_at",
      sortOrder = "DESC",
      // Pagination
      page = "1",
      limit = "20"
    } = req.query;

    // Build dynamic query
    let query = `
      SELECT
        p.id, p.name, p.description, p.price, p.unit, p.category,
        p.image_url, p.is_available, p.created_at, p.discount_percentage,
        CASE WHEN p.discount_percentage IS NOT NULL AND p.discount_percentage > 0
          THEN ROUND(p.price * (1 - p.discount_percentage / 100.0), 2)
          ELSE p.price END AS discounted_price,
        (NOW() - p.created_at) < INTERVAL '7 days' AS is_new,
        p.request_count > 5 AS is_popular,
        i.company_name, i.id as industry_id, i.location as industry_location,
        i.sector as industry_sector
      FROM products p
      JOIN industries i ON i.id = p.industry_id
      JOIN users u ON u.id = i.user_id
      WHERE u.status = 'approved'
    `;

    const queryParams = [];
    let paramCount = 1;

    // Add filters dynamically
    if (is_available !== undefined) {
      query += ` AND p.is_available = $${paramCount++}`;
      queryParams.push(is_available === "true" || is_available === true);
    }

    if (category) {
      query += ` AND LOWER(p.category) LIKE LOWER($${paramCount++})`;
      queryParams.push(`%${category}%`);
    }

    if (minPrice) {
      query += ` AND p.price >= $${paramCount++}`;
      queryParams.push(parseFloat(minPrice));
    }

    if (maxPrice) {
      query += ` AND p.price <= $${paramCount++}`;
      queryParams.push(parseFloat(maxPrice));
    }

    if (location) {
      query += ` AND LOWER(i.location) LIKE LOWER($${paramCount++})`;
      queryParams.push(`%${location}%`);
    }

    if (industry_id) {
      query += ` AND i.id = $${paramCount++}`;
      queryParams.push(parseInt(industry_id));
    }

    if (search) {
      query += ` AND (
        LOWER(p.name) LIKE LOWER($${paramCount++}) OR
        LOWER(p.description) LIKE LOWER($${paramCount++}) OR
        LOWER(i.company_name) LIKE LOWER($${paramCount++})
      )`;
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    // Sorting (validate to prevent SQL injection)
    const allowedSortColumns = [
      "p.created_at", "p.name", "p.price", "p.category",
      "i.company_name", "i.location", "popularity_score"
    ];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : "p.created_at";
    const sortDirection = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    // Add sorting with popularity fallback
    if (sortColumn === "popularity_score") {
      query += ` ORDER BY i.popularity_score ${sortDirection}, p.created_at DESC`;
    } else {
      query += ` ORDER BY ${sortColumn} ${sortDirection}`;
    }

    // Get total count for pagination
    const countQuery = query.replace(
      /SELECT[\s\S]*?FROM/s,
      "SELECT COUNT(*) FROM"
    ).split("ORDER BY")[0];

    const totalResult = await pool.query(countQuery, queryParams);
    const total = parseInt(totalResult.rows[0].count);

    // Pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 20); // Max 100 per page
    const offset = (pageNum - 1) * limitNum;

    query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    queryParams.push(limitNum, offset);

    // Execute final query
    const result = await pool.query(query, queryParams);

    // Send response with pagination metadata
    res.json({
      products: result.rows,
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
    console.error("Get all products error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ========================================
// GET PRODUCTS BY CATEGORY (Public)
// ========================================
router.get("/products/category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const result = await pool.query(
      `SELECT
        p.id, p.name, p.description, p.price, p.unit, p.category,
        p.image_url, p.is_available, p.created_at,
        i.company_name, i.id as industry_id
       FROM products p
       JOIN industries i ON i.id = p.industry_id
       JOIN users u ON u.id = i.user_id
       WHERE u.status = 'approved'
         AND p.is_available = true
         AND LOWER(p.category) = LOWER($1)
       ORDER BY p.created_at DESC`,
      [category]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Get products by category error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ========================================
// GET MY PRODUCTS (industry dashboard) ──
// ========================================
router.get(
  "/my-products",
  authenticateToken,
  requireRole("industry"),
  requireApproved,
  async (req, res) => {
    try {
      const industry = await getIndustryForUser(req.user.id);
      if (!industry) {
        return res.status(404).json({ message: "Industry profile not found" });
      }

      const result = await pool.query(
        `SELECT id, name, description, price, unit, category, image_url, is_available,
                discount_percentage,
                CASE WHEN discount_percentage IS NOT NULL AND discount_percentage > 0
                  THEN ROUND(price * (1 - discount_percentage / 100.0), 2)
                  ELSE price END AS discounted_price,
                (NOW() - created_at) < INTERVAL '7 days' AS is_new,
                request_count > 5 AS is_popular,
                created_at, updated_at
         FROM products WHERE industry_id = $1 ORDER BY category, name`,
        [industry.id]
      );
      res.json(result.rows);
    } catch (error) {
      console.error("Get my products error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// ========================================
// CREATE PRODUCT  (supports optional image upload)
// ========================================
router.post(
  "/products",
  authenticateToken,
  requireRole("industry"),
  requireApproved,
  uploadProductImage.single("image"),
  async (req, res) => {
    const { name, description, price, unit, category, discount_percentage } = req.body;

    if (!name) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Product name is required" });
    }

    // Validate discount
    if (discount_percentage !== undefined && discount_percentage !== null && discount_percentage !== "") {
      const d = parseFloat(discount_percentage);
      if (isNaN(d) || d < 0 || d > 100) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Discount must be between 0 and 100" });
      }
    }

    try {
      const industry = await getIndustryForUser(req.user.id);
      if (!industry) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: "Industry profile not found" });
      }

      // Check product limit for free users
      const userRes = await pool.query(
        "SELECT is_subscribed, subscription_expires_at FROM users WHERE id = $1",
        [req.user.id]
      );
      const subType = resolveSubType(userRes.rows[0] || {});
      if (subType === "free") {
        const countRes = await pool.query(
          "SELECT COUNT(*) FROM products WHERE industry_id = $1",
          [industry.id]
        );
        if (parseInt(countRes.rows[0].count) >= FREE_PRODUCT_LIMIT) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(402).json({
            message: `Free plan allows up to ${FREE_PRODUCT_LIMIT} products. Upgrade to Premium for unlimited listings.`,
            requires_subscription: true,
            limit: FREE_PRODUCT_LIMIT,
          });
        }
      }

      // Duplicate name check
      const dupCheck = await pool.query(
        "SELECT id FROM products WHERE industry_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))",
        [industry.id, name]
      );
      if (dupCheck.rows.length > 0) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(409).json({
          message: "This product already exists. Please update the existing product instead.",
          duplicate: true,
          existing_id: dupCheck.rows[0].id,
        });
      }

      const imageUrl = req.file ? await getFileUrl(req, "products") : null;

      const result = await pool.query(
        `INSERT INTO products (industry_id, name, description, price, unit, category, image_url, discount_percentage)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          industry.id,
          name,
          description || null,
          price ? parseFloat(price) : null,
          unit || "unit",
          category || null,
          imageUrl,
          (discount_percentage !== undefined && discount_percentage !== "" && discount_percentage !== null)
            ? parseFloat(discount_percentage) : null,
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
      console.error("Create product error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// ========================================
// UPDATE PRODUCT  (supports optional image upload)
// ========================================
router.put(
  "/products/:id",
  authenticateToken,
  requireRole("industry"),
  requireApproved,
  uploadProductImage.single("image"),
  async (req, res) => {
    const { id } = req.params;
    const { name, description, price, unit, category, is_available, discount_percentage } = req.body;

    try {
      const industry = await getIndustryForUser(req.user.id);
      if (!industry) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: "Industry profile not found" });
      }

      // Ensure product belongs to this industry
      const check = await pool.query(
        "SELECT id, image_url FROM products WHERE id = $1 AND industry_id = $2",
        [id, industry.id]
      );
      if (check.rows.length === 0) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: "Product not found" });
      }

      // Duplicate name check (exclude self)
      if (name) {
        const dupCheck = await pool.query(
          "SELECT id FROM products WHERE industry_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) AND id != $3",
          [industry.id, name, id]
        );
        if (dupCheck.rows.length > 0) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(409).json({
            message: "Another product with this name already exists.",
            duplicate: true,
            existing_id: dupCheck.rows[0].id,
          });
        }
      }

      // If new image uploaded, delete old one
      let imageUrl = undefined;
      if (req.file) {
        imageUrl = await getFileUrl(req, "products");
        const oldUrl = check.rows[0].image_url;
        if (oldUrl) await deleteFile(oldUrl);
      }

      const result = await pool.query(
        `UPDATE products
         SET name              = COALESCE($1, name),
             description       = COALESCE($2, description),
             price             = COALESCE($3, price),
             unit              = COALESCE($4, unit),
             category          = COALESCE($5, category),
             is_available      = COALESCE($6, is_available),
             image_url         = COALESCE($7, image_url),
             discount_percentage = $8,
             updated_at        = NOW()
         WHERE id = $9
         RETURNING *`,
        [
          name || null,
          description !== undefined ? description : null,
          price !== undefined ? parseFloat(price) : null,
          unit || null,
          category || null,
          is_available !== undefined ? is_available : null,
          imageUrl || null,
          (discount_percentage !== undefined && discount_percentage !== "" && discount_percentage !== null)
            ? parseFloat(discount_percentage) : null,
          id,
        ]
      );
      res.json(result.rows[0]);
    } catch (error) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
      console.error("Update product error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// ========================================
// DELETE PRODUCT
// ========================================
router.delete(
  "/products/:id",
  authenticateToken,
  requireRole("industry"),
  requireApproved,
  async (req, res) => {
    const { id } = req.params;
    try {
      const industry = await getIndustryForUser(req.user.id);
      if (!industry) {
        return res.status(404).json({ message: "Industry profile not found" });
      }

      const result = await pool.query(
        "DELETE FROM products WHERE id = $1 AND industry_id = $2 RETURNING id",
        [id, industry.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Delete product error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// ========================================
// INDUSTRY DASHBOARD SUMMARY
// ========================================
router.get(
  "/industry/dashboard-summary",
  authenticateToken,
  requireRole("industry"),
  requireApproved,
  async (req, res) => {
    try {
      const industry = await getIndustryForUser(req.user.id);
      if (!industry) return res.status(404).json({ message: "Industry profile not found" });
      const id = industry.id;

      const [products, requests, stakeholders] = await Promise.all([
        pool.query("SELECT COUNT(*) FROM products WHERE industry_id = $1", [id]),
        pool.query(
          `SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'pending')  AS pending,
            COUNT(*) FILTER (WHERE status = 'approved') AS approved,
            COUNT(*) FILTER (WHERE status = 'rejected') AS rejected
           FROM purchase_requests WHERE industry_id = $1`, [id]
        ),
        pool.query(
          "SELECT COUNT(DISTINCT stakeholder_id) FROM purchase_requests WHERE industry_id = $1", [id]
        ),
      ]);

      res.json({
        total_products:     parseInt(products.rows[0].count),
        total_requests:     parseInt(requests.rows[0].total),
        pending_requests:   parseInt(requests.rows[0].pending),
        approved_requests:  parseInt(requests.rows[0].approved),
        rejected_requests:  parseInt(requests.rows[0].rejected),
        total_stakeholders: parseInt(stakeholders.rows[0].count),
      });
    } catch (err) {
      console.error("Dashboard summary error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// ========================================
// RECENT PURCHASE REQUESTS (dashboard)
// ========================================
router.get(
  "/industry/recent-requests",
  authenticateToken,
  requireRole("industry"),
  requireApproved,
  async (req, res) => {
    try {
      const industry = await getIndustryForUser(req.user.id);
      if (!industry) return res.status(404).json({ message: "Industry profile not found" });

      const result = await pool.query(
        `SELECT
          pr.id, pr.status, pr.quantity, pr.notes, pr.full_name,
          pr.organization_name, pr.phone, pr.created_at,
          p.name AS product_name,
          s.identity_verified
         FROM purchase_requests pr
         JOIN products p ON p.id = pr.product_id
         JOIN stakeholders s ON s.id = pr.stakeholder_id
         WHERE pr.industry_id = $1
         ORDER BY pr.created_at DESC
         LIMIT 5`,
        [industry.id]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Recent requests error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// ========================================
// PRODUCTS SUMMARY (dashboard)
// ========================================
router.get(
  "/industry/products-summary",
  authenticateToken,
  requireRole("industry"),
  requireApproved,
  async (req, res) => {
    try {
      const industry = await getIndustryForUser(req.user.id);
      if (!industry) return res.status(404).json({ message: "Industry profile not found" });

      const result = await pool.query(
        `SELECT id, name, category, price, unit, is_available, created_at
         FROM products WHERE industry_id = $1
         ORDER BY created_at DESC LIMIT 5`,
        [industry.id]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Products summary error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// ========================================
// INDUSTRY ANALYTICS (chart data — free for all)
// ========================================
router.get(
  "/industry/analytics",
  authenticateToken,
  requireRole("industry"),
  requireApproved,
  async (req, res) => {
    try {
      const industry = await getIndustryForUser(req.user.id);
      if (!industry) return res.status(404).json({ message: "Industry profile not found" });
      const id = industry.id;

      const [summary, byProduct, byStatus, overTime] = await Promise.all([
        // Summary counts
        pool.query(`
          SELECT
            COUNT(*)                                          AS total_requests,
            COUNT(*) FILTER (WHERE status = 'pending')       AS pending,
            COUNT(*) FILTER (WHERE status = 'approved')      AS approved,
            COUNT(*) FILTER (WHERE status = 'rejected')      AS rejected,
            COUNT(*) FILTER (WHERE status = 'completed')     AS completed,
            COUNT(DISTINCT stakeholder_id)                   AS unique_stakeholders,
            COALESCE(SUM(p.price * pr.quantity) FILTER (WHERE pr.status IN ('approved','completed')), 0) AS total_revenue
          FROM purchase_requests pr
          LEFT JOIN products p ON p.id = pr.product_id
          WHERE pr.industry_id = $1
        `, [id]),

        // Requests per product (top 8)
        pool.query(`
          SELECT p.name AS product, COUNT(pr.id) AS requests
          FROM purchase_requests pr
          JOIN products p ON p.id = pr.product_id
          WHERE pr.industry_id = $1
          GROUP BY p.name
          ORDER BY requests DESC
          LIMIT 8
        `, [id]),

        // Status distribution
        pool.query(`
          SELECT status, COUNT(*) AS count
          FROM purchase_requests
          WHERE industry_id = $1
          GROUP BY status
        `, [id]),

        // Requests over last 30 days
        pool.query(`
          SELECT
            TO_CHAR(DATE_TRUNC('day', created_at), 'Mon DD') AS day,
            COUNT(*) AS count
          FROM purchase_requests
          WHERE industry_id = $1
            AND created_at >= NOW() - INTERVAL '30 days'
          GROUP BY DATE_TRUNC('day', created_at)
          ORDER BY DATE_TRUNC('day', created_at)
        `, [id]),
      ]);

      res.json({
        summary:    summary.rows[0],
        byProduct:  byProduct.rows,
        byStatus:   byStatus.rows,
        overTime:   overTime.rows,
      });
    } catch (err) {
      console.error("Industry analytics error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
