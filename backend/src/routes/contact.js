const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { sendEmail } = require('../utils/sendEmail');
const { authenticateToken } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

// ── Admin auth middleware ──
const requireAdminAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Admin access denied. No token provided.' });
  try {
    const adminSecret = process.env.ADMIN_JWT_SECRET;
    if (!adminSecret) return res.status(500).json({ message: 'Server configuration error.' });
    const decoded = jwt.verify(token, adminSecret);
    if (decoded.role !== 'admin') return res.status(403).json({ message: 'Access denied. Admin role required.' });
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired admin token.' });
  }
};

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ethiobridge.et';

const getStatusLabel = (status) => ({
  pending:     'Waiting for review',
  in_progress: 'Being looked into',
  replied:     'Admin replied',
  resolved:    'Completed'
}[status] || 'Unknown');

// ══════════════════════════════════════════════════════
// PUBLIC: SUBMIT CONTACT MESSAGE
// ══════════════════════════════════════════════════════
router.post('/submit', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, role, message, source, userId } = req.body;

    if (!firstName || !lastName || !email || !message)
      return res.status(400).json({ message: 'First name, last name, email, and message are required' });

    if (!source || !['contact', 'help'].includes(source))
      return res.status(400).json({ message: 'Invalid source. Must be "contact" or "help"' });

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ message: 'Invalid email format' });

    const subject = source === 'contact'
      ? `Contact Us: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`
      : `Help Request: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`;

    const result = await pool.query(`
      INSERT INTO contact_messages
        (first_name, last_name, email, phone, role, message, source, subject, status, user_id, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,NOW())
      RETURNING id, first_name, last_name, email, subject, status, created_at
    `, [firstName.trim(), lastName.trim(), email.trim().toLowerCase(),
        phone||null, role||null, message.trim(), source, subject, userId||null]);

    const saved = result.rows[0];

    // Email admin
    try {
      const srcLabel = source === 'contact' ? 'Contact Us' : 'Help Center';
      await sendEmail(ADMIN_EMAIL, `New ${srcLabel} Message from ${firstName} ${lastName}`, `
        <h2>New ${srcLabel} Message</h2>
        <p><strong>From:</strong> ${firstName} ${lastName} &lt;${email}&gt;</p>
        ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
        ${role  ? `<p><strong>Role:</strong> ${role}</p>`   : ''}
        ${userId? `<p><strong>User ID:</strong> ${userId}</p>` : ''}
        <h3>Message:</h3>
        <p style="background:#f5f5f5;padding:15px;border-left:4px solid #0a5c2f;">${message.replace(/\n/g,'<br>')}</p>
        <p style="color:#666;font-size:0.9em;">Message ID: ${saved.id}</p>
      `);
    } catch (e) { console.error('[Contact] Admin email failed:', e.message); }

    // Confirmation to user
    try {
      await sendEmail(email, 'We received your message - EthioBridge', `
        <h2>Thank you for contacting us!</h2>
        <p>Dear ${firstName},</p>
        <p>We received your message and will respond within 24-48 hours.</p>
        <p><strong>Reference:</strong> #${saved.id}</p>
        <p>Best regards,<br>The EthioBridge Team</p>
      `);
    } catch (e) { console.error('[Contact] Confirmation email failed:', e.message); }

    res.status(201).json({
      message: 'Thank you for your message! We will get back to you soon.',
      messageId: saved.id, status: saved.status, createdAt: saved.created_at
    });
  } catch (error) {
    console.error('[Contact] Submit error:', error);
    res.status(500).json({ message: 'Failed to submit message.', error: error.message });
  }
});

// ══════════════════════════════════════════════════════
// USER: GET SUPPORT THREAD (chat-formatted, marks as read)
// ══════════════════════════════════════════════════════
router.get('/my-support', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT id, first_name, last_name, subject, message, admin_reply,
             source, status, priority, created_at, replied_at, user_notified
      FROM contact_messages
      WHERE user_id = $1
      ORDER BY created_at ASC
    `, [userId]);

    const thread = [];
    for (const ticket of result.rows) {
      // User's original message
      thread.push({
        id:           'user-' + ticket.id,
        ticket_id:    ticket.id,
        sender:       'user',
        content:      ticket.message,
        subject:      ticket.subject,
        source:       ticket.source,
        status:       ticket.status,
        status_label: getStatusLabel(ticket.status),
        created_at:   ticket.created_at
      });
      // Admin reply (if exists)
      if (ticket.admin_reply) {
        thread.push({
          id:           'admin-' + ticket.id,
          ticket_id:    ticket.id,
          sender:       'admin',
          content:      ticket.admin_reply,
          subject:      'Re: ' + ticket.subject,
          source:       ticket.source,
          status:       ticket.status,
          status_label: getStatusLabel(ticket.status),
          created_at:   ticket.replied_at || ticket.created_at
        });
      }
    }

    // Count unread before marking as read
    const unreadReplies = result.rows.filter(t => t.admin_reply && !t.user_notified).length;

    // Mark all replied tickets as seen (user_notified = true)
    if (unreadReplies > 0) {
      await pool.query(`
        UPDATE contact_messages
        SET user_notified = true
        WHERE user_id = $1 AND admin_reply IS NOT NULL AND user_notified = false
      `, [userId]);
    }

    res.json({ thread, total: result.rows.length, unread_replies: unreadReplies });
  } catch (error) {
    console.error('[Contact] my-support error:', error);
    res.status(500).json({ message: 'Failed to fetch support messages' });
  }
});

// ══════════════════════════════════════════════════════
// USER: GET OWN MESSAGES LIST
// ══════════════════════════════════════════════════════
router.get('/my-messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, source } = req.query;

    const params = [userId];
    let q = `SELECT id, first_name, last_name, email, phone, role,
               subject, message, admin_reply, source, status, priority,
               user_id, created_at, updated_at, read_at, replied_at, user_notified
             FROM contact_messages WHERE user_id = $1`;

    if (status && ['pending','in_progress','replied','resolved'].includes(status)) {
      params.push(status); q += ` AND status = $${params.length}`;
    }
    if (source && ['contact','help'].includes(source)) {
      params.push(source); q += ` AND source = $${params.length}`;
    }
    q += ' ORDER BY created_at DESC';

    const result = await pool.query(q, params);
    const messages = result.rows.map(m => ({ ...m, status_label: getStatusLabel(m.status) }));
    res.json({ messages, total: messages.length });
  } catch (error) {
    console.error('[Contact] my-messages error:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// ══════════════════════════════════════════════════════
// USER: GET SINGLE MESSAGE
// ══════════════════════════════════════════════════════
router.get('/my-messages/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await pool.query(`
      SELECT id, first_name, last_name, email, phone, role,
             subject, message, admin_reply, source, status, priority,
             user_id, created_at, updated_at, read_at, replied_at, user_notified
      FROM contact_messages
      WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
    `, [id, userId]);
    if (!result.rows.length) return res.status(404).json({ message: 'Message not found' });
    res.json({ ...result.rows[0], status_label: getStatusLabel(result.rows[0].status) });
  } catch (error) {
    console.error('[Contact] my-messages/:id error:', error);
    res.status(500).json({ message: 'Failed to fetch message' });
  }
});

// ══════════════════════════════════════════════════════
// ADMIN: GET ALL MESSAGES
// ══════════════════════════════════════════════════════
router.get('/admin/messages', requireAdminAuth, async (req, res) => {
  try {
    const { status, source, priority, limit = 50, offset = 0 } = req.query;

    const params = [];
    let q = `SELECT id, first_name, last_name, email, phone, role,
               subject, message, admin_reply, source, status, priority,
               user_id, created_at, updated_at, read_at, replied_at, user_notified, notified_at
             FROM contact_messages WHERE 1=1`;

    if (status && ['pending','in_progress','replied','resolved'].includes(status)) {
      params.push(status); q += ` AND status = $${params.length}`;
    }
    if (source && ['contact','help'].includes(source)) {
      params.push(source); q += ` AND source = $${params.length}`;
    }
    if (priority && ['low','normal','high','urgent'].includes(priority)) {
      params.push(priority); q += ` AND priority = $${params.length}`;
    }

    // Count query (before adding LIMIT/OFFSET)
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM contact_messages WHERE 1=1` +
      (params.length ? params.map((_, i) => {
        if (status && i === 0) return ` AND status = $${i+1}`;
        if (source && ((status ? i===1 : i===0))) return ` AND source = $${i+1}`;
        return ` AND priority = $${i+1}`;
      }).join('') : ''),
      params
    );

    params.push(parseInt(limit), parseInt(offset));
    q += ` ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(q, params);
    const messages = result.rows.map(m => ({ ...m, status_label: getStatusLabel(m.status) }));

    res.json({
      messages,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('[Contact] admin/messages error:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// ══════════════════════════════════════════════════════
// ADMIN: GET SINGLE MESSAGE
// ══════════════════════════════════════════════════════
router.get('/admin/messages/:id', requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, first_name, last_name, email, phone, role,
             subject, message, admin_reply, source, status, priority,
             user_id, created_at, updated_at, read_at, replied_at,
             user_notified, notified_at, admin_notes
      FROM contact_messages WHERE id = $1
    `, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Message not found' });
    res.json({ ...result.rows[0], status_label: getStatusLabel(result.rows[0].status) });
  } catch (error) {
    console.error('[Contact] admin/messages/:id error:', error);
    res.status(500).json({ message: 'Failed to fetch message' });
  }
});

// ══════════════════════════════════════════════════════
// ADMIN: REPLY TO MESSAGE
// ══════════════════════════════════════════════════════
router.post('/admin/messages/:id/reply', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reply, notifyUser = true } = req.body;

    if (!reply || !reply.trim())
      return res.status(400).json({ message: 'Reply message is required' });

    const orig = await pool.query(
      'SELECT first_name, email, user_id, status FROM contact_messages WHERE id = $1', [id]
    );
    if (!orig.rows.length) return res.status(404).json({ message: 'Message not found' });
    const user = orig.rows[0];

    // Save reply + update status
    const result = await pool.query(`
      UPDATE contact_messages
      SET admin_reply = $1, status = 'replied', replied_at = NOW(), updated_at = NOW()
      WHERE id = $2 RETURNING *
    `, [reply.trim(), id]);

    const updated = result.rows[0];
    console.log('[Contact] Admin replied to ticket:', id);

    // In-app notification
    if (user.user_id) {
      try {
        await pool.query(`
          INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
          VALUES ($1, 'support_reply', 'Support Reply Received',
                 $2, $3, 'support_ticket')
        `, [
          user.user_id,
          `Admin replied to your support request #${id}. Tap to view.`,
          id
        ]);
        console.log('[Contact] In-app notification created for user:', user.user_id);
      } catch (e) { console.error('[Contact] Notification insert failed:', e.message); }
    }

    // Email notification
    if (notifyUser && user.email) {
      try {
        await sendEmail(user.email, 'Your support request has been answered - EthioBridge', `
          <h2>Your Support Request Has Been Answered</h2>
          <p>Dear ${user.first_name},</p>
          <div style="background:#f5f5f5;padding:16px;border-left:4px solid #0a5c2f;margin:16px 0;">
            <strong>Your Message:</strong><br>${updated.message}
          </div>
          <div style="background:#e8f5e9;padding:16px;border-left:4px solid #16a34a;margin:16px 0;">
            <strong>Admin Reply:</strong><br>${reply.replace(/\n/g,'<br>')}
          </div>
          <p>Log in to view the full conversation in your Messages → Support section.</p>
          <p>Best regards,<br>The EthioBridge Team</p>
          <p style="color:#666;font-size:0.85em;">Reference: #${id}</p>
        `);
        await pool.query(
          'UPDATE contact_messages SET user_notified = false, notified_at = NOW() WHERE id = $1', [id]
        );
        // user_notified = false means "new unread reply" — will be set true when user views it
        console.log('[Contact] Reply email sent to:', user.email);
      } catch (e) { console.error('[Contact] Reply email failed:', e.message); }
    }

    res.json({
      message: 'Reply sent successfully',
      data: { ...updated, status_label: getStatusLabel(updated.status) }
    });
  } catch (error) {
    console.error('[Contact] Reply error:', error);
    res.status(500).json({ message: 'Failed to send reply' });
  }
});

// ══════════════════════════════════════════════════════
// ADMIN: UPDATE STATUS
// ══════════════════════════════════════════════════════
router.patch('/admin/messages/:id/status', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority } = req.body;

    if (!status || !['pending','in_progress','replied','resolved'].includes(status))
      return res.status(400).json({ message: 'Invalid status' });

    const sets = ['status = $1', 'updated_at = NOW()'];
    const params = [status];

    if (status === 'in_progress') sets.push('read_at = COALESCE(read_at, NOW())');

    if (priority && ['low','normal','high','urgent'].includes(priority)) {
      params.push(priority); sets.push(`priority = $${params.length}`);
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE contact_messages SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (!result.rows.length) return res.status(404).json({ message: 'Message not found' });
    res.json({ message: 'Status updated', data: { ...result.rows[0], status_label: getStatusLabel(result.rows[0].status) } });
  } catch (error) {
    console.error('[Contact] Status update error:', error);
    res.status(500).json({ message: 'Failed to update status' });
  }
});

// ══════════════════════════════════════════════════════
// ADMIN: STATS
// ══════════════════════════════════════════════════════
router.get('/admin/stats', requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')     as pending_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'replied')     as replied_count,
        COUNT(*) FILTER (WHERE status = 'resolved')    as resolved_count,
        COUNT(*) FILTER (WHERE source = 'contact')     as contact_count,
        COUNT(*) FILTER (WHERE source = 'help')        as help_count,
        COUNT(*) FILTER (WHERE priority = 'urgent')    as urgent_count,
        COUNT(*) FILTER (WHERE priority = 'high')      as high_priority_count,
        COUNT(*)                                        as total_count
      FROM contact_messages
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[Contact] Stats error:', error);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

// ══════════════════════════════════════════════════════
// USER: NOTIFICATIONS
// ══════════════════════════════════════════════════════
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { unreadOnly = false, limit = 20, offset = 0 } = req.query;

    let q = `SELECT id, type, title, message, reference_id, reference_type, is_read, created_at, read_at
             FROM notifications WHERE user_id = $1`;
    const params = [userId];

    if (unreadOnly === 'true') q += ' AND is_read = false';
    q += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
    params.push(parseInt(limit), parseInt(offset));

    const [result, unreadResult] = await Promise.all([
      pool.query(q, params),
      pool.query('SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = false', [userId])
    ]);

    res.json({ notifications: result.rows, unreadCount: parseInt(unreadResult.rows[0].unread_count) });
  } catch (error) {
    console.error('[Contact] Notifications error:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

router.patch('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Marked as read', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update notification' });
  }
});

router.post('/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update notifications' });
  }
});

module.exports = router;
