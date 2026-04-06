import React, { useState, useEffect } from 'react';
import './Settings.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function Settings({ darkMode, setDarkMode }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [saved, setSaved] = useState(false);
  
  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    fetchWorkflows();
  }, []);

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
        setMessage({ type: 'success', text: 'Workflow updated successfully' });
        fetchWorkflows();
      } else {
        setMessage({ type: 'error', text: 'Failed to update workflow' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
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
      <section className="settings-section">
        <div className="section-title">
          <h2>🔄 Approval Workflows</h2>
          <p>Control how registrations and requests are approved</p>
        </div>

        <div className="workflows-grid">
          {workflows.map(workflow => (
            <div key={workflow.workflow_type} className="workflow-card">
              <div className="workflow-header">
                <span className="workflow-icon">{getWorkflowIcon(workflow.workflow_type)}</span>
                <h3>{getWorkflowLabel(workflow.workflow_type)}</h3>
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
      </section>

      {/* Account Management Section */}
      <section className="settings-section">
        <div className="section-title">
          <h2>🔐 Account Management</h2>
          <p>Manage your admin account credentials</p>
        </div>

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
