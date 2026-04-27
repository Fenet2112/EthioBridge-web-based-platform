const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { sendApprovalEmail, sendRejectionEmail, sendSuspensionEmail } = require('../utils/sendEmail');
const { createNotification } = require('../utils/createNotification');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Get admin credentials from environment - fail if not configured
const getAdminCredentials = () => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminSecret = process.env.ADMIN_JWT_SECRET;

  if (!adminEmail || !adminPassword || !adminSecret) {
    throw new Error('Admin credentials not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_JWT_SECRET environment variables.');
  }

  return { adminEmail, adminPassword, adminSecret };
};

// Store hashed admin credentials in memory (computed once at startup)
let adminCredentials = null;

const getAdminAuth = async () => {
  if (!adminCredentials) {
    const creds = getAdminCredentials();
    const hashedPassword = await bcrypt.hash(creds.adminPassword, 10);
    adminCredentials = {
      email: creds.adminEmail,
      password: hashedPassword,
      secret: creds.adminSecret
    };
  }
  return adminCredentials;
};

// Admin login middleware
const requireAdminAuth = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: "Admin access denied. No token provided." });
  }

  try {
    const adminAuth = await getAdminAuth();
    const decoded = jwt.verify(token, adminAuth.secret);

    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: "Access denied. Admin role required." });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired admin token." });
  }
};

// ========================================
// ADMIN LOGIN
// ========================================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const creds = getAdminCredentials();

    if (email !== creds.adminEmail) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (password !== creds.adminPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: 0, email: creds.adminEmail, role: 'admin' },
      creds.adminSecret,
      { expiresIn: '24h' }
    );

    res.json({ token, message: "Admin login successful" });
  } catch (error) {
    console.error("Admin login error:", error);
    if (error.message.includes('not configured')) {
      return res.status(500).json({ message: "Server configuration error. Contact administrator." });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// ========================================
// GET ALL USERS WITH ADVANCED FILTERING (Admin)
// ========================================
router.get('/users/all', requireAdminAuth, async (req, res) => {
  try {
    const {
      role,
      status,
      search,
      sortBy = "created_at",
      sortOrder = "DESC",
      page = "1",
      limit = "20",
      startDate,
      endDate,
      minLoginCount,
      maxLoginCount,
      minProducts,
      maxProducts,
      minRequests,
      maxRequests
    } = req.query;

    let query = `
      SELECT
        u.id, u.email, u.role, u.status, u.email_verified, u.created_at,
        COALESCE(i.company_name, s.organization_name) AS display_name,
        i.sector,
        s.organization_type,
        COUNT(DISTINCT p.id) AS product_count,
        COUNT(DISTINCT pr.id) AS request_count
      FROM users u
      LEFT JOIN industries i ON i.user_id = u.id
      LEFT JOIN stakeholders s ON s.user_id = u.id
      LEFT JOIN products p ON p.industry_id = i.id
      LEFT JOIN purchase_requests pr ON pr.stakeholder_id = s.id
    `;

    const queryParams = [];
    let paramCount = 1;
    let whereAdded = false;

    // Add WHERE clause only if needed
    const conditions = [];

    if (role) {
      conditions.push(`u.role = $${paramCount++}`);
      queryParams.push(role);
    }

    if (status) {
      conditions.push(`u.status = $${paramCount++}`);
      queryParams.push(status);
    }

    if (search) {
      conditions.push(`(
        LOWER(u.email) LIKE LOWER($${paramCount++}) OR
        LOWER(COALESCE(i.company_name, '')) LIKE LOWER($${paramCount++}) OR
        LOWER(COALESCE(s.organization_name, '')) LIKE LOWER($${paramCount++})
      )`);
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (startDate) {
      conditions.push(`u.created_at >= $${paramCount++}`);
      queryParams.push(startDate);
    }

    if (endDate) {
      conditions.push(`u.created_at <= $${paramCount++}`);
      queryParams.push(endDate);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
      whereAdded = true;
    }

    query += ` GROUP BY u.id, u.email, u.role, u.status, u.email_verified, u.created_at, i.company_name, s.organization_name, i.sector, s.organization_type`;

    // HAVING conditions for aggregate counts
    const havingConditions = [];
    if (minProducts) {
      havingConditions.push(`COUNT(DISTINCT p.id) >= ${paramCount++}`);
      queryParams.push(parseInt(minProducts));
    }
    if (maxProducts) {
      havingConditions.push(`COUNT(DISTINCT p.id) <= ${paramCount++}`);
      queryParams.push(parseInt(maxProducts));
    }
    if (minRequests) {
      havingConditions.push(`COUNT(DISTINCT pr.id) >= ${paramCount++}`);
      queryParams.push(parseInt(minRequests));
    }
    if (maxRequests) {
      havingConditions.push(`COUNT(DISTINCT pr.id) <= ${paramCount++}`);
      queryParams.push(parseInt(maxRequests));
    }
    if (havingConditions.length > 0) {
      query += ` HAVING ${havingConditions.join(' AND ')}`;
    }

    // Sorting
    const allowedSortColumns = [
      "u.created_at", "u.email", "u.role", "u.status",
      "display_name", "product_count", "request_count"
    ];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : "u.created_at";
    const sortDirection = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";
    query += ` ORDER BY ${sortColumn} ${sortDirection}`;

    // Get total count
    const countQuery = query.replace(
      /SELECT[\s\S]*?FROM/s,
      "SELECT COUNT(*) FROM"
    ).split("ORDER BY")[0];

    const totalResult = await pool.query(countQuery, queryParams);
    const total = parseInt(totalResult.rows[0].count);

    // Pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    queryParams.push(limitNum, offset);

    const result = await pool.query(query, queryParams);

    res.json({
      users: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error("[ADMIN] Get users error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ========================================
// GET PENDING USERS WITH FILTERING
// ========================================
router.get('/pending', requireAdminAuth, async (req, res) => {
  try {
    const {
      role,
      search,
      sortBy = "created_at",
      sortOrder = "DESC",
      page = "1",
      limit = "20"
    } = req.query;

    let query = `
      SELECT
        u.id, u.email, u.role, u.status, u.created_at,
        i.company_name, i.sector, i.location AS industry_location,
        i.description AS industry_description, i.phone AS industry_phone,
        i.website, i.established_year,
        s.organization_name, s.organization_type, s.location AS stakeholder_location,
        s.description AS stakeholder_description, s.phone AS stakeholder_phone,
        s.contact_person
      FROM users u
      LEFT JOIN industries i ON i.user_id = u.id
      LEFT JOIN stakeholders s ON s.user_id = u.id
      WHERE u.status = 'pending'
    `;

    const queryParams = [];
    let paramCount = 1;

    if (role) {
      query += ` AND u.role = $${paramCount++}`;
      queryParams.push(role);
    }

    if (search) {
      query += ` AND (
        LOWER(u.email) LIKE LOWER($${paramCount++}) OR
        LOWER(COALESCE(i.company_name, '')) LIKE LOWER($${paramCount++}) OR
        LOWER(COALESCE(s.organization_name, '')) LIKE LOWER($${paramCount++})
      )`;
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    // Sorting
    const allowedSortColumns = ["u.created_at", "u.email", "u.role"];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : "u.created_at";
    const sortDirection = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";
    query += ` ORDER BY ${sortColumn} ${sortDirection}`;

    // Get total count
    const countQuery = query.replace(
      /SELECT[\s\S]*?FROM/s,
      "SELECT COUNT(*) FROM"
    ).split("ORDER BY")[0];

    const totalResult = await pool.query(countQuery, queryParams);
    const total = parseInt(totalResult.rows[0].count);

    // Pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    queryParams.push(limitNum, offset);

    const result = await pool.query(query, queryParams);

    res.json({
      users: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error("[ADMIN] Get pending error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ========================================
// GET SINGLE USER DETAILS
// ========================================
router.get('/users/:id/details', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        u.id, u.email, u.role, u.status, u.email_verified, u.created_at,
        u.ban_reason, u.suspended_until,
        i.company_name, i.sector, i.location AS industry_location,
        i.description AS industry_description, i.phone AS industry_phone,
        i.website, i.established_year,
        s.organization_name, s.organization_type, s.location AS stakeholder_location,
        s.description AS stakeholder_description, s.phone AS stakeholder_phone,
        s.contact_person
      FROM users u
      LEFT JOIN industries i ON i.user_id = u.id
      LEFT JOIN stakeholders s ON s.user_id = u.id
      WHERE u.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("[ADMIN] Get user details error:", err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ========================================
// APPROVE USER
// ========================================
router.patch('/users/:id/approve', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const userResult = await pool.query(
      "UPDATE users SET status = 'approved' WHERE id = $1 RETURNING *",
      [id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const user = userResult.rows[0];

    // Get profile name for email
    let profileName = user.email;
    if (user.role === 'industry') {
      const ind = await pool.query("SELECT company_name FROM industries WHERE user_id = $1", [id]);
      if (ind.rows.length > 0) profileName = ind.rows[0].company_name;
    } else {
      const stk = await pool.query("SELECT organization_name FROM stakeholders WHERE user_id = $1", [id]);
      if (stk.rows.length > 0) profileName = stk.rows[0].organization_name;
    }

    try {
      await sendApprovalEmail(user.email, profileName);
    } catch (emailErr) {
      console.error("Email send failed (non-fatal):", emailErr.message);
    }

    // Notify the industry/stakeholder user
    await createNotification(
      pool, parseInt(id),
      'Account Approved',
      `Congratulations! Your account has been approved. You now have full access to all platform features.`,
      'approval'
    );

    res.json({ message: "User approved successfully", user });
  } catch (error) {
    console.error("Approve error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ========================================
// REJECT USER
// ========================================
router.patch('/users/:id/reject', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body;

  if (!rejectionReason) {
    return res.status(400).json({ message: "Rejection reason is required" });
  }

  try {
    const userResult = await pool.query(
      "UPDATE users SET status = 'rejected' WHERE id = $1 RETURNING *",
      [id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const user = userResult.rows[0];

    let profileName = user.email;
    if (user.role === 'industry') {
      const ind = await pool.query("SELECT company_name FROM industries WHERE user_id = $1", [id]);
      if (ind.rows.length > 0) profileName = ind.rows[0].company_name;
    } else {
      const stk = await pool.query("SELECT organization_name FROM stakeholders WHERE user_id = $1", [id]);
      if (stk.rows.length > 0) profileName = stk.rows[0].organization_name;
    }

    try {
      await sendRejectionEmail(user.email, profileName, rejectionReason);
    } catch (emailErr) {
      console.error("Email send failed (non-fatal):", emailErr.message);
    }

    // Notify the user about rejection
    await createNotification(
      pool, parseInt(id),
      'Account Application Rejected',
      `Your account application has been reviewed and rejected. Reason: ${rejectionReason}. Please contact support if you have questions.`,
      'approval'
    );

    res.json({ message: "User rejected", user });
  } catch (error) {
    console.error("Reject error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ========================================
// UPDATE USER STATUS (ban / suspend / activate)
// ========================================
router.patch('/users/:id/status', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { status, ban_reason, suspended_until } = req.body;

  const allowed = ['approved', 'suspended', 'banned', 'rejected', 'incomplete', 'pending'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${allowed.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET status = $1,
           ban_reason = $2,
           suspended_until = $3
       WHERE id = $4
       RETURNING id, email, role, status, ban_reason, suspended_until`,
      [status, ban_reason || null, suspended_until || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });

    // Send suspension/ban email (non-fatal)
    if (status === 'suspended' || status === 'banned') {
      try {
        await sendSuspensionEmail(result.rows[0].email, status, ban_reason);
      } catch (emailErr) {
        console.error("Suspension email failed (non-fatal):", emailErr.message);
      }
    }

    res.json({ message: `User ${status} successfully`, user: result.rows[0] });
  } catch (err) {
    console.error("Update user status error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ========================================
// GET ALL INDUSTRIES (Admin) - with filtering
// ========================================
router.get('/industries', requireAdminAuth, async (req, res) => {
  try {
    const {
      sector,
      location,
      minProducts,
      maxProducts,
      search,
      sortBy = "created_at",
      sortOrder = "DESC",
      page = "1",
      limit = "20"
    } = req.query;

    let query = `
      SELECT
        i.id, i.company_name, i.sector, i.location, i.phone, i.website,
        i.established_year, i.description, i.created_at,
        u.email, u.status,
        COUNT(DISTINCT p.id) AS product_count,
        COUNT(DISTINCT pr.id) AS request_count
      FROM industries i
      JOIN users u ON u.id = i.user_id
      LEFT JOIN products p ON p.industry_id = i.id
      LEFT JOIN purchase_requests pr ON pr.industry_id = i.id
      WHERE 1=1
    `;

    const queryParams = [];
    let paramCount = 1;

    if (sector) {
      query += ` AND LOWER(i.sector) LIKE LOWER($${paramCount++})`;
      queryParams.push(`%${sector}%`);
    }

    if (location) {
      query += ` AND LOWER(i.location) LIKE LOWER($${paramCount++})`;
      queryParams.push(`%${location}%`);
    }

    if (search) {
      query += ` AND (
        LOWER(i.company_name) LIKE LOWER($${paramCount++}) OR
        LOWER(i.description) LIKE LOWER($${paramCount++})
      )`;
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm);
    }

    query += ` GROUP BY i.id, u.email, u.status`;

    // Having clause for product count filters
    if (minProducts) {
      query += ` HAVING COUNT(DISTINCT p.id) >= $${paramCount++}`;
      queryParams.push(parseInt(minProducts));
    }
    if (maxProducts) {
      query += ` HAVING COUNT(DISTINCT p.id) <= $${paramCount++}`;
      queryParams.push(parseInt(maxProducts));
    }

    // Sorting
    const allowedSortColumns = ["i.created_at", "i.company_name", "i.sector", "product_count", "request_count"];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : "i.created_at";
    const sortDirection = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";
    query += ` ORDER BY ${sortColumn} ${sortDirection}`;

    // Get total count
    const countQuery = query.replace(
      /SELECT[\s\S]*?FROM/s,
      "SELECT COUNT(*) FROM"
    ).split("ORDER BY")[0];

    const totalResult = await pool.query(countQuery, queryParams);
    const total = parseInt(totalResult.rows[0].count);

    // Pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    queryParams.push(limitNum, offset);

    const result = await pool.query(query, queryParams);

    res.json({
      industries: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    });
  } catch (err) {
    console.error("Admin get industries error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ========================================
// DELETE INDUSTRY
// ========================================
router.delete('/industries/:id', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM industries WHERE id = $1', [id]);
    res.json({ message: 'Industry removed successfully' });
  } catch (err) {
    console.error("Delete industry error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ========================================
// GET ALL PRODUCTS (admin) - with filtering
// ========================================
router.get('/products', requireAdminAuth, async (req, res) => {
  try {
    const {
      category,
      is_available,
      sector,
      location,
      search,
      sortBy = "created_at",
      sortOrder = "DESC",
      page = "1",
      limit = "20"
    } = req.query;

    let query = `
      SELECT
        p.id, p.name, p.description, p.price, p.unit, p.category,
        p.is_available, p.image_url, p.created_at,
        i.company_name AS industry_name, i.sector,
        COUNT(pr.id) AS request_count
      FROM products p
      JOIN industries i ON i.id = p.industry_id
      JOIN users u ON u.id = i.user_id
      LEFT JOIN purchase_requests pr ON pr.product_id = p.id
      WHERE 1=1
    `;

    const queryParams = [];
    let paramCount = 1;

    if (category) {
      query += ` AND LOWER(p.category) LIKE LOWER($${paramCount++})`;
      queryParams.push(`%${category}%`);
    }

    if (is_available !== undefined) {
      query += ` AND p.is_available = $${paramCount++}`;
      queryParams.push(is_available === "true" || is_available === true);
    }

    if (sector) {
      query += ` AND LOWER(i.sector) LIKE LOWER($${paramCount++})`;
      queryParams.push(`%${sector}%`);
    }

    if (location) {
      query += ` AND LOWER(i.location) LIKE LOWER($${paramCount++})`;
      queryParams.push(`%${location}%`);
    }

    if (search) {
      query += ` AND (
        LOWER(p.name) LIKE LOWER($${paramCount++}) OR
        LOWER(p.description) LIKE LOWER($${paramCount++}) OR
        LOWER(i.company_name) LIKE LOWER($${paramCount++})
      )`;
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` GROUP BY p.id, i.company_name, i.sector`;

    // Sorting
    const allowedSortColumns = ["p.created_at", "p.name", "p.price", "p.category", "request_count"];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : "p.created_at";
    const sortDirection = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";
    query += ` ORDER BY ${sortColumn} ${sortDirection}`;

    // Get total count
    const countQuery = query.replace(
      /SELECT[\s\S]*?FROM/s,
      "SELECT COUNT(*) FROM"
    ).split("ORDER BY")[0];

    const totalResult = await pool.query(countQuery, queryParams);
    const total = parseInt(totalResult.rows[0].count);

    // Pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    queryParams.push(limitNum, offset);

    const result = await pool.query(query, queryParams);

    res.json({
      products: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    });
  } catch (err) {
    console.error("Admin get products error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ========================================
// DELETE PRODUCT
// ========================================
router.delete('/products/:id', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ message: 'Product removed successfully' });
  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ========================================
// ANALYTICS SUMMARY
// ========================================
router.get('/analytics', requireAdminAuth, async (req, res) => {
  try {
    const [users, products, requests, sectors] = await Promise.all([
      pool.query(`SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS count FROM users GROUP BY month ORDER BY month DESC LIMIT 12`),
      pool.query(`SELECT COUNT(*) AS total FROM products p JOIN industries i ON i.id = p.industry_id JOIN users u ON u.id = i.user_id WHERE u.status = 'approved'`),
      pool.query(`SELECT status, COUNT(*) AS count FROM purchase_requests GROUP BY status`),
      pool.query(`SELECT sector, COUNT(*) AS count FROM industries i JOIN users u ON u.id = i.user_id WHERE u.status = 'approved' GROUP BY sector ORDER BY count DESC LIMIT 8`),
    ]);
    res.json({
      userGrowth: users.rows,
      totalProducts: products.rows[0]?.total || 0,
      requestsByStatus: requests.rows,
      sectorDistribution: sectors.rows,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ========================================
// TOP SELLERS ANALYTICS
// ========================================
router.get('/analytics/top-sellers', requireAdminAuth, async (req, res) => {
  try {
    const { metric = 'revenue', period = 'all', limit = '10' } = req.query;

    // Build date filter
    let dateFilter = '';
    if (period === '7d')  dateFilter = `AND pr.created_at >= NOW() - INTERVAL '7 days'`;
    if (period === '30d') dateFilter = `AND pr.created_at >= NOW() - INTERVAL '30 days'`;
    if (period === '90d') dateFilter = `AND pr.created_at >= NOW() - INTERVAL '90 days'`;

    // Choose metric
    let valueExpr, valueLabel;
    if (metric === 'revenue') {
      valueExpr = 'COALESCE(SUM(p.price * pr.quantity), 0)';
      valueLabel = 'total_revenue';
    } else if (metric === 'quantity') {
      valueExpr = 'COALESCE(SUM(pr.quantity), 0)';
      valueLabel = 'total_quantity';
    } else {
      // transactions
      valueExpr = 'COUNT(pr.id)';
      valueLabel = 'total_transactions';
    }

    const result = await pool.query(`
      SELECT
        i.id,
        i.company_name AS industry_name,
        i.sector,
        ${valueExpr} AS value,
        COUNT(pr.id)                          AS total_transactions,
        COALESCE(SUM(pr.quantity), 0)         AS total_quantity,
        COALESCE(SUM(p.price * pr.quantity), 0) AS total_revenue
      FROM industries i
      JOIN users u ON u.id = i.user_id
      LEFT JOIN purchase_requests pr
        ON pr.industry_id = i.id
        AND pr.status IN ('approved', 'completed')
        ${dateFilter}
      LEFT JOIN products p ON p.id = pr.product_id
      WHERE u.status = 'approved'
      GROUP BY i.id, i.company_name, i.sector
      ORDER BY value DESC
      LIMIT $1
    `, [parseInt(limit)]);

    res.json({
      metric,
      period,
      sellers: result.rows.map(r => ({
        id: r.id,
        industry_name: r.industry_name,
        sector: r.sector,
        value: parseFloat(r.value) || 0,
        total_transactions: parseInt(r.total_transactions),
        total_quantity: parseInt(r.total_quantity),
        total_revenue: parseFloat(r.total_revenue) || 0,
      }))
    });
  } catch (err) {
    console.error('[Analytics] top-sellers error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ========================================
// ADMIN SETTINGS ENDPOINTS
// ========================================

// Get approval workflow settings
router.get('/settings/workflows', requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM approval_workflows ORDER BY workflow_type');
    res.json({ workflows: result.rows });
  } catch (error) {
    console.error('Get workflows error:', error);
    res.status(500).json({ message: 'Failed to fetch workflow settings' });
  }
});

// Update approval workflow
router.put('/settings/workflows/:type', requireAdminAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const { mode, conditions } = req.body;

    if (!['automatic', 'manual', 'conditional'].includes(mode)) {
      return res.status(400).json({ message: 'Invalid workflow mode' });
    }

    const result = await pool.query(
      `UPDATE approval_workflows
       SET mode = $1, conditions = $2, updated_at = CURRENT_TIMESTAMP
       WHERE workflow_type = $3
       RETURNING *`,
      [mode, conditions || {}, type]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Workflow type not found' });
    }

    // Invalidate the in-memory workflow cache so new mode takes effect immediately
    try { require('../services/approvalWorkflow').invalidateCache(); } catch {}

    res.json({
      message: 'Workflow updated successfully',
      workflow: result.rows[0]
    });
  } catch (error) {
    console.error('Update workflow error:', error);
    res.status(500).json({ message: 'Failed to update workflow' });
  }
});

// Change admin password
router.put('/settings/password', requireAdminAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    const adminAuth = await getAdminAuth();
    const validPassword = await bcrypt.compare(currentPassword, adminAuth.password);

    if (!validPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Update the in-memory admin credentials
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    adminCredentials.password = hashedNewPassword;

    console.log('[ADMIN] Password changed successfully');

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

// Get admin profile
router.get('/settings/profile', requireAdminAuth, async (req, res) => {
  try {
    const adminAuth = await getAdminAuth();
    res.json({
      email: adminAuth.email,
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({ message: 'Failed to get profile' });
  }
});

// ========================================
// GENERAL SYSTEM SETTINGS
// ========================================

const ENSURE_SETTINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS system_settings (
    id                        INTEGER PRIMARY KEY DEFAULT 1,
    free_request_limit        INTEGER NOT NULL DEFAULT 1,
    max_products_free         INTEGER NOT NULL DEFAULT 5,
    email_alerts_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    purchase_alerts_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  INSERT INTO system_settings (id, free_request_limit, max_products_free, email_alerts_enabled, purchase_alerts_enabled)
  VALUES (1, 1, 5, true, true)
  ON CONFLICT (id) DO NOTHING;
`;

// GET general settings
router.get('/settings/general', requireAdminAuth, async (req, res) => {
  try {
    await pool.query(ENSURE_SETTINGS_TABLE);
    const result = await pool.query('SELECT * FROM system_settings WHERE id = 1');
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Admin] get general settings error:', err.message);
    res.json({
      free_request_limit: 1,
      max_products_free: 5,
      email_alerts_enabled: true,
      purchase_alerts_enabled: true,
    });
  }
});

// PUT general settings
router.put('/settings/general', requireAdminAuth, async (req, res) => {
  try {
    const {
      free_request_limit,
      max_products_free,
      email_alerts_enabled,
      purchase_alerts_enabled,
    } = req.body;

    // Ensure table exists first
    await pool.query(ENSURE_SETTINGS_TABLE);

    const result = await pool.query(`
      INSERT INTO system_settings (id, free_request_limit, max_products_free, email_alerts_enabled, purchase_alerts_enabled, updated_at)
      VALUES (1, $1, $2, $3, $4, NOW())
      ON CONFLICT (id) DO UPDATE SET
        free_request_limit      = EXCLUDED.free_request_limit,
        max_products_free       = EXCLUDED.max_products_free,
        email_alerts_enabled    = EXCLUDED.email_alerts_enabled,
        purchase_alerts_enabled = EXCLUDED.purchase_alerts_enabled,
        updated_at              = NOW()
      RETURNING *
    `, [
      parseInt(free_request_limit) || 1,
      parseInt(max_products_free)  || 5,
      email_alerts_enabled  !== undefined ? Boolean(email_alerts_enabled)  : true,
      purchase_alerts_enabled !== undefined ? Boolean(purchase_alerts_enabled) : true,
    ]);

    console.log('[Admin] General settings saved:', result.rows[0]);
    res.json({ message: 'Settings saved successfully', settings: result.rows[0] });
  } catch (err) {
    console.error('[Admin] save general settings error:', err.message);
    res.status(500).json({ message: 'Failed to save settings: ' + err.message });
  }
});

// ========================================
// APPROVAL LOGS
// ========================================
router.get('/approval-logs', requireAdminAuth, async (req, res) => {
  try {
    const { entityType, decision, limit = '50' } = req.query;
    let query = `
      SELECT al.*,
        CASE
          WHEN al.entity_type IN ('industry','stakeholder') THEN
            COALESCE(
              (SELECT i.company_name FROM industries i JOIN users u ON u.id = i.user_id WHERE u.id = al.entity_id LIMIT 1),
              (SELECT s.organization_name FROM stakeholders s JOIN users u ON u.id = s.user_id WHERE u.id = al.entity_id LIMIT 1),
              (SELECT u.email FROM users u WHERE u.id = al.entity_id LIMIT 1)
            )
          WHEN al.entity_type = 'purchase_request' THEN
            CONCAT('PR #', al.entity_id, ' — ',
              (SELECT p.name FROM purchase_requests pr JOIN products p ON p.id = pr.product_id WHERE pr.id = al.entity_id LIMIT 1)
            )
          ELSE CONCAT(al.entity_type, ' #', al.entity_id)
        END AS entity_name
      FROM approval_logs al
    `;
    const params = [];
    const conditions = [];
    let n = 1;
    if (entityType) { conditions.push(`al.entity_type = $${n++}`); params.push(entityType); }
    if (decision)   { conditions.push(`al.decision = $${n++}`);    params.push(decision); }
    if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ` ORDER BY al.created_at DESC LIMIT $${n}`;
    params.push(parseInt(limit));
    const result = await pool.query(query, params);
    res.json({ logs: result.rows });
  } catch (err) {
    console.error('[Admin] approval-logs error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
