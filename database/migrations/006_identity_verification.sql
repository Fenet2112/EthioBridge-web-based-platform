-- Migration 006: Identity verification for purchase requests

-- Add id_document_url to purchase_requests
ALTER TABLE purchase_requests
  ADD COLUMN IF NOT EXISTS id_document_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS id_document_type VARCHAR(100);

-- Add pending_verification to purchase_requests status
ALTER TABLE purchase_requests
  DROP CONSTRAINT IF EXISTS purchase_requests_status_check;

ALTER TABLE purchase_requests
  ADD CONSTRAINT purchase_requests_status_check
  CHECK (status IN ('pending', 'pending_verification', 'approved', 'rejected'));

-- Add verified status to users
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE users
  ADD CONSTRAINT users_status_check
  CHECK (status IN ('incomplete', 'pending', 'approved', 'rejected', 'verified'));

-- Track whether a stakeholder has already been verified (so future requests skip ID upload)
ALTER TABLE stakeholders
  ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMP;
