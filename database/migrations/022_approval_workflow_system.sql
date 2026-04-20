-- ═══════════════════════════════════════════════════════════
-- MIGRATION 022: Approval Workflow System
-- ═══════════════════════════════════════════════════════════

-- Ensure approval_workflows table exists with all 3 types
CREATE TABLE IF NOT EXISTS approval_workflows (
  id            SERIAL PRIMARY KEY,
  workflow_type VARCHAR(50) UNIQUE NOT NULL,
  mode          VARCHAR(20) NOT NULL DEFAULT 'manual'
                  CHECK (mode IN ('manual', 'automatic', 'conditional')),
  conditions    JSONB NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the 3 workflow types (do nothing if they already exist)
INSERT INTO approval_workflows (workflow_type, mode) VALUES
  ('industry_registration',    'manual'),
  ('stakeholder_registration',  'manual'),
  ('purchase_request',          'manual')
ON CONFLICT (workflow_type) DO NOTHING;

-- Approval decision log
CREATE TABLE IF NOT EXISTS approval_logs (
  id          SERIAL PRIMARY KEY,
  entity_type VARCHAR(50)  NOT NULL,  -- 'industry' | 'stakeholder' | 'purchase_request'
  entity_id   INTEGER      NOT NULL,
  decision    VARCHAR(20)  NOT NULL,  -- 'approved' | 'rejected' | 'pending'
  mode        VARCHAR(20)  NOT NULL,  -- 'manual' | 'automatic' | 'conditional'
  reason      TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_logs_entity ON approval_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_logs_created ON approval_logs(created_at DESC);
