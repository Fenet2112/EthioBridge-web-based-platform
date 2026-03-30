import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProfileDropdown.css';
import DarkModeToggle from './DarkModeToggle';

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function ProfileDropdown() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    bio: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsEditing(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchProfile = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setFormData({
          username: data.username || '',
          full_name: data.full_name || '',
          bio: data.bio || ''
        });
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB.'); return; }

    // Show local preview immediately
    setPreviewUrl(URL.createObjectURL(file));
    setSelectedFile(file);
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
      // Replace blob URL with persisted server URL
      setPreviewUrl(null);
      setSelectedFile(null);
      setProfile(prev => ({ ...prev, profile_picture: data.profile_picture }));
    } catch (err) {
      alert('Photo upload failed: ' + err.message);
      setPreviewUrl(null);
      setSelectedFile(null);
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem('token');
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) throw new Error('Failed to update profile');

      await fetchProfile();
      setIsEditing(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      alert('Profile updated successfully!');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeletePicture = async () => {
    if (!window.confirm('Delete profile picture?')) return;

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/me/picture`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to delete picture');
      
      await fetchProfile();
      setPreviewUrl(null);
      alert('Profile picture deleted');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return '?';
  };

  const profilePicUrl = previewUrl || (profile?.profile_picture ? `${API_BASE_URL}${profile.profile_picture}` : null);

  return (
    <div className="profile-dropdown-container" ref={dropdownRef}>
      <button 
        className="profile-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        {profilePicUrl ? (
          <img src={profilePicUrl} alt="Profile" className="profile-avatar" />
        ) : (
          <div className="profile-avatar-placeholder">{getInitials()}</div>
        )}
        <span className="dropdown-arrow">▼</span>
      </button>

      {isOpen && (
        <div className="profile-dropdown-menu">
          {!isEditing ? (
            <>
              <div className="dropdown-header">
                {profilePicUrl ? (
                  <img src={profilePicUrl} alt="Profile" className="dropdown-avatar" />
                ) : (
                  <div className="dropdown-avatar-placeholder">{getInitials()}</div>
                )}
                <div className="dropdown-user-info">
                  <h3>{profile?.full_name || 'Set your name'}</h3>
                  <p>@{profile?.username || 'username'}</p>
                </div>
              </div>

              {profile?.bio && (
                <div className="dropdown-bio">
                  <p>{profile.bio}</p>
                </div>
              )}

              <div className="dropdown-divider"></div>

              <button 
                className="dropdown-item"
                onClick={() => setIsEditing(true)}
              >
                <span className="item-icon">✏️</span>
                Edit Profile
              </button>

              <button 
                className="dropdown-item"
                onClick={() => {
                  console.log('Navigating to /profile');
                  setIsOpen(false);
                  navigate('/profile');
                }}
              >
                <span className="item-icon">👤</span>
                View Full Profile
              </button>

              <button 
                className="dropdown-item"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/subscription');
                }}
              >
                <span className="item-icon">⭐</span>
                Subscription
              </button>

              <div className="dropdown-divider"></div>

              <div className="dropdown-item dm-row">
                <span className="item-icon">🌙</span>
                <span>Dark Mode</span>
                <DarkModeToggle />
              </div>

              <div className="dropdown-divider"></div>

              <button
                className="dropdown-item logout"
                onClick={handleLogout}
              >
                <span className="item-icon">🚪</span>
                Logout
              </button>
            </>
          ) : (
            <div className="dropdown-edit-form">
              <h3>Edit Profile</h3>

              <div className="edit-avatar-section">
                <div className="edit-avatar-wrap">
                  {profilePicUrl ? (
                    <img src={profilePicUrl} alt="Profile" className="edit-avatar" />
                  ) : (
                    <div className="edit-avatar-placeholder">{getInitials()}</div>
                  )}
                  {photoUploading && (
                    <div className="edit-avatar-uploading">
                      <div className="edit-upload-spinner"></div>
                    </div>
                  )}
                </div>
                <div className="avatar-actions">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                  <button
                    className="btn-change-photo"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoUploading}
                  >
                    {photoUploading ? 'Uploading...' : 'Change Photo'}
                  </button>
                  {profile?.profile_picture && !photoUploading && (
                    <button
                      className="btn-delete-photo"
                      onClick={handleDeletePicture}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="username"
                />
              </div>

              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  placeholder="Your full name"
                />
              </div>

              <div className="form-group">
                <label>Bio</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  placeholder="Tell us about yourself..."
                  rows="3"
                />
              </div>

              <div className="form-actions">
                <button className="btn-set" onClick={handleSave}>
                  Set Profile
                </button>
                <button 
                  className="btn-cancel" 
                  onClick={() => {
                    setIsEditing(false);
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    setFormData({
                      username: profile?.username || '',
                      full_name: profile?.full_name || '',
                      bio: profile?.bio || ''
                    });
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProfileDropdown;
