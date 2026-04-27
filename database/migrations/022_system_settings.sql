-- Migration: System Settings Table
-- Stores global platform configuration (single row)

CREATE TABLE IF NOT EXISTS system_settings (
  id                        SERIAL PRIMARY KEY,
  free_request_limit        INTEGER NOT NULL DEFAULT 1,
  max_products_free         INTEGER NOT NULL DEFAULT 5,
  email_alerts_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  purchase_alerts_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure only one row ever exists
INSERT INTO system_settings (id, free_request_limit, max_products_free)
VALUES (1, 1, 5)
ON CONFLICT (id) DO NOTHING;
