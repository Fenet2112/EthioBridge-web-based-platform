-- Migration 014: Fix pending status for users with completed profiles
-- This ensures that users who have completed their profiles are marked as pending

-- Update industries with completed profiles to pending status
UPDATE users u
SET status = 'pending'
FROM industries i
WHERE i.user_id = u.id
  AND u.status = 'incomplete'
  AND i.company_name IS NOT NULL
  AND i.company_name != ''
  AND i.sector IS NOT NULL
  AND i.sector != ''
  AND i.location IS NOT NULL
  AND i.location != '';

-- Update stakeholders with completed profiles to pending status
UPDATE users u
SET status = 'pending'
FROM stakeholders s
WHERE s.user_id = u.id
  AND u.status = 'incomplete'
  AND s.organization_name IS NOT NULL
  AND s.organization_name != ''
  AND s.organization_type IS NOT NULL
  AND s.organization_type != ''
  AND s.location IS NOT NULL
  AND s.location != '';

-- Log the changes
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM users
  WHERE status = 'pending';
  
  RAISE NOTICE 'Total users with pending status: %', updated_count;
END $$;
