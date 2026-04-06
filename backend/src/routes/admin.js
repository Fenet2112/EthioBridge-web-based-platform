const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { sendApprovalEmail, sendRejectionEmail, sendSuspensionEmail } = require('../utils/sendEmail');
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

// Admin login middleware - verify admin token
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

// ── ADMIN LOGIN ──
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

// ── GET ALL PENDING USERS WITH PROFILE DATA ──
router.get('/pending', requireAdminAuth, async (req, res) => {
  try {
    console.log('[ADMIN] Fetching pending users...');
    const result = await pool.query(`
      SELECT
        u.id, u.email, u.role, u.status, u.created_at,
        i.company_name, i.sector, i.location AS industry_location,
        i.description AS industry_description, i.phone AS industry_phone,
        i.website, i.established_year,
        s.organization_name, s.organization_type, s.location AS stakeholder_location,
        s.description AS stakeholder_description, s.phone AS stakeholder_phone,
        s.contact_person, s.id_document_url, s.id_document_type, s.identity_verified
      FROM users u
      LEFT JOIN industries i ON i.user_id = u.id
      LEFT JOIN stakeholders s ON s.user_id = u.id
      WHERE u.status = 'pending'
      ORDER BY u.created_at DESC
    `);
    console.log(`[ADMIN] Found ${result.rows.length} pending users`);
    res.json(result.rows);
  } catch (error) {
    console.error("[ADMIN] Get pending error:", error.message);
    console.error("[ADMIN] Error details:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ── GET ALL USERS (for admin overview) ──
router.get('/users', requireAdminAuth, async (req, res) => {
  try {
    console.log('[ADMIN] Fetching all users...');
    const result = await pool.query(`
      SELECT
        u.id, u.email, u.role, u.status, u.created_at,
        i.company_name, i.sector,
        s.organization_name, s.organization_type
      FROM users u
      LEFT JOIN industries i ON i.user_id = u.id
      LEFT JOIN stakeholders s ON s.user_id = u.id
      ORDER BY u.created_at DESC
    `);
    console.log(`[ADMIN] Found ${result.rows.length} total users`);
    res.json(result.rows);
  } catch (error) {
    console.error("[ADMIN] Get users error:", error.message);
    console.error("[ADMIN] Error details:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ── APPROVE USER ──
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

    res.json({ message: "User approved successfully", user });
  } catch (error) {
    console.error("Approve error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── REJECT USER ──
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

    res.json({ message: "User rejected", user });
  } catch (error) {
    console.error("Reject error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET ALL USERS — full management view ──
router.get('/users/all', requireAdminAuth, async (req, res) => {
  try {
    console.log('[ADMIN] Fetching all users for management...');
    const result = await pool.query(`
      SELECT
        u.id, u.email, u.role, u.status, u.is_verified, u.ban_reason,
        u.suspended_until, u.created_at,
        COALESCE(i.company_name, s.organization_name) AS display_name,
        i.sector,
        s.organization_type,
        s.identity_verified,
        s.id_document_url
      FROM users u
      LEFT JOIN industries  i ON i.user_id = u.id
      LEFT JOIN stakeholders s ON s.user_id = u.id
      ORDER BY u.created_at DESC
    `);
    console.log(`[ADMIN] Found ${result.rows.length} users for management`);
    res.json(result.rows);
  } catch (err) {
    console.error("[ADMIN] Get all users error:", err.message);
    console.error("[ADMIN] Error details:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ── UPDATE USER STATUS (ban / suspend / activate) ──
router.patch('/users/:id/status', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { status, ban_reason, suspended_until } = req.body;

  const allowed = ['approved', 'suspended', 'banned', 'rejected'];
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
router.get('/industries', requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.id, i.company_name, i.sector, i.location, i.phone, i.website,
             i.established_year, i.description, i.created_at,
             u.email, u.status,
             COUNT(DISTINCT p.id) AS product_count,
             COUNT(DISTINCT pr.id) AS request_count
      FROM industries i
      JOIN users u ON u.id = i.user_id
      LEFT JOIN products p ON p.industry_id = i.id
      LEFT JOIN purchase_requests pr ON pr.industry_id = i.id
      WHERE u.status = 'approved'
      GROUP BY i.id, u.email, u.status
      ORDER BY i.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Admin get industries error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── DELETE INDUSTRY ──
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

// ── GET ALL PRODUCTS (admin) ──
router.get('/products', requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.name, p.description, p.price, p.unit, p.category,
             p.is_available, p.image_url, p.created_at,
             i.company_name AS industry_name, i.sector,
             COUNT(pr.id) AS request_count
      FROM products p
      JOIN industries i ON i.id = p.industry_id
      JOIN users u ON u.id = i.user_id
      LEFT JOIN purchase_requests pr ON pr.product_id = p.id
      WHERE u.status = 'approved'
      GROUP BY p.id, i.company_name, i.sector
      ORDER BY request_count DESC, p.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Admin get products error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── DELETE PRODUCT ──
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

// ── ANALYTICS SUMMARY ──
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

// ═══════════════════════════════════════════════════════════
// ADMIN SETTINGS ENDPOINTS
// ═══════════════════════════════════════════════════════════

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

    // Note: This only updates in-memory. For persistent storage, 
    // you'd need to update environment variables or use a database
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
      // Don't send password or secret
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

module.exports = router;
