-- Migration: Add latitude and longitude columns to industries table
-- This allows industries to be displayed on the interactive map

ALTER TABLE industries
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add index for faster geospatial queries
CREATE INDEX IF NOT EXISTS idx_industries_coordinates ON industries(latitude, longitude);

-- Add comment for documentation
COMMENT ON COLUMN industries.latitude IS 'Latitude coordinate for map display (e.g., 9.0320 for Addis Ababa)';
COMMENT ON COLUMN industries.longitude IS 'Longitude coordinate for map display (e.g., 38.7469 for Addis Ababa)';
