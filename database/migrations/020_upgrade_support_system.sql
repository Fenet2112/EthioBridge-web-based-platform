-- Migration: Upgrade Contact System to Support Tickets
-- Description: Add support ticket features with user tracking, reply capability, and status management
-- This migration enhances the existing contact_messages table

-- 1. Add subject column (optional, can be auto-generated)
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS subject VARCHAR(255);

-- 2. Add admin_reply column for storing admin responses
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS admin_reply TEXT;

-- 3. Update status values to be more meaningful for support tickets
-- First, drop the existing CHECK constraint (PostgreSQL requires this)
ALTER TABLE contact_messages DROP CONSTRAINT IF EXISTS contact_messages_status_check;

-- 4. Add new status values: pending, in_progress, resolved
ALTER TABLE contact_messages ADD COLUMN status_new VARCHAR(50) 
  DEFAULT 'pending' 
  CHECK (status_new IN ('pending', 'in_progress', 'replied', 'resolved'));

-- 5. Copy existing status to new column with mapping
UPDATE contact_messages SET status_new = 
  CASE 
    WHEN status = 'unread' THEN 'pending'
    WHEN status = 'read' THEN 'in_progress'
    WHEN status = 'replied' THEN 'replied'
    WHEN status = 'archived' THEN 'resolved'
    ELSE 'pending'
  END;

-- 6. Rename the column
ALTER TABLE contact_messages DROP COLUMN status;
ALTER TABLE contact_messages RENAME COLUMN status_new TO status;

-- 7. Add updated_at timestamp
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 8. Add notification tracking
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS user_notified BOOLEAN DEFAULT FALSE;
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP;

-- 9. Add priority field
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS priority VARCHAR(20) 
  DEFAULT 'normal' 
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

-- 10. Create notification table for in-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  reference_id INTEGER,
  reference_type VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- 11. Create support_tickets view for easier querying
CREATE OR REPLACE VIEW support_tickets_view AS
SELECT 
  cm.id,
  cm.first_name,
  cm.last_name,
  cm.email,
  cm.phone,
  cm.role,
  cm.subject,
  cm.message,
  cm.admin_reply,
  cm.source,
  cm.status,
  cm.priority,
  cm.user_id,
  cm.created_at,
  cm.updated_at,
  cm.read_at,
  cm.replied_at,
  cm.user_notified,
  CASE 
    WHEN cm.status = 'pending' THEN 'Waiting for review'
    WHEN cm.status = 'in_progress' THEN 'Being looked into'
    WHEN cm.status = 'replied' THEN 'Awaiting your response'
    WHEN cm.status = 'resolved' THEN 'Completed'
    ELSE 'Unknown'
  END AS status_label
FROM contact_messages cm;

-- Add comments
COMMENT ON TABLE notifications IS 'In-app notifications for users';
COMMENT ON COLUMN contact_messages.status IS 'Support ticket status: pending, in_progress, replied, resolved';
COMMENT ON COLUMN contact_messages.admin_reply IS 'Admin response to the user message';
COMMENT ON COLUMN contact_messages.priority IS 'Message priority: low, normal, high, urgent';

-- 12. Add foreign key constraint for user_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'contact_messages_user_id_fkey'
  ) THEN
    ALTER TABLE contact_messages 
    ADD CONSTRAINT contact_messages_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 13. Create a function to auto-generate subject from message if not provided
CREATE OR REPLACE FUNCTION set_default_subject()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.subject IS NULL OR NEW.subject = '' THEN
    NEW.subject := CASE 
      WHEN NEW.source = 'contact' THEN 'Contact Us: ' || LEFT(NEW.message, 50)
      WHEN NEW.source = 'help' THEN 'Help Request: ' || LEFT(NEW.message, 50)
      ELSE 'Support Request'
    END;
    IF LENGTH(NEW.message) > 50 THEN
      NEW.subject := NEW.subject || '...';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-set subject
DROP TRIGGER IF EXISTS set_default_subject_trigger ON contact_messages;
CREATE TRIGGER set_default_subject_trigger
BEFORE INSERT OR UPDATE ON contact_messages
FOR EACH ROW
EXECUTE FUNCTION set_default_subject();