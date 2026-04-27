-- Migration: Advanced Filtering System
-- Description: Add columns and indexes for efficient filtering of products, industries, and users

-- ========================================
-- 1. PRODUCTS TABLE ENHANCEMENTS
-- ========================================

-- Add index on category for faster category filtering
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Add index on price for range queries
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

-- Add index on is_available for availability filtering
CREATE INDEX IF NOT EXISTS idx_products_is_available ON products(is_available);

-- Add index on industry_id for joins
CREATE INDEX IF NOT EXISTS idx_products_industry_id ON products(industry_id);

-- Composite index for common filter combination (category + availability)
CREATE INDEX IF NOT EXISTS idx_products_category_available ON products(category, is_available);

-- Add full-text search support for product name and description
CREATE INDEX IF NOT EXISTS idx_products_name_fts ON products USING GIN(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_products_description_fts ON products USING GIN(to_tsvector('english', description));

-- ========================================
-- 2. INDUSTRIES TABLE ENHANCEMENTS
-- ========================================

-- Add popularity metric (based on purchase requests count, calculated dynamically but can be cached)
ALTER TABLE industries ADD COLUMN IF NOT EXISTS popularity_score INTEGER DEFAULT 0;

-- Add last_activity_at for sorting by recent activity
ALTER TABLE industries ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP;

-- Add index on sector for sector filtering
CREATE INDEX IF NOT EXISTS idx_industries_sector ON industries(sector);

-- Add index on location for location filtering
CREATE INDEX IF NOT EXISTS idx_industries_location ON industries(location);

-- Add index on user_id for joins
CREATE INDEX IF NOT EXISTS idx_industries_user_id ON industries(user_id);

-- Composite index for location + sector queries
CREATE INDEX IF NOT EXISTS idx_industries_location_sector ON industries(location, sector);

-- ========================================
-- 3. USERS/STAKEHOLDERS TABLE ENHANCEMENTS
-- ========================================

-- Add last_login tracking for activity level
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Add login_count for activity metrics
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- Add index on role for role filtering
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Add index on status for status filtering
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Add index on created_at for date-based filtering
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Composite index for role + status queries (common in admin panels)
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);

-- Add index to stakeholders location
CREATE INDEX IF NOT EXISTS idx_stakeholders_location ON stakeholders(location);

-- Add index to stakeholders organization_type
CREATE INDEX IF NOT EXISTS idx_stakeholders_org_type ON stakeholders(organization_type);

-- ========================================
-- 4. PURCHASE REQUESTS (for popularity/activity metrics)
-- ========================================

-- Add index on industry_id for counting products per industry
CREATE INDEX IF NOT EXISTS idx_purchase_requests_industry_id ON purchase_requests(industry_id);

-- Add index on stakeholder_id for activity tracking
CREATE INDEX IF NOT EXISTS idx_purchase_requests_stakeholder_id ON purchase_requests(stakeholder_id);

-- Add index on created_at for date queries
CREATE INDEX IF NOT EXISTS idx_purchase_requests_created_at ON purchase_requests(created_at DESC);

-- ========================================
-- 5. UPDATE POPULARITY SCORES (initial calculation)
-- ========================================

-- Initialize popularity_score based on purchase request count
UPDATE industries i
SET popularity_score = (
  SELECT COUNT(*) 
  FROM purchase_requests pr 
  WHERE pr.industry_id = i.id
)
WHERE EXISTS (
  SELECT 1 FROM purchase_requests pr WHERE pr.industry_id = i.id
);

-- ========================================
-- 6. CREATE FUNCTION FOR DYNAMIC POPULARITY
-- ========================================

-- Function to recalculate popularity scores (can be called periodically)
CREATE OR REPLACE FUNCTION update_industry_popularity()
RETURNS void AS $$
BEGIN
  UPDATE industries i
  SET popularity_score = (
    SELECT COUNT(*) 
    FROM purchase_requests pr 
    WHERE pr.industry_id = i.id
  );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 7. COMMENTS
-- ========================================

COMMENT ON COLUMN industries.popularity_score IS 'Popularity score based on total purchase requests (higher = more popular)';
COMMENT ON COLUMN industries.last_activity_at IS 'Timestamp of last purchase request or user activity';
COMMENT ON COLUMN users.last_login_at IS 'Last login timestamp for activity level calculation';
COMMENT ON COLUMN users.login_count IS 'Total number of logins for activity metrics';
