-- Migration 015: Change signup status from 'incomplete' to 'pending'
-- This ensures all newly registered users appear in admin approval section immediately

-- Update all existing users with 'incomplete' status to 'pending'
UPDATE users
SET status = 'pending'
WHERE status = 'incomplete';

-- Add comment to document the change
COMMENT ON COLUMN users.status IS 'User account status: pending (awaiting approval), approved (active), rejected (denied), suspended (temporarily blocked), banned (permanently blocked)';

-- Log the changes
DO $$
DECLARE
  pending_count INTEGER;
  approved_count INTEGER;
  rejected_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO pending_count FROM users WHERE status = 'pending';
  SELECT COUNT(*) INTO approved_count FROM users WHERE status = 'approved';
  SELECT COUNT(*) INTO rejected_count FROM users WHERE status = 'rejected';
  
  RAISE NOTICE '=== User Status Summary ===';
  RAISE NOTICE 'Pending: %', pending_count;
  RAISE NOTICE 'Approved: %', approved_count;
  RAISE NOTICE 'Rejected: %', rejected_count;
  RAISE NOTICE '==========================';
END $$;
