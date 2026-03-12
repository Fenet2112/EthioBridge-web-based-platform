const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticateToken, requireRole, requireApproved } = require("../middleware/auth");

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

module.exports = router;
