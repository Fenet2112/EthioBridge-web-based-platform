-- Migration 007: Unique product name per industry (case-insensitive)

-- Add normalized name column
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS name_normalized VARCHAR(255)
    GENERATED ALWAYS AS (LOWER(TRIM(name))) STORED;

-- Unique constraint: one product name per industry (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_industry_name
  ON products (industry_id, name_normalized);
