/**
 * Cloudinary upload utility
 * Provides multer storage that uploads directly to Cloudinary.
 * Falls back to local disk storage if Cloudinary is not configured.
 */
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ── Try to configure Cloudinary ──
let cloudinaryConfigured = false;
let cloudinary, CloudinaryStorage;

try {
  cloudinary = require("cloudinary").v2;
  CloudinaryStorage = require("multer-storage-cloudinary").CloudinaryStorage;

  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    cloudinaryConfigured = true;
    console.log("[Cloudinary] Configured successfully");
  } else {
    console.log("[Cloudinary] Not configured — using local disk storage");
  }
} catch (e) {
  console.log("[Cloudinary] Package not available — using local disk storage");
}

/**
 * Create a multer upload middleware.
 * @param {string} folder  Cloudinary folder name (e.g. "products", "profiles")
 * @param {string} localDir  Local fallback directory (relative to backend root)
 * @param {number} maxSizeMB  Max file size in MB
 */
function createUpload(folder, localDir, maxSizeMB = 2) {
  const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const allowedExts  = /jpeg|jpg|png|webp/;

  const fileFilter = (req, file, cb) => {
    const extOk  = allowedExts.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowedMimes.includes(file.mimetype);
    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, or WebP images are allowed"));
    }
  };

  let storage;

  if (cloudinaryConfigured) {
    storage = new CloudinaryStorage({
      cloudinary,
      params: {
        folder:         `ethiobridge/${folder}`,
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        transformation: [{ quality: "auto", fetch_format: "auto" }],
      },
    });
  } else {
    // Local disk fallback
    const absDir = path.join(__dirname, "../../uploads", localDir);
    if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });

    storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, absDir),
      filename:    (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${folder}_${req.user?.id || "x"}_${Date.now()}${ext}`);
      },
    });
  }

  return multer({
    storage,
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
    fileFilter,
  });
}

/**
 * Get the public URL for an uploaded file.
 * - Cloudinary: req.file.path  (full https URL)
 * - Local disk:  /uploads/<localDir>/<filename>
 */
function getFileUrl(req, localDir) {
  if (!req.file) return null;
  if (cloudinaryConfigured) {
    return req.file.path; // Cloudinary returns the full URL in req.file.path
  }
  return `/uploads/${localDir}/${req.file.filename}`;
}

/**
 * Delete a file by its stored URL.
 * - Cloudinary: extract public_id and destroy
 * - Local disk: unlink the file
 */
async function deleteFile(fileUrl) {
  if (!fileUrl) return;

  if (cloudinaryConfigured && fileUrl.startsWith("http")) {
    try {
      // Extract public_id from Cloudinary URL
      // URL format: https://res.cloudinary.com/<cloud>/image/upload/v<ver>/<folder>/<public_id>.<ext>
      const parts = fileUrl.split("/");
      const uploadIdx = parts.indexOf("upload");
      if (uploadIdx !== -1) {
        const publicIdWithExt = parts.slice(uploadIdx + 2).join("/"); // skip version
        const publicId = publicIdWithExt.replace(/\.[^/.]+$/, ""); // remove extension
        await cloudinary.uploader.destroy(publicId);
        console.log(`[Cloudinary] Deleted: ${publicId}`);
      }
    } catch (e) {
      console.error("[Cloudinary] Delete failed (non-fatal):", e.message);
    }
  } else {
    // Local file
    try {
      const localPath = path.join(__dirname, "../../", fileUrl);
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    } catch (e) {
      console.error("[Upload] Local delete failed (non-fatal):", e.message);
    }
  }
}

module.exports = { createUpload, getFileUrl, deleteFile, cloudinaryConfigured };
