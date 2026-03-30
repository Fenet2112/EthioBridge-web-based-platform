-- Full freemium subscription system
-- Add subscription_type column
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_type VARCHAR(20) NOT NULL DEFAULT 'free'
  CHECK (subscription_type IN ('free', 'premium'));

-- Sync existing subscribed users
UPDATE users SET subscription_type = 'premium'
WHERE is_subscribed = true
  AND (subscription_expires_at IS NULL OR subscription_expires_at > NOW());

-- Message usage tracking (per calendar month)
ALTER TABLE users ADD COLUMN IF NOT EXISTS messages_used_this_month INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS messages_month_reset_at TIMESTAMP DEFAULT NOW();

-- Analytics tracking for industries
CREATE TABLE IF NOT EXISTS industry_analytics (
  id SERIAL PRIMARY KEY,
  industry_id INTEGER REFERENCES industries(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'profile_view', 'product_click', 'purchase_request'
  visitor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_industry ON industry_analytics(industry_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON industry_analytics(created_at);
