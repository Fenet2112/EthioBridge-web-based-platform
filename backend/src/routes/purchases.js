const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticateToken, requireRole, requireApproved } = require("../middleware/auth");
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendPurchaseApprovedEmail, sendPurchaseRejectedEmail } = require("../utils/sendEmail");
const { createNotification } = require("../utils/createNotification");
const { supabaseConfigured, cloudinaryConfigured } = require("../utils/cloudinaryUpload");

// ID document upload — uses Supabase if configured, otherwise local disk
// Supports images + PDF (unlike the image-only createUpload helper)
let uploadId;

if (supabaseConfigured) {
  // Memory storage — we upload to Supabase manually in the route handler
  uploadId = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = /jpeg|jpg|png|pdf/;
      cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
    }
  });
} else {
  // Local disk fallback
  const idStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = 'uploads/id_documents';
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `id_${req.user.id}_${Date.now()}${path.extname(file.originalname)}`);
    }
  });
  uploadId = multer({
    storage: idStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = /jpeg|jpg|png|pdf/;
      cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
    }
  });
}

// Admin JWT auth — separate secret from user JWT
const requireAdminAuth = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Admin access denied." });
  try {
    const adminSecret = process.env.ADMIN_JWT_SECRET;
    if (!adminSecret) return res.status(500).json({ message: "Admin not configured." });
    const decoded = jwt.verify(token, adminSecret);
    if (decoded.role !== 'admin') return res.status(403).json({ message: "Admin role required." });
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired admin token." });
  }
};

// Check if this stakeholder has any previous purchase requests
router.get(
  "/purchases/check-first-request",
  authenticateToken,
  requireRole("stakeholder"),
  async (req, res) => {
    try {
      const stakeResult = await pool.query(
        "SELECT id, identity_verified FROM stakeholders WHERE user_id = $1",
        [req.user.id]
      );

      if (stakeResult.rows.length === 0) {
        // No profile yet — show full form
        return res.json({ isFirstRequest: true, identityVerified: false });
      }

      const { identity_verified } = stakeResult.rows[0];

      // Only skip the full form if admin has explicitly verified this stakeholder
      res.json({
        isFirstRequest: !identity_verified,
        identityVerified: !!identity_verified,
      });
    } catch (error) {
      console.error("Check first request error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/purchases",
  authenticateToken,
  requireRole("stakeholder"),
  async (req, res) => {
    const { industry_id, product_id, quantity, notes, full_name, organization_name, phone, location } = req.body;

    if (!industry_id || !product_id || !quantity) {
      return res.status(400).json({ message: "industry_id, product_id, and quantity are required." });
    }

    try {
      // Check subscription / free-request gate
      const [subResult, settingsResult] = await Promise.all([
        pool.query(
          "SELECT free_requests_used, is_subscribed, subscription_expires_at FROM users WHERE id = $1",
          [req.user.id]
        ),
        pool.query("SELECT free_request_limit FROM system_settings WHERE id = 1").catch(() => ({ rows: [] })),
      ]);
      const subUser = subResult.rows[0] || {};
      const freeLimit = settingsResult.rows[0]?.free_request_limit ?? 1;
      const now = new Date();
      const isSubscribed = subUser.is_subscribed &&
        (!subUser.subscription_expires_at || new Date(subUser.subscription_expires_at) > now);
      const freeUsed = subUser.free_requests_used || 0;

      if (!isSubscribed && freeUsed >= freeLimit) {
        return res.status(402).json({
          message: `Free request limit reached (${freeLimit}). Please subscribe to continue.`,
          requires_subscription: true,
        });
      }

      // Verify product belongs to stated industry
      const productCheck = await pool.query(
        "SELECT id FROM products WHERE id = $1 AND industry_id = $2 AND is_available = true",
        [product_id, industry_id]
      );
      if (productCheck.rows.length === 0) {
        return res.status(400).json({ message: "Product not found in the specified industry" });
      }

      // Get or create stakeholder profile
      let stakeResult = await pool.query(
        "SELECT id, identity_verified FROM stakeholders WHERE user_id = $1",
        [req.user.id]
      );

      let stakeholder_id, identity_verified;

      if (stakeResult.rows.length === 0) {
        // No profile yet — require full details
        if (!full_name || !organization_name || !phone || !location) {
          return res.status(400).json({ message: "Profile info required for first request." });
        }
        stakeResult = await pool.query(
          `INSERT INTO stakeholders (user_id, organization_name, organization_type, location, phone, contact_person)
           VALUES ($1, $2, 'Other', $3, $4, $5) RETURNING id, identity_verified`,
          [req.user.id, organization_name, location, phone, full_name]
        );
      } else {
        // Has a profile — if not yet verified, still require contact info
        const notVerified = !stakeResult.rows[0].identity_verified;
        if (notVerified && (!full_name || !organization_name || !phone || !location)) {
          return res.status(400).json({ message: "Contact info required until your identity is verified." });
        }
      }

      stakeholder_id = stakeResult.rows[0].id;
      identity_verified = stakeResult.rows[0].identity_verified;

      // isFirstRequest = not yet verified by admin
      const isFirstRequest = !identity_verified;

      let requestStatus, requestData;

      if (identity_verified) {
        // Admin-verified stakeholder — reuse stored profile, send directly to industry
        const profileResult = await pool.query(
          "SELECT organization_name, contact_person, phone, location FROM stakeholders WHERE id = $1",
          [stakeholder_id]
        );
        const p = profileResult.rows[0];
        requestData = {
          full_name:         p.contact_person    || 'N/A',
          organization_name: p.organization_name || 'N/A',
          phone:             p.phone             || 'N/A',
          location:          p.location          || 'N/A',
        };
        requestStatus = 'approved';
      } else {
        // Not yet verified — hold for admin review after ID upload
        requestData = { full_name, organization_name, phone, location };
        // Block duplicate pending_verification requests
        const existingPending = await pool.query(
          "SELECT id FROM purchase_requests WHERE stakeholder_id = $1 AND status = 'pending_verification'",
          [stakeholder_id]
        );
        if (existingPending.rows.length > 0) {
          return res.status(409).json({
            message: "You already have a request pending identity verification.",
            requires_verification: true,
          });
        }
        requestStatus = 'pending_verification';
      }

      // Create purchase request
      const result = await pool.query(
        `INSERT INTO purchase_requests
           (stakeholder_id, industry_id, product_id, full_name, organization_name, phone, location, quantity, notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [stakeholder_id, industry_id, product_id,
          requestData.full_name, requestData.organization_name, requestData.phone, requestData.location,
          quantity, notes || null, requestStatus]
      );

      // Increment free_requests_used only for unsubscribed users
      if (!isSubscribed) {
        await pool.query(
          "UPDATE users SET free_requests_used = free_requests_used + 1 WHERE id = $1",
          [req.user.id]
        );
      }

      // Conversation is opened by admin on approval, not here
      // (pending_verification requests wait for admin review first)

      const requiresVerification = requestStatus === 'pending_verification';
      res.status(201).json({
        message: requiresVerification
          ? "Please upload your ID to complete the request."
          : "Purchase request sent successfully!",
        request: result.rows[0],
        requires_verification: requiresVerification,
      });

      // Run auto-approval workflow only for already-verified returning users
      if (!requiresVerification) {
        try {
          const { processPurchaseRequestApproval } = require('../services/approvalWorkflow');
          const { newStatus, reason } = await processPurchaseRequestApproval(result.rows[0].id);
          console.log(`[Purchases] Workflow result for PR ${result.rows[0].id}: ${newStatus} — ${reason}`);
        } catch (wfErr) {
          console.error('[Purchases] Workflow error (non-fatal):', wfErr.message);
        }
      }

      // Notify the industry (non-fatal)
      try {
        const industryUserRes = await pool.query(
          `SELECT i.user_id, p.name AS product_name, s.organization_name
           FROM industries i
           JOIN products p ON p.id = $1
           JOIN stakeholders s ON s.id = $2
           WHERE i.id = $3`,
          [product_id, stakeholder_id, industry_id]
        );
        if (industryUserRes.rows.length > 0) {
          const { user_id, product_name, organization_name } = industryUserRes.rows[0];
          await createNotification(
            pool,
            user_id,
            'New Purchase Request Received',
            `${organization_name || 'A stakeholder'} has submitted a purchase request for "${product_name}".`,
            'request',
            result.rows[0].id
          );
        }
      } catch (notifErr) {
        console.error('[Purchases] Notification trigger failed (non-fatal):', notifErr.message);
      }
    } catch (error) {
      console.error("Create purchase request error:", error);
      res.status(500).json({ message: "Server error: " + error.message });
    }
  }
);

router.post(
  "/purchases/:id/upload-id",
  authenticateToken,
  requireRole("stakeholder"),
  uploadId.single('id_document'),
  async (req, res) => {
    const { id } = req.params;
    const { id_document_type } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "ID document file is required." });
    }

    try {
      // Verify this request belongs to this stakeholder
      const stakeResult = await pool.query(
        "SELECT id FROM stakeholders WHERE user_id = $1", [req.user.id]
      );
      if (stakeResult.rows.length === 0) {
        return res.status(404).json({ message: "Stakeholder profile not found." });
      }
      const stakeholder_id = stakeResult.rows[0].id;

      const reqResult = await pool.query(
        "SELECT id, status FROM purchase_requests WHERE id = $1 AND stakeholder_id = $2",
        [id, stakeholder_id]
      );
      if (reqResult.rows.length === 0) {
        return res.status(404).json({ message: "Purchase request not found." });
      }
      if (reqResult.rows[0].status !== 'pending_verification') {
        return res.status(400).json({ message: "This request does not require ID verification." });
      }

      let fileUrl;

      if (supabaseConfigured) {
        // Upload to Supabase id-documents bucket
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          { auth: { persistSession: false } }
        );
        const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
        const filePath = `id_documents/${req.user.id}_${Date.now()}${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('id-documents')
          .upload(filePath, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: false,
          });

        if (uploadError) {
          console.error('[ID Upload] Supabase error:', uploadError.message);
          return res.status(500).json({ message: 'ID upload failed: ' + uploadError.message });
        }

        const { data } = supabase.storage.from('id-documents').getPublicUrl(filePath);
        fileUrl = data.publicUrl;
        console.log(`[ID Upload] Stored in Supabase: ${fileUrl}`);
      } else {
        // Local disk fallback
        fileUrl = `/uploads/id_documents/${req.file.filename}`;
      }

      await pool.query(
        `UPDATE purchase_requests
         SET id_document_url = $1, id_document_type = $2, updated_at = NOW()
         WHERE id = $3`,
        [fileUrl, id_document_type || 'national_id', id]
      );

      res.json({ message: "ID uploaded successfully. Your request is now under review.", file_url: fileUrl });
    } catch (error) {
      console.error("Upload ID error:", error);
      res.status(500).json({ message: "Server error: " + error.message });
    }
  }
);

router.get(
  "/purchases/my-requests",
  authenticateToken,
  requireRole("stakeholder"),
  async (req, res) => {
    try {
      const { status, dateFrom, dateTo, page = "1", limit = "50" } = req.query;
      const params = [req.user.id];
      let n = 2;
      let where = `WHERE s.user_id = $1`;
      if (status && status !== "all") { where += ` AND pr.status = $${n++}`; params.push(status); }
      if (dateFrom) { where += ` AND pr.created_at >= $${n++}`; params.push(dateFrom); }
      if (dateTo)   { where += ` AND pr.created_at <= $${n++}::date + interval '1 day'`; params.push(dateTo); }

      const pageNum  = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, parseInt(limit));
      const offset   = (pageNum - 1) * limitNum;

      const result = await pool.query(`
        SELECT
          pr.id, pr.status, pr.quantity, pr.notes, pr.admin_notes,
          pr.created_at, pr.updated_at,
          pr.id_document_url, pr.id_document_type,
          p.name AS product_name, p.price, p.unit, p.image_url AS product_image,
          (p.price * pr.quantity) AS total_price,
          i.company_name AS industry_name, i.sector, i.location AS industry_location
        FROM purchase_requests pr
        JOIN stakeholders s ON s.id = pr.stakeholder_id
        JOIN products p ON p.id = pr.product_id
        JOIN industries i ON i.id = pr.industry_id
        ${where}
        ORDER BY pr.created_at DESC
        LIMIT $${n++} OFFSET $${n++}
      `, [...params, limitNum, offset]);

      res.json({ transactions: result.rows, total: result.rows.length, page: pageNum });
    } catch (error) {
      console.error("Get my requests error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.get(
  "/purchases/industry-requests",
  authenticateToken,
  requireRole("industry"),
  async (req, res) => {
    try {
      const industryResult = await pool.query(
        "SELECT id FROM industries WHERE user_id = $1", [req.user.id]
      );
      if (industryResult.rows.length === 0) {
        return res.status(404).json({ message: "Industry profile not found" });
      }
      const industry_id = industryResult.rows[0].id;

      const { status, dateFrom, dateTo, page = "1", limit = "50" } = req.query;
      const params = [industry_id];
      let n = 2;
      let where = `WHERE pr.industry_id = $1`;
      if (status && status !== "all") { where += ` AND pr.status = $${n++}`; params.push(status); }
      else { where += ` AND pr.status IN ('approved','pending','rejected','completed')`; }
      if (dateFrom) { where += ` AND pr.created_at >= $${n++}`; params.push(dateFrom); }
      if (dateTo)   { where += ` AND pr.created_at <= $${n++}::date + interval '1 day'`; params.push(dateTo); }

      const pageNum  = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, parseInt(limit));
      const offset   = (pageNum - 1) * limitNum;

      const result = await pool.query(`
        SELECT
          pr.id, pr.status, pr.quantity, pr.notes, pr.full_name, pr.organization_name,
          pr.phone, pr.location, pr.created_at, pr.updated_at, pr.admin_notes,
          pr.id_document_type,
          p.name AS product_name, p.price, p.unit, p.image_url AS product_image,
          (p.price * pr.quantity) AS total_price,
          s.organization_name AS stakeholder_org, s.contact_person, s.identity_verified,
          s.id AS stakeholder_id,
          c.id AS conversation_id,
          u.email AS stakeholder_email
        FROM purchase_requests pr
        JOIN products p ON p.id = pr.product_id
        JOIN stakeholders s ON s.id = pr.stakeholder_id
        JOIN users u ON u.id = s.user_id
        LEFT JOIN conversations c ON c.stakeholder_id = pr.stakeholder_id AND c.industry_id = pr.industry_id
        ${where}
        ORDER BY pr.created_at DESC
        LIMIT $${n++} OFFSET $${n++}
      `, [...params, limitNum, offset]);

      res.json({ transactions: result.rows, total: result.rows.length, page: pageNum });
    } catch (error) {
      console.error("Get industry requests error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.get("/admin/purchases", requireAdminAuth, async (req, res) => {
  const { status } = req.query;
  try {
    let query = `
      SELECT
        pr.id, pr.status, pr.quantity, pr.full_name, pr.organization_name,
        pr.phone, pr.location, pr.notes, pr.business_license, pr.admin_notes,
        pr.id_document_url, pr.id_document_type, pr.created_at,
        p.name AS product_name, p.price, p.unit,
        i.company_name AS industry_name, i.sector,
        s.organization_name AS stakeholder_org,
        u.email AS stakeholder_email
      FROM purchase_requests pr
      JOIN products p ON p.id = pr.product_id
      JOIN industries i ON i.id = pr.industry_id
      JOIN stakeholders s ON s.id = pr.stakeholder_id
      JOIN users u ON u.id = s.user_id
    `;
    const params = [];
    if (status) {
      query += " WHERE pr.status = $1";
      params.push(status);
    }
    // No status filter = return everything (used by "All" tab)
    query += " ORDER BY pr.created_at DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Admin get purchases error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin approves a purchase request — marks stakeholder as verified, opens conversation, sends email
router.patch("/admin/purchases/:id/approve", requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { admin_notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE purchase_requests SET status = 'approved', admin_notes = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [admin_notes || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Purchase request not found" });

    const request = result.rows[0];

    // Mark stakeholder as identity_verified so future requests skip the ID upload step
    await pool.query(
      `UPDATE stakeholders SET identity_verified = TRUE, identity_verified_at = NOW()
       WHERE id = $1`,
      [request.stakeholder_id]
    );

    // Open conversation so stakeholder and industry can now communicate
    await pool.query(
      `INSERT INTO conversations (stakeholder_id, industry_id, purchase_request_id)
       VALUES ($1, $2, $3) ON CONFLICT (stakeholder_id, industry_id) DO NOTHING`,
      [request.stakeholder_id, request.industry_id, request.id]
    );

    // Send approval email + in-app notification
    try {
      const emailRes = await pool.query(
        `SELECT u.id AS stakeholder_user_id, u.email, p.name AS product_name, i.company_name
         FROM purchase_requests pr
         JOIN stakeholders s ON s.id = pr.stakeholder_id
         JOIN users u ON u.id = s.user_id
         JOIN products p ON p.id = pr.product_id
         JOIN industries i ON i.id = pr.industry_id
         WHERE pr.id = $1`, [id]
      );
      if (emailRes.rows.length > 0) {
        const { stakeholder_user_id, email, product_name, company_name } = emailRes.rows[0];
        await sendPurchaseApprovedEmail(email, product_name, company_name);
        await createNotification(pool, stakeholder_user_id,
          'Purchase Request Approved',
          `Your request for "${product_name}" from ${company_name} has been approved. You can now message the industry.`,
          'approval', parseInt(id)
        );
      }
    } catch (emailErr) {
      console.error("Purchase approval email/notif failed (non-fatal):", emailErr.message);
    }

    res.json({ message: "Purchase request approved and stakeholder verified", request });
  } catch (error) {
    console.error("Admin approve purchase error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/admin/purchases/:id/reject", requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { admin_notes } = req.body;
  if (!admin_notes) return res.status(400).json({ message: "Rejection reason is required" });

  try {
    const result = await pool.query(
      `UPDATE purchase_requests SET status = 'rejected', admin_notes = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [admin_notes, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Purchase request not found" });

    // Send rejection email + in-app notification (non-fatal)
    try {
      const emailRes = await pool.query(
        `SELECT u.id AS stakeholder_user_id, u.email, p.name AS product_name, i.company_name
         FROM purchase_requests pr
         JOIN stakeholders s ON s.id = pr.stakeholder_id
         JOIN users u ON u.id = s.user_id
         JOIN products p ON p.id = pr.product_id
         JOIN industries i ON i.id = pr.industry_id
         WHERE pr.id = $1`, [id]
      );
      if (emailRes.rows.length > 0) {
        const { stakeholder_user_id, email, product_name, company_name } = emailRes.rows[0];
        await sendPurchaseRejectedEmail(email, product_name, company_name, admin_notes);
        await createNotification(pool, stakeholder_user_id,
          'Purchase Request Rejected',
          `Your request for "${product_name}" from ${company_name} was not approved. Reason: ${admin_notes}`,
          'approval', parseInt(id)
        );
      }
    } catch (emailErr) {
      console.error("Purchase rejection email/notif failed (non-fatal):", emailErr.message);
    }

    res.json({ message: "Purchase request rejected", request: result.rows[0] });
  } catch (error) {
    console.error("Admin reject purchase error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
