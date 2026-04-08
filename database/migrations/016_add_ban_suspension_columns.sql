-- Migration: Add ban_reason and suspended_until columns to users table
-- Purpose: Support user suspension and ban functionality with reasons

-- Add ban_reason column to store reason for ban/suspension
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS ban_reason TEXT;

-- Add suspended_until column to store suspension end date
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMP;

-- Add index for querying suspended users
CREATE INDEX IF NOT EXISTS idx_users_suspended_until ON users(suspended_until);

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Add comment for documentation
COMMENT ON COLUMN users.ban_reason IS 'Reason provided by admin for ban or suspension';
COMMENT ON COLUMN users.suspended_until IS 'Date/time when suspension ends (NULL for permanent ban)';
