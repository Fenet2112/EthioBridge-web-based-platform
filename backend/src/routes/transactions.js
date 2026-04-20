/**
 * Admin Transaction Monitoring Routes
 *
 * GET  /api/admin/transactions          – list with filters + sort
 * GET  /api/admin/transactions/summary  – aggregate metrics
 * GET  /api/admin/transactions/:id      – single transaction detail
 * PATCH /api/admin/transactions/:id/status – approve / reject
 *
 * "Transactions" are purchase_requests enriched with product price data.
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const { createNotification } = require('../utils/createNotification');

// ── Admin auth ──
const requireAdminAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Admin access denied.' });
  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ message: 'Admin role required.' });
    req.admin = decoded;
    next();
  } catch { return res.status(403).json({ message: 'Invalid or expired admin token.' }); }
};

// ── Risk thresholds (server-side mirror) ──
const HIGH_QTY   = 500;
const HIGH_PRICE = 500000;
const LOW_PRICE  = 1;

function computeRiskFlags(tx) {
  const flags = [];
  if (Number(tx.quantity) >= HIGH_QTY)   flags.push('High quantity');
  if (Number(tx.total_price) >= HIGH_PRICE) flags.push('Unusually high price');
  if (Number(tx.unit_price) > 0 && Number(tx.unit_price) < LOW_PRICE) flags.push('Suspiciously low price');
  return flags;
}

// ─────────────────────────────────────────────────────────
// GET /api/admin/transactions/summary
// ─────────────────────────────────────────────────────────
router.get('/summary', requireAdminAuth, async (req, res) => {
  try {
    const [counts, topIndustries, topStakeholders, burstUsers] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)                                                    AS total,
          COUNT(*) FILTER (WHERE status = 'approved')                AS approved,
          COUNT(*) FILTER (WHERE status IN ('pending','pending_verification')) AS pending,
          COUNT(*) FILTER (WHERE status = 'rejected')                AS rejected,
          SUM(p.price * pr.quantity)                                 AS total_value
        FROM purchase_requests pr
        JOIN products p ON p.id = pr.product_id
      `),
      pool.query(`
        SELECT i.company_name, COUNT(pr.id) AS tx_count
        FROM purchase_requests pr
        JOIN industries i ON i.id = pr.industry_id
        GROUP BY i.id, i.company_name
        ORDER BY tx_count DESC LIMIT 5
      `),
      pool.query(`
        SELECT COALESCE(s.organization_name, u.email) AS name, COUNT(pr.id) AS tx_count
        FROM purchase_requests pr
        JOIN stakeholders s ON s.id = pr.stakeholder_id
        JOIN users u ON u.id = s.user_id
        GROUP BY s.id, s.organization_name, u.email
        ORDER BY tx_count DESC LIMIT 5
      `),
      // Burst detection: stakeholders with ≥5 requests in any single day
      pool.query(`
        SELECT s.id, COALESCE(s.organization_name, u.email) AS name,
               DATE(pr.created_at) AS day, COUNT(*) AS cnt
        FROM purchase_requests pr
        JOIN stakeholders s ON s.id = pr.stakeholder_id
        JOIN users u ON u.id = s.user_id
        GROUP BY s.id, s.organization_name, u.email, DATE(pr.created_at)
        HAVING COUNT(*) >= 5
        ORDER BY cnt DESC LIMIT 10
      `),
    ]);

    const row = counts.rows[0];
    res.json({
      total:          parseInt(row.total),
      approved:       parseInt(row.approved),
      pending:        parseInt(row.pending),
      rejected:       parseInt(row.rejected),
      total_value:    row.total_value || 0,
      flagged:        burstUsers.rows.length,
      top_industries: topIndustries.rows,
      top_stakeholders: topStakeholders.rows,
      burst_users:    burstUsers.rows,
    });
  } catch (err) {
    console.error('[Transactions] summary error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/admin/transactions
// ─────────────────────────────────────────────────────────
router.get('/', requireAdminAuth, async (req, res) => {
  try {
    const {
      status, industry, stakeholder, minPrice, maxPrice,
      dateFrom, dateTo, search,
      sortBy = 'created_at', sortOrder = 'desc',
      page = '1', limit = '50',
    } = req.query;

    const ALLOWED_SORT = {
      id: 'pr.id', created_at: 'pr.created_at', status: 'pr.status',
      quantity: 'pr.quantity', total_price: '(p.price * pr.quantity)',
      stakeholder_name: 's.organization_name', industry_name: 'i.company_name',
      product_name: 'p.name',
    };
    const sortCol = ALLOWED_SORT[sortBy] || 'pr.created_at';
    const sortDir = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    let where = [];
    const params = [];
    let n = 1;

    if (status) { where.push(`pr.status = $${n++}`); params.push(status); }
    if (industry) { where.push(`LOWER(i.company_name) LIKE LOWER($${n++})`); params.push(`%${industry}%`); }
    if (stakeholder) { where.push(`(LOWER(s.organization_name) LIKE LOWER($${n++}) OR LOWER(u.email) LIKE LOWER($${n++}))`); params.push(`%${stakeholder}%`, `%${stakeholder}%`); }
    if (minPrice) { where.push(`(p.price * pr.quantity) >= $${n++}`); params.push(parseFloat(minPrice)); }
    if (maxPrice) { where.push(`(p.price * pr.quantity) <= $${n++}`); params.push(parseFloat(maxPrice)); }
    if (dateFrom) { where.push(`pr.created_at >= $${n++}`); params.push(dateFrom); }
    if (dateTo)   { where.push(`pr.created_at <= $${n++}::date + interval '1 day'`); params.push(dateTo); }
    if (search) {
      where.push(`(LOWER(i.company_name) LIKE LOWER($${n++}) OR LOWER(s.organization_name) LIKE LOWER($${n++}) OR LOWER(p.name) LIKE LOWER($${n++}) OR LOWER(u.email) LIKE LOWER($${n++}))`);
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, parseInt(limit));
    const offset   = (pageNum - 1) * limitNum;

    const query = `
      SELECT
        pr.id, pr.status, pr.quantity, pr.notes, pr.admin_notes,
        pr.full_name, pr.organization_name, pr.phone, pr.location,
        pr.id_document_url, pr.id_document_type,
        pr.created_at, pr.updated_at,
        p.name  AS product_name,
        p.price AS unit_price,
        p.unit,
        (p.price * pr.quantity) AS total_price,
        i.id    AS industry_id,
        i.company_name AS industry_name,
        i.sector,
        s.id    AS stakeholder_id,
        COALESCE(s.organization_name, pr.organization_name) AS stakeholder_name,
        u.email AS stakeholder_email
      FROM purchase_requests pr
      JOIN products    p ON p.id  = pr.product_id
      JOIN industries  i ON i.id  = pr.industry_id
      JOIN stakeholders s ON s.id = pr.stakeholder_id
      JOIN users       u ON u.id  = s.user_id
      ${whereClause}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${n++} OFFSET $${n++}
    `;
    params.push(limitNum, offset);

    const result = await pool.query(query, params);

    // Attach server-side risk flags
    const transactions = result.rows.map(tx => ({
      ...tx,
      risk_flags: computeRiskFlags(tx),
    }));

    res.json({ transactions, total: transactions.length, page: pageNum, limit: limitNum });
  } catch (err) {
    console.error('[Transactions] list error:', err.message);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/admin/transactions/:id
// ─────────────────────────────────────────────────────────
router.get('/:id', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        pr.id, pr.status, pr.quantity, pr.notes, pr.admin_notes,
        pr.full_name, pr.organization_name, pr.phone, pr.location,
        pr.id_document_url, pr.id_document_type,
        pr.created_at, pr.updated_at,
        p.name  AS product_name,
        p.price AS unit_price,
        p.unit,
        (p.price * pr.quantity) AS total_price,
        i.id    AS industry_id,
        i.company_name AS industry_name,
        i.sector,
        s.id    AS stakeholder_id,
        COALESCE(s.organization_name, pr.organization_name) AS stakeholder_name,
        u.email AS stakeholder_email
      FROM purchase_requests pr
      JOIN products    p ON p.id  = pr.product_id
      JOIN industries  i ON i.id  = pr.industry_id
      JOIN stakeholders s ON s.id = pr.stakeholder_id
      JOIN users       u ON u.id  = s.user_id
      WHERE pr.id = $1
    `, [id]);

    if (result.rows.length === 0) return res.status(404).json({ message: 'Transaction not found' });

    const tx = result.rows[0];
    res.json({ ...tx, risk_flags: computeRiskFlags(tx) });
  } catch (err) {
    console.error('[Transactions] detail error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────
// PATCH /api/admin/transactions/:id/status
// ─────────────────────────────────────────────────────────
router.patch('/:id/status', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { status, admin_notes } = req.body;

  const allowed = ['approved', 'rejected', 'pending', 'completed'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${allowed.join(', ')}` });
  }
  if (status === 'rejected' && !admin_notes) {
    return res.status(400).json({ message: 'Rejection reason is required' });
  }

  try {
    const result = await pool.query(
      `UPDATE purchase_requests
       SET status = $1, admin_notes = COALESCE($2, admin_notes), updated_at = NOW()
       WHERE id = $3
       RETURNING *, (SELECT user_id FROM industries WHERE id = purchase_requests.industry_id) AS industry_user_id`,
      [status, admin_notes || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Transaction not found' });

    const pr = result.rows[0];

    // If approved: mark stakeholder identity_verified + create conversation
    if (status === 'approved') {
      await pool.query(`UPDATE stakeholders SET identity_verified = TRUE, identity_verified_at = NOW() WHERE id = $1`, [pr.stakeholder_id]);
      await pool.query(
        `INSERT INTO conversations (stakeholder_id, industry_id, purchase_request_id)
         VALUES ($1, $2, $3) ON CONFLICT (stakeholder_id, industry_id) DO NOTHING`,
        [pr.stakeholder_id, pr.industry_id, pr.id]
      );
    }

    // Notify industry user
    if (pr.industry_user_id) {
      const notifTitle = status === 'approved' ? 'Purchase Request Approved' : status === 'rejected' ? 'Purchase Request Rejected' : 'Purchase Request Updated';
      const notifMsg   = status === 'approved'
        ? `A purchase request has been approved by admin.`
        : status === 'rejected'
        ? `A purchase request was rejected. Reason: ${admin_notes}`
        : `A purchase request status changed to ${status}.`;
      await createNotification(pool, pr.industry_user_id, notifTitle, notifMsg, 'approval', pr.id);
    }

    res.json({ message: `Transaction ${status} successfully`, transaction: pr });
  } catch (err) {
    console.error('[Transactions] status update error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
