-- Migration 009: Email verification fields

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP;

-- Mark existing approved/pending users as already verified (don't break existing accounts)
UPDATE users SET email_verified = TRUE
WHERE status IN ('approved', 'pending', 'incomplete');
