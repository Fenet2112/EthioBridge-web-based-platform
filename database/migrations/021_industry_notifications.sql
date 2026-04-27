-- ═══════════════════════════════════════════════════════════
-- MIGRATION 021: Industry Notifications System
-- ═══════════════════════════════════════════════════════════

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  message      TEXT NOT NULL,
  type         VARCHAR(50) NOT NULL CHECK (type IN ('request', 'approval', 'system', 'message')),
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  reference_id INTEGER,          -- optional: purchase_request id, conversation id, etc.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast per-user queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id     ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at  ON notifications(created_at DESC);
