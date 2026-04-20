const pool = require('./src/config/db');

const sql = `
  CREATE TABLE IF NOT EXISTS approval_workflows (
    id SERIAL PRIMARY KEY,
    workflow_type VARCHAR(50) UNIQUE NOT NULL,
    mode VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (mode IN ('manual','automatic','conditional')),
    conditions JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  INSERT INTO approval_workflows (workflow_type, mode) VALUES
    ('industry_registration','manual'),
    ('stakeholder_registration','manual'),
    ('purchase_request','manual')
  ON CONFLICT (workflow_type) DO NOTHING;
  CREATE TABLE IF NOT EXISTS approval_logs (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    decision VARCHAR(20) NOT NULL,
    mode VARCHAR(20) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_approval_logs_entity ON approval_logs(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_approval_logs_created ON approval_logs(created_at DESC);
`;

pool.query(sql)
  .then(() => { console.log('✅ Approval workflow migration complete'); process.exit(0); })
  .catch(e => { console.error('❌', e.message); process.exit(1); });
