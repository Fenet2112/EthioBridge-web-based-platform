import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../utils/api';
import './ProfileDropdown.css';

function ProfileDropdown() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState(null);
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
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return '?';
  };

  const profilePicUrl = profile?.profile_picture ? `${API_BASE_URL}${profile.profile_picture}` : null;

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
      </button>

      {isOpen && (
        <div className="profile-dropdown-menu">
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
            onClick={() => {
              setIsOpen(false);
              navigate('/profile');
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            Profile
          </button>

          <button 
            className="dropdown-item"
            onClick={() => {
              setIsOpen(false);
              navigate('/subscription');
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Subscription
          </button>

          <button 
            className="dropdown-item"
            onClick={() => {
              setIsOpen(false);
              navigate('/help');
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Help
          </button>

          <div className="dropdown-divider"></div>

          <button
            className="dropdown-item logout"
            onClick={handleLogout}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default ProfileDropdown;
