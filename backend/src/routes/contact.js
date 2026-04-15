const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { sendEmail } = require('../utils/sendEmail');

// Get admin email from environment or use default
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ethiobridge.et';

// ── SUBMIT CONTACT MESSAGE (Public) ──
router.post('/submit', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, role, message, source } = req.body;

    console.log('[Contact] New message submission:', { email, source });

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

    // Insert message into database
    const result = await pool.query(`
      INSERT INTO contact_messages 
        (first_name, last_name, email, phone, role, message, source, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'unread')
      RETURNING id, first_name, last_name, email, created_at
    `, [
      firstName.trim(),
      lastName.trim(),
      email.trim().toLowerCase(),
      phone || null,
      role || null,
      message.trim(),
      source
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
        <p><strong>Source:</strong> ${sourceLabel}</p>
        <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
        
        <h3>Message:</h3>
        <p style="background: #f5f5f5; padding: 15px; border-left: 4px solid #0a5c2f;">
          ${message.replace(/\n/g, '<br>')}
        </p>
        
        <hr>
        <p style="color: #666; font-size: 0.9em;">
          Message ID: ${savedMessage.id}<br>
          View all messages in the admin dashboard.
        </p>
      `;

      await sendEmail(ADMIN_EMAIL, emailSubject, emailBody);
      console.log('[Contact] Admin notification email sent');
    } catch (emailError) {
      console.error('[Contact] Failed to send admin notification:', emailError.message);
      // Don't fail the request if email fails - message is still saved
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
        
        <p>Our team typically responds within 24-48 hours.</p>
        
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
      // Don't fail the request if email fails
    }

    res.status(201).json({
      message: 'Thank you for your message! We will get back to you soon.',
      messageId: savedMessage.id
    });

  } catch (error) {
    console.error('[Contact] Error submitting message:', error);
    res.status(500).json({ 
      message: 'Failed to submit message. Please try again later.',
      error: error.message 
    });
  }
});

// ── GET ALL CONTACT MESSAGES (Admin Only) ──
router.get('/admin/messages', async (req, res) => {
  try {
    // Simple admin check - in production, use proper admin authentication
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { status, source, limit = 50 } = req.query;

    let query = `
      SELECT 
        id, first_name, last_name, email, phone, role, 
        message, source, status, created_at, read_at, 
        replied_at, admin_notes
      FROM contact_messages
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (status && ['unread', 'read', 'replied', 'archived'].includes(status)) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    if (source && ['contact', 'help'].includes(source)) {
      paramCount++;
      query += ` AND source = $${paramCount}`;
      params.push(source);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    res.json({
      messages: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('[Contact] Error fetching messages:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// ── UPDATE MESSAGE STATUS (Admin Only) ──
router.patch('/admin/messages/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!status || !['unread', 'read', 'replied', 'archived'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updates = ['status = $1'];
    const params = [status, id];
    let paramCount = 1;

    if (status === 'read') {
      updates.push(`read_at = CURRENT_TIMESTAMP`);
    }

    if (status === 'replied') {
      updates.push(`replied_at = CURRENT_TIMESTAMP`);
    }

    if (adminNotes !== undefined) {
      paramCount++;
      updates.push(`admin_notes = $${paramCount}`);
      params.splice(paramCount - 1, 0, adminNotes);
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
      data: result.rows[0]
    });

  } catch (error) {
    console.error('[Contact] Error updating message status:', error);
    res.status(500).json({ message: 'Failed to update status' });
  }
});

// ── GET MESSAGE STATS (Admin Only) ──
router.get('/admin/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'unread') as unread_count,
        COUNT(*) FILTER (WHERE status = 'read') as read_count,
        COUNT(*) FILTER (WHERE status = 'replied') as replied_count,
        COUNT(*) FILTER (WHERE source = 'contact') as contact_count,
        COUNT(*) FILTER (WHERE source = 'help') as help_count,
        COUNT(*) as total_count
      FROM contact_messages
    `);

    res.json(result.rows[0]);

  } catch (error) {
    console.error('[Contact] Error fetching stats:', error);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

module.exports = router;
