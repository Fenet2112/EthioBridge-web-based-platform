-- Migration: Add approval workflow configuration
-- This allows admins to configure automatic, manual, or conditional approval workflows

CREATE TABLE IF NOT EXISTS approval_workflows (
  id SERIAL PRIMARY KEY,
  workflow_type VARCHAR(50) NOT NULL UNIQUE, -- 'stakeholder_registration', 'industry_registration', 'purchase_request'
  mode VARCHAR(20) NOT NULL DEFAULT 'manual', -- 'automatic', 'manual', 'conditional'
  conditions JSONB DEFAULT '{}', -- For conditional approval rules
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default workflows (manual approval for all)
INSERT INTO approval_workflows (workflow_type, mode) VALUES
  ('stakeholder_registration', 'manual'),
  ('industry_registration', 'manual'),
  ('purchase_request', 'manual')
ON CONFLICT (workflow_type) DO NOTHING;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_approval_workflows_type ON approval_workflows(workflow_type);
