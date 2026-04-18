/**
 * Structured Approval System Routes
 * Advanced approval management with scoring and criteria validation
 */

const express = require('express');
const router = express.Router();
const ApprovalService = require('../services/approvalService');
const { sendApprovalEmail, sendRejectionEmail } = require('../utils/sendEmail');
const pool = require('../config/db');

// Admin authentication middleware (reused from admin.js)
const jwt = require('jsonwebtoken');
const requireAdminAuth = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Admin access denied. No token provided." });
  }

  try {
    const adminSecret = process.env.ADMIN_JWT_SECRET;
    if (!adminSecret) {
      return res.status(500).json({ message: "Admin not configured." });
    }
    
    const decoded = jwt.verify(token, adminSecret);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: "Access denied. Admin role required." });
    }
    
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired admin token." });
  }
};

// ═══════════════════════════════════════════════════════════
// APPROVAL OVERVIEW AND STATISTICS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/admin/structured-approval/overview
 * Get comprehensive approval system overview
 */
router.get('/overview', requireAdminAuth, async (req, res) => {
  try {
    console.log('[StructuredApproval] Getting overview...');
    
    const [stats, pendingUsers, pendingPurchases] = await Promise.all([
      ApprovalService.getApprovalStats(),
      ApprovalService.getPendingApprovals('user'),
      ApprovalService.getPendingApprovals('purchase_request')
    ]);

    // Calculate summary metrics
    const summary = {
      totalPendingUsers: pendingUsers.length,
      totalPendingPurchases: pendingPurchases.length,
      highRiskUsers: pendingUsers.filter(u => u.risk_level === 'high').length,
      highRiskPurchases: pendingPurchases.filter(p => p.risk_level === 'high').length,
      autoApprovableUsers: pendingUsers.filter(u => u.recommendation === 'approve').length,
      autoApprovablePurchases: pendingPurchases.filter(p => p.recommendation === 'approve').length,
      autoRejectableUsers: pendingUsers.filter(u => u.recommendation === 'reject').length,
      autoRejectablePurchases: pendingPurchases.filter(p => p.recommendation === 'reject').length
    };

    res.json({
      summary,
      statistics: stats,
      pendingCounts: {
        users: pendingUsers.length,
        purchaseRequests: pendingPurchases.length
      }
    });
  } catch (error) {
    console.error('[StructuredApproval] Overview error:', error);
    res.status(500).json({ message: 'Failed to get approval overview', error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// ENTITY APPROVAL MANAGEMENT
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/admin/structured-approval/:entityType/pending
 * Get all pending entities with approval scores
 */
router.get('/:entityType/pending', requireAdminAuth, async (req, res) => {
  try {
    const { entityType } = req.params;
    const { riskLevel, recommendation } = req.query;
    
    console.log(`[StructuredApproval] Getting pending ${entityType}...`);
    
    if (!['user', 'purchase_request'].includes(entityType)) {
      return res.status(400).json({ message: 'Invalid entity type' });
    }

    let entities = await ApprovalService.getPendingApprovals(entityType);
    
    // Apply filters
    if (riskLevel) {
      entities = entities.filter(e => e.risk_level === riskLevel);
    }
    if (recommendation) {
      entities = entities.filter(e => e.recommendation === recommendation);
    }

    res.json({
      entities,
      total: entities.length,
      filters: { riskLevel, recommendation }
    });
  } catch (error) {
    console.error(`[StructuredApproval] Get pending ${req.params.entityType} error:`, error);
    res.status(500).json({ message: 'Failed to get pending entities', error: error.message });
  }
});

/**
 * GET /api/admin/structured-approval/:entityType/:entityId/details
 * Get detailed approval information for a specific entity
 */
router.get('/:entityType/:entityId/details', requireAdminAuth, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    
    console.log(`[StructuredApproval] Getting details for ${entityType} ${entityId}...`);
    
    const details = await ApprovalService.getApprovalDetails(entityType, parseInt(entityId));
    
    // Get entity-specific information
    let entityInfo = {};
    if (entityType === 'user') {
      const userResult = await pool.query(`
        SELECT u.*, 
               i.company_name, i.sector, i.location as industry_location, i.phone as industry_phone,
               i.website, i.established_year, i.description as industry_description,
               s.organization_name, s.organization_type, s.location as stakeholder_location,
               s.phone as stakeholder_phone, s.contact_person, s.description as stakeholder_description
        FROM users u
        LEFT JOIN industries i ON i.user_id = u.id
        LEFT JOIN stakeholders s ON s.user_id = u.id
        WHERE u.id = $1
      `, [entityId]);
      entityInfo = userResult.rows[0] || {};
    } else if (entityType === 'purchase_request') {
      const prResult = await pool.query(`
        SELECT pr.*, p.name as product_name, p.price, p.unit,
               i.company_name as industry_name, i.sector,
               s.organization_name as stakeholder_org, s.contact_person,
               u.email as stakeholder_email
        FROM purchase_requests pr
        JOIN products p ON p.id = pr.product_id
        JOIN industries i ON i.id = pr.industry_id
        JOIN stakeholders s ON s.id = pr.stakeholder_id
        JOIN users u ON u.id = s.user_id
        WHERE pr.id = $1
      `, [entityId]);
      entityInfo = prResult.rows[0] || {};
    }

    res.json({
      ...details,
      entityInfo
    });
  } catch (error) {
    console.error(`[StructuredApproval] Get details error:`, error);
    res.status(500).json({ message: 'Failed to get entity details', error: error.message });
  }
});

/**
 * POST /api/admin/structured-approval/:entityType/:entityId/recalculate
 * Recalculate approval score for an entity
 */
router.post('/:entityType/:entityId/recalculate', requireAdminAuth, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    
    console.log(`[StructuredApproval] Recalculating score for ${entityType} ${entityId}...`);
    
    const scoreData = await ApprovalService.calculateScore(entityType, parseInt(entityId));
    
    res.json({
      message: 'Score recalculated successfully',
      scoreData
    });
  } catch (error) {
    console.error(`[StructuredApproval] Recalculate error:`, error);
    res.status(500).json({ message: 'Failed to recalculate score', error: error.message });
  }
});

/**
 * POST /api/admin/structured-approval/:entityType/:entityId/approve
 * Manually approve an entity
 */
router.post('/:entityType/:entityId/approve', requireAdminAuth, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { notes } = req.body;
    
    console.log(`[StructuredApproval] Manual approval: ${entityType} ${entityId}`);
    
    const result = await ApprovalService.manualApprove(
      entityType, 
      parseInt(entityId), 
      req.admin.id || 0, 
      notes
    );

    // Send approval email for users
    if (entityType === 'user') {
      try {
        const userResult = await pool.query(`
          SELECT u.email, COALESCE(i.company_name, s.organization_name) as name
          FROM users u
          LEFT JOIN industries i ON i.user_id = u.id
          LEFT JOIN stakeholders s ON s.user_id = u.id
          WHERE u.id = $1
        `, [entityId]);
        
        if (userResult.rows.length > 0) {
          const { email, name } = userResult.rows[0];
          await sendApprovalEmail(email, name || email);
        }
      } catch (emailError) {
        console.error('[StructuredApproval] Approval email failed (non-fatal):', emailError);
      }
    }

    res.json({
      message: 'Entity approved successfully',
      result
    });
  } catch (error) {
    console.error(`[StructuredApproval] Approve error:`, error);
    res.status(500).json({ message: 'Failed to approve entity', error: error.message });
  }
});

/**
 * POST /api/admin/structured-approval/:entityType/:entityId/reject
 * Manually reject an entity
 */
router.post('/:entityType/:entityId/reject', requireAdminAuth, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }
    
    console.log(`[StructuredApproval] Manual rejection: ${entityType} ${entityId}`);
    
    const result = await ApprovalService.manualReject(
      entityType, 
      parseInt(entityId), 
      req.admin.id || 0, 
      reason
    );

    // Send rejection email for users
    if (entityType === 'user') {
      try {
        const userResult = await pool.query(`
          SELECT u.email, COALESCE(i.company_name, s.organization_name) as name
          FROM users u
          LEFT JOIN industries i ON i.user_id = u.id
          LEFT JOIN stakeholders s ON s.user_id = u.id
          WHERE u.id = $1
        `, [entityId]);
        
        if (userResult.rows.length > 0) {
          const { email, name } = userResult.rows[0];
          await sendRejectionEmail(email, name || email, reason);
        }
      } catch (emailError) {
        console.error('[StructuredApproval] Rejection email failed (non-fatal):', emailError);
      }
    }

    res.json({
      message: 'Entity rejected successfully',
      result
    });
  } catch (error) {
    console.error(`[StructuredApproval] Reject error:`, error);
    res.status(500).json({ message: 'Failed to reject entity', error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// BATCH OPERATIONS
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/admin/structured-approval/:entityType/process-auto
 * Process automatic approvals/rejections based on scores
 */
router.post('/:entityType/process-auto', requireAdminAuth, async (req, res) => {
  try {
    const { entityType } = req.params;
    
    console.log(`[StructuredApproval] Processing auto approvals for ${entityType}...`);
    
    const result = await ApprovalService.processAutoApprovals(entityType);
    
    res.json({
      message: 'Auto processing completed',
      result
    });
  } catch (error) {
    console.error(`[StructuredApproval] Auto process error:`, error);
    res.status(500).json({ message: 'Failed to process auto approvals', error: error.message });
  }
});

/**
 * POST /api/admin/structured-approval/batch-approve
 * Batch approve multiple entities
 */
router.post('/batch-approve', requireAdminAuth, async (req, res) => {
  try {
    const { entities, notes } = req.body; // entities: [{ entityType, entityId }]
    
    if (!Array.isArray(entities) || entities.length === 0) {
      return res.status(400).json({ message: 'Entities array is required' });
    }
    
    console.log(`[StructuredApproval] Batch approving ${entities.length} entities...`);
    
    const results = [];
    for (const entity of entities) {
      try {
        const result = await ApprovalService.manualApprove(
          entity.entityType,
          entity.entityId,
          req.admin.id || 0,
          notes
        );
        results.push({ ...entity, success: true, result });
      } catch (error) {
        results.push({ ...entity, success: false, error: error.message });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    res.json({
      message: `Batch approval completed: ${successful} successful, ${failed} failed`,
      results,
      summary: { successful, failed, total: entities.length }
    });
  } catch (error) {
    console.error(`[StructuredApproval] Batch approve error:`, error);
    res.status(500).json({ message: 'Failed to batch approve', error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// FRAUD DETECTION
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/admin/structured-approval/:entityType/:entityId/fraud-indicator
 * Add fraud indicator to an entity
 */
router.post('/:entityType/:entityId/fraud-indicator', requireAdminAuth, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { detectionType, severity, details } = req.body;
    
    console.log(`[StructuredApproval] Adding fraud indicator: ${entityType} ${entityId}`);
    
    const fraudLog = await ApprovalService.addFraudIndicator(
      entityType,
      parseInt(entityId),
      detectionType,
      severity || 'medium',
      details || {}
    );
    
    res.json({
      message: 'Fraud indicator added successfully',
      fraudLog
    });
  } catch (error) {
    console.error(`[StructuredApproval] Add fraud indicator error:`, error);
    res.status(500).json({ message: 'Failed to add fraud indicator', error: error.message });
  }
});

/**
 * GET /api/admin/structured-approval/fraud-indicators
 * Get all unresolved fraud indicators
 */
router.get('/fraud-indicators', requireAdminAuth, async (req, res) => {
  try {
    const { severity, entityType } = req.query;
    
    let query = `
      SELECT fdl.*, 
             CASE 
               WHEN fdl.entity_type = 'user' THEN COALESCE(i.company_name, s.organization_name, u.email)
               WHEN fdl.entity_type = 'purchase_request' THEN CONCAT('PR #', fdl.entity_id)
               ELSE CONCAT(fdl.entity_type, ' #', fdl.entity_id)
             END as entity_name
      FROM fraud_detection_log fdl
      LEFT JOIN users u ON fdl.entity_type = 'user' AND fdl.entity_id = u.id
      LEFT JOIN industries i ON u.id = i.user_id
      LEFT JOIN stakeholders s ON u.id = s.user_id
      WHERE fdl.is_resolved = false
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (severity) {
      paramCount++;
      query += ` AND fdl.severity = $${paramCount}`;
      params.push(severity);
    }
    
    if (entityType) {
      paramCount++;
      query += ` AND fdl.entity_type = $${paramCount}`;
      params.push(entityType);
    }
    
    query += ' ORDER BY fdl.severity DESC, fdl.created_at DESC';
    
    const result = await pool.query(query, params);
    
    res.json({
      fraudIndicators: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error(`[StructuredApproval] Get fraud indicators error:`, error);
    res.status(500).json({ message: 'Failed to get fraud indicators', error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// APPROVAL RULES MANAGEMENT
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/admin/structured-approval/rules
 * Get all approval rules
 */
router.get('/rules', requireAdminAuth, async (req, res) => {
  try {
    const { entityType } = req.query;
    
    const rules = await ApprovalService.getRules(entityType);
    
    res.json({
      rules,
      total: rules.length
    });
  } catch (error) {
    console.error(`[StructuredApproval] Get rules error:`, error);
    res.status(500).json({ message: 'Failed to get approval rules', error: error.message });
  }
});

/**
 * PUT /api/admin/structured-approval/rules/:ruleId
 * Update an approval rule
 */
router.put('/rules/:ruleId', requireAdminAuth, async (req, res) => {
  try {
    const { ruleId } = req.params;
    const updates = req.body;
    
    // Remove non-updatable fields
    delete updates.id;
    delete updates.created_at;
    
    console.log(`[StructuredApproval] Updating rule ${ruleId}...`);
    
    const updatedRule = await ApprovalService.updateRule(parseInt(ruleId), updates);
    
    if (!updatedRule) {
      return res.status(404).json({ message: 'Rule not found' });
    }
    
    res.json({
      message: 'Rule updated successfully',
      rule: updatedRule
    });
  } catch (error) {
    console.error(`[StructuredApproval] Update rule error:`, error);
    res.status(500).json({ message: 'Failed to update rule', error: error.message });
  }
});

module.exports = router;