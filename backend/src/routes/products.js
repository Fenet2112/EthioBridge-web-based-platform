const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticateToken, requireRole, requireApproved } = require("../middleware/auth");
const { resolveSubType } = require("./subscription");

const FREE_PRODUCT_LIMIT = 5;

// Helper: verify the requesting user owns the industry resource
async function getIndustryForUser(userId) {
  const result = await pool.query(
    "SELECT id FROM industries WHERE user_id = $1",
    [userId]
  );
  return result.rows[0] || null;
}

// ── GET ALL PRODUCTS (public - for Products page) ──
router.get("/products/all", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        p.id, p.name, p.description, p.price, p.unit, p.category, p.image_url, p.is_available,
        i.company_name, i.id as industry_id
       FROM products p
       JOIN industries i ON i.id = p.industry_id
       WHERE p.is_available = true
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Get all products error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET MY PRODUCTS (industry dashboard) ──
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
        `SELECT id, name, description, price, unit, category, image_url, is_available, created_at, updated_at
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

// ── CREATE PRODUCT ──
router.post(
  "/products",
  authenticateToken,
  requireRole("industry"),
  requireApproved,
  async (req, res) => {
    const { name, description, price, unit, category } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Product name is required" });
    }

    try {
      const industry = await getIndustryForUser(req.user.id);
      if (!industry) {
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
          return res.status(402).json({
            message: `Free plan allows up to ${FREE_PRODUCT_LIMIT} products. Upgrade to Premium for unlimited listings.`,
            requires_subscription: true,
            limit: FREE_PRODUCT_LIMIT,
          });
        }
      }

      // ── Duplicate name check ──
      const dupCheck = await pool.query(
        "SELECT id FROM products WHERE industry_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))",
        [industry.id, name]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({
          message: "This product already exists. Please update the existing product instead.",
          duplicate: true,
          existing_id: dupCheck.rows[0].id,
        });
      }

      const result = await pool.query(
        `INSERT INTO products (industry_id, name, description, price, unit, category)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          industry.id,
          name,
          description || null,
          price ? parseFloat(price) : null,
          unit || "unit",
          category || null,
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Create product error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// ── UPDATE PRODUCT ──
router.put(
  "/products/:id",
  authenticateToken,
  requireRole("industry"),
  requireApproved,
  async (req, res) => {
    const { id } = req.params;
    const { name, description, price, unit, category, is_available } = req.body;

    try {
      const industry = await getIndustryForUser(req.user.id);
      if (!industry) {
        return res.status(404).json({ message: "Industry profile not found" });
      }

      // Ensure product belongs to this industry
      const check = await pool.query(
        "SELECT id FROM products WHERE id = $1 AND industry_id = $2",
        [id, industry.id]
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Duplicate name check (exclude self)
      if (name) {
        const dupCheck = await pool.query(
          "SELECT id FROM products WHERE industry_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) AND id != $3",
          [industry.id, name, id]
        );
        if (dupCheck.rows.length > 0) {
          return res.status(409).json({
            message: "Another product with this name already exists.",
            duplicate: true,
            existing_id: dupCheck.rows[0].id,
          });
        }
      }

      const result = await pool.query(
        `UPDATE products
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             price = COALESCE($3, price),
             unit = COALESCE($4, unit),
             category = COALESCE($5, category),
             is_available = COALESCE($6, is_available),
             updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [
          name || null,
          description !== undefined ? description : null,
          price !== undefined ? parseFloat(price) : null,
          unit || null,
          category || null,
          is_available !== undefined ? is_available : null,
          id,
        ]
      );
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Update product error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// ── DELETE PRODUCT ──
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

// ── INDUSTRY DASHBOARD SUMMARY ──
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

// ── RECENT PURCHASE REQUESTS (dashboard) ──
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

// ── PRODUCTS SUMMARY (dashboard) ──
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

module.exports = router;

