-- Add profile fields to stakeholders table
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(500);

-- Create index for username lookups
CREATE INDEX IF NOT EXISTS idx_stakeholders_username ON stakeholders(username);

-- Add profile fields to industries table as well (for consistency)
ALTER TABLE industries ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;
ALTER TABLE industries ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE industries ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE industries ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_industries_username ON industries(username);
