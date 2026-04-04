-- Migration 012: Make stakeholder org fields optional
-- so new users can set profile photo/username/bio before submitting org profile

ALTER TABLE stakeholders
  ALTER COLUMN organization_name DROP NOT NULL,
  ALTER COLUMN organization_type DROP NOT NULL,
  ALTER COLUMN location DROP NOT NULL;
