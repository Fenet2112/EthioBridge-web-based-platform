import React, { useState, useEffect } from 'react';
import { 
  FaEnvelope, FaEnvelopeOpen, FaReply, FaFilter, 
  FaPhone, FaUser, FaClock, FaCheckCircle, FaPaperPlane,
  FaExclamationTriangle, FaCheck, FaHourglassHalf, FaRedoAlt,
  FaSpinner, FaTicketAlt
} from 'react-icons/fa';
import './ContactMessages.css';

function ContactMessages() {
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [notifyUser, setNotifyUser] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchMessages();
    fetchStats();
  }, [statusFilter, sourceFilter, priorityFilter]);

  const fetchMessages = async () => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
        console.error('[ContactMessages] No admin token found');
        return;
      }

      let url = `${API_BASE_URL}/api/contact/admin/messages?limit=100`;
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;
      if (sourceFilter !== 'all') url += `&source=${sourceFilter}`;
      if (priorityFilter !== 'all') url += `&priority=${priorityFilter}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
        console.log('[ContactMessages] Loaded', data.messages.length, 'messages');
      } else {
        throw new Error('Failed to fetch messages');
      }
    } catch (error) {
      console.error('[ContactMessages] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/api/contact/admin/stats`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('[ContactMessages] Error fetching stats:', error);
    }
  };

  const updateMessageStatus = async (messageId, newStatus, priority = null) => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      const body = { status: newStatus };
      if (priority) body.priority = priority;

      const response = await fetch(`${API_BASE_URL}/api/contact/admin/messages/${messageId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        console.log('[ContactMessages] Status updated to:', newStatus);
        fetchMessages();
        fetchStats();
        if (selectedMessage && selectedMessage.id === messageId) {
          const updated = await response.json();
          setSelectedMessage(updated.data);
        }
      } else {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      console.error('[ContactMessages] Error updating status:', error);
      alert('Failed to update message status');
    }
  };

  const sendReply = async () => {
    if (!replyText.trim()) {
      alert('Please enter a reply message');
      return;
    }

    setSendingReply(true);
    try {
      const adminToken = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/api/contact/admin/messages/${selectedMessage.id}/reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reply: replyText, notifyUser: notifyUser })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[ContactMessages] Reply sent successfully');
        setShowReplyModal(false);
        setReplyText('');
        setSelectedMessage(data.data);
        fetchMessages();
        fetchStats();
        alert('Reply sent successfully! User has been notified via email.');
      } else {
        throw new Error('Failed to send reply');
      }
    } catch (error) {
      console.error('[ContactMessages] Error sending reply:', error);
      alert('Failed to send reply. Please try again.');
    } finally {
      setSendingReply(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { icon: <FaHourglassHalf />, class: 'status-pending', label: 'Pending' },
      in_progress: { icon: <FaClock />, class: 'status-in-progress', label: 'In Progress' },
      replied: { icon: <FaReply />, class: 'status-replied', label: 'Replied' },
      resolved: { icon: <FaCheckCircle />, class: 'status-resolved', label: 'Resolved' }
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`status-badge ${badge.class}`}>
        {badge.icon} {badge.label}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      urgent: { icon: <FaExclamationTriangle />, class: 'priority-urgent', label: 'Urgent' },
      high: { icon: <FaExclamationTriangle />, class: 'priority-high', label: 'High' },
      normal: { icon: <FaClock />, class: 'priority-normal', label: 'Normal' },
      low: { icon: <FaClock />, class: 'priority-low', label: 'Low' }
    };
    const badge = badges[priority] || badges.normal;
    return (
      <span className={`priority-badge ${badge.class}`}>
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
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="contact-messages-loading">
        <div className="loading-spinner"></div>
        <p>Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="contact-messages-container">
      <div className="contact-messages-header">
        <div>
          <h1>Support Tickets</h1>
          <p>Manage support requests from Contact Us and Help Center</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="contact-stats-grid">
        <div className="contact-stat-card">
          <div className="stat-icon pending">
            <FaHourglassHalf />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.pending_count || 0}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
        <div className="contact-stat-card">
          <div className="stat-icon in-progress">
            <FaClock />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.in_progress_count || 0}</div>
            <div className="stat-label">In Progress</div>
          </div>
        </div>
        <div className="contact-stat-card">
          <div className="stat-icon replied">
            <FaReply />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.replied_count || 0}</div>
            <div className="stat-label">Replied</div>
          </div>
        </div>
        <div className="contact-stat-card">
          <div className="stat-icon resolved">
            <FaCheckCircle />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.resolved_count || 0}</div>
            <div className="stat-label">Resolved</div>
          </div>
        </div>
        <div className="contact-stat-card urgent">
          <div className="stat-icon urgent">
            <FaExclamationTriangle />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.urgent_count || 0}</div>
            <div className="stat-label">Urgent</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="contact-filters">
        <div className="filter-group">
          <FaFilter />
          <label>Status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="replied">Replied</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Source:</label>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="all">All Sources</option>
            <option value="contact">Contact Us</option>
            <option value="help">Help Center</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Priority:</label>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Messages List */}
      {messages.length === 0 ? (
        <div className="no-messages">
          <FaEnvelope />
          <p>No messages found</p>
        </div>
      ) : (
        <div className="messages-list">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`message-card ${message.status === 'pending' ? 'unread' : ''}`}
              onClick={() => setSelectedMessage(message)}
            >
              <div className="message-card-header">
                <div className="message-sender">
                  <FaUser />
                  <strong>{message.first_name} {message.last_name}</strong>
                </div>
                <div className="message-badges">
                  {getSourceBadge(message.source)}
                  {getPriorityBadge(message.priority)}
                  {getStatusBadge(message.status)}
                </div>
              </div>
              <div className="message-card-subject">
                {message.subject || 'No subject'}
              </div>
              <div className="message-card-meta">
                <span><FaEnvelope /> {message.email}</span>
                {message.phone && <span><FaPhone /> {message.phone}</span>}
                {message.role && <span><FaUser /> {message.role}</span>}
                <span><FaClock /> {formatDate(message.created_at)}</span>
              </div>
              <div className="message-card-preview">
                {message.message.substring(0, 150)}
                {message.message.length > 150 && '...'}
              </div>
              {message.admin_reply && (
                <div className="message-card-reply-indicator">
                  <FaReply /> Has admin reply
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div className="message-modal-overlay" onClick={() => setSelectedMessage(null)}>
          <div className="message-modal" onClick={(e) => e.stopPropagation()}>
            <div className="message-modal-header">
              <h2>Support Ticket #{selectedMessage.id}</h2>
              <button className="modal-close" onClick={() => setSelectedMessage(null)}>×</button>
            </div>
            <div className="message-modal-body">
              <div className="message-detail-section">
                <h3>From</h3>
                <p><strong>{selectedMessage.first_name} {selectedMessage.last_name}</strong></p>
                <p><FaEnvelope /> {selectedMessage.email}</p>
                {selectedMessage.phone && <p><FaPhone /> {selectedMessage.phone}</p>}
                {selectedMessage.role && <p><FaUser /> Role: {selectedMessage.role}</p>}
              </div>
              <div className="message-detail-section">
                <h3>Details</h3>
                <p><FaClock /> Received: {formatDate(selectedMessage.created_at)}</p>
                {selectedMessage.updated_at && (
                  <p><FaClock /> Updated: {formatDate(selectedMessage.updated_at)}</p>
                )}
                <p>Source: {getSourceBadge(selectedMessage.source)}</p>
                <p>Priority: {getPriorityBadge(selectedMessage.priority)}</p>
                <p>Status: {getStatusBadge(selectedMessage.status)}</p>
                <p>Status: {selectedMessage.status_label}</p>
              </div>
              <div className="message-detail-section">
                <h3>Subject</h3>
                <p className="message-subject">{selectedMessage.subject || 'No subject'}</p>
              </div>
              <div className="message-detail-section">
                <h3>User's Message</h3>
                <div className="message-content">
                  {selectedMessage.message}
                </div>
              </div>
              
              {/* Admin Reply Section */}
              {selectedMessage.admin_reply && (
                <div className="message-detail-section admin-reply-section">
                  <h3>Admin Reply</h3>
                  <div className="admin-reply-content">
                    {selectedMessage.admin_reply}
                  </div>
                  {selectedMessage.replied_at && (
                    <p className="reply-timestamp">
                      <FaClock /> Replied at: {formatDate(selectedMessage.replied_at)}
                    </p>
                  )}
                  {selectedMessage.user_notified && (
                    <p className="reply-notified">
                      <FaCheck /> User has been notified via email
                    </p>
                  )}
                </div>
              )}

              {selectedMessage.admin_notes && (
                <div className="message-detail-section">
                  <h3>Admin Notes (Internal)</h3>
                  <p>{selectedMessage.admin_notes}</p>
                </div>
              )}
            </div>
            <div className="message-modal-actions">
              <div className="actions-left">
                {selectedMessage.status === 'pending' && (
                  <button
                    className="action-btn btn-in-progress"
                    onClick={() => updateMessageStatus(selectedMessage.id, 'in_progress', 'normal')}
                  >
                    <span className="btn-inner"><FaClock /> Mark In Progress</span>
                  </button>
                )}
                {selectedMessage.status === 'in_progress' && (
                  <button
                    className="action-btn btn-pending"
                    onClick={() => updateMessageStatus(selectedMessage.id, 'pending')}
                  >
                    <span className="btn-inner"><FaHourglassHalf /> Back to Pending</span>
                  </button>
                )}
                {selectedMessage.status !== 'resolved' && (
                  <button
                    className="action-btn btn-resolve"
                    onClick={() => updateMessageStatus(selectedMessage.id, 'resolved')}
                  >
                    <span className="btn-inner"><FaCheckCircle /> Mark Resolved</span>
                  </button>
                )}
                {selectedMessage.status === 'resolved' && (
                  <button
                    className="action-btn btn-reopen"
                    onClick={() => updateMessageStatus(selectedMessage.id, 'pending')}
                  >
                    <span className="btn-inner"><FaRedoAlt /> Reopen Ticket</span>
                  </button>
                )}
              </div>
              <div className="actions-right">
                <a
                  href={`mailto:${selectedMessage.email}?subject=Re: Your support request #${selectedMessage.id}`}
                  className="action-btn btn-email"
                >
                  <span className="btn-inner"><FaEnvelope /> Email User</span>
                </a>
                {selectedMessage.status !== 'resolved' && (
                  <button
                    className="action-btn btn-reply"
                    onClick={() => setShowReplyModal(true)}
                  >
                    <span className="btn-inner"><FaPaperPlane /> Send Reply</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reply Modal */}
      {showReplyModal && (
        <div className="message-modal-overlay" onClick={() => setShowReplyModal(false)}>
          <div className="reply-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reply-modal-header">
              <h2>Send Reply to #{selectedMessage?.id}</h2>
              <button className="modal-close" onClick={() => setShowReplyModal(false)}>×</button>
            </div>
            <div className="reply-modal-body">
              <div className="reply-to-info">
                <strong>To:</strong> {selectedMessage?.first_name} {selectedMessage?.last_name} ({selectedMessage?.email})
              </div>
              <div className="reply-original">
                <strong>Original Message:</strong>
                <p>{selectedMessage?.message}</p>
              </div>
              <div className="reply-form">
                <label>Your Reply:</label>
                <textarea 
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your response to the user..."
                  rows={8}
                />
              </div>
              <div className="reply-options">
                <label className="reply-notify-label">
                  <input
                    type="checkbox"
                    className="reply-notify-checkbox"
                    checked={notifyUser}
                    onChange={(e) => setNotifyUser(e.target.checked)}
                  />
                  <span>Send email notification to user</span>
                </label>
              </div>
            </div>
            <div className="reply-modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowReplyModal(false)}
                disabled={sendingReply}
              >
                Cancel
              </button>
              <button
                className="send-reply-btn"
                onClick={sendReply}
                disabled={sendingReply || !replyText.trim()}
              >
                <span className="btn-inner">
                  {sendingReply ? 'Sending...' : <><FaPaperPlane /> Send Reply</>}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContactMessages;
