const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

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
        approved_at as created_at
      FROM testimonials
      WHERE status = 'approved'
      ORDER BY approved_at DESC
      LIMIT 20
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('[Testimonials] Error fetching approved testimonials:', error);
    res.status(500).json({ message: 'Failed to fetch testimonials' });
  }
});

// ── SUBMIT FEEDBACK (Authenticated Users) ──
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const { message, rating, role } = req.body;
    const userId = req.user.id;

    console.log('[Testimonials] Submit request from user:', userId);
    console.log('[Testimonials] Request body:', { message: message?.substring(0, 50), rating, role });

    // Validation
    if (!message || message.trim().length < 10) {
      console.log('[Testimonials] Validation failed: message too short');
      return res.status(400).json({ message: 'Message must be at least 10 characters long' });
    }

    if (!role || !['stakeholder', 'industry', 'investor', 'other'].includes(role)) {
      console.log('[Testimonials] Validation failed: invalid role');
      return res.status(400).json({ message: 'Invalid role selected' });
    }

    if (rating && (rating < 1 || rating > 5)) {
      console.log('[Testimonials] Validation failed: invalid rating');
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Get user's name from database
    console.log('[Testimonials] Fetching user details...');
    const userResult = await pool.query(
      'SELECT full_name, email FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      console.log('[Testimonials] User not found:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    const userName = userResult.rows[0].full_name || userResult.rows[0].email.split('@')[0];
    console.log('[Testimonials] User name:', userName);

    // Insert testimonial
    console.log('[Testimonials] Inserting testimonial...');
    const result = await pool.query(`
      INSERT INTO testimonials (user_id, name, role, message, rating, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING id, name, role, message, rating, status, created_at
    `, [userId, userName, role, message.trim(), rating || null]);

    console.log(`[Testimonials] New feedback submitted successfully by user ${userId}, testimonial ID: ${result.rows[0].id}`);
    
    res.status(201).json({
      message: 'Thank you for your feedback! It will be reviewed by our team.',
      testimonial: result.rows[0]
    });
  } catch (error) {
    console.error('[Testimonials] Error submitting feedback:', error);
    console.error('[Testimonials] Error stack:', error.stack);
    res.status(500).json({ message: 'Failed to submit feedback', error: error.message });
  }
});

// ── GET ALL TESTIMONIALS (Admin Only) ──
router.get('/admin/all', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

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
router.patch('/admin/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.user.id;

    // Check if user is admin
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [adminId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

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
        approved_at = CASE WHEN $1 = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE id = $3
      RETURNING id, name, role, message, rating, status, approved_at
    `, [status, adminId, id]);

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
    res.status(500).json({ message: 'Failed to update testimonial status' });
  }
});

// ── DELETE TESTIMONIAL (Admin Only) ──
router.delete('/admin/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    // Check if user is admin
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [adminId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

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
router.get('/admin/stats', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

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
