const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticateToken, requireRole } = require("../middleware/auth");

// ── GET CART ──
router.get("/cart", authenticateToken, requireRole("stakeholder"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         ci.id, ci.quantity, ci.created_at,
         p.id AS product_id, p.name, p.price, p.unit, p.category, p.image_url,
         i.company_name
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN industries i ON i.id = p.industry_id
       WHERE ci.user_id = $1
       ORDER BY ci.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Get cart error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── ADD / UPDATE ITEM ──
router.post("/cart", authenticateToken, requireRole("stakeholder"), async (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  if (!product_id) return res.status(400).json({ message: "product_id is required" });

  try {
    // Verify product exists
    const prod = await pool.query("SELECT id FROM products WHERE id = $1 AND is_available = true", [product_id]);
    if (prod.rows.length === 0) return res.status(404).json({ message: "Product not found" });

    const result = await pool.query(
      `INSERT INTO cart_items (user_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, product_id)
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = NOW()
       RETURNING *`,
      [req.user.id, product_id, quantity]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── UPDATE QUANTITY ──
router.patch("/cart/:product_id", authenticateToken, requireRole("stakeholder"), async (req, res) => {
  const { product_id } = req.params;
  const { quantity } = req.body;
  if (!quantity || quantity < 1) return res.status(400).json({ message: "quantity must be >= 1" });

  try {
    const result = await pool.query(
      `UPDATE cart_items SET quantity = $1, updated_at = NOW()
       WHERE user_id = $2 AND product_id = $3 RETURNING *`,
      [quantity, req.user.id, product_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Cart item not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update cart error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── REMOVE ITEM ──
router.delete("/cart/:product_id", authenticateToken, requireRole("stakeholder"), async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2",
      [req.user.id, req.params.product_id]
    );
    res.json({ message: "Removed from cart" });
  } catch (err) {
    console.error("Remove cart error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── CLEAR CART ──
router.delete("/cart", authenticateToken, requireRole("stakeholder"), async (req, res) => {
  try {
    await pool.query("DELETE FROM cart_items WHERE user_id = $1", [req.user.id]);
    res.json({ message: "Cart cleared" });
  } catch (err) {
    console.error("Clear cart error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── SYNC (merge localStorage cart on login) ──
router.post("/cart/sync", authenticateToken, requireRole("stakeholder"), async (req, res) => {
  const { items } = req.body; // [{ product_id, quantity }]
  if (!Array.isArray(items) || items.length === 0) return res.json({ message: "Nothing to sync" });

  try {
    for (const item of items) {
      if (!item.product_id || !item.quantity) continue;
      const prod = await pool.query("SELECT id FROM products WHERE id = $1 AND is_available = true", [item.product_id]);
      if (prod.rows.length === 0) continue;

      await pool.query(
        `INSERT INTO cart_items (user_id, product_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, product_id)
         DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = NOW()`,
        [req.user.id, item.product_id, item.quantity]
      );
    }
    // Return merged cart
    const result = await pool.query(
      `SELECT ci.id, ci.quantity, p.id AS product_id, p.name, p.price, p.unit, p.category, p.image_url, i.company_name
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN industries i ON i.id = p.industry_id
       WHERE ci.user_id = $1 ORDER BY ci.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Cart sync error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
