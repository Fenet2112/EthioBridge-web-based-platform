import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../utils/api";
import "../ProfileForm.css";

function IndustryProfile() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    company_name: "",
    sector: "",
    location: "",
    description: "",
    phone: "",
    website: "",
    established_year: "",
    latitude: "",
    longitude: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    if (!userData.id) {
      setError("Session expired. Please log in again.");
      navigate("/login");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/industry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userData.id, ...formData }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Submission failed");

      // Refresh page to show updated status
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-icon">🏭</div>
          <h1>Complete Your Industry Profile</h1>
          <p>Fill in your company details to submit your application for admin review.</p>
        </div>

        {error && <p className="error-message">{error}</p>}

        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-row">
            <div className="form-group">
              <label>Company Name *</label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                placeholder="e.g. Addis Construction PLC"
                required
              />
            </div>
            <div className="form-group">
              <label>Industry Sector *</label>
              <select name="sector" value={formData.sector} onChange={handleChange} required>
                <option value="">Select sector...</option>
                <option value="Cement & Concrete">Cement & Concrete</option>
                <option value="Steel & Metal">Steel & Metal</option>
                <option value="Timber & Wood">Timber & Wood</option>
                <option value="Glass & Aluminum">Glass & Aluminum</option>
                <option value="Electrical & Plumbing">Electrical & Plumbing</option>
                <option value="Paint & Finishing">Paint & Finishing</option>
                <option value="Tiles & Ceramics">Tiles & Ceramics</option>
                <option value="Machinery & Equipment">Machinery & Equipment</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Location / City *</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g. Addis Ababa"
                required
              />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+251 911 000 000"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Latitude (for map display)</label>
              <input
                type="number"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                placeholder="e.g. 9.0320 (Addis Ababa)"
                step="0.000001"
                min="-90"
                max="90"
              />
              <small style={{color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', display: 'block'}}>
                Optional: Your location's latitude coordinate
              </small>
            </div>
            <div className="form-group">
              <label>Longitude (for map display)</label>
              <input
                type="number"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                placeholder="e.g. 38.7469 (Addis Ababa)"
                step="0.000001"
                min="-180"
                max="180"
              />
              <small style={{color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', display: 'block'}}>
                Optional: Your location's longitude coordinate
              </small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Website</label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://yourcompany.com"
              />
            </div>
            <div className="form-group">
              <label>Year Established</label>
              <input
                type="number"
                name="established_year"
                value={formData.established_year}
                onChange={handleChange}
                placeholder="e.g. 2010"
                min="1900"
                max={new Date().getFullYear()}
              />
            </div>
          </div>

          <div className="form-group full-width">
            <label>Company Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe your company, products, and services..."
              rows={4}
            />
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Submitting..." : "Submit Application →"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default IndustryProfile;
