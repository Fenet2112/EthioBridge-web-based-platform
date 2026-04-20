/**
 * Approval Workflow Service
 *
 * Reads the current workflow mode from the DB and applies the correct
 * approval logic for users (industry / stakeholder) and purchase requests.
 *
 * Modes:
 *   manual      – do nothing; leave status as 'pending' for admin review
 *   automatic   – immediately approve
 *   conditional – evaluate rule-based criteria; approve / reject / leave pending
 */

const pool = require('../config/db');
const { createNotification } = require('../utils/createNotification');

// ── In-memory cache so we don't hit the DB on every request ──
let _cache = {};
let _cacheTime = 0;
const CACHE_TTL = 30 * 1000; // 30 seconds

async function getWorkflowMode(workflowType) {
  const now = Date.now();
  if (now - _cacheTime < CACHE_TTL && _cache[workflowType]) {
    return _cache[workflowType];
  }
  try {
    const result = await pool.query(
      'SELECT mode FROM approval_workflows WHERE workflow_type = $1',
      [workflowType]
    );
    const mode = result.rows[0]?.mode || 'manual';
    _cache[workflowType] = mode;
    _cacheTime = now;
    return mode;
  } catch {
    return 'manual'; // safe fallback
  }
}

// Invalidate cache when admin changes a workflow
function invalidateCache() {
  _cache = {};
  _cacheTime = 0;
}

// ── Approval log helper ──
async function logDecision({ entityType, entityId, decision, mode, reason }) {
  try {
    await pool.query(
      `INSERT INTO approval_logs (entity_type, entity_id, decision, mode, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [entityType, entityId, decision, mode, reason]
    );
  } catch (err) {
    // Non-fatal — table may not exist yet
    console.error('[ApprovalWorkflow] Log error (non-fatal):', err.message);
  }
}

// ═══════════════════════════════════════════════════════════
// INDUSTRY PROFILE APPROVAL
// ═══════════════════════════════════════════════════════════

/**
 * Called after an industry profile is saved.
 * Returns { newStatus, reason }
 */
async function processIndustryApproval(userId) {
  const mode = await getWorkflowMode('industry_registration');
  console.log(`[ApprovalWorkflow] Industry ${userId} — mode: ${mode}`);

  if (mode === 'manual') {
    await logDecision({ entityType: 'industry', entityId: userId, decision: 'pending', mode, reason: 'Manual review required' });
    return { newStatus: 'pending', reason: 'Manual review required' };
  }

  if (mode === 'automatic') {
    await _applyUserStatus(userId, 'approved');
    await logDecision({ entityType: 'industry', entityId: userId, decision: 'approved', mode, reason: 'Automatic approval' });
    await _notifyUser(userId, 'approved', 'Your industry account has been automatically approved.');
    return { newStatus: 'approved', reason: 'Automatic approval' };
  }

  // ── Conditional ──
  const { passed, failed } = await _checkIndustryCriteria(userId);

  if (failed.length === 0) {
    await _applyUserStatus(userId, 'approved');
    await logDecision({ entityType: 'industry', entityId: userId, decision: 'approved', mode, reason: `Conditional: all criteria met (${passed.join(', ')})` });
    await _notifyUser(userId, 'approved', 'Your industry account has been automatically approved based on your profile.');
    return { newStatus: 'approved', reason: 'All criteria met' };
  }

  // Hard failures → reject; soft failures → leave pending
  const hardFails = failed.filter(f => f.hard);
  if (hardFails.length > 0) {
    await _applyUserStatus(userId, 'rejected');
    const reason = `Rejected: ${hardFails.map(f => f.msg).join('; ')}`;
    await logDecision({ entityType: 'industry', entityId: userId, decision: 'rejected', mode, reason });
    await _notifyUser(userId, 'rejected', `Your industry account was rejected. Reason: ${reason}`);
    return { newStatus: 'rejected', reason };
  }

  const reason = `Pending review: ${failed.map(f => f.msg).join('; ')}`;
  await logDecision({ entityType: 'industry', entityId: userId, decision: 'pending', mode, reason });
  return { newStatus: 'pending', reason };
}

async function _checkIndustryCriteria(userId) {
  const passed = [], failed = [];

  const result = await pool.query(`
    SELECT u.email_verified, u.email,
           i.company_name, i.sector, i.location, i.latitude, i.longitude, i.phone
    FROM users u
    LEFT JOIN industries i ON i.user_id = u.id
    WHERE u.id = $1
  `, [userId]);

  if (!result.rows.length) {
    failed.push({ msg: 'User not found', hard: true });
    return { passed, failed };
  }

  const r = result.rows[0];

  // Required fields
  if (!r.company_name?.trim()) failed.push({ msg: 'Company name missing', hard: true });
  else passed.push('company_name');

  if (!r.sector?.trim()) failed.push({ msg: 'Sector/category missing', hard: true });
  else passed.push('sector');

  if (!r.location?.trim()) failed.push({ msg: 'Location missing', hard: true });
  else passed.push('location');

  // GPS coordinates (soft — location text may be enough)
  if (!r.latitude || !r.longitude) failed.push({ msg: 'GPS coordinates not provided', hard: false });
  else passed.push('gps_coordinates');

  // Phone (soft)
  if (!r.phone?.trim()) failed.push({ msg: 'Phone number missing', hard: false });
  else passed.push('phone');

  // Duplicate company name check
  const dupCheck = await pool.query(
    `SELECT COUNT(*) FROM industries i JOIN users u ON u.id = i.user_id
     WHERE LOWER(i.company_name) = LOWER($1) AND u.id != $2 AND u.status = 'approved'`,
    [r.company_name || '', userId]
  );
  if (parseInt(dupCheck.rows[0].count) > 0) {
    failed.push({ msg: 'Duplicate company name detected', hard: true });
  } else {
    passed.push('no_duplicate');
  }

  return { passed, failed };
}

// ═══════════════════════════════════════════════════════════
// STAKEHOLDER PROFILE APPROVAL
// ═══════════════════════════════════════════════════════════

async function processStakeholderApproval(userId) {
  const mode = await getWorkflowMode('stakeholder_registration');
  console.log(`[ApprovalWorkflow] Stakeholder ${userId} — mode: ${mode}`);

  if (mode === 'manual') {
    await logDecision({ entityType: 'stakeholder', entityId: userId, decision: 'pending', mode, reason: 'Manual review required' });
    return { newStatus: 'pending', reason: 'Manual review required' };
  }

  if (mode === 'automatic') {
    await _applyUserStatus(userId, 'approved');
    await logDecision({ entityType: 'stakeholder', entityId: userId, decision: 'approved', mode, reason: 'Automatic approval' });
    await _notifyUser(userId, 'approved', 'Your stakeholder account has been automatically approved.');
    return { newStatus: 'approved', reason: 'Automatic approval' };
  }

  // ── Conditional ──
  const { passed, failed } = await _checkStakeholderCriteria(userId);

  if (failed.length === 0) {
    await _applyUserStatus(userId, 'approved');
    await logDecision({ entityType: 'stakeholder', entityId: userId, decision: 'approved', mode, reason: `Conditional: all criteria met (${passed.join(', ')})` });
    await _notifyUser(userId, 'approved', 'Your stakeholder account has been automatically approved based on your profile.');
    return { newStatus: 'approved', reason: 'All criteria met' };
  }

  const hardFails = failed.filter(f => f.hard);
  if (hardFails.length > 0) {
    await _applyUserStatus(userId, 'rejected');
    const reason = `Rejected: ${hardFails.map(f => f.msg).join('; ')}`;
    await logDecision({ entityType: 'stakeholder', entityId: userId, decision: 'rejected', mode, reason });
    await _notifyUser(userId, 'rejected', `Your stakeholder account was rejected. Reason: ${reason}`);
    return { newStatus: 'rejected', reason };
  }

  const reason = `Pending review: ${failed.map(f => f.msg).join('; ')}`;
  await logDecision({ entityType: 'stakeholder', entityId: userId, decision: 'pending', mode, reason });
  return { newStatus: 'pending', reason };
}

async function _checkStakeholderCriteria(userId) {
  const passed = [], failed = [];

  const result = await pool.query(`
    SELECT u.email_verified, u.email,
           s.organization_name, s.organization_type, s.location,
           s.phone, s.contact_person, s.id_document_url
    FROM users u
    LEFT JOIN stakeholders s ON s.user_id = u.id
    WHERE u.id = $1
  `, [userId]);

  if (!result.rows.length) {
    failed.push({ msg: 'User not found', hard: true });
    return { passed, failed };
  }

  const r = result.rows[0];

  if (!r.email_verified) failed.push({ msg: 'Email not verified', hard: false });
  else passed.push('email_verified');

  if (!r.organization_name?.trim()) failed.push({ msg: 'Organization name missing', hard: true });
  else passed.push('organization_name');

  if (!r.organization_type?.trim()) failed.push({ msg: 'Organization type missing', hard: true });
  else passed.push('organization_type');

  if (!r.location?.trim()) failed.push({ msg: 'Location missing', hard: true });
  else passed.push('location');

  if (!r.phone?.trim()) failed.push({ msg: 'Phone number missing', hard: false });
  else passed.push('phone');

  if (!r.id_document_url) failed.push({ msg: 'ID document not uploaded', hard: false });
  else passed.push('id_document');

  return { passed, failed };
}

// ═══════════════════════════════════════════════════════════
// PURCHASE REQUEST APPROVAL
// ═══════════════════════════════════════════════════════════

async function processPurchaseRequestApproval(purchaseRequestId) {
  const mode = await getWorkflowMode('purchase_request');
  console.log(`[ApprovalWorkflow] PurchaseRequest ${purchaseRequestId} — mode: ${mode}`);

  if (mode === 'manual') {
    await logDecision({ entityType: 'purchase_request', entityId: purchaseRequestId, decision: 'pending', mode, reason: 'Manual review required' });
    return { newStatus: null, reason: 'Manual review required' }; // keep existing status
  }

  if (mode === 'automatic') {
    await _applyPurchaseStatus(purchaseRequestId, 'approved');
    await logDecision({ entityType: 'purchase_request', entityId: purchaseRequestId, decision: 'approved', mode, reason: 'Automatic approval' });
    await _notifyIndustryForPurchase(purchaseRequestId, 'approved', 'A purchase request was automatically approved.');
    return { newStatus: 'approved', reason: 'Automatic approval' };
  }

  // ── Conditional ──
  const { passed, failed } = await _checkPurchaseCriteria(purchaseRequestId);

  if (failed.length === 0) {
    await _applyPurchaseStatus(purchaseRequestId, 'approved');
    await logDecision({ entityType: 'purchase_request', entityId: purchaseRequestId, decision: 'approved', mode, reason: `Conditional: all criteria met (${passed.join(', ')})` });
    await _notifyIndustryForPurchase(purchaseRequestId, 'approved', 'A purchase request was automatically approved based on validation criteria.');
    return { newStatus: 'approved', reason: 'All criteria met' };
  }

  const hardFails = failed.filter(f => f.hard);
  if (hardFails.length > 0) {
    const reason = `Rejected: ${hardFails.map(f => f.msg).join('; ')}`;
    await _applyPurchaseStatus(purchaseRequestId, 'rejected', reason);
    await logDecision({ entityType: 'purchase_request', entityId: purchaseRequestId, decision: 'rejected', mode, reason });
    return { newStatus: 'rejected', reason };
  }

  const reason = `Pending review: ${failed.map(f => f.msg).join('; ')}`;
  await logDecision({ entityType: 'purchase_request', entityId: purchaseRequestId, decision: 'pending', mode, reason });
  return { newStatus: null, reason }; // keep as pending
}

async function _checkPurchaseCriteria(prId) {
  const passed = [], failed = [];

  const result = await pool.query(`
    SELECT pr.quantity, pr.stakeholder_id, pr.industry_id,
           p.is_available, p.price,
           u_ind.status AS industry_status,
           u_stk.status AS stakeholder_status,
           (SELECT COUNT(*) FROM purchase_requests
            WHERE stakeholder_id = pr.stakeholder_id
            AND created_at > NOW() - INTERVAL '1 hour') AS recent_count
    FROM purchase_requests pr
    JOIN products p ON p.id = pr.product_id
    JOIN industries i ON i.id = pr.industry_id
    JOIN users u_ind ON u_ind.id = i.user_id
    JOIN stakeholders s ON s.id = pr.stakeholder_id
    JOIN users u_stk ON u_stk.id = s.user_id
    WHERE pr.id = $1
  `, [prId]);

  if (!result.rows.length) {
    failed.push({ msg: 'Purchase request not found', hard: true });
    return { passed, failed };
  }

  const r = result.rows[0];

  if (!r.is_available) failed.push({ msg: 'Product is not available', hard: true });
  else passed.push('product_available');

  if (r.industry_status !== 'approved') failed.push({ msg: 'Industry is not approved', hard: true });
  else passed.push('industry_approved');

  if (r.stakeholder_status !== 'approved') failed.push({ msg: 'Stakeholder is not approved', hard: false });
  else passed.push('stakeholder_approved');

  const qty = parseInt(r.quantity);
  if (qty <= 0) failed.push({ msg: 'Invalid quantity', hard: true });
  else if (qty > 10000) failed.push({ msg: 'Quantity exceeds maximum allowed (10,000)', hard: true });
  else passed.push('valid_quantity');

  if (parseInt(r.recent_count) >= 10) failed.push({ msg: 'Suspicious burst activity detected', hard: true });
  else passed.push('no_burst_activity');

  return { passed, failed };
}

// ── Helpers ──
async function _applyUserStatus(userId, status) {
  await pool.query('UPDATE users SET status = $1 WHERE id = $2', [status, userId]);
}

async function _applyPurchaseStatus(prId, status, adminNotes = null) {
  await pool.query(
    'UPDATE purchase_requests SET status = $1, admin_notes = COALESCE($2, admin_notes), updated_at = NOW() WHERE id = $3',
    [status, adminNotes, prId]
  );
}

async function _notifyUser(userId, decision, message) {
  const title = decision === 'approved' ? 'Account Approved' : 'Account Application Rejected';
  await createNotification(pool, userId, title, message, 'approval');
}

async function _notifyIndustryForPurchase(prId, decision, message) {
  try {
    const r = await pool.query(
      `SELECT i.user_id FROM purchase_requests pr JOIN industries i ON i.id = pr.industry_id WHERE pr.id = $1`,
      [prId]
    );
    if (r.rows.length) {
      const title = decision === 'approved' ? 'Purchase Request Approved' : 'Purchase Request Rejected';
      await createNotification(pool, r.rows[0].user_id, title, message, 'request', prId);
    }
  } catch (err) {
    console.error('[ApprovalWorkflow] Notify industry error (non-fatal):', err.message);
  }
}

module.exports = {
  processIndustryApproval,
  processStakeholderApproval,
  processPurchaseRequestApproval,
  invalidateCache,
};
