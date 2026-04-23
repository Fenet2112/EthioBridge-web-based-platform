const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

// Admin authentication middleware (same as in admin.js)
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: "Admin access denied. No token provided." });
  }

  try {
    // Use admin secret from environment
    const adminSecret = process.env.ADMIN_JWT_SECRET || 'admin-super-secret-key-change-in-production';
    const decoded = jwt.verify(token, adminSecret);
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: "Access denied. Admin role required." });
    }
    
    req.admin = decoded;
    next();
  } catch (err) {
    console.error('[Testimonials] Admin auth error:', err.message);
    return res.status(403).json({ message: "Invalid or expired admin token." });
  }
};

// ── GET APPROVED TESTIMONIALS (Public) ──
router.get('/approved', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        name,
        role,
        message,
        rating,
        COALESCE(approved_at, created_at) AS created_at
      FROM testimonials
      WHERE status = 'approved'
        AND name IS NOT NULL
        AND TRIM(name) <> ''
        AND message IS NOT NULL
        AND TRIM(message) <> ''
      ORDER BY COALESCE(approved_at, created_at) DESC
      LIMIT 20
    `);
    
    console.log(`[Testimonials] Returning ${result.rows.length} approved testimonials`);
    res.json(result.rows);
  } catch (error) {
    console.error('[Testimonials] Error fetching approved testimonials:', error);
    res.status(500).json({ message: 'Failed to fetch testimonials' });
  }
});

// ── SUBMIT FEEDBACK (Authenticated Users) ──
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const { message, rating } = req.body;
    const userId = req.user.id;
    // Always use role from the authenticated token — never trust frontend input
    const role = req.user.role || 'other';

    console.log('[Testimonials] Submit request from user:', userId, 'role:', role);

    // Validation
    if (!message || message.trim().length < 10) {
      return res.status(400).json({ message: 'Message must be at least 10 characters long' });
    }

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Get user's display name from database
    const userResult = await pool.query(`
      SELECT 
        u.email,
        COALESCE(i.company_name, s.organization_name, s.full_name, SPLIT_PART(u.email, '@', 1)) as display_name
      FROM users u
      LEFT JOIN industries i ON i.user_id = u.id
      LEFT JOIN stakeholders s ON s.user_id = u.id
      WHERE u.id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userName = userResult.rows[0].display_name;

    const result = await pool.query(`
      INSERT INTO testimonials (user_id, name, role, message, rating, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING id, name, role, message, rating, status, created_at
    `, [userId, userName, role, message.trim(), rating || null]);

    console.log(`[Testimonials] Submitted by user ${userId} (${role}), ID: ${result.rows[0].id}`);
    
    res.status(201).json({
      message: 'Thank you for your feedback! It will be reviewed by our team.',
      testimonial: result.rows[0]
    });
  } catch (error) {
    console.error('[Testimonials] Error submitting feedback:', error);
    res.status(500).json({ message: 'Failed to submit feedback', error: error.message });
  }
});

// ── GET ALL TESTIMONIALS (Admin Only) ──
router.get('/admin/all', authenticateAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT 
        t.id,
        t.user_id,
        t.name,
        t.role,
        t.message,
        t.rating,
        t.status,
        t.created_at,
        t.approved_at,
        u.email as user_email
      FROM testimonials t
      LEFT JOIN users u ON t.user_id = u.id
    `;

    const params = [];
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query += ' WHERE t.status = $1';
      params.push(status);
    }

    query += ' ORDER BY t.created_at DESC';

    const result = await pool.query(query, params);
    
    res.json(result.rows);
  } catch (error) {
    console.error('[Testimonials] Error fetching all testimonials:', error);
    res.status(500).json({ message: 'Failed to fetch testimonials' });
  }
});

// ── UPDATE TESTIMONIAL STATUS (Admin Only) ──
router.patch('/admin/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.admin.id;

    // Validate status
    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be "approved" or "rejected"' });
    }

    // Update testimonial status
    const result = await pool.query(`
      UPDATE testimonials
      SET 
        status = $1,
        approved_by = $2,
        approved_at = CASE WHEN $3 = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, name, role, message, rating, status, approved_at
    `, [status, adminId === 0 ? null : adminId, status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Testimonial not found' });
    }

    console.log(`[Testimonials] Admin ${adminId} ${status} testimonial ${id}`);
    
    res.json({
      message: `Testimonial ${status} successfully`,
      testimonial: result.rows[0]
    });
  } catch (error) {
    console.error('[Testimonials] Error updating testimonial status:', error);
    console.error('[Testimonials] Error details:', error.message);
    console.error('[Testimonials] Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Failed to update testimonial status',
      error: error.message 
    });
  }
});

// ── DELETE TESTIMONIAL (Admin Only) ──
router.delete('/admin/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin.id;

    const result = await pool.query(
      'DELETE FROM testimonials WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Testimonial not found' });
    }

    console.log(`[Testimonials] Admin ${adminId} deleted testimonial ${id}`);
    
    res.json({ message: 'Testimonial deleted successfully' });
  } catch (error) {
    console.error('[Testimonials] Error deleting testimonial:', error);
    res.status(500).json({ message: 'Failed to delete testimonial' });
  }
});

// ── GET TESTIMONIAL STATS (Admin Only) ──
router.get('/admin/stats', authenticateAdmin, async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
        COUNT(*) as total_count,
        ROUND(AVG(rating), 1) as average_rating
      FROM testimonials
    `);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[Testimonials] Error fetching stats:', error);
    res.status(500).json({ message: 'Failed to fetch testimonial stats' });
  }
});

module.exports = router;
