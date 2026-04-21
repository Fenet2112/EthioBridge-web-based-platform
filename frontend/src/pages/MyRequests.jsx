import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FaEnvelope, FaSearch, FaClock, FaCheckCircle, FaHourglassHalf,
  FaPaperPlane, FaArrowLeft, FaRedo, FaPlusCircle
} from 'react-icons/fa';
import './MyRequests.css';
import { API_BASE_URL } from "../utils/api";
function MyRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [newRequestData, setNewRequestData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState({ type: '', text: '' });



  useEffect(() => {
    fetchMyRequests();
  }, [statusFilter]);

  const fetchMyRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to view your support requests');
        return;
      }

      let url = `${API_BASE_URL}/api/contact/my-messages`;
      if (statusFilter !== 'all') {
        url += `?status=${statusFilter}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.messages);
        console.log('[MyRequests] Loaded', data.messages.length, 'requests');
      } else {
        const data = await response.json();
        throw new Error(data.message || 'Failed to fetch requests');
      }
    } catch (error) {
      console.error('[MyRequests] Error:', error);
      setError(error.message || 'Failed to load your requests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewRequestChange = (e) => {
    const { name, value } = e.target;
    setNewRequestData(prev => ({ ...prev, [name]: value }));
  };

  const handleNewRequestSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/contact/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newRequestData,
          source: 'help',
          userId: localStorage.getItem('userId')
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitMessage({ 
          type: 'success', 
          text: 'Your support request has been submitted! We will respond within 24-48 hours.' 
        });
        setNewRequestData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          role: '',
          message: ''
        });
        setShowNewRequestModal(false);
        fetchMyRequests();
      } else {
        throw new Error(data.message || 'Failed to submit request');
      }
    } catch (error) {
      console.error('[MyRequests] Error submitting:', error);
      setSubmitMessage({ 
        type: 'error', 
        text: error.message || 'Failed to submit request. Please try again.' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { icon: <FaHourglassHalf />, class: 'status-pending', label: 'Pending' },
      in_progress: { icon: <FaClock />, class: 'status-in-progress', label: 'In Progress' },
      replied: { icon: <FaPaperPlane />, class: 'status-replied', label: 'Awaiting Response' },
      resolved: { icon: <FaCheckCircle />, class: 'status-resolved', label: 'Resolved' }
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`status-badge ${badge.class}`}>
        {badge.icon} {badge.label}
      </span>
    );
  };

  const getSourceBadge = (source) => {
    return (
      <span className={`source-badge source-${source}`}>
        {source === 'contact' ? 'Contact Us' : 'Help Center'}
      </span>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredRequests = requests;

  return (
    <div className="my-requests-container">
      {/* Header */}
      <div className="my-requests-header">
        <div className="header-content">
          <Link to="/" className="back-link">
            <FaArrowLeft /> Back to Home
          </Link>
          <h1>My Support Requests</h1>
          <p>Track and manage your support tickets</p>
        </div>
        <button 
          className="new-request-btn"
          onClick={() => setShowNewRequestModal(true)}
        >
          <FaPlusCircle /> New Request
        </button>
      </div>

      {/* Filters */}
      <div className="requests-filters">
        <div className="filter-group">
          <FaSearch />
          <label>Filter by status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Requests</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="replied">Awaiting Response</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <button className="refresh-btn" onClick={fetchMyRequests}>
          <FaRedo /> Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          {error}
          {!localStorage.getItem('token') && (
            <Link to="/login" className="login-link">Log in</Link>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading your requests...</p>
        </div>
      ) : (
        <>
          {/* Stats Summary */}
          <div className="requests-stats">
            <div className="stat-item">
              <span className="stat-number">{requests.filter(r => r.status === 'pending').length}</span>
              <span className="stat-label">Pending</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{requests.filter(r => r.status === 'in_progress').length}</span>
              <span className="stat-label">In Progress</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{requests.filter(r => r.status === 'replied').length}</span>
              <span className="stat-label">Awaiting Response</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{requests.filter(r => r.status === 'resolved').length}</span>
              <span className="stat-label">Resolved</span>
            </div>
          </div>

          {/* Requests List */}
          {filteredRequests.length === 0 ? (
            <div className="empty-state">
              <FaEnvelope />
              <h3>No support requests found</h3>
              <p>You haven't submitted any support requests yet.</p>
              <button 
                className="new-request-btn"
                onClick={() => setShowNewRequestModal(true)}
              >
                Submit Your First Request
              </button>
            </div>
          ) : (
            <div className="requests-list">
              {filteredRequests.map((request) => (
                <div 
                  key={request.id} 
                  className={`request-card ${request.admin_reply ? 'has-reply' : ''}`}
                  onClick={() => setSelectedRequest(request)}
                >
                  <div className="request-card-header">
                    <div className="request-id">#{request.id}</div>
                    <div className="request-badges">
                      {getSourceBadge(request.source)}
                      {getStatusBadge(request.status)}
                    </div>
                  </div>
                  <div className="request-subject">
                    {request.subject || 'Support Request'}
                  </div>
                  <div className="request-preview">
                    {request.message.substring(0, 120)}
                    {request.message.length > 120 && '...'}
                  </div>
                  <div className="request-meta">
                    <span><FaClock /> {formatDate(request.created_at)}</span>
                    {request.admin_reply && (
                      <span className="has-reply-badge">
                        <FaCheckCircle /> Has admin reply
                      </span>
                    )}
                  </div>
                  {request.status_label && (
                    <div className="request-status-label">
                      {request.status_label}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Request Detail Modal */}
      {selectedRequest && (
        <div className="request-modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="request-modal" onClick={(e) => e.stopPropagation()}>
            <div className="request-modal-header">
              <h2>Support Request #{selectedRequest.id}</h2>
              <button className="modal-close" onClick={() => setSelectedRequest(null)}>×</button>
            </div>
            <div className="request-modal-body">
              <div className="request-detail-section">
                <h3>Status</h3>
                <div className="status-display">
                  {getStatusBadge(selectedRequest.status)}
                  <span className="status-description">{selectedRequest.status_label}</span>
                </div>
              </div>
              
              <div className="request-detail-section">
                <h3>Details</h3>
                <p><strong>Submitted:</strong> {formatDate(selectedRequest.created_at)}</p>
                {selectedRequest.updated_at && (
                  <p><strong>Last Updated:</strong> {formatDate(selectedRequest.updated_at)}</p>
                )}
                <p><strong>Source:</strong> {getSourceBadge(selectedRequest.source)}</p>
              </div>

              <div className="request-detail-section">
                <h3>Your Message</h3>
                <div className="message-content">
                  {selectedRequest.message}
                </div>
              </div>

              {/* Admin Reply */}
              {selectedRequest.admin_reply ? (
                <div className="request-detail-section admin-reply-section">
                  <h3>
                    <FaPaperPlane /> Admin Response
                    {selectedRequest.user_notified && <span className="notified-badge">Email sent</span>}
                  </h3>
                  <div className="admin-reply-content">
                    {selectedRequest.admin_reply}
                  </div>
                  {selectedRequest.replied_at && (
                    <p className="reply-timestamp">
                      Received on {formatDate(selectedRequest.replied_at)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="request-detail-section no-reply-section">
                  <h3>Admin Response</h3>
                  <p className="waiting-message">
                    <FaHourglassHalf /> Our team is reviewing your request. We'll respond as soon as possible.
                  </p>
                </div>
              )}
            </div>
            <div className="request-modal-footer">
              <button 
                className="close-detail-btn"
                onClick={() => setSelectedRequest(null)}
              >
                Close
              </button>
              {selectedRequest.status === 'resolved' && (
                <button 
                  className="reopen-btn"
                  onClick={() => {
                    alert('To reopen this ticket, please submit a new request.');
                    setSelectedRequest(null);
                  }}
                >
                  <FaRedo /> Submit Follow-up
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Request Modal */}
      {showNewRequestModal && (
        <div className="request-modal-overlay" onClick={() => setShowNewRequestModal(false)}>
          <div className="new-request-modal" onClick={(e) => e.stopPropagation()}>
            <div className="new-request-header">
              <h2>Submit New Support Request</h2>
              <button className="modal-close" onClick={() => setShowNewRequestModal(false)}>×</button>
            </div>
            <div className="new-request-body">
              {submitMessage.text && (
                <div className={`submit-message ${submitMessage.type}`}>
                  {submitMessage.text}
                </div>
              )}
              
              <form onSubmit={handleNewRequestSubmit}>
                <div className="form-row">
                  <div className="form-field">
                    <label>First Name *</label>
                    <input 
                      type="text" 
                      name="firstName"
                      value={newRequestData.firstName}
                      onChange={handleNewRequestChange}
                      required 
                    />
                  </div>
                  <div className="form-field">
                    <label>Last Name *</label>
                    <input 
                      type="text" 
                      name="lastName"
                      value={newRequestData.lastName}
                      onChange={handleNewRequestChange}
                      required 
                    />
                  </div>
                </div>
                <div className="form-field">
                  <label>Email Address *</label>
                  <input 
                    type="email" 
                    name="email"
                    value={newRequestData.email}
                    onChange={handleNewRequestChange}
                    required 
                  />
                </div>
                <div className="form-field">
                  <label>Phone Number</label>
                  <input 
                    type="tel" 
                    name="phone"
                    value={newRequestData.phone}
                    onChange={handleNewRequestChange}
                    placeholder="+251 9XX XXX XXX"
                  />
                </div>
                <div className="form-field">
                  <label>I am a</label>
                  <select 
                    name="role"
                    value={newRequestData.role}
                    onChange={handleNewRequestChange}
                    required
                  >
                    <option value="">Select your role...</option>
                    <option value="industry">Industry / Supplier</option>
                    <option value="stakeholder">Stakeholder / Investor</option>
                    <option value="contractor">Contractor</option>
                    <option value="government">Government Agency</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>How can we help you? *</label>
                  <textarea 
                    name="message"
                    value={newRequestData.message}
                    onChange={handleNewRequestChange}
                    placeholder="Describe your issue or question in detail..."
                    rows={5}
                    required
                  />
                </div>
                <div className="form-actions">
                  <button 
                    type="button"
                    className="cancel-btn"
                    onClick={() => setShowNewRequestModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="submit-btn"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>Sending...</>
                    ) : (
                      <><FaPaperPlane /> Submit Request</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyRequests;