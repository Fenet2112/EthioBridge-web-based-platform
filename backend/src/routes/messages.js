const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticateToken } = require("../middleware/auth");
const { resolveSubType } = require("./subscription");

const FREE_MESSAGES_LIMIT = 3;

// Helper to check if user is a member of a conversation
async function userInConversation(userId, conversationId) {
  const result = await pool.query(`
    SELECT c.id FROM conversations c
    JOIN stakeholders s ON s.id = c.stakeholder_id
    JOIN industries i ON i.id = c.industry_id
    WHERE c.id = $1 AND (s.user_id = $2 OR i.user_id = $2)
  `, [conversationId, userId]);
  return result.rows.length > 0;
}

// ── GET MY CONVERSATIONS ──
router.get("/conversations", authenticateToken, async (req, res) => {
  try {
    let query;
    const params = [req.user.id];

    if (req.user.role === "stakeholder") {
      query = `
        SELECT
          c.id, c.created_at,
          i.id AS industry_id, i.company_name, i.sector, i.user_id AS industry_user_id,
          (
            SELECT m.content FROM messages m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC LIMIT 1
          ) AS last_message,
          (
            SELECT m.created_at FROM messages m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC LIMIT 1
          ) AS last_message_at,
          (
            SELECT COUNT(*) FROM messages m
            WHERE m.conversation_id = c.id AND m.is_read = false AND m.sender_id != $1
          ) AS unread_count
        FROM conversations c
        JOIN stakeholders s ON s.id = c.stakeholder_id
        JOIN industries i ON i.id = c.industry_id
        WHERE s.user_id = $1
        ORDER BY last_message_at DESC NULLS LAST
      `;
    } else if (req.user.role === "industry") {
      query = `
        SELECT
          c.id, c.created_at,
          s.id AS stakeholder_id, s.organization_name, s.organization_type, s.user_id AS stakeholder_user_id,
          (
            SELECT m.content FROM messages m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC LIMIT 1
          ) AS last_message,
          (
            SELECT m.created_at FROM messages m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC LIMIT 1
          ) AS last_message_at,
          (
            SELECT COUNT(*) FROM messages m
            WHERE m.conversation_id = c.id AND m.is_read = false AND m.sender_id != $1
          ) AS unread_count
        FROM conversations c
        JOIN industries i ON i.id = c.industry_id
        JOIN stakeholders s ON s.id = c.stakeholder_id
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

// ── GET MESSAGES FOR A CONVERSATION ──
router.get("/conversations/:id/messages", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const authorized = await userInConversation(req.user.id, id);
    if (!authorized) {
      return res.status(403).json({ message: "Not authorized to access this conversation" });
    }

    const result = await pool.query(`
      SELECT
        m.id, m.content, m.file_url, m.file_name, m.is_read, m.created_at,
        m.sender_id,
        u.email AS sender_email,
        u.role AS sender_role,
        COALESCE(i.company_name, s.organization_name) AS sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      LEFT JOIN industries i ON i.user_id = u.id
      LEFT JOIN stakeholders s ON s.user_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `, [id]);

    // Mark messages as read for requesting user
    await pool.query(`
      UPDATE messages SET is_read = true
      WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false
    `, [id, req.user.id]);

    res.json(result.rows);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── SEND MESSAGE (REST fallback) ──
router.post("/conversations/:id/messages", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ message: "Message content is required" });
  }

  try {
    const authorized = await userInConversation(req.user.id, id);
    if (!authorized) {
      return res.status(403).json({ message: "Not authorized to access this conversation" });
    }

    // Check message limit for free stakeholders
    if (req.user.role === "stakeholder") {
      const userRes = await pool.query(
        `SELECT is_subscribed, subscription_expires_at,
                messages_used_this_month, messages_month_reset_at
         FROM users WHERE id = $1`,
        [req.user.id]
      );
      const user = userRes.rows[0] || {};
      const subType = resolveSubType(user);

      if (subType === "free") {
        // Reset counter if new month
        const resetAt = user.messages_month_reset_at ? new Date(user.messages_month_reset_at) : new Date(0);
        const now = new Date();
        let used = user.messages_used_this_month || 0;
        if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
          await pool.query(
            "UPDATE users SET messages_used_this_month = 0, messages_month_reset_at = NOW() WHERE id = $1",
            [req.user.id]
          );
          used = 0;
        }

        if (used >= FREE_MESSAGES_LIMIT) {
          return res.status(402).json({
            message: `Free plan allows ${FREE_MESSAGES_LIMIT} messages per month. Upgrade to Premium for unlimited messaging.`,
            requires_subscription: true,
            messages_used: used,
            messages_limit: FREE_MESSAGES_LIMIT,
          });
        }

        // Increment counter
        await pool.query(
          "UPDATE users SET messages_used_this_month = messages_used_this_month + 1 WHERE id = $1",
          [req.user.id]
        );
      }
    }

    const result = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [id, req.user.id, content.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── CREATE OR GET CONVERSATION ──
router.post("/conversations/create", authenticateToken, async (req, res) => {
  const { stakeholder_id, industry_id } = req.body;

  if (!stakeholder_id || !industry_id) {
    return res.status(400).json({ message: "stakeholder_id and industry_id are required" });
  }

  try {
    // Check if conversation already exists
    const existing = await pool.query(
      `SELECT id FROM conversations WHERE stakeholder_id = $1 AND industry_id = $2`,
      [stakeholder_id, industry_id]
    );

    if (existing.rows.length > 0) {
      return res.json({ conversation_id: existing.rows[0].id, created: false });
    }

    // Create new conversation
    const result = await pool.query(
      `INSERT INTO conversations (stakeholder_id, industry_id)
       VALUES ($1, $2) RETURNING id`,
      [stakeholder_id, industry_id]
    );

    res.status(201).json({ conversation_id: result.rows[0].id, created: true });
  } catch (error) {
    console.error("Create conversation error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
