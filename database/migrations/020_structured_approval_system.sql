-- Migration: Structured Approval System with Multiple Validation Criteria
-- Description: Implement comprehensive approval system with scoring and criteria validation

-- ═══════════════════════════════════════════════════════════
-- APPROVAL CRITERIA TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS approval_criteria (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL, -- 'user', 'industry', 'purchase_request'
  entity_id INTEGER NOT NULL,
  criteria_type VARCHAR(100) NOT NULL, -- 'email_verification', 'profile_completeness', etc.
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'passed', 'failed', 'pending', 'manual_review'
  score INTEGER DEFAULT 0, -- 0-100 score for this criteria
  weight DECIMAL(3,2) DEFAULT 1.0, -- Weight multiplier for final score
  details JSONB DEFAULT '{}', -- Additional validation details
  checked_at TIMESTAMP,
  checked_by INTEGER, -- Admin user ID if manually checked
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════
-- APPROVAL SCORES TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS approval_scores (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER NOT NULL,
  total_score DECIMAL(5,2) DEFAULT 0, -- Weighted total score
  max_possible_score DECIMAL(5,2) DEFAULT 100,
  score_percentage DECIMAL(5,2) DEFAULT 0, -- Calculated percentage
  auto_approval_threshold DECIMAL(5,2) DEFAULT 80, -- Auto-approve if score >= this
  auto_rejection_threshold DECIMAL(5,2) DEFAULT 30, -- Auto-reject if score <= this
  final_status VARCHAR(20) DEFAULT 'pending', -- 'auto_approved', 'auto_rejected', 'manual_review', 'approved', 'rejected'
  recommendation VARCHAR(20), -- 'approve', 'reject', 'review'
  risk_level VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high'
  fraud_indicators JSONB DEFAULT '[]', -- Array of detected fraud indicators
  last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,
  approved_by INTEGER, -- Admin user ID
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(entity_type, entity_id)
);

-- ═══════════════════════════════════════════════════════════
-- APPROVAL RULES TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS approval_rules (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  rule_name VARCHAR(100) NOT NULL,
  rule_type VARCHAR(50) NOT NULL, -- 'required', 'scoring', 'validation', 'fraud_detection'
  condition_sql TEXT, -- SQL condition to check
  score_points INTEGER DEFAULT 0, -- Points awarded if condition passes
  weight DECIMAL(3,2) DEFAULT 1.0,
  is_required BOOLEAN DEFAULT false, -- If true, failure blocks approval
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  error_message TEXT, -- Message shown when rule fails
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════
-- FRAUD DETECTION LOG
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fraud_detection_log (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER NOT NULL,
  detection_type VARCHAR(100) NOT NULL, -- 'duplicate_email', 'suspicious_pattern', etc.
  severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  details JSONB DEFAULT '{}',
  is_resolved BOOLEAN DEFAULT false,
  resolved_by INTEGER, -- Admin user ID
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════
-- INDEXES FOR PERFORMANCE
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_approval_criteria_entity ON approval_criteria(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_criteria_status ON approval_criteria(status);
CREATE INDEX IF NOT EXISTS idx_approval_criteria_type ON approval_criteria(criteria_type);

CREATE INDEX IF NOT EXISTS idx_approval_scores_entity ON approval_scores(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_scores_status ON approval_scores(final_status);
CREATE INDEX IF NOT EXISTS idx_approval_scores_risk ON approval_scores(risk_level);

CREATE INDEX IF NOT EXISTS idx_approval_rules_entity ON approval_rules(entity_type);
CREATE INDEX IF NOT EXISTS idx_approval_rules_active ON approval_rules(is_active);

CREATE INDEX IF NOT EXISTS idx_fraud_log_entity ON fraud_detection_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_fraud_log_severity ON fraud_detection_log(severity);
CREATE INDEX IF NOT EXISTS idx_fraud_log_resolved ON fraud_detection_log(is_resolved);

-- ═══════════════════════════════════════════════════════════
-- INSERT DEFAULT APPROVAL RULES
-- ═══════════════════════════════════════════════════════════

-- User Registration Rules
INSERT INTO approval_rules (entity_type, rule_name, rule_type, condition_sql, score_points, weight, is_required, description, error_message) VALUES
-- Email Verification
('user', 'email_verified', 'required', 'SELECT email_verified FROM users WHERE id = $1', 25, 1.0, true, 'Email must be verified', 'Email verification required'),
('user', 'valid_email_domain', 'scoring', 'SELECT CASE WHEN email ~ ''^[^@]+@[^@]+\.[^@]+$'' AND email NOT LIKE ''%temp%'' AND email NOT LIKE ''%fake%'' THEN 1 ELSE 0 END FROM users WHERE id = $1', 10, 1.0, false, 'Valid email domain check', 'Suspicious email domain detected'),

-- Profile Completeness
('user', 'profile_complete_stakeholder', 'scoring', 'SELECT CASE WHEN s.organization_name IS NOT NULL AND s.contact_person IS NOT NULL AND s.phone IS NOT NULL AND s.location IS NOT NULL THEN 1 ELSE 0 END FROM users u LEFT JOIN stakeholders s ON s.user_id = u.id WHERE u.id = $1 AND u.role = ''stakeholder''', 20, 1.0, false, 'Stakeholder profile completeness', 'Complete profile information required'),
('user', 'profile_complete_industry', 'scoring', 'SELECT CASE WHEN i.company_name IS NOT NULL AND i.sector IS NOT NULL AND i.location IS NOT NULL AND i.phone IS NOT NULL THEN 1 ELSE 0 END FROM users u LEFT JOIN industries i ON i.user_id = u.id WHERE u.id = $1 AND u.role = ''industry''', 20, 1.0, false, 'Industry profile completeness', 'Complete company information required'),

-- Fraud Detection
('user', 'no_duplicate_email', 'validation', 'SELECT CASE WHEN COUNT(*) = 1 THEN 1 ELSE 0 END FROM users WHERE email = (SELECT email FROM users WHERE id = $1)', 15, 1.0, true, 'No duplicate email addresses', 'Email address already registered'),
('user', 'registration_time_normal', 'scoring', 'SELECT CASE WHEN EXTRACT(EPOCH FROM (NOW() - created_at)) > 300 THEN 1 ELSE 0 END FROM users WHERE id = $1', 5, 1.0, false, 'Normal registration time (not too fast)', 'Registration completed too quickly'),

-- Industry-Specific Rules
('industry', 'has_products', 'scoring', 'SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END FROM products p JOIN industries i ON i.id = p.industry_id WHERE i.user_id = $1', 20, 1.0, false, 'Industry has product listings', 'No products listed'),
('industry', 'valid_location_coordinates', 'scoring', 'SELECT CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 THEN 1 ELSE 0 END FROM industries WHERE user_id = $1', 10, 1.0, false, 'Valid GPS coordinates', 'Invalid or missing location coordinates'),
('industry', 'established_year_valid', 'scoring', 'SELECT CASE WHEN established_year IS NOT NULL AND established_year BETWEEN 1900 AND EXTRACT(YEAR FROM NOW()) THEN 1 ELSE 0 END FROM industries WHERE user_id = $1', 5, 1.0, false, 'Valid establishment year', 'Invalid establishment year'),
('industry', 'no_duplicate_company', 'validation', 'SELECT CASE WHEN COUNT(*) = 1 THEN 1 ELSE 0 END FROM industries WHERE company_name = (SELECT company_name FROM industries WHERE user_id = $1)', 15, 1.0, true, 'No duplicate company names', 'Company name already registered'),

-- Purchase Request Rules
('purchase_request', 'stakeholder_approved', 'required', 'SELECT CASE WHEN u.status = ''approved'' THEN 1 ELSE 0 END FROM purchase_requests pr JOIN stakeholders s ON s.id = pr.stakeholder_id JOIN users u ON u.id = s.user_id WHERE pr.id = $1', 30, 1.0, true, 'Stakeholder must be approved', 'Stakeholder account not approved'),
('purchase_request', 'product_available', 'required', 'SELECT CASE WHEN p.is_available = true THEN 1 ELSE 0 END FROM purchase_requests pr JOIN products p ON p.id = pr.product_id WHERE pr.id = $1', 25, 1.0, true, 'Product must be available', 'Product is not available'),
('purchase_request', 'valid_quantity', 'scoring', 'SELECT CASE WHEN pr.quantity > 0 AND pr.quantity <= 10000 THEN 1 ELSE 0 END FROM purchase_requests pr WHERE pr.id = $1', 10, 1.0, false, 'Reasonable quantity requested', 'Invalid quantity requested'),
('purchase_request', 'has_contact_info', 'scoring', 'SELECT CASE WHEN pr.phone IS NOT NULL AND pr.location IS NOT NULL AND pr.full_name IS NOT NULL THEN 1 ELSE 0 END FROM purchase_requests pr WHERE pr.id = $1', 15, 1.0, false, 'Complete contact information', 'Contact information incomplete'),
('purchase_request', 'identity_verified', 'scoring', 'SELECT CASE WHEN s.identity_verified = true OR pr.id_document_url IS NOT NULL THEN 1 ELSE 0 END FROM purchase_requests pr JOIN stakeholders s ON s.id = pr.stakeholder_id WHERE pr.id = $1', 20, 1.0, false, 'Identity verification provided', 'Identity verification required')

ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- FUNCTIONS FOR APPROVAL SYSTEM
-- ═══════════════════════════════════════════════════════════

-- Function to calculate approval score for an entity
CREATE OR REPLACE FUNCTION calculate_approval_score(p_entity_type VARCHAR, p_entity_id INTEGER)
RETURNS JSONB AS $$
DECLARE
  rule_record RECORD;
  total_score DECIMAL := 0;
  max_score DECIMAL := 0;
  passed_required BOOLEAN := true;
  fraud_indicators JSONB := '[]'::JSONB;
  result_details JSONB := '{}'::JSONB;
  rule_result INTEGER;
BEGIN
  -- Clear existing criteria for this entity
  DELETE FROM approval_criteria WHERE entity_type = p_entity_type AND entity_id = p_entity_id;
  
  -- Process each rule for this entity type
  FOR rule_record IN 
    SELECT * FROM approval_rules 
    WHERE entity_type = p_entity_type AND is_active = true 
    ORDER BY is_required DESC, score_points DESC
  LOOP
    -- Execute the rule condition
    BEGIN
      EXECUTE rule_record.condition_sql INTO rule_result USING p_entity_id;
      
      -- Insert criteria record
      INSERT INTO approval_criteria (
        entity_type, entity_id, criteria_type, status, score, weight, 
        details, checked_at, notes
      ) VALUES (
        p_entity_type, p_entity_id, rule_record.rule_name,
        CASE WHEN rule_result = 1 THEN 'passed' ELSE 'failed' END,
        CASE WHEN rule_result = 1 THEN rule_record.score_points ELSE 0 END,
        rule_record.weight,
        jsonb_build_object('rule_id', rule_record.id, 'result', rule_result),
        NOW(),
        CASE WHEN rule_result = 0 THEN rule_record.error_message ELSE 'Passed' END
      );
      
      -- Update totals
      IF rule_result = 1 THEN
        total_score := total_score + (rule_record.score_points * rule_record.weight);
      ELSE
        -- Check if required rule failed
        IF rule_record.is_required THEN
          passed_required := false;
        END IF;
        
        -- Add to fraud indicators if validation rule failed
        IF rule_record.rule_type = 'validation' THEN
          fraud_indicators := fraud_indicators || jsonb_build_object(
            'type', rule_record.rule_name,
            'message', rule_record.error_message,
            'severity', 'medium'
          );
        END IF;
      END IF;
      
      max_score := max_score + (rule_record.score_points * rule_record.weight);
      
    EXCEPTION WHEN OTHERS THEN
      -- Log rule execution error
      INSERT INTO approval_criteria (
        entity_type, entity_id, criteria_type, status, score, weight,
        details, checked_at, notes
      ) VALUES (
        p_entity_type, p_entity_id, rule_record.rule_name, 'failed', 0, rule_record.weight,
        jsonb_build_object('error', SQLERRM),
        NOW(),
        'Rule execution failed: ' || SQLERRM
      );
    END;
  END LOOP;
  
  -- Calculate final score and recommendation
  DECLARE
    score_percentage DECIMAL := CASE WHEN max_score > 0 THEN (total_score / max_score) * 100 ELSE 0 END;
    recommendation VARCHAR := 'review';
    risk_level VARCHAR := 'medium';
    final_status VARCHAR := 'manual_review';
  BEGIN
    -- Determine recommendation
    IF NOT passed_required THEN
      recommendation := 'reject';
      risk_level := 'high';
      final_status := 'auto_rejected';
    ELSIF score_percentage >= 80 THEN
      recommendation := 'approve';
      risk_level := 'low';
      final_status := 'auto_approved';
    ELSIF score_percentage <= 30 THEN
      recommendation := 'reject';
      risk_level := 'high';
      final_status := 'auto_rejected';
    ELSE
      recommendation := 'review';
      risk_level := CASE 
        WHEN score_percentage >= 60 THEN 'medium'
        ELSE 'high'
      END;
      final_status := 'manual_review';
    END IF;
    
    -- Insert or update approval score
    INSERT INTO approval_scores (
      entity_type, entity_id, total_score, max_possible_score, score_percentage,
      final_status, recommendation, risk_level, fraud_indicators, last_calculated_at
    ) VALUES (
      p_entity_type, p_entity_id, total_score, max_score, score_percentage,
      final_status, recommendation, risk_level, fraud_indicators, NOW()
    )
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
      total_score = EXCLUDED.total_score,
      max_possible_score = EXCLUDED.max_possible_score,
      score_percentage = EXCLUDED.score_percentage,
      final_status = EXCLUDED.final_status,
      recommendation = EXCLUDED.recommendation,
      risk_level = EXCLUDED.risk_level,
      fraud_indicators = EXCLUDED.fraud_indicators,
      last_calculated_at = EXCLUDED.last_calculated_at,
      updated_at = NOW();
    
    -- Return result summary
    result_details := jsonb_build_object(
      'total_score', total_score,
      'max_score', max_score,
      'percentage', score_percentage,
      'recommendation', recommendation,
      'risk_level', risk_level,
      'final_status', final_status,
      'passed_required', passed_required,
      'fraud_indicators', fraud_indicators
    );
    
    RETURN result_details;
  END;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- TRIGGERS FOR AUTOMATIC SCORE CALCULATION
-- ═══════════════════════════════════════════════════════════

-- Trigger function to recalculate scores when relevant data changes
CREATE OR REPLACE FUNCTION trigger_recalculate_approval_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Determine entity type and ID based on table
  IF TG_TABLE_NAME = 'users' THEN
    PERFORM calculate_approval_score('user', NEW.id);
    IF NEW.role = 'industry' THEN
      PERFORM calculate_approval_score('industry', NEW.id);
    END IF;
  ELSIF TG_TABLE_NAME = 'industries' THEN
    PERFORM calculate_approval_score('industry', NEW.user_id);
  ELSIF TG_TABLE_NAME = 'stakeholders' THEN
    PERFORM calculate_approval_score('user', NEW.user_id);
  ELSIF TG_TABLE_NAME = 'purchase_requests' THEN
    PERFORM calculate_approval_score('purchase_request', NEW.id);
  ELSIF TG_TABLE_NAME = 'products' THEN
    -- Recalculate for the industry when products change
    PERFORM calculate_approval_score('industry', (SELECT user_id FROM industries WHERE id = NEW.industry_id));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers (only if they don't exist)
DO $$
BEGIN
  -- Users table trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_users_approval_score') THEN
    CREATE TRIGGER trigger_users_approval_score
      AFTER INSERT OR UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_approval_score();
  END IF;
  
  -- Industries table trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_industries_approval_score') THEN
    CREATE TRIGGER trigger_industries_approval_score
      AFTER INSERT OR UPDATE ON industries
      FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_approval_score();
  END IF;
  
  -- Stakeholders table trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_stakeholders_approval_score') THEN
    CREATE TRIGGER trigger_stakeholders_approval_score
      AFTER INSERT OR UPDATE ON stakeholders
      FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_approval_score();
  END IF;
  
  -- Purchase requests table trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_purchase_requests_approval_score') THEN
    CREATE TRIGGER trigger_purchase_requests_approval_score
      AFTER INSERT OR UPDATE ON purchase_requests
      FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_approval_score();
  END IF;
  
  -- Products table trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_products_approval_score') THEN
    CREATE TRIGGER trigger_products_approval_score
      AFTER INSERT OR UPDATE ON products
      FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_approval_score();
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- COMMENTS FOR DOCUMENTATION
-- ═══════════════════════════════════════════════════════════

COMMENT ON TABLE approval_criteria IS 'Individual validation criteria results for entities';
COMMENT ON TABLE approval_scores IS 'Calculated approval scores and recommendations for entities';
COMMENT ON TABLE approval_rules IS 'Configurable rules for approval validation and scoring';
COMMENT ON TABLE fraud_detection_log IS 'Log of detected fraud indicators and suspicious activities';

COMMENT ON FUNCTION calculate_approval_score(VARCHAR, INTEGER) IS 'Calculate comprehensive approval score for any entity type';
COMMENT ON FUNCTION trigger_recalculate_approval_score() IS 'Trigger function to automatically recalculate scores when data changes';