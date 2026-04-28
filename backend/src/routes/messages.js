const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticateToken } = require("../middleware/auth");
const { resolveSubType } = require("./subscription");
const { createNotification } = require("../utils/createNotification");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const FREE_MESSAGES_LIMIT = 3; // per month for non-premium stakeholders

const messageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/message_attachments";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const suffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `msg_${suffix}${path.extname(file.originalname)}`);
  },
});

const uploadMessageFile = multer({
  storage: messageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|zip|rar/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error('File type not allowed'));
  },
});

async function userInConversation(userId, conversationId) {
  const result = await pool.query(`
    SELECT c.id FROM conversations c
    JOIN stakeholders s ON s.id = c.stakeholder_id
    JOIN industries i ON i.id = c.industry_id
    WHERE c.id = $1 AND (s.user_id = $2 OR i.user_id = $2)
  `, [conversationId, userId]);
  return result.rows.length > 0;
}

router.get("/conversations", authenticateToken, async (req, res) => {
  try {
    let query;
    const params = [req.user.id];

    if (req.user.role === "stakeholder") {
      query = `
        SELECT c.id, c.created_at,
               i.id AS industry_id, i.company_name, i.sector, i.user_id AS industry_user_id,
               (SELECT m.content  FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
               (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
               (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.is_read = false AND m.sender_id != $1) AS unread_count
        FROM conversations c
        JOIN stakeholders s ON s.id = c.stakeholder_id
        JOIN industries i ON i.id = c.industry_id
        WHERE s.user_id = $1
        ORDER BY last_message_at DESC NULLS LAST
      `;
    } else if (req.user.role === "industry") {
      query = `
        SELECT c.id, c.created_at,
               s.id AS stakeholder_id, s.organization_name, s.organization_type,
               s.contact_person, s.phone, s.user_id AS stakeholder_user_id,
               u.email AS stakeholder_email,
               (SELECT m.content  FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
               (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
               (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.is_read = false AND m.sender_id != $1) AS unread_count
        FROM conversations c
        JOIN industries i ON i.id = c.industry_id
        JOIN stakeholders s ON s.id = c.stakeholder_id
        JOIN users u ON u.id = s.user_id
        WHERE i.user_id = $1
        ORDER BY last_message_at DESC NULLS LAST
      `;
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/conversations/:id/messages", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    if (!await userInConversation(req.user.id, id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const result = await pool.query(`
      SELECT m.id, m.content, m.file_url, m.file_name, m.is_read, m.created_at,
             m.sender_id, u.email AS sender_email, u.role AS sender_role,
             COALESCE(i.company_name, s.organization_name) AS sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      LEFT JOIN industries i ON i.user_id = u.id
      LEFT JOIN stakeholders s ON s.user_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `, [id]);

    // Mark incoming messages as read
    await pool.query(
      "UPDATE messages SET is_read = true WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false",
      [id, req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/conversations/:id/messages", authenticateToken, uploadMessageFile.single("file"), async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if ((!content || !content.trim()) && !req.file) {
    return res.status(400).json({ message: "Message content or file is required" });
  }

  try {
    if (!await userInConversation(req.user.id, id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Enforce monthly message limit for free stakeholders
    if (req.user.role === "stakeholder") {
      const userRes = await pool.query(
        "SELECT is_subscribed, subscription_expires_at, messages_used_this_month, messages_month_reset_at FROM users WHERE id = $1",
        [req.user.id]
      );
      const user = userRes.rows[0] || {};
      const subType = resolveSubType(user);

      if (subType === "free") {
        const resetAt = user.messages_month_reset_at ? new Date(user.messages_month_reset_at) : new Date(0);
        const now = new Date();
        let used = user.messages_used_this_month || 0;

        // Reset counter at the start of each month
        if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
          await pool.query(
            "UPDATE users SET messages_used_this_month = 0, messages_month_reset_at = NOW() WHERE id = $1",
            [req.user.id]
          );
          used = 0;
        }

        if (used >= FREE_MESSAGES_LIMIT) {
          return res.status(402).json({
            message: `Free plan allows ${FREE_MESSAGES_LIMIT} messages per month.`,
            requires_subscription: true,
            messages_used: used,
            messages_limit: FREE_MESSAGES_LIMIT,
          });
        }

        await pool.query(
          "UPDATE users SET messages_used_this_month = messages_used_this_month + 1 WHERE id = $1",
          [req.user.id]
        );
      }
    }

    const fileUrl  = req.file ? `/uploads/message_attachments/${req.file.filename}` : null;
    const fileName = req.file ? req.file.originalname : null;

    const result = await pool.query(
      "INSERT INTO messages (conversation_id, sender_id, content, file_url, file_name) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [id, req.user.id, content ? content.trim() : null, fileUrl, fileName]
    );

    res.status(201).json(result.rows[0]);

    // Notify the industry when a stakeholder sends a message
    if (req.user.role === 'stakeholder') {
      try {
        const convRes = await pool.query(
          `SELECT c.industry_id, i.user_id AS industry_user_id, s.organization_name AS sender_name
           FROM conversations c
           JOIN industries i ON i.id = c.industry_id
           JOIN stakeholders s ON s.id = c.stakeholder_id
           WHERE c.id = $1`,
          [id]
        );
        if (convRes.rows.length > 0) {
          const { industry_user_id, sender_name } = convRes.rows[0];
          await createNotification(
            pool, industry_user_id,
            'New Message Received',
            `${sender_name || 'A stakeholder'} sent you a message.`,
            'message', parseInt(id)
          );
        }
      } catch (err) {
        console.error('[Messages] Notification failed (non-fatal):', err.message);
      }
    }
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/conversations/create", authenticateToken, async (req, res) => {
  const { stakeholder_id, industry_id } = req.body;
  if (!stakeholder_id || !industry_id) {
    return res.status(400).json({ message: "stakeholder_id and industry_id are required" });
  }

  try {
    const existing = await pool.query(
      "SELECT id FROM conversations WHERE stakeholder_id = $1 AND industry_id = $2",
      [stakeholder_id, industry_id]
    );

    if (existing.rows.length > 0) {
      return res.json({ conversation_id: existing.rows[0].id, created: false });
    }

    const result = await pool.query(
      "INSERT INTO conversations (stakeholder_id, industry_id) VALUES ($1,$2) RETURNING id",
      [stakeholder_id, industry_id]
    );
    res.status(201).json({ conversation_id: result.rows[0].id, created: true });
  } catch (error) {
    console.error("Create conversation error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
