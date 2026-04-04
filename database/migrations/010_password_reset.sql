-- Migration 010: Password reset tokens
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
