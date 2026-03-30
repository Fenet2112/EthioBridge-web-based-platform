import { useState } from "react";
import "./IDVerificationModal.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ID_TYPES = [
  { value: "national_id", label: "National ID Card" },
  { value: "passport", label: "Passport" },
  { value: "business_license", label: "Business License" },
  { value: "drivers_license", label: "Driver's License" },
];

function IDVerificationModal({ requestId, onClose, onSuccess }) {
  const [idType, setIdType] = useState("national_id");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setError("File must be under 5MB."); return; }
    setFile(f);
    setError("");
    if (f.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async () => {
    if (!file) { setError("Please select an ID document."); return; }
    setUploading(true);
    setError("");

    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("id_document", file);
    formData.append("id_document_type", idType);

    try {
      const res = await fetch(`${API_BASE_URL}/api/purchases/${requestId}/upload-id`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onSuccess(data.message);
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="idv-overlay" onClick={onClose}>
      <div className="idv-modal" onClick={(e) => e.stopPropagation()}>
        <button className="idv-close" onClick={onClose}>✕</button>

        <div className="idv-header">
          <div className="idv-shield">🛡️</div>
          <h2>Identity Verification Required</h2>
          <p>
            This is your first purchase request. Please upload a valid ID to verify
            your identity. Future requests will be sent directly without this step.
          </p>
        </div>

        <div className="idv-steps">
          <div className="idv-step done">
            <span className="step-dot">✓</span>
            <span>Request details submitted</span>
          </div>
          <div className="idv-step active">
            <span className="step-dot">2</span>
            <span>Upload identity document</span>
          </div>
          <div className="idv-step">
            <span className="step-dot">3</span>
            <span>Admin review &amp; approval</span>
          </div>
        </div>

        <div className="idv-form">
          <div className="idv-field">
            <label>Document Type</label>
            <select value={idType} onChange={(e) => setIdType(e.target.value)}>
              {ID_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="idv-field">
            <label>Upload Document</label>
            <div
              className={`idv-dropzone ${file ? "has-file" : ""}`}
              onClick={() => document.getElementById("idv-file-input").click()}
            >
              {preview ? (
                <img src={preview} alt="ID preview" className="idv-preview-img" />
              ) : file ? (
                <div className="idv-file-info">
                  <span className="idv-file-icon">📄</span>
                  <span>{file.name}</span>
                </div>
              ) : (
                <>
                  <span className="idv-upload-icon">📤</span>
                  <p>Click to upload or drag &amp; drop</p>
                  <span className="idv-hint">JPG, PNG or PDF · Max 5MB</span>
                </>
              )}
            </div>
            <input
              id="idv-file-input"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={handleFile}
              style={{ display: "none" }}
            />
            {file && (
              <button className="idv-change-btn" onClick={() => { setFile(null); setPreview(null); }}>
                Change file
              </button>
            )}
          </div>

          {error && <div className="idv-error">{error}</div>}

          <div className="idv-notice">
            🔒 Your document is encrypted and only reviewed by EthioBridge admins.
            It will not be shared with industries.
          </div>
        </div>

        <button className="idv-submit-btn" onClick={handleSubmit} disabled={uploading || !file}>
          {uploading ? "Uploading..." : "Submit for Verification"}
        </button>
      </div>
    </div>
  );
}

export default IDVerificationModal;
