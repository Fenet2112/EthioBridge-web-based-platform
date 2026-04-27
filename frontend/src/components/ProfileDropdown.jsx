import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../utils/api';
import { imageUrl } from '../utils/imageUrl';
import './ProfileDropdown.css';

function ProfileDropdown() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
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
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return '?';
  };

  const profilePicUrl = previewUrl || imageUrl(profile?.profile_picture);

  return (
    <div className="profile-dropdown-container" ref={dropdownRef}>
      <button
        className="profile-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        {profilePicUrl ? (
          <img
            src={profilePicUrl}
            alt="Profile"
            className="profile-avatar"
          />
        ) : (
          <div className="profile-avatar-placeholder">
            {getInitials()}
          </div>
        )}
        <span className="dropdown-arrow">▼</span>
      </button>

      {isOpen && (
        <div className="profile-dropdown-menu">

          {/* HEADER */}
          <div className="dropdown-header">
            {profilePicUrl ? (
              <img
                src={profilePicUrl}
                alt="Profile"
                className="dropdown-avatar"
              />
            ) : (
              <div className="dropdown-avatar-placeholder">
                {getInitials()}
              </div>
            )}

            <div className="dropdown-user-info">
              <h3>{profile?.full_name || 'Set your name'}</h3>
              <p>@{profile?.username || 'username'}</p>
            </div>
          </div>

          {/* BIO */}
          {profile?.bio && (
            <div className="dropdown-bio">
              <p>{profile.bio}</p>
            </div>
          )}

          <div className="dropdown-divider"></div>

          {/* VIEW MODE */}
          {!isEditing ? (
            <>
              <button
                className="dropdown-item"
                onClick={() => setIsEditing(true)}
              >
                ✏️ Edit Profile
              </button>

              <button
                className="dropdown-item"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/profile');
                }}
              >
                👤 View Profile
              </button>

              <button
                className="dropdown-item"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/subscription');
                }}
              >
                ⭐ Subscription
              </button>

              <div className="dropdown-divider"></div>

              <button
                className="dropdown-item logout"
                onClick={handleLogout}
              >
                🚪 Logout
              </button>
            </>
          ) : (
            /* EDIT MODE */
            <div className="dropdown-edit-form">
              <h3>Edit Profile</h3>

              <button
                className="btn-cancel"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

export default ProfileDropdown;