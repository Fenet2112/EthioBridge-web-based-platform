/**
 * createNotification – shared helper to insert a notification row.
 *
 * Usage:
 *   const { createNotification } = require('../utils/createNotification');
 *   await createNotification(pool, userId, 'New Purchase Request', 'message…', 'request', requestId);
 *
 * @param {Pool}   pool         – pg Pool instance
 * @param {number} userId       – industry user's users.id
 * @param {string} title        – short title
 * @param {string} message      – full message body
 * @param {string} type         – 'request' | 'approval' | 'system' | 'message'
 * @param {number} [referenceId] – optional related entity id
 */
async function createNotification(pool, userId, title, message, type = 'system', referenceId = null) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, reference_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, title, message, type, referenceId]
    );
    console.log(`[Notification] Created for user ${userId}: ${title}`);
  } catch (err) {
    // Non-fatal – log but don't crash the calling route
    console.error('[Notification] Failed to create notification:', err.message);
  }
}

module.exports = { createNotification };
