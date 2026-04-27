/**
 * imageUrl — resolve an image URL to its full absolute URL.
 *
 * Handles three cases:
 *   1. Supabase Storage URL  (https://...supabase.co/storage/...) → return as-is
 *   2. Cloudinary URL        (https://res.cloudinary.com/...)      → return as-is
 *   3. Local /uploads/...    → prepend backend base URL
 *   4. null / empty          → return null
 */
const BACKEND = process.env.REACT_APP_API_URL || "https://ethiobridge-web-based-platform.onrender.com";

export function imageUrl(url) {
  if (!url) return null;
  // Already an absolute URL (Supabase, Cloudinary, or any https)
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  // Local path — prepend backend
  if (url.startsWith("/")) return `${BACKEND}${url}`;
  return `${BACKEND}/${url}`;
}

/**
 * imgProps — returns src + onError props for an <img> tag.
 */
export function imgProps(url, alt = "") {
  const src = imageUrl(url);
  return {
    src: src || "",
    alt,
    onError: (e) => { e.target.style.display = "none"; },
    style: src ? {} : { display: "none" },
  };
}
