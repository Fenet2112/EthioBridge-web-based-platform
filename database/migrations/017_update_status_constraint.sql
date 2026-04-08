-- Migration: Update users status constraint to include suspended and banned
-- Purpose: Allow admin to suspend and ban users

-- Drop the old constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;

-- Add new constraint with all valid statuses
ALTER TABLE users ADD CONSTRAINT users_status_check 
CHECK (status IN ('incomplete', 'pending', 'approved', 'rejected', 'verified', 'suspended', 'banned'));

-- Add comment for documentation
COMMENT ON CONSTRAINT users_status_check ON users IS 
'Valid user statuses: incomplete, pending, approved, rejected, verified, suspended, banned';
