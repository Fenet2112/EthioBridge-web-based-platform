/**
 * Image Upload Utility
 *
 * Priority order:
 *   1. Supabase Storage  (if SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set)
 *   2. Cloudinary        (if CLOUDINARY_* vars are set)
 *   3. Local disk        (fallback for development)
 *
 * All three expose the same interface:
 *   createUpload(folder, localDir, maxSizeMB) → multer middleware
 *   getFileUrl(req, localDir)                 → public URL string
 *   deleteFile(url)                           → void (non-fatal)
 */

const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");

// ─────────────────────────────────────────────────────────
// 1. Supabase Storage
// ─────────────────────────────────────────────────────────
let supabase = null;
let supabaseConfigured = false;

try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = require("@supabase/supabase-js");
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
    supabaseConfigured = true;
    console.log("[Storage] Supabase Storage configured");
  }
} catch (e) {
  console.log("[Storage] Supabase not available:", e.message);
}

// ─────────────────────────────────────────────────────────
// 2. Cloudinary (fallback)
// ─────────────────────────────────────────────────────────
let cloudinaryConfigured = false;
let cloudinary, CloudinaryStorage;

if (!supabaseConfigured) {
  try {
    cloudinary      = require("cloudinary").v2;
    CloudinaryStorage = require("multer-storage-cloudinary").CloudinaryStorage;

    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key:    process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      cloudinaryConfigured = true;
      console.log("[Storage] Cloudinary configured");
    }
  } catch (e) {
    // Cloudinary not installed or not configured
  }
}

if (!supabaseConfigured && !cloudinaryConfigured) {
  console.log("[Storage] Using local disk storage (development fallback)");
}

// ─────────────────────────────────────────────────────────
// Supabase bucket name mapping
// ─────────────────────────────────────────────────────────
const BUCKET_MAP = {
  products: "product-images",
  profiles: "profile-images",
  id_documents: "id-documents",
};

function getBucket(folder) {
  return BUCKET_MAP[folder] || "product-images";
}

// ─────────────────────────────────────────────────────────
// createUpload — returns a multer middleware
// ─────────────────────────────────────────────────────────
function createUpload(folder, localDir, maxSizeMB = 2) {
  const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const allowedExts  = /jpeg|jpg|png|webp/;

  const fileFilter = (req, file, cb) => {
    const extOk  = allowedExts.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowedMimes.includes(file.mimetype);
    extOk && mimeOk ? cb(null, true) : cb(new Error("Only JPG, PNG, or WebP images are allowed"));
  };

  let storage;

  if (supabaseConfigured) {
    // Use memory storage — we'll upload to Supabase in getFileUrl()
    storage = multer.memoryStorage();
  } else if (cloudinaryConfigured) {
    storage = new CloudinaryStorage({
      cloudinary,
      params: {
        folder:          `ethiobridge/${folder}`,
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        transformation:  [{ quality: "auto", fetch_format: "auto" }],
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

  return multer({ storage, limits: { fileSize: maxSizeMB * 1024 * 1024 }, fileFilter });
}

// ─────────────────────────────────────────────────────────
// getFileUrl — upload to Supabase if needed, return public URL
// ─────────────────────────────────────────────────────────
async function getFileUrl(req, localDir) {
  if (!req.file) return null;

  if (supabaseConfigured) {
    // req.file.buffer is available because we used memoryStorage()
    const bucket  = getBucket(localDir);
    const ext     = path.extname(req.file.originalname).toLowerCase() || ".jpg";
    const userId  = req.user?.id || "x";
    const filePath = `${localDir}/${userId}_${Date.now()}${ext}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error("[Supabase Storage] Upload error:", error.message);
      throw new Error("Image upload failed: " + error.message);
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    console.log(`[Supabase Storage] Uploaded: ${data.publicUrl}`);
    return data.publicUrl;
  }

  if (cloudinaryConfigured) {
    return req.file.path; // Cloudinary sets req.file.path to the full URL
  }

  // Local disk
  return `/uploads/${localDir}/${req.file.filename}`;
}

// ─────────────────────────────────────────────────────────
// deleteFile — remove from storage
// ─────────────────────────────────────────────────────────
async function deleteFile(fileUrl) {
  if (!fileUrl) return;

  if (supabaseConfigured && fileUrl.startsWith("http") && fileUrl.includes("supabase")) {
    try {
      // Extract bucket + path from URL
      // URL: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
      const url   = new URL(fileUrl);
      const parts = url.pathname.split("/");
      // parts: ["", "storage", "v1", "object", "public", "<bucket>", ...rest]
      const bucketIdx = parts.indexOf("public") + 1;
      if (bucketIdx > 0 && bucketIdx < parts.length) {
        const bucket   = parts[bucketIdx];
        const filePath = parts.slice(bucketIdx + 1).join("/");
        const { error } = await supabase.storage.from(bucket).remove([filePath]);
        if (error) console.error("[Supabase Storage] Delete error (non-fatal):", error.message);
        else console.log(`[Supabase Storage] Deleted: ${filePath}`);
      }
    } catch (e) {
      console.error("[Supabase Storage] Delete failed (non-fatal):", e.message);
    }
    return;
  }

  if (cloudinaryConfigured && fileUrl.startsWith("http") && fileUrl.includes("cloudinary")) {
    try {
      const parts      = fileUrl.split("/");
      const uploadIdx  = parts.indexOf("upload");
      if (uploadIdx !== -1) {
        const publicIdWithExt = parts.slice(uploadIdx + 2).join("/");
        const publicId        = publicIdWithExt.replace(/\.[^/.]+$/, "");
        await cloudinary.uploader.destroy(publicId);
      }
    } catch (e) {
      console.error("[Cloudinary] Delete failed (non-fatal):", e.message);
    }
    return;
  }

  // Local file
  try {
    const localPath = path.join(__dirname, "../../", fileUrl);
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
  } catch (e) {
    console.error("[Upload] Local delete failed (non-fatal):", e.message);
  }
}

module.exports = { createUpload, getFileUrl, deleteFile, supabaseConfigured, cloudinaryConfigured };
