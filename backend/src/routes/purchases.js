const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticateToken, requireRole, requireApproved } = require("../middleware/auth");
const jwt = require('jsonwebtoken');

// Admin authentication middleware
const requireAdminAuth = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: "Admin access denied. No token provided." });
  }

  try {
    const adminSecret = process.env.ADMIN_JWT_SECRET;
    if (!adminSecret) {
      return res.status(500).json({ message: "Admin not configured. Contact administrator." });
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

// ── CREATE PURCHASE REQUEST (stakeholder submits) ──
router.post(
  "/purchases",
  authenticateToken,
  requireRole("stakeholder"),
  async (req, res) => {
    const {
      industry_id,
      product_id,
      quantity,
      notes,
      full_name,
      organization_name,
      phone,
      location,
    } = req.body;

    console.log('Purchase request received:', { 
      industry_id, 
      product_id, 
      quantity, 
      notes, 
      user_id: req.user.id,
      status: req.user.status,
      manual_data: { full_name, organization_name, phone, location }
    });

    if (!industry_id || !product_id || !quantity) {
      console.log('Missing required fields');
      return res.status(400).json({ message: "industry_id, product_id, and quantity are required." });
    }

    try {
      let stakeholder_id, requestData, requestStatus;

      // Check if user is approved
      if (req.user.status === "approved") {
        // APPROVED USERS: Use verified profile data automatically
        const stakeResult = await pool.query(
          "SELECT id, organization_name, contact_person, phone, location FROM stakeholders WHERE user_id = $1",
          [req.user.id]
        );
        
        console.log('Stakeholder query result:', stakeResult.rows);
        
        if (stakeResult.rows.length === 0) {
          return res.status(404).json({ message: "Stakeholder profile not found. Please complete your profile first." });
        }
        
        const stakeholder = stakeResult.rows[0];
        stakeholder_id = stakeholder.id;

        requestData = {
          full_name: stakeholder.contact_person || 'N/A',
          organization_name: stakeholder.organization_name,
          phone: stakeholder.phone,
          location: stakeholder.location,
        };
        
        requestStatus = 'approved'; // Goes directly to industry
        console.log('Using verified profile data for approved user');
        
      } else {
        // NON-APPROVED USERS (incomplete/pending): Use manual form data
        if (!full_name || !organization_name || !phone || !location) {
          return res.status(400).json({ 
            message: "For non-approved accounts, full_name, organization_name, phone, and location are required." 
          });
        }

        // Check if stakeholder profile exists, if not create a basic one
        let stakeResult = await pool.query(
          "SELECT id FROM stakeholders WHERE user_id = $1",
          [req.user.id]
        );
        
        if (stakeResult.rows.length === 0) {
          // Create basic stakeholder profile
          stakeResult = await pool.query(
            `INSERT INTO stakeholders (user_id, organization_name, organization_type, location, phone, contact_person)
             VALUES ($1, $2, 'Other', $3, $4, $5)
             RETURNING id`,
            [req.user.id, organization_name, location, phone, full_name]
          );
          console.log('Created basic stakeholder profile');
        }
        
        stakeholder_id = stakeResult.rows[0].id;

        requestData = {
          full_name,
          organization_name,
          phone,
          location,
        };
        
        requestStatus = 'pending'; // Needs admin approval
        console.log('Using manual form data for non-approved user');
      }

      // Verify product belongs to stated industry
      const productCheck = await pool.query(
        "SELECT id FROM products WHERE id = $1 AND industry_id = $2 AND is_available = true",
        [product_id, industry_id]
      );
      
      console.log('Product check result:', productCheck.rows);
      
      if (productCheck.rows.length === 0) {
        return res.status(400).json({ message: "Product not found in the specified industry" });
      }

      // Create purchase request
      const result = await pool.query(
        `INSERT INTO purchase_requests
           (stakeholder_id, industry_id, product_id, full_name, organization_name, phone, location, quantity, notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          stakeholder_id, 
          industry_id, 
          product_id, 
          requestData.full_name,
          requestData.organization_name,
          requestData.phone,
          requestData.location,
          quantity,
          notes || null,
          requestStatus
        ]
      );

      console.log('Purchase request created:', result.rows[0]);

      // Auto-create conversation only for approved requests
      if (requestStatus === 'approved') {
        await pool.query(
          `INSERT INTO conversations (stakeholder_id, industry_id, purchase_request_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (stakeholder_id, industry_id) DO NOTHING`,
          [stakeholder_id, industry_id, result.rows[0].id]
        );
      }

      const message = requestStatus === 'approved' 
        ? "Purchase request sent to industry successfully!"
        : "Purchase request submitted for admin verification. You will be notified once approved.";

      res.status(201).json({
        message,
        request: result.rows[0],
      });
    } catch (error) {
      console.error("Create purchase request error:", error);
      res.status(500).json({ message: "Server error: " + error.message });
    }
  }
);

// ── GET MY REQUESTS (stakeholder view) ──
router.get(
  "/purchases/my-requests",
  authenticateToken,
  requireRole("stakeholder"),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          pr.id, pr.status, pr.quantity, pr.notes, pr.admin_notes, pr.created_at,
          p.name AS product_name, p.price, p.unit,
          i.company_name AS industry_name, i.sector, i.location AS industry_location
        FROM purchase_requests pr
        JOIN stakeholders s ON s.id = pr.stakeholder_id
        JOIN products p ON p.id = pr.product_id
        JOIN industries i ON i.id = pr.industry_id
        WHERE s.user_id = $1
        ORDER BY pr.created_at DESC
      `, [req.user.id]);

      res.json(result.rows);
    } catch (error) {
      console.error("Get my requests error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// ── GET PURCHASE REQUESTS FOR MY INDUSTRY (industry view – approved only) ──
router.get(
  "/purchases/industry-requests",
  authenticateToken,
  requireRole("industry"),
  requireApproved,
  async (req, res) => {
    try {
      const industryResult = await pool.query(
        "SELECT id FROM industries WHERE user_id = $1",
        [req.user.id]
      );
      if (industryResult.rows.length === 0) {
        return res.status(404).json({ message: "Industry profile not found" });
      }
      const industry_id = industryResult.rows[0].id;

      const result = await pool.query(`
        SELECT
          pr.id, pr.status, pr.quantity, pr.notes, pr.full_name, pr.organization_name,
          pr.phone, pr.location, pr.created_at,
          p.name AS product_name, p.price, p.unit,
          s.organization_name AS stakeholder_org, s.contact_person,
          s.id AS stakeholder_id,
          c.id AS conversation_id
        FROM purchase_requests pr
        JOIN products p ON p.id = pr.product_id
        JOIN stakeholders s ON s.id = pr.stakeholder_id
        LEFT JOIN conversations c ON c.stakeholder_id = pr.stakeholder_id AND c.industry_id = pr.industry_id
        WHERE pr.industry_id = $1 AND pr.status = 'approved'
        ORDER BY pr.created_at DESC
      `, [industry_id]);

      res.json(result.rows);
    } catch (error) {
      console.error("Get industry requests error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// ── ADMIN: GET ALL PURCHASE REQUESTS ──
router.get("/admin/purchases", requireAdminAuth, async (req, res) => {
  const { status } = req.query; // optional filter: ?status=pending
  try {
    let query = `
      SELECT
        pr.id, pr.status, pr.quantity, pr.full_name, pr.organization_name,
        pr.phone, pr.location, pr.notes, pr.business_license, pr.admin_notes, pr.created_at,
        p.name AS product_name, p.price, p.unit,
        i.company_name AS industry_name, i.sector,
        s.organization_name AS stakeholder_org
      FROM purchase_requests pr
      JOIN products p ON p.id = pr.product_id
      JOIN industries i ON i.id = pr.industry_id
      JOIN stakeholders s ON s.id = pr.stakeholder_id
    `;
    const params = [];
    if (status) {
      query += " WHERE pr.status = $1";
      params.push(status);
    }
    query += " ORDER BY pr.created_at DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Admin get purchases error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── ADMIN: APPROVE PURCHASE REQUEST ──
router.patch("/admin/purchases/:id/approve", requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { admin_notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE purchase_requests
       SET status = 'approved', admin_notes = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [admin_notes || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Purchase request not found" });
    }

    const request = result.rows[0];

    // Auto-create conversation between stakeholder and industry if not exists
    await pool.query(
      `INSERT INTO conversations (stakeholder_id, industry_id, purchase_request_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (stakeholder_id, industry_id) DO NOTHING`,
      [request.stakeholder_id, request.industry_id, request.id]
    );

    res.json({ message: "Purchase request approved", request });
  } catch (error) {
    console.error("Admin approve purchase error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── ADMIN: REJECT PURCHASE REQUEST ──
router.patch("/admin/purchases/:id/reject", requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { admin_notes } = req.body;

  if (!admin_notes) {
    return res.status(400).json({ message: "admin_notes (rejection reason) is required" });
  }

  try {
    const result = await pool.query(
      `UPDATE purchase_requests
       SET status = 'rejected', admin_notes = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [admin_notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Purchase request not found" });
    }
    res.json({ message: "Purchase request rejected", request: result.rows[0] });
  } catch (error) {
    console.error("Admin reject purchase error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
