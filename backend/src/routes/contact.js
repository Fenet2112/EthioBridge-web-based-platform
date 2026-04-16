const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { sendEmail } = require('../utils/sendEmail');
const { authenticateToken } = require('../middleware/auth');

// Get admin email from environment or use default
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ethiobridge.et';

// ── SUBMIT CONTACT MESSAGE (Public) ──
router.post('/submit', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, role, message, source, userId } = req.body;

    console.log('[Contact] New message submission:', { email, source, userId });

    // Validation
    if (!firstName || !lastName || !email || !message) {
      return res.status(400).json({ 
        message: 'First name, last name, email, and message are required' 
      });
    }

    if (!source || !['contact', 'help'].includes(source)) {
      return res.status(400).json({ 
        message: 'Invalid source. Must be "contact" or "help"' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Generate subject from message
    const subject = source === 'contact' 
      ? `Contact Us: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`
      : `Help Request: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`;

    // Insert message into database (now with status 'pending')
    const result = await pool.query(`
      INSERT INTO contact_messages 
        (first_name, last_name, email, phone, role, message, source, subject, status, user_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, NOW())
      RETURNING id, first_name, last_name, email, subject, status, created_at
    `, [
      firstName.trim(),
      lastName.trim(),
      email.trim().toLowerCase(),
      phone || null,
      role || null,
      message.trim(),
      source,
      subject,
      userId || null
    ]);

    const savedMessage = result.rows[0];
    console.log('[Contact] Message saved with ID:', savedMessage.id);

    // Send email notification to admin
    try {
      const sourceLabel = source === 'contact' ? 'Contact Us' : 'Help Center';
      const emailSubject = `New ${sourceLabel} Message from ${firstName} ${lastName}`;
      
      const emailBody = `
        <h2>New ${sourceLabel} Message</h2>
        <p><strong>From:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
        ${role ? `<p><strong>Role:</strong> ${role}</p>` : ''}
        ${userId ? `<p><strong>User ID:</strong> ${userId}</p>` : ''}
        <p><strong>Source:</strong> ${sourceLabel}</p>
        <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
        
        <h3>Message:</h3>
        <p style="background: #f5f5f5; padding: 15px; border-left: 4px solid #0a5c2f;">
          ${message.replace(/\n/g, '<br>')}
        </p>
        
        <hr>
        <p style="color: #666; font-size: 0.9em;">
          Message ID: ${savedMessage.id}<br>
          <a href="${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000'}/admin/dashboard">View in admin dashboard</a>
        </p>
      `;

      await sendEmail(ADMIN_EMAIL, emailSubject, emailBody);
      console.log('[Contact] Admin notification email sent');
    } catch (emailError) {
      console.error('[Contact] Failed to send admin notification:', emailError.message);
    }

    // Send confirmation email to user
    try {
      const confirmationSubject = 'We received your message - EthioBridge';
      const confirmationBody = `
        <h2>Thank you for contacting us!</h2>
        <p>Dear ${firstName},</p>
        <p>We have received your message and will get back to you as soon as possible.</p>
        
        <h3>Your Message:</h3>
        <p style="background: #f5f5f5; padding: 15px; border-left: 4px solid #0a5c2f;">
          ${message.replace(/\n/g, '<br>')}
        </p>
        
        <p><strong>Reference Number:</strong> #${savedMessage.id}</p>
        <p>Our team typically responds within 24-48 hours.</p>
        
        <p>Track your request status by logging into your account and visiting the Support section.</p>
        
        <p>Best regards,<br>
        The EthioBridge Team</p>
        
        <hr>
        <p style="color: #666; font-size: 0.9em;">
          This is an automated confirmation email. Please do not reply to this email.
        </p>
      `;

      await sendEmail(email, confirmationSubject, confirmationBody);
      console.log('[Contact] Confirmation email sent to user');
    } catch (emailError) {
      console.error('[Contact] Failed to send confirmation email:', emailError.message);
    }

    res.status(201).json({
      message: 'Thank you for your message! We will get back to you soon.',
      messageId: savedMessage.id,
      status: savedMessage.status,
      createdAt: savedMessage.created_at
    });

  } catch (error) {
    console.error('[Contact] Error submitting message:', error);
    res.status(500).json({ 
      message: 'Failed to submit message. Please try again later.',
      error: error.message 
    });
  }
});

// ── GET USER'S OWN MESSAGES (Authenticated User) ──
router.get('/my-messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, source } = req.query;

    console.log('[Contact] Getting messages for user:', userId);

    let query = `
      SELECT 
        id, first_name, last_name, email, phone, role,
        subject, message, admin_reply, source, status, priority,
        user_id, created_at, updated_at, read_at, replied_at, user_notified
      FROM contact_messages
      WHERE user_id = $1
    `;

    const params = [userId];
    let paramCount = 1;

    if (status && ['pending', 'in_progress', 'replied', 'resolved'].includes(status)) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    if (source && ['contact', 'help'].includes(source)) {
      paramCount++;
      query += ` AND source = $${paramCount}`;
      params.push(source);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);

    // Transform to include status label
    const messages = result.rows.map(msg => ({
      ...msg,
      status_label: getStatusLabel(msg.status)
    }));

    res.json({
      messages,
      total: messages.length
    });

  } catch (error) {
    console.error('[Contact] Error fetching user messages:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// ── GET SINGLE MESSAGE BY ID (Authenticated User) ──
router.get('/my-messages/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT 
        id, first_name, last_name, email, phone, role,
        subject, message, admin_reply, source, status, priority,
        user_id, created_at, updated_at, read_at, replied_at, user_notified
      FROM contact_messages
      WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
    `, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const message = result.rows[0];
    res.json({
      ...message,
      status_label: getStatusLabel(message.status)
    });

  } catch (error) {
    console.error('[Contact] Error fetching message:', error);
    res.status(500).json({ message: 'Failed to fetch message' });
  }
});

// ── ADMIN: GET ALL CONTACT MESSAGES ──
router.get('/admin/messages', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { status, source, priority, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        id, first_name, last_name, email, phone, role,
        subject, message, admin_reply, source, status, priority,
        user_id, created_at, updated_at, read_at, replied_at, user_notified, notified_at
      FROM contact_messages
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (status && ['pending', 'in_progress', 'replied', 'resolved'].includes(status)) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    if (source && ['contact', 'help'].includes(source)) {
      paramCount++;
      query += ` AND source = $${paramCount}`;
      params.push(source);
    }

    if (priority && ['low', 'normal', 'high', 'urgent'].includes(priority)) {
      paramCount++;
      query += ` AND priority = $${paramCount}`;
      params.push(priority);
    }

    query += ` ORDER BY 
      CASE priority 
        WHEN 'urgent' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'normal' THEN 3 
        WHEN 'low' THEN 4 
      END,
      created_at DESC 
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Transform to include status label
    const messages = result.rows.map(msg => ({
      ...msg,
      status_label: getStatusLabel(msg.status)
    }));

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM contact_messages WHERE 1=1';
    const countParams = [];
    let countParamCount = 0;
    
    if (status) {
      countParamCount++;
      countQuery += ` AND status = $${countParamCount}`;
      countParams.push(status);
    }
    if (source) {
      countParamCount++;
      countQuery += ` AND source = $${countParamCount}`;
      countParams.push(source);
    }
    if (priority) {
      countParamCount++;
      countQuery += ` AND priority = $${countParamCount}`;
      countParams.push(priority);
    }
    
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      messages,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('[Contact] Error fetching messages:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// ── ADMIN: GET SINGLE MESSAGE ──
router.get('/admin/messages/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        id, first_name, last_name, email, phone, role,
        subject, message, admin_reply, source, status, priority,
        user_id, created_at, updated_at, read_at, replied_at, user_notified, notified_at, admin_notes
      FROM contact_messages
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const message = result.rows[0];
    res.json({
      ...message,
      status_label: getStatusLabel(message.status)
    });

  } catch (error) {
    console.error('[Contact] Error fetching message:', error);
    res.status(500).json({ message: 'Failed to fetch message' });
  }
});

// ── ADMIN: REPLY TO MESSAGE ──
router.post('/admin/messages/:id/reply', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const { reply, notifyUser = true } = req.body;

    if (!reply || !reply.trim()) {
      return res.status(400).json({ message: 'Reply message is required' });
    }

    // Get the original message to find user's email
    const originalMsg = await pool.query(`
      SELECT first_name, email, user_id, status FROM contact_messages WHERE id = $1
    `, [id]);

    if (originalMsg.rows.length === 0) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const user = originalMsg.rows[0];
    const newStatus = 'replied';

    // Update the message with admin reply
    const result = await pool.query(`
      UPDATE contact_messages
      SET admin_reply = $1,
          status = $2,
          replied_at = NOW(),
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [reply.trim(), newStatus, id]);

    const updatedMessage = result.rows[0];
    console.log('[Contact] Admin replied to message:', id);

    // Send email notification to user
    if (notifyUser && user.email) {
      try {
        const emailSubject = 'Re: Your support request has been answered - EthioBridge';
        const emailBody = `
          <h2>Your Support Request Has Been Answered</h2>
          <p>Dear ${user.first_name},</p>
          <p>Thank you for reaching out to us. Here is our response to your request:</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-left: 4px solid #0a5c2f; margin: 20px 0;">
            <p><strong>Your Original Message:</strong></p>
            <p>${updatedMessage.message}</p>
          </div>
          
          <div style="background: #e8f5e9; padding: 20px; border-left: 4px solid #2e7d32; margin: 20px 0;">
            <p><strong>Our Response:</strong></p>
            <p>${reply.replace(/\n/g, '<br>')}</p>
          </div>
          
          <p>If you have any further questions, please don't hesitate to contact us.</p>
          
          <p>Best regards,<br>
          The EthioBridge Team</p>
          
          <hr>
          <p style="color: #666; font-size: 0.9em;">
            Reference: #${id}<br>
            Log in to your account to view your support history.
          </p>
        `;

        await sendEmail(user.email, emailSubject, emailBody);
        console.log('[Contact] Reply email sent to user:', user.email);

        // Mark as notified
        await pool.query(`
          UPDATE contact_messages
          SET user_notified = true, notified_at = NOW()
          WHERE id = $1
        `, [id]);

      } catch (emailError) {
        console.error('[Contact] Failed to send reply email:', emailError.message);
      }

      // Create in-app notification if user is logged in
      if (user.user_id) {
        try {
          await pool.query(`
            INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
            VALUES ($1, 'support_reply', 'Support Request Updated', $2, $3, 'support_ticket')
          `, [
            user.user_id,
            `Your support request #${id} has been answered. Please log in to view the response.`,
            id
          ]);
          console.log('[Contact] In-app notification created for user:', user.user_id);
        } catch (notifError) {
          console.error('[Contact] Failed to create notification:', notifError.message);
        }
      }
    }

    res.json({
      message: 'Reply sent successfully',
      data: {
        ...updatedMessage,
        status_label: getStatusLabel(updatedMessage.status)
      }
    });

  } catch (error) {
    console.error('[Contact] Error sending reply:', error);
    res.status(500).json({ message: 'Failed to send reply' });
  }
});

// ── ADMIN: UPDATE MESSAGE STATUS ──
router.patch('/admin/messages/:id/status', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const { status, priority } = req.body;

    if (!status || !['pending', 'in_progress', 'replied', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updates = ['status = $1', 'updated_at = NOW()'];
    const params = [status, id];
    let paramCount = 1;

    if (status === 'in_progress' || status === 'read') {
      updates.push(`read_at = COALESCE(read_at, NOW())`);
    }

    if (priority && ['low', 'normal', 'high', 'urgent'].includes(priority)) {
      paramCount++;
      updates.push(`priority = $${paramCount}`);
      params.push(priority);
    }

    const query = `
      UPDATE contact_messages
      SET ${updates.join(', ')}
      WHERE id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Message not found' });
    }

    res.json({
      message: 'Status updated successfully',
      data: {
        ...result.rows[0],
        status_label: getStatusLabel(result.rows[0].status)
      }
    });

  } catch (error) {
    console.error('[Contact] Error updating message status:', error);
    res.status(500).json({ message: 'Failed to update status' });
  }
});

// ── ADMIN: GET MESSAGE STATS ──
router.get('/admin/stats', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'replied') as replied_count,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
        COUNT(*) FILTER (WHERE source = 'contact') as contact_count,
        COUNT(*) FILTER (WHERE source = 'help') as help_count,
        COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_count,
        COUNT(*) FILTER (WHERE priority = 'high') as high_priority_count,
        COUNT(*) as total_count
      FROM contact_messages
    `);

    res.json(result.rows[0]);

  } catch (error) {
    console.error('[Contact] Error fetching stats:', error);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

// ── GET USER NOTIFICATIONS ──
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { unreadOnly = false, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT id, type, title, message, reference_id, reference_type, is_read, created_at, read_at
      FROM notifications
      WHERE user_id = $1
    `;

    const params = [userId];
    
    if (unreadOnly === 'true') {
      query += ' AND is_read = false';
    }

    query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get unread count
    const unreadResult = await pool.query(`
      SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = false
    `, [userId]);

    res.json({
      notifications: result.rows,
      unreadCount: parseInt(unreadResult.rows[0].unread_count)
    });

  } catch (error) {
    console.error('[Contact] Error fetching notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

// ── MARK NOTIFICATION AS READ ──
router.patch('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(`
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read', data: result.rows[0] });

  } catch (error) {
    console.error('[Contact] Error marking notification as read:', error);
    res.status(500).json({ message: 'Failed to update notification' });
  }
});

// ── MARK ALL NOTIFICATIONS AS READ ──
router.post('/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(`
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE user_id = $1 AND is_read = false
    `, [userId]);

    res.json({ message: 'All notifications marked as read' });

  } catch (error) {
    console.error('[Contact] Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Failed to update notifications' });
  }
});

// Helper function to get status label
function getStatusLabel(status) {
  const labels = {
    'pending': 'Waiting for review',
    'in_progress': 'Being looked into',
    'replied': 'Awaiting your response',
    'resolved': 'Completed'
  };
  return labels[status] || 'Unknown';
}

module.exports = router;
