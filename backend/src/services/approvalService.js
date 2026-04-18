/**
 * Structured Approval Service
 * Handles comprehensive approval validation with scoring and criteria checking
 */

const pool = require('../config/db');

class ApprovalService {
  /**
   * Calculate approval score for an entity
   * @param {string} entityType - 'user', 'industry', 'purchase_request'
   * @param {number} entityId - Entity ID
   * @returns {Promise<Object>} Approval score details
   */
  static async calculateScore(entityType, entityId) {
    try {
      console.log(`[ApprovalService] Calculating score for ${entityType} ${entityId}`);
      
      const result = await pool.query(
        'SELECT calculate_approval_score($1, $2) as score_data',
        [entityType, entityId]
      );
      
      const scoreData = result.rows[0]?.score_data || {};
      console.log(`[ApprovalService] Score calculated:`, scoreData);
      
      return scoreData;
    } catch (error) {
      console.error(`[ApprovalService] Error calculating score:`, error);
      throw error;
    }
  }

  /**
   * Get detailed approval information for an entity
   * @param {string} entityType 
   * @param {number} entityId 
   * @returns {Promise<Object>} Detailed approval data
   */
  static async getApprovalDetails(entityType, entityId) {
    try {
      // Get approval score
      const scoreResult = await pool.query(`
        SELECT * FROM approval_scores 
        WHERE entity_type = $1 AND entity_id = $2
      `, [entityType, entityId]);

      // Get individual criteria
      const criteriaResult = await pool.query(`
        SELECT ac.*, ar.description, ar.error_message, ar.is_required
        FROM approval_criteria ac
        LEFT JOIN approval_rules ar ON ar.rule_name = ac.criteria_type AND ar.entity_type = ac.entity_type
        WHERE ac.entity_type = $1 AND ac.entity_id = $2
        ORDER BY ar.is_required DESC, ac.score DESC
      `, [entityType, entityId]);

      // Get fraud indicators
      const fraudResult = await pool.query(`
        SELECT * FROM fraud_detection_log 
        WHERE entity_type = $1 AND entity_id = $2 AND is_resolved = false
        ORDER BY severity DESC, created_at DESC
      `, [entityType, entityId]);

      return {
        score: scoreResult.rows[0] || null,
        criteria: criteriaResult.rows || [],
        fraudIndicators: fraudResult.rows || []
      };
    } catch (error) {
      console.error(`[ApprovalService] Error getting approval details:`, error);
      throw error;
    }
  }

  /**
   * Get all entities pending approval with scores
   * @param {string} entityType 
   * @returns {Promise<Array>} Entities pending approval
   */
  static async getPendingApprovals(entityType) {
    try {
      let query, params = [];
      
      if (entityType === 'user') {
        query = `
          SELECT 
            u.id, u.email, u.role, u.status, u.created_at, u.email_verified,
            COALESCE(i.company_name, s.organization_name) as display_name,
            i.sector, s.organization_type,
            aps.total_score, aps.score_percentage, aps.recommendation, 
            aps.risk_level, aps.final_status, aps.fraud_indicators,
            COUNT(CASE WHEN ac.status = 'failed' AND ar.is_required = true THEN 1 END) as failed_required,
            COUNT(CASE WHEN ac.status = 'failed' THEN 1 END) as total_failed,
            COUNT(ac.id) as total_criteria
          FROM users u
          LEFT JOIN industries i ON i.user_id = u.id
          LEFT JOIN stakeholders s ON s.user_id = u.id
          LEFT JOIN approval_scores aps ON aps.entity_type = 'user' AND aps.entity_id = u.id
          LEFT JOIN approval_criteria ac ON ac.entity_type = 'user' AND ac.entity_id = u.id
          LEFT JOIN approval_rules ar ON ar.rule_name = ac.criteria_type AND ar.entity_type = 'user'
          WHERE u.status = 'pending'
          GROUP BY u.id, i.company_name, s.organization_name, i.sector, s.organization_type,
                   aps.total_score, aps.score_percentage, aps.recommendation, aps.risk_level, 
                   aps.final_status, aps.fraud_indicators
          ORDER BY aps.risk_level DESC, aps.score_percentage ASC, u.created_at ASC
        `;
      } else if (entityType === 'purchase_request') {
        query = `
          SELECT 
            pr.id, pr.status, pr.quantity, pr.full_name, pr.organization_name,
            pr.phone, pr.location, pr.created_at, pr.id_document_url,
            p.name as product_name, i.company_name as industry_name,
            u.email as stakeholder_email,
            aps.total_score, aps.score_percentage, aps.recommendation,
            aps.risk_level, aps.final_status, aps.fraud_indicators,
            COUNT(CASE WHEN ac.status = 'failed' AND ar.is_required = true THEN 1 END) as failed_required,
            COUNT(CASE WHEN ac.status = 'failed' THEN 1 END) as total_failed,
            COUNT(ac.id) as total_criteria
          FROM purchase_requests pr
          JOIN products p ON p.id = pr.product_id
          JOIN industries i ON i.id = pr.industry_id
          JOIN stakeholders s ON s.id = pr.stakeholder_id
          JOIN users u ON u.id = s.user_id
          LEFT JOIN approval_scores aps ON aps.entity_type = 'purchase_request' AND aps.entity_id = pr.id
          LEFT JOIN approval_criteria ac ON ac.entity_type = 'purchase_request' AND ac.entity_id = pr.id
          LEFT JOIN approval_rules ar ON ar.rule_name = ac.criteria_type AND ar.entity_type = 'purchase_request'
          WHERE pr.status IN ('pending', 'pending_verification')
          GROUP BY pr.id, p.name, i.company_name, u.email,
                   aps.total_score, aps.score_percentage, aps.recommendation, aps.risk_level,
                   aps.final_status, aps.fraud_indicators
          ORDER BY aps.risk_level DESC, aps.score_percentage ASC, pr.created_at ASC
        `;
      }

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error(`[ApprovalService] Error getting pending approvals:`, error);
      throw error;
    }
  }

  /**
   * Manually approve an entity
   * @param {string} entityType 
   * @param {number} entityId 
   * @param {number} adminId 
   * @param {string} notes 
   * @returns {Promise<Object>} Approval result
   */
  static async manualApprove(entityType, entityId, adminId, notes = '') {
    try {
      console.log(`[ApprovalService] Manual approval: ${entityType} ${entityId} by admin ${adminId}`);
      
      // Update approval score
      await pool.query(`
        UPDATE approval_scores 
        SET final_status = 'approved', approved_at = NOW(), approved_by = $3
        WHERE entity_type = $1 AND entity_id = $2
      `, [entityType, entityId, adminId]);

      // Update the actual entity status
      if (entityType === 'user') {
        await pool.query(
          'UPDATE users SET status = $1 WHERE id = $2',
          ['approved', entityId]
        );
      } else if (entityType === 'purchase_request') {
        await pool.query(
          'UPDATE purchase_requests SET status = $1, admin_notes = $3 WHERE id = $2',
          ['approved', entityId, notes]
        );
      }

      console.log(`[ApprovalService] Manual approval completed`);
      return { success: true, message: 'Entity approved successfully' };
    } catch (error) {
      console.error(`[ApprovalService] Error in manual approval:`, error);
      throw error;
    }
  }

  /**
   * Manually reject an entity
   * @param {string} entityType 
   * @param {number} entityId 
   * @param {number} adminId 
   * @param {string} reason 
   * @returns {Promise<Object>} Rejection result
   */
  static async manualReject(entityType, entityId, adminId, reason) {
    try {
      console.log(`[ApprovalService] Manual rejection: ${entityType} ${entityId} by admin ${adminId}`);
      
      // Update approval score
      await pool.query(`
        UPDATE approval_scores 
        SET final_status = 'rejected', rejection_reason = $4, approved_by = $3, approved_at = NOW()
        WHERE entity_type = $1 AND entity_id = $2
      `, [entityType, entityId, adminId, reason]);

      // Update the actual entity status
      if (entityType === 'user') {
        await pool.query(
          'UPDATE users SET status = $1 WHERE id = $2',
          ['rejected', entityId]
        );
      } else if (entityType === 'purchase_request') {
        await pool.query(
          'UPDATE purchase_requests SET status = $1, admin_notes = $3 WHERE id = $2',
          ['rejected', entityId, reason]
        );
      }

      console.log(`[ApprovalService] Manual rejection completed`);
      return { success: true, message: 'Entity rejected successfully' };
    } catch (error) {
      console.error(`[ApprovalService] Error in manual rejection:`, error);
      throw error;
    }
  }

  /**
   * Process automatic approvals based on scores
   * @param {string} entityType 
   * @returns {Promise<Object>} Processing results
   */
  static async processAutoApprovals(entityType) {
    try {
      console.log(`[ApprovalService] Processing auto approvals for ${entityType}`);
      
      // Get entities eligible for auto approval/rejection
      const result = await pool.query(`
        SELECT entity_id, final_status, score_percentage, recommendation
        FROM approval_scores 
        WHERE entity_type = $1 
        AND final_status IN ('auto_approved', 'auto_rejected')
        AND approved_at IS NULL
      `, [entityType]);

      let approved = 0, rejected = 0;

      for (const row of result.rows) {
        if (row.final_status === 'auto_approved') {
          await this.manualApprove(entityType, row.entity_id, 0, 'Auto-approved by system');
          approved++;
        } else if (row.final_status === 'auto_rejected') {
          await this.manualReject(entityType, row.entity_id, 0, 'Auto-rejected due to failed criteria');
          rejected++;
        }
      }

      console.log(`[ApprovalService] Auto processing completed: ${approved} approved, ${rejected} rejected`);
      return { approved, rejected, total: approved + rejected };
    } catch (error) {
      console.error(`[ApprovalService] Error in auto processing:`, error);
      throw error;
    }
  }

  /**
   * Add fraud indicator
   * @param {string} entityType 
   * @param {number} entityId 
   * @param {string} detectionType 
   * @param {string} severity 
   * @param {Object} details 
   * @returns {Promise<Object>} Fraud log entry
   */
  static async addFraudIndicator(entityType, entityId, detectionType, severity = 'medium', details = {}) {
    try {
      const result = await pool.query(`
        INSERT INTO fraud_detection_log (entity_type, entity_id, detection_type, severity, details)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [entityType, entityId, detectionType, severity, JSON.stringify(details)]);

      // Recalculate score to update fraud indicators
      await this.calculateScore(entityType, entityId);

      return result.rows[0];
    } catch (error) {
      console.error(`[ApprovalService] Error adding fraud indicator:`, error);
      throw error;
    }
  }

  /**
   * Get approval statistics
   * @returns {Promise<Object>} Approval statistics
   */
  static async getApprovalStats() {
    try {
      const [userStats, purchaseStats, fraudStats] = await Promise.all([
        // User approval stats
        pool.query(`
          SELECT 
            final_status,
            risk_level,
            COUNT(*) as count,
            AVG(score_percentage) as avg_score
          FROM approval_scores 
          WHERE entity_type = 'user'
          GROUP BY final_status, risk_level
        `),
        
        // Purchase request stats
        pool.query(`
          SELECT 
            final_status,
            risk_level,
            COUNT(*) as count,
            AVG(score_percentage) as avg_score
          FROM approval_scores 
          WHERE entity_type = 'purchase_request'
          GROUP BY final_status, risk_level
        `),
        
        // Fraud detection stats
        pool.query(`
          SELECT 
            severity,
            is_resolved,
            COUNT(*) as count
          FROM fraud_detection_log
          GROUP BY severity, is_resolved
        `)
      ]);

      return {
        users: userStats.rows,
        purchaseRequests: purchaseStats.rows,
        fraudDetection: fraudStats.rows
      };
    } catch (error) {
      console.error(`[ApprovalService] Error getting stats:`, error);
      throw error;
    }
  }

  /**
   * Update approval rule
   * @param {number} ruleId 
   * @param {Object} updates 
   * @returns {Promise<Object>} Updated rule
   */
  static async updateRule(ruleId, updates) {
    try {
      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      const values = [ruleId, ...Object.values(updates)];
      
      const result = await pool.query(`
        UPDATE approval_rules 
        SET ${setClause}, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, values);

      return result.rows[0];
    } catch (error) {
      console.error(`[ApprovalService] Error updating rule:`, error);
      throw error;
    }
  }

  /**
   * Get all approval rules
   * @param {string} entityType 
   * @returns {Promise<Array>} Approval rules
   */
  static async getRules(entityType = null) {
    try {
      let query = 'SELECT * FROM approval_rules';
      let params = [];
      
      if (entityType) {
        query += ' WHERE entity_type = $1';
        params = [entityType];
      }
      
      query += ' ORDER BY entity_type, is_required DESC, score_points DESC';
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error(`[ApprovalService] Error getting rules:`, error);
      throw error;
    }
  }
}

module.exports = ApprovalService;