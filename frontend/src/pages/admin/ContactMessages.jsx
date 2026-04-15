import React, { useState, useEffect } from 'react';
import { 
  FaEnvelope, FaEnvelopeOpen, FaReply, FaArchive, FaFilter, 
  FaPhone, FaUser, FaClock, FaCheckCircle, FaTimesCircle 
} from 'react-icons/fa';
import './ContactMessages.css';

function ContactMessages() {
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchMessages();
    fetchStats();
  }, [statusFilter, sourceFilter]);

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

  const updateMessageStatus = async (messageId, newStatus, adminNotes = '') => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/api/contact/admin/messages/${messageId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus, adminNotes })
      });

      if (response.ok) {
        console.log('[ContactMessages] Status updated to:', newStatus);
        fetchMessages();
        fetchStats();
        if (selectedMessage && selectedMessage.id === messageId) {
          setSelectedMessage(null);
        }
      } else {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      console.error('[ContactMessages] Error updating status:', error);
      alert('Failed to update message status');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      unread: { icon: <FaEnvelope />, class: 'status-unread', label: 'Unread' },
      read: { icon: <FaEnvelopeOpen />, class: 'status-read', label: 'Read' },
      replied: { icon: <FaReply />, class: 'status-replied', label: 'Replied' },
      archived: { icon: <FaArchive />, class: 'status-archived', label: 'Archived' }
    };
    const badge = badges[status] || badges.unread;
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
          <h1>Contact Messages</h1>
          <p>Manage messages from Contact Us and Help Center</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="contact-stats-grid">
        <div className="contact-stat-card">
          <div className="stat-icon unread">
            <FaEnvelope />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.unread_count || 0}</div>
            <div className="stat-label">Unread</div>
          </div>
        </div>
        <div className="contact-stat-card">
          <div className="stat-icon read">
            <FaEnvelopeOpen />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.read_count || 0}</div>
            <div className="stat-label">Read</div>
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
          <div className="stat-icon total">
            <FaCheckCircle />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.total_count || 0}</div>
            <div className="stat-label">Total</div>
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
            <option value="unread">Unread</option>
            <option value="read">Read</option>
            <option value="replied">Replied</option>
            <option value="archived">Archived</option>
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
              className={`message-card ${message.status === 'unread' ? 'unread' : ''}`}
              onClick={() => setSelectedMessage(message)}
            >
              <div className="message-card-header">
                <div className="message-sender">
                  <FaUser />
                  <strong>{message.first_name} {message.last_name}</strong>
                </div>
                <div className="message-badges">
                  {getSourceBadge(message.source)}
                  {getStatusBadge(message.status)}
                </div>
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
            </div>
          ))}
        </div>
      )}

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div className="message-modal-overlay" onClick={() => setSelectedMessage(null)}>
          <div className="message-modal" onClick={(e) => e.stopPropagation()}>
            <div className="message-modal-header">
              <h2>Message Details</h2>
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
                <p>Source: {getSourceBadge(selectedMessage.source)}</p>
                <p>Status: {getStatusBadge(selectedMessage.status)}</p>
              </div>
              <div className="message-detail-section">
                <h3>Message</h3>
                <div className="message-content">
                  {selectedMessage.message}
                </div>
              </div>
              {selectedMessage.admin_notes && (
                <div className="message-detail-section">
                  <h3>Admin Notes</h3>
                  <p>{selectedMessage.admin_notes}</p>
                </div>
              )}
            </div>
            <div className="message-modal-actions">
              {selectedMessage.status === 'unread' && (
                <button 
                  className="action-btn read"
                  onClick={() => updateMessageStatus(selectedMessage.id, 'read')}
                >
                  <FaEnvelopeOpen /> Mark as Read
                </button>
              )}
              {(selectedMessage.status === 'unread' || selectedMessage.status === 'read') && (
                <button 
                  className="action-btn replied"
                  onClick={() => updateMessageStatus(selectedMessage.id, 'replied')}
                >
                  <FaReply /> Mark as Replied
                </button>
              )}
              <button 
                className="action-btn archive"
                onClick={() => updateMessageStatus(selectedMessage.id, 'archived')}
              >
                <FaArchive /> Archive
              </button>
              <a 
                href={`mailto:${selectedMessage.email}?subject=Re: Your message to EthioBridge`}
                className="action-btn email"
              >
                <FaEnvelope /> Reply via Email
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContactMessages;
