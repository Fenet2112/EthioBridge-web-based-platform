const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticateToken } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../../uploads/profiles");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "profile-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
});

// ── GET STAKEHOLDER STATUS (for checking approval status) ──
router.get("/stakeholder/status", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "stakeholder") {
      return res.status(403).json({ message: "Only stakeholders can check status" });
    }

    const result = await pool.query(
      `SELECT u.status FROM users u WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ status: result.rows[0].status });
  } catch (error) {
    console.error("Get stakeholder status error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET MY PROFILE ──
router.get("/me", authenticateToken, async (req, res) => {
  try {
    let query;

    if (req.user.role === "stakeholder") {
      query = `
        SELECT
          s.id, s.username, s.full_name, s.bio, s.profile_picture,
          s.organization_name, s.organization_type, s.location,
          s.phone, s.contact_person, s.description,
          u.email, u.status, u.created_at
        FROM stakeholders s
        JOIN users u ON u.id = s.user_id
        WHERE s.user_id = $1
      `;
    } else if (req.user.role === "industry") {
      query = `
        SELECT
          i.id, i.username, i.full_name, i.bio, i.profile_picture,
          i.company_name, i.sector, i.location,
          i.phone, i.website, i.description, i.established_year,
          u.email, u.status, u.created_at
        FROM industries i
        JOIN users u ON u.id = i.user_id
        WHERE i.user_id = $1
      `;
    } else {
      return res.status(403).json({ message: "Invalid user role" });
    }

    let result = await pool.query(query, [req.user.id]);

    // Auto-create a minimal stakeholder row so new users can set photo/username/bio
    // before they submit their org profile
    if (result.rows.length === 0 && req.user.role === "stakeholder") {
      await pool.query(
        `INSERT INTO stakeholders (user_id, organization_name, organization_type, location)
         VALUES ($1, '', '', '') ON CONFLICT (user_id) DO NOTHING`,
        [req.user.id]
      );
      result = await pool.query(query, [req.user.id]);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── UPDATE PROFILE ──
router.put("/me", authenticateToken, async (req, res) => {
  const { username, full_name, bio } = req.body;

  try {
    let query, table, profileId;

    // Get or create profile row
    if (req.user.role === "stakeholder") {
      table = "stakeholders";
      const idResult = await pool.query("SELECT id FROM stakeholders WHERE user_id = $1", [req.user.id]);
      if (idResult.rows.length === 0) {
        // Auto-create minimal row so user can set username/bio before org profile
        await pool.query(
          `INSERT INTO stakeholders (user_id, organization_name, organization_type, location)
           VALUES ($1, '', '', '') ON CONFLICT (user_id) DO NOTHING`,
          [req.user.id]
        );
        const newRow = await pool.query("SELECT id FROM stakeholders WHERE user_id = $1", [req.user.id]);
        profileId = newRow.rows[0].id;
      } else {
        profileId = idResult.rows[0].id;
      }
    } else if (req.user.role === "industry") {
      table = "industries";
      const idResult = await pool.query("SELECT id FROM industries WHERE user_id = $1", [req.user.id]);
      if (idResult.rows.length === 0) {
        return res.status(404).json({ message: "Profile not found" });
      }
      profileId = idResult.rows[0].id;
    } else {
      return res.status(403).json({ message: "Invalid user role" });
    }

    // Check if username is taken (if provided and different)
    if (username) {
      const usernameCheck = await pool.query(
        `SELECT id FROM ${table} WHERE username = $1 AND id != $2`,
        [username, profileId]
      );
      if (usernameCheck.rows.length > 0) {
        return res.status(409).json({ message: "Username already taken" });
      }
    }

    // Update profile
    query = `
      UPDATE ${table}
      SET 
        username = COALESCE($1, username),
        full_name = COALESCE($2, full_name),
        bio = COALESCE($3, bio),
        updated_at = NOW()
      WHERE user_id = $4
      RETURNING *
    `;

    const result = await pool.query(query, [
      username || null,
      full_name || null,
      bio || null,
      req.user.id,
    ]);

    res.json({
      message: "Profile updated successfully",
      profile: result.rows[0],
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── UPLOAD PROFILE PICTURE ──
router.post("/me/picture", authenticateToken, upload.single("profile_picture"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const profilePictureUrl = `/uploads/profiles/${req.file.filename}`;
    let table;

    if (req.user.role === "stakeholder") {
      table = "stakeholders";
    } else if (req.user.role === "industry") {
      table = "industries";
    } else {
      return res.status(403).json({ message: "Invalid user role" });
    }

    // Auto-create minimal row if it doesn't exist
    if (req.user.role === "stakeholder") {
      await pool.query(
        `INSERT INTO stakeholders (user_id, organization_name, organization_type, location)
         VALUES ($1, '', '', '') ON CONFLICT (user_id) DO NOTHING`,
        [req.user.id]
      );
    } else if (req.user.role === "industry") {
      await pool.query(
        `INSERT INTO industries (user_id, company_name, sector, location)
         VALUES ($1, '', '', '') ON CONFLICT (user_id) DO NOTHING`,
        [req.user.id]
      );
    }

    // Get old profile picture to delete it
    const oldPicResult = await pool.query(
      `SELECT profile_picture FROM ${table} WHERE user_id = $1`,
      [req.user.id]
    );

    // Update profile picture in database
    const result = await pool.query(
      `UPDATE ${table} SET profile_picture = $1 WHERE user_id = $2 RETURNING profile_picture`,
      [profilePictureUrl, req.user.id]
    );

    // Delete old profile picture file if it exists
    if (oldPicResult.rows.length > 0 && oldPicResult.rows[0].profile_picture) {
      const oldFilePath = path.join(__dirname, "../..", oldPicResult.rows[0].profile_picture);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    res.json({
      message: "Profile picture uploaded successfully",
      profile_picture: result.rows[0].profile_picture,
    });
  } catch (error) {
    console.error("Upload profile picture error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── DELETE PROFILE PICTURE ──
router.delete("/me/picture", authenticateToken, async (req, res) => {
  try {
    let table;

    if (req.user.role === "stakeholder") {
      table = "stakeholders";
    } else if (req.user.role === "industry") {
      table = "industries";
    } else {
      return res.status(403).json({ message: "Invalid user role" });
    }

    // Get current profile picture
    const result = await pool.query(
      `SELECT profile_picture FROM ${table} WHERE user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length > 0 && result.rows[0].profile_picture) {
      const filePath = path.join(__dirname, "../..", result.rows[0].profile_picture);
      
      // Delete file if it exists
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Remove from database
      await pool.query(
        `UPDATE ${table} SET profile_picture = NULL WHERE user_id = $1`,
        [req.user.id]
      );
    }

    res.json({ message: "Profile picture deleted successfully" });
  } catch (error) {
    console.error("Delete profile picture error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET PUBLIC PROFILE BY USERNAME ──
router.get("/user/:username", async (req, res) => {
  const { username } = req.params;

  try {
    // Try stakeholders first
    let result = await pool.query(
      `SELECT 
        s.username, s.full_name, s.bio, s.profile_picture,
        s.organization_name, s.organization_type, s.location,
        u.created_at
      FROM stakeholders s
      JOIN users u ON u.id = s.user_id
      WHERE s.username = $1 AND u.status = 'approved'`,
      [username]
    );

    if (result.rows.length === 0) {
      // Try industries
      result = await pool.query(
        `SELECT 
          i.username, i.full_name, i.bio, i.profile_picture,
          i.company_name, i.sector, i.location,
          u.created_at
        FROM industries i
        JOIN users u ON u.id = i.user_id
        WHERE i.username = $1 AND u.status = 'approved'`,
        [username]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get public profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
