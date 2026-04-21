import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import StakeholderNav from '../components/StakeholderNav';
import { API_BASE_URL } from '../utils/api';
import './ProfilePage.css';

function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [formData, setFormData] = useState({ username: '', full_name: '', bio: '' });
  const fileInputRef = useRef(null);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      setProfile(data);
      setFormData({ username: data.username || '', full_name: data.full_name || '', bio: data.bio || '' });
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  // Upload immediately on file select — no separate button needed
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB.'); return; }

    setPhotoUploading(true);
    const token = localStorage.getItem('token');
    const fd = new FormData();
    fd.append('profile_picture', file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/me/picture`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      // Update profile with the persisted server URL
      setProfile(prev => ({ ...prev, profile_picture: data.profile_picture }));
    } catch (err) {
      alert('Photo upload failed: ' + err.message);
    } finally {
      setPhotoUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async () => {
    if (!window.confirm('Remove profile photo?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/me/picture`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to remove photo');
      setProfile(prev => ({ ...prev, profile_picture: null }));
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update');
      setProfile(prev => ({ ...prev, ...data.profile }));
      setIsEditing(false);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="pp-page">
      <StakeholderNav />
      <div className="pp-header">
        <h1>My Profile</h1>
        <p>Manage your personal information</p>
      </div>
      <div className="pp-body">
        <div className="pp-profile-header">
          <div className="pp-skeleton-avatar" />
          <div className="pp-skeleton-info">
            <div className="pp-skeleton-line pp-skeleton-name" />
            <div className="pp-skeleton-line pp-skeleton-username" />
            <div className="pp-skeleton-line pp-skeleton-bio" />
            <div className="pp-skeleton-meta">
              <div className="pp-skeleton-line pp-skeleton-meta-item" />
              <div className="pp-skeleton-line pp-skeleton-meta-item" />
              <div className="pp-skeleton-line pp-skeleton-meta-item" />
            </div>
            <div className="pp-skeleton-button" />
          </div>
        </div>
        <div className="pp-info-card">
          <div className="pp-skeleton-section-title" />
          <div className="pp-skeleton-details">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="pp-skeleton-detail">
                <div className="pp-skeleton-line pp-skeleton-label" />
                <div className="pp-skeleton-line pp-skeleton-value" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (!profile) return (
    <div className="pp-page"><div className="pp-not-found">Profile not found</div></div>
  );

  const avatarSrc = profile.profile_picture ? `${API_BASE_URL}${profile.profile_picture}` : null;
  const initials = (profile.full_name || profile.username || '?').charAt(0).toUpperCase();

  return (
    <div className="pp-page">
      <StakeholderNav />

      {/* Header */}
      <div className="pp-header">
        <h1>My Profile</h1>
        <p>Manage your personal information</p>
      </div>

      <div className="pp-body">
        {/* Profile Header Section */}
        <div className="pp-profile-header">
          {/* Avatar with upload icon */}
          <div className="pp-avatar-container">
            <div className={`pp-avatar-ring ${photoUploading ? 'uploading' : ''}`}>
              {avatarSrc
                ? <img src={avatarSrc} alt="Profile" className="pp-avatar-img" />
                : <div className="pp-avatar-initials">{initials}</div>
              }
              {photoUploading && <div className="pp-avatar-overlay"><div className="pp-spinner sm"></div></div>}
            </div>
            
            {/* Upload icon with dropdown */}
            <div className="pp-upload-wrapper">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                id="pp-file-input"
              />
              <label htmlFor="pp-file-input" className="pp-upload-icon" title={avatarSrc ? "Change photo" : "Add photo"}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </label>
              
              {/* Photo options menu */}
              {avatarSrc && !photoUploading && (
                <div className="pp-photo-menu">
                  <label htmlFor="pp-file-input" className="pp-photo-menu-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    Change
                  </label>
                  <button className="pp-photo-menu-item pp-photo-menu-remove" onClick={handleDeletePhoto}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Profile Info */}
          <div className="pp-profile-info">
            <div className="pp-name-section">
              <h2 className="pp-display-name">{profile.full_name || profile.username || 'User'}</h2>
              {profile.username && <p className="pp-username-text">@{profile.username}</p>}
            </div>
            
            {profile.bio && <p className="pp-bio-text">{profile.bio}</p>}
            
            <div className="pp-meta-row">
              {profile.location && (
                <div className="pp-meta-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span>{profile.location}</span>
                </div>
              )}
              {(profile.organization_name || profile.company_name) && (
                <div className="pp-meta-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                  </svg>
                  <span>{profile.organization_name || profile.company_name}</span>
                </div>
              )}
              <div className="pp-meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span>Joined {new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</span>
              </div>
            </div>

            {/* Action button */}
            <div className="pp-action-buttons">
              <button className="pp-btn pp-btn-edit" onClick={() => setIsEditing(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit Profile
              </button>
            </div>
          </div>
        </div>

        {/* Details card */}
        <div className="pp-info-card">
          {!isEditing ? (
            <>
              <div className="pp-section">
                <h4 className="pp-section-title">Account Details</h4>
                <div className="pp-details-grid">
                  <div className="pp-detail">
                    <span className="pp-detail-label">Email</span>
                    <span className="pp-detail-value">{profile.email}</span>
                  </div>
                  <div className="pp-detail">
                    <span className="pp-detail-label">Username</span>
                    <span className="pp-detail-value">{profile.username ? `@${profile.username}` : '—'}</span>
                  </div>
                  <div className="pp-detail">
                    <span className="pp-detail-label">Full Name</span>
                    <span className="pp-detail-value">{profile.full_name || '—'}</span>
                  </div>
                  <div className="pp-detail">
                    <span className="pp-detail-label">Member Since</span>
                    <span className="pp-detail-value">
                      {new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <h4 className="pp-section-title">Edit Profile</h4>

              <div className="pp-field">
                <label>Full Name</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="Your full name"
                />
              </div>

              <div className="pp-field">
                <label>Username</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={e => setFormData(p => ({ ...p, username: e.target.value }))}
                  placeholder="unique_username"
                />
              </div>

              <div className="pp-field">
                <label>Bio</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={e => setFormData(p => ({ ...p, bio: e.target.value }))}
                  placeholder="Tell us about yourself..."
                  rows={4}
                />
              </div>

              <div className="pp-edit-actions">
                <button
                  className="pp-btn pp-btn-cancel"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({ username: profile.username || '', full_name: profile.full_name || '', bio: profile.bio || '' });
                  }}
                >
                  Cancel
                </button>
                <button className="pp-btn pp-btn-save" onClick={handleSaveProfile} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
