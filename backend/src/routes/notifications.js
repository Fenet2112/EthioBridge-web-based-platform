/**
 * Industry Notifications Routes
 * GET  /api/industry/notifications              – list all notifications
 * GET  /api/industry/notifications/unread-count – unread badge count
 * PATCH /api/industry/notifications/:id/read    – mark one as read
 * PATCH /api/industry/notifications/mark-all-read – mark all as read
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// ── All routes require an authenticated industry user ──
router.use(authenticateToken, requireRole('industry'));

// ─────────────────────────────────────────────────────────
// GET /api/industry/notifications
// Returns all notifications for the logged-in industry user
// ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, message, type, is_read, reference_id, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json({ notifications: result.rows });
  } catch (err) {
    console.error('[Notifications] GET error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/industry/notifications/unread-count
// ─────────────────────────────────────────────────────────
router.get('/unread-count', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );
    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    console.error('[Notifications] unread-count error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────
// PATCH /api/industry/notifications/mark-all-read
// Must be defined BEFORE /:id/read to avoid route conflict
// ─────────────────────────────────────────────────────────
router.patch('/mark-all-read', async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('[Notifications] mark-all-read error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────
// PATCH /api/industry/notifications/:id/read
// ─────────────────────────────────────────────────────────
router.patch('/:id/read', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE notifications SET is_read = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('[Notifications] mark-read error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
