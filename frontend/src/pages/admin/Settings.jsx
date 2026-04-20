import React, { useState, useEffect } from 'react';
import './Settings.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const MODE_META = {
  manual:      { icon: '👤', color: '#f59e0b', label: 'Manual',      desc: 'Admin reviews every request' },
  automatic:   { icon: '⚡', color: '#10b981', label: 'Automatic',   desc: 'All requests approved instantly' },
  conditional: { icon: '🎯', color: '#667eea', label: 'Conditional', desc: 'Rule-based auto approve/reject' },
};

const DECISION_COLORS = {
  approved: { bg: '#e8f5e9', color: '#0a5c2f' },
  rejected: { bg: '#fff5f5', color: '#dc2626' },
  pending:  { bg: '#fff8e1', color: '#b45309' },
};

function Settings({ darkMode, setDarkMode }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [saved, setSaved] = useState(false);

  // Approval logs
  const [approvalLogs, setApprovalLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsFilter, setLogsFilter] = useState({ entityType: '', decision: '' });
  
  // Dropdown/Accordion state
  const [expandedSections, setExpandedSections] = useState({
    workflows: true,
    approvalLogs: true,
    account: false,
    appearance: true,
    notifications: true,
    systemRules: true,
    categories: true
  });
  
  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  useEffect(() => {
    fetchWorkflows();
    fetchApprovalLogs();
  }, []);

  useEffect(() => {
    fetchApprovalLogs();
  }, [logsFilter]);

  const fetchApprovalLogs = async () => {
    setLogsLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const params = new URLSearchParams({ limit: '30' });
      if (logsFilter.entityType) params.set('entityType', logsFilter.entityType);
      if (logsFilter.decision)   params.set('decision',   logsFilter.decision);
      const res = await fetch(`${API_BASE_URL}/api/admin/approval-logs?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setApprovalLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch approval logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchWorkflows = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/admin/settings/workflows`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setWorkflows(data.workflows);
      }
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateWorkflow = async (type, mode) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/admin/settings/workflows/${type}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mode, conditions: {} })
      });

      if (res.ok) {
        const meta = MODE_META[mode];
        setMessage({ type: 'success', text: `Workflow updated to ${meta.label} mode — ${meta.desc}` });
        fetchWorkflows();
        fetchApprovalLogs();
      } else {
        setMessage({ type: 'error', text: 'Failed to update workflow' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE_URL}/api/admin/settings/password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: 'Password changed successfully' });
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to change password' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const getWorkflowLabel = (type) => {
    const labels = {
      'stakeholder_registration': 'Stakeholder Registrations',
      'industry_registration': 'Industry Registrations',
      'purchase_request': 'Purchase Requests'
    };
    return labels[type] || type;
  };

  const getWorkflowIcon = (type) => {
    const icons = {
      'stakeholder_registration': '🤝',
      'industry_registration': '🏭',
      'purchase_request': '🛒'
    };
    return icons[type] || '⚙️';
  };

  if (loading) {
    return <div className="settings-loading">Loading settings...</div>;
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>⚙️ Admin Settings</h1>
        <p>Configure system-wide settings and approval workflows</p>
      </div>

      {message.text && (
        <div className={`settings-message ${message.type}`}>
          {message.type === 'success' ? '✓' : '✗'} {message.text}
        </div>
      )}

      {/* Approval Workflows Section */}
      <section className="settings-section collapsible">
        <div className="section-title clickable" onClick={() => toggleSection('workflows')}>
          <div>
            <h2>🔄 Approval Workflows</h2>
            <p>Control how registrations and requests are approved</p>
          </div>
          <span className={`collapse-icon ${expandedSections.workflows ? 'expanded' : ''}`}>
            ▼
          </span>
        </div>

        {expandedSections.workflows && (
          <div className="section-content">
            <div className="workflows-grid">
              {workflows.map(workflow => (
                <div key={workflow.workflow_type} className="workflow-card">
                  <div className="workflow-header">
                    <span className="workflow-icon">{getWorkflowIcon(workflow.workflow_type)}</span>
                    <div>
                      <h3>{getWorkflowLabel(workflow.workflow_type)}</h3>
                      {workflow.mode && (
                        <span className="workflow-current-mode" style={{ background: MODE_META[workflow.mode]?.color + '22', color: MODE_META[workflow.mode]?.color }}>
                          {MODE_META[workflow.mode]?.icon} Currently: {MODE_META[workflow.mode]?.label}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="workflow-modes">
                    <label className={`mode-option ${workflow.mode === 'automatic' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name={`workflow-${workflow.workflow_type}`}
                        checked={workflow.mode === 'automatic'}
                        onChange={() => updateWorkflow(workflow.workflow_type, 'automatic')}
                        disabled={saving}
                      />
                      <div className="mode-content">
                        <span className="mode-icon">⚡</span>
                        <div>
                          <strong>Automatic</strong>
                          <p>Approve instantly without review</p>
                        </div>
                      </div>
                    </label>

                    <label className={`mode-option ${workflow.mode === 'manual' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name={`workflow-${workflow.workflow_type}`}
                        checked={workflow.mode === 'manual'}
                        onChange={() => updateWorkflow(workflow.workflow_type, 'manual')}
                        disabled={saving}
                      />
                      <div className="mode-content">
                        <span className="mode-icon">👤</span>
                        <div>
                          <strong>Manual</strong>
                          <p>Require admin review for all</p>
                        </div>
                      </div>
                    </label>

                    <label className={`mode-option ${workflow.mode === 'conditional' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name={`workflow-${workflow.workflow_type}`}
                        checked={workflow.mode === 'conditional'}
                        onChange={() => updateWorkflow(workflow.workflow_type, 'conditional')}
                        disabled={saving}
                      />
                      <div className="mode-content">
                        <span className="mode-icon">🎯</span>
                        <div>
                          <strong>Conditional</strong>
                          <p>Auto-approve based on rules</p>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {/* Conditional mode rules reference */}
            {workflows.some(w => w.mode === 'conditional') && (
              <div className="conditional-rules-info">
                <h4>🎯 Active Conditional Rules</h4>
                <div className="rules-grid">
                  <div className="rules-col">
                    <strong>🏭 Industry Registration</strong>
                    <ul>
                      <li>✅ Company name provided</li>
                      <li>✅ Sector/category provided</li>
                      <li>✅ Location provided</li>
                      <li>⚠️ GPS coordinates (soft)</li>
                      <li>⚠️ Phone number (soft)</li>
                      <li>🚫 No duplicate company name</li>
                    </ul>
                  </div>
                  <div className="rules-col">
                    <strong>🤝 Stakeholder Registration</strong>
                    <ul>
                      <li>✅ Organization name provided</li>
                      <li>✅ Organization type provided</li>
                      <li>✅ Location provided</li>
                      <li>⚠️ Email verified (soft)</li>
                      <li>⚠️ Phone number (soft)</li>
                      <li>⚠️ ID document uploaded (soft)</li>
                    </ul>
                  </div>
                  <div className="rules-col">
                    <strong>🛒 Purchase Requests</strong>
                    <ul>
                      <li>✅ Product is available</li>
                      <li>✅ Industry is approved</li>
                      <li>✅ Valid quantity (1–10,000)</li>
                      <li>⚠️ Stakeholder is approved (soft)</li>
                      <li>🚫 No burst activity (&lt;10/hour)</li>
                    </ul>
                  </div>
                </div>
                <p className="rules-legend">✅ Hard requirement — fail = reject &nbsp;|&nbsp; ⚠️ Soft requirement — fail = pending &nbsp;|&nbsp; 🚫 Fraud check — fail = reject</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Approval Decision Logs Section */}
      <section className="settings-section collapsible">
        <div className="section-title clickable" onClick={() => toggleSection('approvalLogs')}>
          <div>
            <h2>📋 Approval Decision Logs</h2>
            <p>Audit trail of all automatic and manual approval decisions</p>
          </div>
          <span className={`collapse-icon ${expandedSections.approvalLogs ? 'expanded' : ''}`}>▼</span>
        </div>

        {expandedSections.approvalLogs && (
          <div className="section-content">
            {/* Filters */}
            <div className="logs-filters">
              <select value={logsFilter.entityType} onChange={e => setLogsFilter(f => ({ ...f, entityType: e.target.value }))}>
                <option value="">All Types</option>
                <option value="industry">Industry</option>
                <option value="stakeholder">Stakeholder</option>
                <option value="purchase_request">Purchase Request</option>
              </select>
              <select value={logsFilter.decision} onChange={e => setLogsFilter(f => ({ ...f, decision: e.target.value }))}>
                <option value="">All Decisions</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="pending">Pending</option>
              </select>
              <button className="btn-refresh-logs" onClick={fetchApprovalLogs}>↻ Refresh</button>
            </div>

            {logsLoading ? (
              <div className="logs-loading">Loading logs…</div>
            ) : approvalLogs.length === 0 ? (
              <div className="logs-empty">No approval decisions logged yet. Decisions appear here once workflows run.</div>
            ) : (
              <div className="logs-table-wrap">
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Entity</th>
                      <th>Type</th>
                      <th>Decision</th>
                      <th>Mode</th>
                      <th>Reason</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalLogs.map(log => {
                      const dc = DECISION_COLORS[log.decision] || { bg: '#f5f5f5', color: '#888' };
                      const modeMeta = MODE_META[log.mode] || {};
                      return (
                        <tr key={log.id}>
                          <td className="log-entity">{log.entity_name || `#${log.entity_id}`}</td>
                          <td><span className="log-type-badge">{log.entity_type.replace('_', ' ')}</span></td>
                          <td>
                            <span className="log-decision-badge" style={{ background: dc.bg, color: dc.color }}>
                              {log.decision}
                            </span>
                          </td>
                          <td>
                            <span className="log-mode-badge" style={{ color: modeMeta.color }}>
                              {modeMeta.icon} {log.mode}
                            </span>
                          </td>
                          <td className="log-reason">{log.reason || '—'}</td>
                          <td className="log-time">{new Date(log.created_at).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Account Management Section */}
      <section className="settings-section collapsible">
        <div className="section-title clickable" onClick={() => toggleSection('account')}>
          <div>
            <h2>🔐 Account Management</h2>
            <p>Manage your admin account credentials</p>
          </div>
          <span className={`collapse-icon ${expandedSections.account ? 'expanded' : ''}`}>
            ▼
          </span>
        </div>

        {expandedSections.account && (
          <div className="section-content">
            <div className="account-card">
              <form onSubmit={handlePasswordChange} className="password-form">
                <h3>Change Password</h3>
                
                <div className="form-group">
                  <label>Current Password</label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                    required
                    placeholder="Enter current password"
                  />
                </div>

                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                    required
                    placeholder="At least 8 characters"
                    minLength={8}
                  />
                </div>

                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                    required
                    placeholder="Re-enter new password"
                  />
                </div>

                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Changing...' : 'Change Password'}
                </button>
              </form>
            </div>
          </div>
        )}
      </section>

      {/* Appearance Section */}
      <section className="settings-section">
        <div className="section-title">
          <h2>🎨 Appearance</h2>
          <p>Customize the dashboard look and feel</p>
        </div>

        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">Dark Mode</div>
              <div className="settings-sub">Switch between light and dark theme</div>
            </div>
            <button 
              type="button"
              className={`toggle-btn ${darkMode ? "on" : ""}`} 
              onClick={() => setDarkMode(!darkMode)}
            >
              <span className="toggle-knob" />
            </button>
          </div>
        </div>
      </section>

      {/* Notifications Section */}
      <section className="settings-section">
        <div className="section-title">
          <h2>🔔 Notifications</h2>
          <p>Configure email and system alerts</p>
        </div>

        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">Email Alerts</div>
              <div className="settings-sub">Receive email for new registrations</div>
            </div>
            <button type="button" className="toggle-btn on">
              <span className="toggle-knob" />
            </button>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-label">Purchase Alerts</div>
              <div className="settings-sub">Notify on new purchase requests</div>
            </div>
            <button type="button" className="toggle-btn on">
              <span className="toggle-knob" />
            </button>
          </div>
        </div>
      </section>

      {/* System Rules Section */}
      <section className="settings-section">
        <div className="section-title">
          <h2>⚙️ System Rules</h2>
          <p>Configure platform limits and restrictions</p>
        </div>

        <div className="settings-card">
          <div className="settings-field">
            <label>Free Request Limit per User</label>
            <input type="number" defaultValue={1} className="settings-input" />
          </div>
          <div className="settings-field">
            <label>Max Products per Industry (Free)</label>
            <input type="number" defaultValue={5} className="settings-input" />
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="settings-section">
        <div className="section-title">
          <h2>🏷️ Categories</h2>
          <p>Manage industry sectors and classifications</p>
        </div>

        <div className="settings-card">
          <div className="settings-field">
            <label>Industry Sectors (comma-separated)</label>
            <textarea 
              className="settings-textarea" 
              defaultValue="Agriculture, Manufacturing, Technology, Healthcare, Finance, Energy, Retail, Construction" 
              rows={3} 
            />
          </div>
        </div>
      </section>

      {/* Save Button for General Settings */}
      <div style={{ marginTop: 24, paddingBottom: 24 }}>
        <button 
          type="button"
          className="btn-primary" 
          style={{ width: "auto", padding: "12px 32px" }} 
          onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
        >
          {saved ? "✓ Saved!" : "Save General Settings"}
        </button>
      </div>
    </div>
  );
}

export default Settings;
