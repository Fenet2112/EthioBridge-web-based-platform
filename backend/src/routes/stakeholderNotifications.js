/**
 * Stakeholder Notifications Routes
 * GET  /api/stakeholder/notifications
 * GET  /api/stakeholder/notifications/unread-count
 * PATCH /api/stakeholder/notifications/mark-all-read
 * PATCH /api/stakeholder/notifications/:id/read
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken, requireRole('stakeholder'));

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, message, type, is_read, reference_id, created_at
       FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ notifications: result.rows });
  } catch (err) {
    console.error('[StakeholderNotif] GET error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );
    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/mark-all-read', async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
