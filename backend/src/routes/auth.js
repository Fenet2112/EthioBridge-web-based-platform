const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ── Multer for stakeholder ID documents ──
const idStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/id_documents";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const userId = req.body.user_id || "unknown";
    cb(null, `stakeholder_id_${userId}_${Date.now()}${path.extname(file.originalname)}`);
  },
});
const uploadStakeholderID = multer({
  storage: idStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|pdf/.test(path.extname(file.originalname).toLowerCase());
    cb(null, ok);
  },
});

// ── SIGNUP ──
router.post("/signup", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ message: "Email, password, and role are required" });
    }

    if (!["industry", "stakeholder"].includes(role)) {
      return res.status(400).json({ message: "Role must be 'industry' or 'stakeholder'" });
    }

    // Check if email already exists
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await pool.query(
      "INSERT INTO users (email, password, role, status) VALUES ($1, $2, $3, 'incomplete') RETURNING id, email, role, status",
      [email, hashedPassword, role]
    );

    res.status(201).json({
      message: "Account created successfully",
      user: newUser.rows[0],
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── LOGIN ──
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = userResult.rows[0];

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Block banned or suspended users
    if (user.status === 'banned') {
      return res.status(403).json({
        message: "Your account has been banned. Please contact support at support@ethiobridge.et",
        status: 'banned'
      });
    }
    if (user.status === 'suspended') {
      const until = user.suspended_until
        ? ` until ${new Date(user.suspended_until).toLocaleDateString()}`
        : '';
      return res.status(403).json({
        message: `Your account is temporarily suspended${until}. Please contact support.`,
        status: 'suspended'
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, status: user.status },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── SUBMIT INDUSTRY PROFILE ──
router.post("/profile/industry", async (req, res) => {
  try {
    const { user_id, company_name, sector, location, description, phone, website, established_year } = req.body;

    if (!user_id || !company_name || !sector || !location) {
      return res.status(400).json({ message: "user_id, company_name, sector, and location are required" });
    }

    // Check user exists and is industry role
    const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [user_id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    if (userResult.rows[0].role !== "industry") {
      return res.status(403).json({ message: "User is not an industry account" });
    }

    // Upsert industry profile
    await pool.query(
      `INSERT INTO industries (user_id, company_name, sector, location, description, phone, website, established_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET
         company_name = EXCLUDED.company_name,
         sector = EXCLUDED.sector,
         location = EXCLUDED.location,
         description = EXCLUDED.description,
         phone = EXCLUDED.phone,
         website = EXCLUDED.website,
         established_year = EXCLUDED.established_year`,
      [user_id, company_name, sector, location, description || null, phone || null, website || null, established_year || null]
    );

    // Update user status to pending
    await pool.query("UPDATE users SET status = 'pending' WHERE id = $1", [user_id]);

    res.json({ message: "Industry profile submitted. Awaiting admin approval." });
  } catch (error) {
    console.error("Industry profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── SUBMIT STAKEHOLDER PROFILE ──
router.post("/profile/stakeholder", uploadStakeholderID.single("id_document"), async (req, res) => {
  try {
    const { user_id, organization_name, organization_type, location, description, phone, contact_person, id_document_type } = req.body;

    console.log('Stakeholder profile submission:', { user_id, organization_name, organization_type, location });

    if (!user_id || !organization_name || !organization_type || !location) {
      return res.status(400).json({ message: "user_id, organization_name, organization_type, and location are required" });
    }

    const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [user_id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    if (userResult.rows[0].role !== "stakeholder") {
      return res.status(403).json({ message: "User is not a stakeholder account" });
    }

    const idDocUrl = req.file ? `/uploads/id_documents/${req.file.filename}` : null;
    const idDocType = id_document_type || null;

    // Upsert stakeholder profile
    await pool.query(
      `INSERT INTO stakeholders (user_id, organization_name, organization_type, location, description, phone, contact_person, id_document_url, id_document_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id) DO UPDATE SET
         organization_name = EXCLUDED.organization_name,
         organization_type = EXCLUDED.organization_type,
         location = EXCLUDED.location,
         description = EXCLUDED.description,
         phone = EXCLUDED.phone,
         contact_person = EXCLUDED.contact_person,
         id_document_url = COALESCE(EXCLUDED.id_document_url, stakeholders.id_document_url),
         id_document_type = COALESCE(EXCLUDED.id_document_type, stakeholders.id_document_type)`,
      [user_id, organization_name, organization_type, location, description || null, phone || null, contact_person || null, idDocUrl, idDocType]
    );

    // Update user status to pending
    await pool.query("UPDATE users SET status = 'pending' WHERE id = $1", [user_id]);

    res.json({ message: "Stakeholder profile submitted. Awaiting admin approval." });
  } catch (error) {
    console.error("Stakeholder profile CRASH:", error.message);
    res.status(500).json({
      message: "Server error - see backend logs for details",
      ...(process.env.NODE_ENV !== "production" && { error: error.message, code: error.code }),
    });
  }
});

// ── GET INDUSTRY PROFILE STATUS ──
router.get("/profile/industry/status", async (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = require("jsonwebtoken").verify(token, getJwtSecret());
    
    if (decoded.role !== "industry") {
      return res.json({ status: decoded.status });
    }

    const userResult = await pool.query("SELECT status FROM users WHERE id = $1", [decoded.id]);
    if (userResult.rows.length === 0) {
      return res.json({ status: "incomplete" });
    }

    const indResult = await pool.query("SELECT * FROM industries WHERE user_id = $1", [decoded.id]);
    
    res.json({
      status: userResult.rows[0].status,
      profile: indResult.rows[0] || null
    });
  } catch (error) {
    console.error("Get profile status error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET STAKEHOLDER PROFILE STATUS ──
router.get("/profile/stakeholder/status", async (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = require("jsonwebtoken").verify(token, getJwtSecret());
    
    if (decoded.role !== "stakeholder") {
      return res.json({ status: decoded.status });
    }

    const userResult = await pool.query("SELECT status FROM users WHERE id = $1", [decoded.id]);
    if (userResult.rows.length === 0) {
      return res.json({ status: "incomplete" });
    }

    const stakeResult = await pool.query("SELECT * FROM stakeholders WHERE user_id = $1", [decoded.id]);
    
    res.json({
      status: userResult.rows[0].status,
      profile: stakeResult.rows[0] || null
    });
  } catch (error) {
    console.error("Get stakeholder profile status error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
