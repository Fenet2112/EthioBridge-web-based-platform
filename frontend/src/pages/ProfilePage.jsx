import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProfilePage.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    bio: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to load profile');
      
      const data = await res.json();
      setProfile(data);
      setFormData({
        username: data.username || '',
        full_name: data.full_name || '',
        bio: data.bio || ''
      });
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUploadPicture = async () => {
    if (!selectedFile) return;

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('profile_picture', selectedFile);

    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/me/picture`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) throw new Error('Failed to upload picture');

      alert('Profile picture updated!');
      setSelectedFile(null);
      setPreviewUrl(null);
      fetchProfile();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleSaveProfile = async () => {
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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to update profile');
      }

      alert('Profile updated successfully!');
      setIsEditing(false);
      fetchProfile();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  if (loading) {
    return <div style={{padding: '40px', textAlign: 'center'}}>Loading profile...</div>;
  }

  if (!profile) {
    return <div style={{padding: '40px', textAlign: 'center'}}>Profile not found</div>;
  }

  return (
    <div className="profile-page">
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '40px 20px',
        color: 'white',
        textAlign: 'center'
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ← Back
        </button>
        <h1 style={{margin: 0, fontSize: '32px'}}>My Profile</h1>
      </div>

      {/* Profile Content */}
      <div style={{
        maxWidth: '800px',
        margin: '-60px auto 40px',
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
        padding: '40px'
      }}>
        {/* Profile Picture Section */}
        <div style={{textAlign: 'center', marginBottom: '40px'}}>
          <div style={{
            width: '150px',
            height: '150px',
            borderRadius: '50%',
            margin: '0 auto 20px',
            background: previewUrl || profile.profile_picture 
              ? `url(${previewUrl || API_BASE_URL + profile.profile_picture}) center/cover`
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '60px',
            color: 'white',
            border: '4px solid white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            {!previewUrl && !profile.profile_picture && (profile.full_name?.[0] || profile.username?.[0] || '👤')}
          </div>

          {isEditing && (
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{display: 'none'}}
                id="profile-picture-input"
              />
              <label
                htmlFor="profile-picture-input"
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  background: '#f8f9fa',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginRight: '10px'
                }}
              >
                Choose Photo
              </label>
              {selectedFile && (
                <button
                  onClick={handleUploadPicture}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Upload
                </button>
              )}
            </div>
          )}
        </div>

        {/* Profile Info */}
        {!isEditing ? (
          <div>
            <div style={{textAlign: 'center', marginBottom: '30px'}}>
              <h2 style={{margin: '0 0 8px', fontSize: '28px'}}>
                {profile.full_name || 'No name set'}
              </h2>
              {profile.username && (
                <p style={{color: '#6c757d', margin: '0 0 8px'}}>@{profile.username}</p>
              )}
              <p style={{color: '#6c757d', fontSize: '14px'}}>
                {profile.organization_name || profile.company_name}
              </p>
            </div>

            {profile.bio && (
              <div style={{
                background: '#f8f9fa',
                padding: '20px',
                borderRadius: '12px',
                marginBottom: '30px'
              }}>
                <h3 style={{margin: '0 0 10px', fontSize: '16px', color: '#495057'}}>Bio</h3>
                <p style={{margin: 0, lineHeight: '1.6', color: '#6c757d'}}>{profile.bio}</p>
              </div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '30px'
            }}>
              <div>
                <div style={{fontSize: '12px', color: '#6c757d', marginBottom: '4px'}}>Email</div>
                <div style={{fontWeight: '500'}}>{profile.email}</div>
              </div>
              <div>
                <div style={{fontSize: '12px', color: '#6c757d', marginBottom: '4px'}}>Location</div>
                <div style={{fontWeight: '500'}}>{profile.location || 'Not set'}</div>
              </div>
              <div>
                <div style={{fontSize: '12px', color: '#6c757d', marginBottom: '4px'}}>Member Since</div>
                <div style={{fontWeight: '500'}}>
                  {new Date(profile.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long'
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsEditing(true)}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Edit Profile
            </button>
          </div>
        ) : (
          <div>
            <div style={{marginBottom: '20px'}}>
              <label style={{display: 'block', marginBottom: '8px', fontWeight: '500'}}>
                Username
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Choose a unique username"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{marginBottom: '20px'}}>
              <label style={{display: 'block', marginBottom: '8px', fontWeight: '500'}}>
                Full Name
              </label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                placeholder="Your full name"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{marginBottom: '30px'}}>
              <label style={{display: 'block', marginBottom: '8px', fontWeight: '500'}}>
                Bio
              </label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                placeholder="Tell us about yourself..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{display: 'flex', gap: '10px'}}>
              <button
                onClick={() => setIsEditing(false)}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#f8f9fa',
                  border: '1px solid #dee2e6',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
