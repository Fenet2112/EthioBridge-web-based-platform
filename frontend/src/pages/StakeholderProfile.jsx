import React, { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../utils/api";
import "./ProfileForm.css";

const ORGANIZATION_TYPES = [
  "Contractor",
  "Developer / Real Estate",
  "Consulting Engineer",
  "Government Agency",
  "NGO / Non-Profit",
  "Architect / Designer",
  "Buyer / Investor",
  "Other",
];

const ID_TYPES = [
  { value: "national_id",      label: "National ID Card" },
  { value: "passport",         label: "Passport" },
  { value: "business_license", label: "Business License" },
  { value: "drivers_license",  label: "Driver's License" },
];

const INITIAL = {
  organization_name: "",
  organization_type: "",
  location: "",
  description: "",
  phone: "",
  contact_person: "",
  id_document_type: "national_id",
};

function StakeholderProfile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [formData, setFormData]           = useState(INITIAL);
  const [originalFormData, setOriginal]   = useState(INITIAL);
  const [error, setError]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [profileStatus, setProfileStatus] = useState("incomplete");
  const [isEditing, setIsEditing]         = useState(true);
  const [idFile, setIdFile]               = useState(null);
  const [idPreview, setIdPreview]         = useState(null);
  const [existingIdUrl, setExistingIdUrl] = useState(null);

  React.useEffect(() => {
    const load = async () => {
      const token    = localStorage.getItem("token");
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      if (!token || !userData.id) { navigate("/login"); return; }

      try {
        const res = await fetch(`${API_BASE_URL}/api/profile/stakeholder/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setProfileStatus(data.status || "incomplete");

        if (data.profile) {
          const p = {
            organization_name: data.profile.organization_name || "",
            organization_type: data.profile.organization_type || "",
            location:          data.profile.location          || "",
            description:       data.profile.description       || "",
            phone:             data.profile.phone             || "",
            contact_person:    data.profile.contact_person    || "",
            id_document_type:  data.profile.id_document_type  || "national_id",
          };
          setFormData(p);
          setOriginal(p);
          if (data.profile.id_document_url) {
            setExistingIdUrl(`${API_BASE_URL}${data.profile.id_document_url}`);
          }
          if (data.status === "approved") setIsEditing(false);
        }
      } catch (e) { console.error(e); }
    };
    load();
  }, [navigate]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setError("ID file must be under 5MB."); return; }
    setIdFile(f);
    setError("");
    setIdPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    if (!userData?.id) { setError("Session expired. Please log in again."); navigate("/login"); return; }

    setLoading(true);
    try {
      const token   = localStorage.getItem("token");
      const payload = new FormData();
      payload.append("user_id", userData.id);
      Object.entries(formData).forEach(([k, v]) => payload.append(k, v));
      if (idFile) payload.append("id_document", idFile);

      const res  = await fetch(`${API_BASE_URL}/api/profile/stakeholder`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: payload,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Error ${res.status}`);

      // Stakeholders are already approved — profile save just updates data
      // Update localStorage with fresh status from response
      if (data.status) {
        userData.status = data.status;
        localStorage.setItem("user", JSON.stringify(userData));
      }
      // Refresh page to show updated profile
      window.location.reload();
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const isApproved = profileStatus === "approved";

  return (
    <div className="profile-page">
      <div className="profile-container">

        {/* Header */}
        <div className="profile-header">
          <div className="profile-icon">🤝</div>
          <h1>
            {isEditing
              ? "Edit Your Stakeholder Profile"
              : "Your Stakeholder Profile"}
          </h1>
          <p>
            {isEditing
              ? "Fill in your organization details and upload a valid ID to submit for admin review."
              : "View your organization details. Click Edit to make changes."}
          </p>
        </div>

        {error && (
          <div className="sp-error" role="alert">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="sp-form" noValidate>

          {/* ── Row 1 ── */}
          <div className="sp-row">
            <div className="sp-field">
              <label htmlFor="organization_name">Organization Name <span className="sp-req">*</span></label>
              <input
                id="organization_name" name="organization_name" type="text"
                value={formData.organization_name} onChange={handleChange}
                placeholder="e.g. Addis Real Estate Group" required
                disabled={!isEditing && isApproved}
              />
            </div>
            <div className="sp-field">
              <label htmlFor="organization_type">Organization Type <span className="sp-req">*</span></label>
              <select
                id="organization_type" name="organization_type"
                value={formData.organization_type} onChange={handleChange}
                required disabled={!isEditing && isApproved}
              >
                <option value="">Select type...</option>
                {ORGANIZATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* ── Row 2 ── */}
          <div className="sp-row">
            <div className="sp-field">
              <label htmlFor="location">Location / City <span className="sp-req">*</span></label>
              <input
                id="location" name="location" type="text"
                value={formData.location} onChange={handleChange}
                placeholder="e.g. Addis Ababa" required
                disabled={!isEditing && isApproved}
              />
            </div>
            <div className="sp-field">
              <label htmlFor="contact_person">Contact Person</label>
              <input
                id="contact_person" name="contact_person" type="text"
                value={formData.contact_person} onChange={handleChange}
                placeholder="Full name of primary contact"
                disabled={!isEditing && isApproved}
              />
            </div>
          </div>

          {/* ── Phone ── */}
          <div className="sp-field">
            <label htmlFor="phone">Phone Number</label>
            <input
              id="phone" name="phone" type="tel"
              value={formData.phone} onChange={handleChange}
              placeholder="+251 911 000 000"
              disabled={!isEditing && isApproved}
            />
          </div>

          {/* ── Description ── */}
          <div className="sp-field">
            <label htmlFor="description">Organization Description</label>
            <textarea
              id="description" name="description"
              value={formData.description} onChange={handleChange}
              placeholder="Describe your organization, projects, and needs..."
              rows={4} disabled={!isEditing && isApproved}
            />
          </div>

          {/* ══ ID DOCUMENT SECTION ══ */}
          <div className="sp-id-section">
            <div className="sp-id-header">
              <span className="sp-id-icon">🪪</span>
              <div>
                <h3>Identity Document</h3>
                <p>Upload a valid ID for verification. Required when submitting purchase requests.</p>
              </div>
            </div>

            {/* Document type */}
            <div className="sp-field sp-id-type">
              <label htmlFor="id_document_type">Document Type</label>
              <select
                id="id_document_type" name="id_document_type"
                value={formData.id_document_type} onChange={handleChange}
                disabled={!isEditing && isApproved}
              >
                {ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* Upload area */}
            {isEditing ? (
              <>
                <div
                  className={`sp-dropzone ${idFile ? "has-file" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {idPreview ? (
                    <img src={idPreview} alt="ID preview" className="sp-id-preview" />
                  ) : idFile ? (
                    <div className="sp-file-info">
                      <span>📄</span>
                      <span>{idFile.name}</span>
                    </div>
                  ) : existingIdUrl ? (
                    <div className="sp-file-info">
                      <span>✅</span>
                      <span>ID already uploaded — click to replace</span>
                    </div>
                  ) : (
                    <div className="sp-dropzone-empty">
                      <span className="sp-upload-icon">📤</span>
                      <strong>Click to upload your ID document</strong>
                      <span>JPG, PNG or PDF · Max 5MB</span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                {idFile && (
                  <button
                    type="button" className="sp-remove-btn"
                    onClick={() => { setIdFile(null); setIdPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  >
                    ✕ Remove file
                  </button>
                )}
              </>
            ) : existingIdUrl ? (
              <div className="sp-id-existing">
                {existingIdUrl.match(/\.(jpg|jpeg|png)$/i) ? (
                  <a href={existingIdUrl} target="_blank" rel="noopener noreferrer">
                    <img src={existingIdUrl} alt="Uploaded ID" className="sp-id-preview" />
                  </a>
                ) : (
                  <a href={existingIdUrl} target="_blank" rel="noopener noreferrer" className="sp-view-doc">
                    📄 View Uploaded Document
                  </a>
                )}
              </div>
            ) : (
              <p className="sp-id-missing">No ID document uploaded yet.</p>
            )}

            <p className="sp-id-note">
              🔒 Your document is encrypted and only reviewed by EthioBridge admins. It will not be shared with industries.
            </p>
          </div>

          {/* ── Buttons ── */}
          <div className="sp-buttons">
            {!isEditing && isApproved ? (
              <button type="button" className="sp-btn-edit" onClick={() => setIsEditing(true)}>
                ✏️ Edit Profile
              </button>
            ) : (
              <>
                <button type="submit" className="sp-btn-submit" disabled={loading}>
                  {loading ? "Saving..." : "Save Profile"}
                </button>
                {profileStatus !== "incomplete" && (
                  <button
                    type="button" className="sp-btn-cancel" disabled={loading}
                    onClick={() => { setFormData(originalFormData); setIsEditing(false); setError(""); }}
                  >
                    Cancel
                  </button>
                )}
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default StakeholderProfile;
