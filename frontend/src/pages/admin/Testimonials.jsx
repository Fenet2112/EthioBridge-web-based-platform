import React, { useState, useEffect } from 'react';
import { FaStar, FaCheck, FaTimes, FaTrash, FaFilter, FaSync } from 'react-icons/fa';
import './Testimonials.css';

function AdminTestimonials() {
  const [testimonials, setTestimonials] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, approved, rejected
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchTestimonials();
    fetchStats();
  }, [filter]);

  const fetchTestimonials = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      
      const url = filter === 'all' 
        ? `${API_BASE_URL}/api/testimonials/admin/all`
        : `${API_BASE_URL}/api/testimonials/admin/all?status=${filter}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch testimonials');
      }

      const data = await response.json();
      setTestimonials(data);
      console.log('[AdminTestimonials] Loaded', data.length, 'testimonials');
    } catch (err) {
      console.error('[AdminTestimonials] Error:', err);
      setError('Failed to load testimonials');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/api/testimonials/admin/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('[AdminTestimonials] Error fetching stats:', err);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/api/testimonials/admin/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      setSuccessMessage(`Testimonial ${status} successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      fetchTestimonials();
      fetchStats();
    } catch (err) {
      console.error('[AdminTestimonials] Error updating status:', err);
      setError('Failed to update testimonial status');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this testimonial?')) {
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/api/testimonials/admin/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete testimonial');
      }

      setSuccessMessage('Testimonial deleted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      fetchTestimonials();
      fetchStats();
    } catch (err) {
      console.error('[AdminTestimonials] Error deleting:', err);
      setError('Failed to delete testimonial');
      setTimeout(() => setError(''), 3000);
    }
  };

  const renderStars = (rating) => {
    if (!rating) return <span className="no-rating">No rating</span>;
    return (
      <div className="rating-display">
        {[...Array(5)].map((_, i) => (
          <FaStar key={i} className={i < rating ? 'star-filled' : 'star-empty'} />
        ))}
      </div>
    );
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { class: 'status-pending', text: 'Pending' },
      approved: { class: 'status-approved', text: 'Approved' },
      rejected: { class: 'status-rejected', text: 'Rejected' }
    };
    const badge = badges[status] || badges.pending;
    return <span className={`status-badge ${badge.class}`}>{badge.text}</span>;
  };

  const getRoleDisplay = (role) => {
    const roleMap = {
      'stakeholder': 'Stakeholder',
      'industry': 'Industry Owner',
      'investor': 'Investor',
      'other': 'Other'
    };
    return roleMap[role] || role;
  };

  return (
    <div className="admin-testimonials-page">
      <div className="admin-testimonials-header">
        <div>
          <h1>Testimonials Management</h1>
          <p>Review and manage user feedback</p>
        </div>
        <button className="refresh-btn" onClick={() => { fetchTestimonials(); fetchStats(); }}>
          <FaSync /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="testimonials-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.total_count || 0}</div>
            <div className="stat-label">Total Testimonials</div>
          </div>
          <div className="stat-card pending">
            <div className="stat-value">{stats.pending_count || 0}</div>
            <div className="stat-label">Pending Review</div>
          </div>
          <div className="stat-card approved">
            <div className="stat-value">{stats.approved_count || 0}</div>
            <div className="stat-label">Approved</div>
          </div>
          <div className="stat-card rejected">
            <div className="stat-value">{stats.rejected_count || 0}</div>
            <div className="stat-label">Rejected</div>
          </div>
          <div className="stat-card rating">
            <div className="stat-value">{stats.average_rating || 'N/A'}</div>
            <div className="stat-label">Average Rating</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button 
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button 
          className={filter === 'pending' ? 'active' : ''}
          onClick={() => setFilter('pending')}
        >
          Pending
        </button>
        <button 
          className={filter === 'approved' ? 'active' : ''}
          onClick={() => setFilter('approved')}
        >
          Approved
        </button>
        <button 
          className={filter === 'rejected' ? 'active' : ''}
          onClick={() => setFilter('rejected')}
        >
          Rejected
        </button>
      </div>

      {/* Messages */}
      {error && <div className="alert alert-error">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      {/* Testimonials List */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading testimonials...</p>
        </div>
      ) : testimonials.length === 0 ? (
        <div className="empty-state">
          <FaFilter size={48} />
          <h3>No testimonials found</h3>
          <p>No testimonials match the current filter</p>
        </div>
      ) : (
        <div className="testimonials-list">
          {testimonials.map((testimonial) => (
            <div key={testimonial.id} className="testimonial-item">
              <div className="testimonial-item-header">
                <div className="testimonial-user-info">
                  <div className="user-avatar">
                    {testimonial.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3>{testimonial.name}</h3>
                    <p className="user-role">{getRoleDisplay(testimonial.role)}</p>
                    {testimonial.user_email && (
                      <p className="user-email">{testimonial.user_email}</p>
                    )}
                  </div>
                </div>
                <div className="testimonial-meta">
                  {getStatusBadge(testimonial.status)}
                  {renderStars(testimonial.rating)}
                </div>
              </div>

              <div className="testimonial-message">
                {testimonial.message}
              </div>

              <div className="testimonial-item-footer">
                <div className="testimonial-date">
                  Submitted: {new Date(testimonial.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                <div className="testimonial-actions">
                  {testimonial.status !== 'approved' && (
                    <button 
                      className="action-btn approve-btn"
                      onClick={() => handleStatusUpdate(testimonial.id, 'approved')}
                    >
                      <FaCheck /> Approve
                    </button>
                  )}
                  {testimonial.status !== 'rejected' && (
                    <button 
                      className="action-btn reject-btn"
                      onClick={() => handleStatusUpdate(testimonial.id, 'rejected')}
                    >
                      <FaTimes /> Reject
                    </button>
                  )}
                  <button 
                    className="action-btn delete-btn"
                    onClick={() => handleDelete(testimonial.id)}
                  >
                    <FaTrash /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminTestimonials;
