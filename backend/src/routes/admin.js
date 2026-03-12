const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { sendApprovalEmail, sendRejectionEmail } = require('../utils/sendEmail');
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
    const result = await pool.query(`
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
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Get pending error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET ALL USERS (for admin overview) ──
router.get('/users', requireAdminAuth, async (req, res) => {
  try {
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
    res.json(result.rows);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Server error" });
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

module.exports = router;
