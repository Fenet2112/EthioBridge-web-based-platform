import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { imageUrl } from '../utils/imageUrl';
import StakeholderNav from '../components/StakeholderNav';
import './ProfilePage.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

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
      <div className="pp-loading"><div className="pp-spinner"></div><p>Loading profile...</p></div>
    </div>
  );

  if (!profile) return (
    <div className="pp-page"><div className="pp-not-found">Profile not found</div></div>
  );

  const avatarSrc = imageUrl(profile.profile_picture);
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
        {/* Photo card */}
        <div className="pp-photo-card">
          <div className={`pp-avatar-ring ${photoUploading ? 'uploading' : ''}`}>
            {avatarSrc
              ? <img src={avatarSrc} alt="Profile" className="pp-avatar-img" />
              : <div className="pp-avatar-initials">{initials}</div>
            }
            {photoUploading && <div className="pp-avatar-overlay"><div className="pp-spinner sm"></div></div>}
          </div>

          <div className="pp-photo-meta">
            <h3>{profile.full_name || 'Set your name'}</h3>
            {profile.username && <p className="pp-username">@{profile.username}</p>}
            {(profile.organization_name || profile.company_name) && (
              <p className="pp-org">{profile.organization_name || profile.company_name}</p>
            )}
          </div>

          <div className="pp-photo-btns">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="pp-file-input"
            />
            <label htmlFor="pp-file-input" className="pp-btn pp-btn-photo" title="Max 5MB · JPG, PNG, GIF">
              {photoUploading ? 'Uploading...' : avatarSrc ? '📷 Change Photo' : '📷 Add Photo'}
            </label>
            {avatarSrc && !photoUploading && (
              <button className="pp-btn pp-btn-remove" onClick={handleDeletePhoto}>Remove</button>
            )}
          </div>
          <p className="pp-photo-hint">JPG, PNG or GIF · Max 5MB · Uploads instantly</p>
        </div>

        {/* Info card */}
        <div className="pp-info-card">
          {!isEditing ? (
            <>
              <div className="pp-section">
                <h4 className="pp-section-title">About</h4>
                {profile.bio
                  ? <p className="pp-bio">{profile.bio}</p>
                  : <p className="pp-empty-field">No bio added yet</p>
                }
              </div>

              <div className="pp-section">
                <h4 className="pp-section-title">Details</h4>
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
                    <span className="pp-detail-label">Location</span>
                    <span className="pp-detail-value">{profile.location || '—'}</span>
                  </div>
                  <div className="pp-detail">
                    <span className="pp-detail-label">Member since</span>
                    <span className="pp-detail-value">
                      {new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                    </span>
                  </div>
                </div>
              </div>

              <button className="pp-btn pp-btn-edit" onClick={() => setIsEditing(true)}>
                ✏️ Edit Profile
              </button>
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
