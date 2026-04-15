-- Migration: Add Contact Messages System
-- Description: Store contact form submissions and help requests

CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(100),
  message TEXT NOT NULL,
  source VARCHAR(50) NOT NULL CHECK (source IN ('contact', 'help')),
  status VARCHAR(50) DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied', 'archived')),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP,
  replied_at TIMESTAMP,
  admin_notes TEXT
);

-- Create indexes for better query performance
CREATE INDEX idx_contact_messages_status ON contact_messages(status);
CREATE INDEX idx_contact_messages_source ON contact_messages(source);
CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at DESC);
CREATE INDEX idx_contact_messages_email ON contact_messages(email);

-- Add comment
COMMENT ON TABLE contact_messages IS 'Stores contact form submissions from Contact Us and Help pages';
COMMENT ON COLUMN contact_messages.source IS 'Where the message came from: contact (Contact Us page) or help (Help page)';
COMMENT ON COLUMN contact_messages.status IS 'Message status: unread, read, replied, or archived';
