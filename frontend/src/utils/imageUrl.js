/**
 * imageUrl — resolve an image URL to its full absolute URL.
 *
 * - If the URL is already absolute (http/https) → return as-is (Cloudinary URL)
 * - If it starts with /uploads/ → prepend the backend base URL
 * - Otherwise → return null (no image)
 */
const BACKEND = process.env.REACT_APP_API_URL || "https://ethiobridge-web-based-platform.onrender.com";

export function imageUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${BACKEND}${url}`;
  return `${BACKEND}/${url}`;
}

/**
 * imgProps — returns src + onError props for an <img> tag.
 * Falls back to hiding the image on error.
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
