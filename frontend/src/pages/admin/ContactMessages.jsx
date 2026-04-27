import React, { useState, useEffect } from 'react';
import {
  FaEnvelope, FaReply, FaFilter,
  FaPhone, FaUser, FaClock, FaCheckCircle, FaPaperPlane,
  FaExclamationTriangle, FaCheck, FaHourglassHalf, FaRedoAlt,
  FaTimesCircle
} from 'react-icons/fa';
import './ContactMessages.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function ContactMessages() {
  const [messages, setMessages]               = useState([]);
  const [stats, setStats]                     = useState({});
  const [loading, setLoading]                 = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showReplyModal, setShowReplyModal]   = useState(false);
  const [replyText, setReplyText]             = useState('');
  const [sendingReply, setSendingReply]       = useState(false);
  const [notifyUser, setNotifyUser]           = useState(true);
  const [statusFilter, setStatusFilter]       = useState('all');
  const [sourceFilter, setSourceFilter]       = useState('all');
  const [priorityFilter, setPriorityFilter]   = useState('all');
  const [toast, setToast]                     = useState(null); // { type: 'success'|'error', msg }

  useEffect(() => { fetchMessages(); fetchStats(); }, [statusFilter, sourceFilter, priorityFilter]);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const authHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
    'Content-Type': 'application/json'
  });

  const fetchMessages = async () => {
    try {
      let url = `${API_BASE_URL}/api/contact/admin/messages?limit=100`;
      if (statusFilter !== 'all')  url += `&status=${statusFilter}`;
      if (sourceFilter !== 'all')  url += `&source=${sourceFilter}`;
      if (priorityFilter !== 'all') url += `&priority=${priorityFilter}`;
      const res = await fetch(url, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setMessages(d.messages); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/contact/admin/stats`, { headers: authHeaders() });
      if (res.ok) setStats(await res.json());
    } catch (e) { console.error(e); }
  };

  const updateStatus = async (messageId, newStatus, priority = null) => {
    try {
      const body = { status: newStatus };
      if (priority) body.priority = priority;
      const res = await fetch(`${API_BASE_URL}/api/contact/admin/messages/${messageId}/status`, {
        method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body)
      });
      if (res.ok) {
        const updated = await res.json();
        fetchMessages(); fetchStats();
        if (selectedMessage?.id === messageId) setSelectedMessage(updated.data);
      } else { showToast('error', 'Failed to update status'); }
    } catch (e) { showToast('error', 'Failed to update status'); }
  };

  const sendReply = async () => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/contact/admin/messages/${selectedMessage.id}/reply`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ reply: replyText, notifyUser })
      });
      if (res.ok) {
        const data = await res.json();
        setShowReplyModal(false);
        setReplyText('');
        setSelectedMessage(data.data);
        fetchMessages(); fetchStats();
        showToast('success', notifyUser
          ? 'Reply sent! User has been notified via email.'
          : 'Reply saved. No email sent.');
      } else {
        showToast('error', 'Failed to send reply. Please try again.');
      }
    } catch (e) { showToast('error', 'Failed to send reply.'); }
    finally { setSendingReply(false); }
  };

  const openReply = () => { setReplyText(''); setShowReplyModal(true); };
  const closeReply = () => { setShowReplyModal(false); setReplyText(''); };

  const statusBadge = (status) => {
    const map = {
      pending:     { cls: 'sb-pending',     icon: <FaHourglassHalf />, label: 'Pending' },
      in_progress: { cls: 'sb-in-progress', icon: <FaClock />,         label: 'In Progress' },
      replied:     { cls: 'sb-replied',     icon: <FaReply />,         label: 'Replied' },
      resolved:    { cls: 'sb-resolved',    icon: <FaCheckCircle />,   label: 'Resolved' },
    };
    const b = map[status] || map.pending;
    return <span className={`cm-badge ${b.cls}`}>{b.icon} {b.label}</span>;
  };

  const priorityBadge = (priority) => {
    const map = {
      urgent: { cls: 'pb-urgent', label: 'Urgent' },
      high:   { cls: 'pb-high',   label: 'High' },
      normal: { cls: 'pb-normal', label: 'Normal' },
      low:    { cls: 'pb-low',    label: 'Low' },
    };
    const b = map[priority] || map.normal;
    return <span className={`cm-badge ${b.cls}`}>{b.label}</span>;
  };

  const sourceBadge = (source) => (
    <span className={`cm-badge src-${source}`}>
      {source === 'contact' ? 'Contact Us' : 'Help Center'}
    </span>
  );

  const fmt = (d) => d ? new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : '—';

  if (loading) return (
    <div className="cm-loading">
      <div className="cm-spinner" />
      <p>Loading tickets...</p>
    </div>
  );

  return (
    <div className="cm-container">

      {/* Toast */}
      {toast && (
        <div className={`cm-toast cm-toast-${toast.type}`}>
          {toast.type === 'success' ? <FaCheck /> : <FaTimesCircle />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="cm-header">
        <div>
          <h1>Support Tickets</h1>
          <p>Manage requests from Contact Us and Help Center</p>
        </div>
      </div>

      {/* Stats */}
      <div className="cm-stats-grid">
        {[
          { icon: <FaHourglassHalf />, cls: 'st-pending',     val: stats.pending_count     || 0, label: 'Pending' },
          { icon: <FaClock />,         cls: 'st-progress',    val: stats.in_progress_count || 0, label: 'In Progress' },
          { icon: <FaReply />,         cls: 'st-replied',     val: stats.replied_count     || 0, label: 'Replied' },
          { icon: <FaCheckCircle />,   cls: 'st-resolved',    val: stats.resolved_count    || 0, label: 'Resolved' },
          { icon: <FaExclamationTriangle />, cls: 'st-urgent', val: stats.urgent_count     || 0, label: 'Urgent' },
        ].map(s => (
          <div key={s.label} className="cm-stat-card">
            <div className={`cm-stat-icon ${s.cls}`}>{s.icon}</div>
            <div><div className="cm-stat-val">{s.val}</div><div className="cm-stat-lbl">{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="cm-filters">
        <FaFilter className="cm-filter-icon" />
        {[
          { label: 'Status', val: statusFilter, set: setStatusFilter, opts: [['all','All Status'],['pending','Pending'],['in_progress','In Progress'],['replied','Replied'],['resolved','Resolved']] },
          { label: 'Source', val: sourceFilter, set: setSourceFilter, opts: [['all','All Sources'],['contact','Contact Us'],['help','Help Center']] },
          { label: 'Priority', val: priorityFilter, set: setPriorityFilter, opts: [['all','All Priorities'],['urgent','Urgent'],['high','High'],['normal','Normal'],['low','Low']] },
        ].map(f => (
          <div key={f.label} className="cm-filter-group">
            <label>{f.label}:</label>
            <select value={f.val} onChange={e => f.set(e.target.value)}>
              {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Ticket List */}
      {messages.length === 0 ? (
        <div className="cm-empty"><FaEnvelope /><p>No tickets found</p></div>
      ) : (
        <div className="cm-list">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`cm-card ${msg.status === 'pending' ? 'cm-card-unread' : ''}`}
              onClick={() => setSelectedMessage(msg)}
            >
              <div className="cm-card-top">
                <div className="cm-card-sender"><FaUser /> <strong>{msg.first_name} {msg.last_name}</strong></div>
                <div className="cm-card-badges">
                  {sourceBadge(msg.source)}
                  {priorityBadge(msg.priority)}
                  {statusBadge(msg.status)}
                </div>
              </div>
              <div className="cm-card-subject">{msg.subject || 'No subject'}</div>
              <div className="cm-card-meta">
                <span><FaEnvelope /> {msg.email}</span>
                {msg.phone && <span><FaPhone /> {msg.phone}</span>}
                <span><FaClock /> {fmt(msg.created_at)}</span>
              </div>
              <div className="cm-card-preview">
                {msg.message.substring(0, 150)}{msg.message.length > 150 && '…'}
              </div>
              {msg.admin_reply && (
                <div className="cm-card-replied"><FaReply /> Admin replied</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedMessage && !showReplyModal && (
        <div className="cm-overlay" onClick={() => setSelectedMessage(null)}>
          <div className="cm-modal" onClick={e => e.stopPropagation()}>

            <div className="cm-modal-head">
              <div>
                <h2>Ticket #{selectedMessage.id}</h2>
                <div className="cm-modal-badges">
                  {sourceBadge(selectedMessage.source)}
                  {priorityBadge(selectedMessage.priority)}
                  {statusBadge(selectedMessage.status)}
                </div>
              </div>
              <button className="cm-close" onClick={() => setSelectedMessage(null)}>×</button>
            </div>

            <div className="cm-modal-body">

              {/* From */}
              <div className="cm-section">
                <h3>From</h3>
                <p><FaUser /> <strong>{selectedMessage.first_name} {selectedMessage.last_name}</strong></p>
                <p><FaEnvelope /> {selectedMessage.email}</p>
                {selectedMessage.phone && <p><FaPhone /> {selectedMessage.phone}</p>}
                {selectedMessage.role  && <p><FaUser /> Role: {selectedMessage.role}</p>}
                <p><FaClock /> Received: {fmt(selectedMessage.created_at)}</p>
              </div>

              {/* Message */}
              <div className="cm-section">
                <h3>Message</h3>
                <div className="cm-subject-line">{selectedMessage.subject}</div>
                <div className="cm-message-box">{selectedMessage.message}</div>
              </div>

              {/* Admin Reply */}
              {selectedMessage.admin_reply && (
                <div className="cm-section cm-reply-section">
                  <h3>Admin Reply</h3>
                  <div className="cm-reply-box">{selectedMessage.admin_reply}</div>
                  <div className="cm-reply-meta">
                    {selectedMessage.replied_at && <span><FaClock /> {fmt(selectedMessage.replied_at)}</span>}
                    {selectedMessage.user_notified && <span className="cm-notified"><FaCheck /> User notified via email</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="cm-modal-actions">
              <div className="cm-actions-left">
                {selectedMessage.status === 'pending' && (
                  <button className="cm-btn cm-btn-progress" onClick={() => updateStatus(selectedMessage.id, 'in_progress', 'normal')}>
                    <span className="btn-inner"><FaClock /> Mark In Progress</span>
                  </button>
                )}
                {selectedMessage.status === 'in_progress' && (
                  <button className="cm-btn cm-btn-pending" onClick={() => updateStatus(selectedMessage.id, 'pending')}>
                    <span className="btn-inner"><FaHourglassHalf /> Back to Pending</span>
                  </button>
                )}
                {selectedMessage.status !== 'resolved' && (
                  <button className="cm-btn cm-btn-resolve" onClick={() => updateStatus(selectedMessage.id, 'resolved')}>
                    <span className="btn-inner"><FaCheckCircle /> Mark Resolved</span>
                  </button>
                )}
                {selectedMessage.status === 'resolved' && (
                  <button className="cm-btn cm-btn-reopen" onClick={() => updateStatus(selectedMessage.id, 'pending')}>
                    <span className="btn-inner"><FaRedoAlt /> Reopen</span>
                  </button>
                )}
              </div>
              <div className="cm-actions-right">
                <a
                  href={`mailto:${selectedMessage.email}?subject=Re: Your support request #${selectedMessage.id}`}
                  className="cm-btn cm-btn-email"
                >
                  <span className="btn-inner"><FaEnvelope /> Email User</span>
                </a>
                {selectedMessage.status !== 'resolved' && (
                  <button className="cm-btn cm-btn-reply" onClick={openReply}>
                    <span className="btn-inner"><FaPaperPlane /> Send Reply</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Reply Modal */}
      {showReplyModal && selectedMessage && (
        <div className="cm-overlay" onClick={closeReply}>
          <div className="cm-reply-modal" onClick={e => e.stopPropagation()}>

            <div className="cm-modal-head">
              <h2>Reply to Ticket #{selectedMessage.id}</h2>
              <button className="cm-close" onClick={closeReply}>×</button>
            </div>

            <div className="cm-reply-modal-body">
              <div className="cm-reply-to">
                <strong>To:</strong> {selectedMessage.first_name} {selectedMessage.last_name}
                <span className="cm-reply-email">({selectedMessage.email})</span>
              </div>

              <div className="cm-reply-original">
                <div className="cm-reply-original-label">Original Message</div>
                <div className="cm-reply-original-text">{selectedMessage.message}</div>
              </div>

              <div className="cm-reply-field">
                <label htmlFor="reply-textarea">Your Reply</label>
                <textarea
                  id="reply-textarea"
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Type your response to the user..."
                  rows={7}
                  autoFocus
                />
              </div>

              <label className="cm-notify-label">
                <input
                  type="checkbox"
                  checked={notifyUser}
                  onChange={e => setNotifyUser(e.target.checked)}
                />
                <span>Send email notification to user</span>
              </label>
            </div>

            <div className="cm-reply-modal-footer">
              <button className="cm-btn cm-btn-cancel" onClick={closeReply} disabled={sendingReply}>
                Cancel
              </button>
              <button
                className="cm-btn cm-btn-send"
                onClick={sendReply}
                disabled={sendingReply || !replyText.trim()}
              >
                <span className="btn-inner">
                  {sendingReply
                    ? 'Sending…'
                    : <><FaPaperPlane /> Send Reply</>}
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
