import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./ProfileForm.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

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

const INITIAL_FORM_STATE = {
  organization_name: "",
  organization_type: "",
  location: "",
  description: "",
  phone: "",
  contact_person: "",
};

function StakeholderProfile() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [originalFormData, setOriginalFormData] = useState(INITIAL_FORM_STATE);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileStatus, setProfileStatus] = useState("incomplete");
  const [isEditing, setIsEditing] = useState(true);

  // Load existing profile on mount
  React.useEffect(() => {
    const loadProfile = async () => {
      const token = localStorage.getItem("token");
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      
      if (!token || !userData.id) {
        navigate("/login");
        return;
      }

      try {
        // Check if profile exists
        const res = await fetch(`${API_BASE_URL}/api/profile/stakeholder/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setProfileStatus(data.status || "incomplete");
          
          // Load existing profile data if available
          if (data.profile) {
            const profileData = {
              organization_name: data.profile.organization_name || "",
              organization_type: data.profile.organization_type || "",
              location: data.profile.location || "",
              description: data.profile.description || "",
              phone: data.profile.phone || "",
              contact_person: data.profile.contact_person || "",
            };
            setFormData(profileData);
            setOriginalFormData(profileData);
            
            // If approved, show view mode
            if (data.status === "approved") {
              setIsEditing(false);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      }
    };

    loadProfile();
  }, [navigate]);

  // useCallback prevents unnecessary re-creation of the handler on every render
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    console.log('Form submitted with data:', formData);

    // Validate session before making a network request
    let userData;
    try {
      userData = JSON.parse(localStorage.getItem("user") || "{}");
      console.log('User data from localStorage:', userData);
    } catch {
      setError("Session data is corrupted. Please log in again.");
      navigate("/login");
      return;
    }

    if (!userData?.id) {
      setError("Session expired. Please log in again.");
      navigate("/login");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const payload = { user_id: userData.id, ...formData };
      console.log('Sending payload:', payload);
      
      const response = await fetch(`${API_BASE_URL}/api/profile/stakeholder`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('Response:', response.status, data);

      if (!response.ok) {
        // Surface the server's error message when available
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      if (profileStatus === "incomplete") {
        // Update user status in localStorage
        userData.status = "pending";
        localStorage.setItem("user", JSON.stringify(userData));
        console.log('Updated user status to pending in localStorage');
        
        alert("Profile submitted! Your application is now pending admin approval.");
        navigate("/pending");
      } else {
        alert("Profile updated successfully!");
        setIsEditing(false);
        
        // Reload profile status
        const statusRes = await fetch(`${API_BASE_URL}/api/profile/stakeholder/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setProfileStatus(statusData.status || "incomplete");
          
          // Update localStorage with new status
          userData.status = statusData.status;
          localStorage.setItem("user", JSON.stringify(userData));
        }
      }
    } catch (err) {
      // Only log in development to avoid leaking details in production
      console.error("StakeholderProfile submission error:", err);
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      // Always restore the loading state regardless of success or failure
      setLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-icon">🤝</div>
          <h1>
            {isEditing 
              ? (profileStatus === "incomplete" ? "Complete Your Stakeholder Profile" : "Edit Your Stakeholder Profile")
              : "Your Stakeholder Profile"}
          </h1>
          <p>
            {isEditing 
              ? "Fill in your organization details to submit your application for admin review."
              : "View your organization details. Click Edit to make changes."}
          </p>
        </div>

        {error && (
          <p className="error-message" role="alert" aria-live="assertive">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="profile-form" noValidate>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="organization_name">Organization Name *</label>
              <input
                id="organization_name"
                type="text"
                name="organization_name"
                value={formData.organization_name}
                onChange={handleChange}
                placeholder="e.g. Addis Real Estate Group"
                required
                autoComplete="organization"
                disabled={!isEditing && profileStatus === "approved"}
              />
            </div>
            <div className="form-group">
              <label htmlFor="organization_type">Organization Type *</label>
              <select
                id="organization_type"
                name="organization_type"
                value={formData.organization_type}
                onChange={handleChange}
                required
                disabled={!isEditing && profileStatus === "approved"}
              >
                <option value="">Select type...</option>
                {ORGANIZATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="location">Location / City *</label>
              <input
                id="location"
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g. Addis Ababa"
                required
                autoComplete="address-level2"
                disabled={!isEditing && profileStatus === "approved"}
              />
            </div>
            <div className="form-group">
              <label htmlFor="contact_person">Contact Person</label>
              <input
                id="contact_person"
                type="text"
                name="contact_person"
                value={formData.contact_person}
                onChange={handleChange}
                placeholder="Full name of primary contact"
                autoComplete="name"
                disabled={!isEditing && profileStatus === "approved"}
              />
            </div>
          </div>

          <div className="form-group full-width">
            <label htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+251 911 000 000"
              autoComplete="tel"
              disabled={!isEditing && profileStatus === "approved"}
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="description">Organization Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe your organization, projects, and needs..."
              rows={4}
              disabled={!isEditing && profileStatus === "approved"}
            />
          </div>

          <div className="form-buttons">
            {!isEditing && profileStatus === "approved" ? (
              <button 
                type="button" 
                className="edit-btn"
                onClick={() => setIsEditing(true)}
              >
                ✏️ Edit Profile
              </button>
            ) : (
              <>
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading 
                    ? "Saving..." 
                    : profileStatus === "incomplete" 
                      ? "Submit Application →" 
                      : "Save Changes"}
                </button>
                {profileStatus !== "incomplete" && (
                  <button 
                    type="button" 
                    className="cancel-btn"
                    onClick={() => {
                      setFormData(originalFormData);
                      setIsEditing(false);
                      setError("");
                    }}
                    disabled={loading}
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
