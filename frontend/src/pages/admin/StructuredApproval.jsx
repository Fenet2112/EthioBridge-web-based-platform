import React, { useState, useEffect } from 'react';
import { 
  FaUsers, FaClipboardList, FaCheckCircle, FaTimesCircle, FaExclamationTriangle,
  FaShieldAlt, FaChartBar, FaEye, FaRedo, FaBan, FaCheck, FaTimes,
  FaFilter, FaSort, FaSearch, FaBolt, FaRobot
} from 'react-icons/fa';
import './StructuredApproval.css';
/* eslint-disable no-restricted-globals */

function StructuredApproval() {
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [pendingEntities, setPendingEntities] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [entityDetails, setEntityDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    riskLevel: '',
    recommendation: ''
  });

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    if (activeTab === 'users' || activeTab === 'purchases') {
      const entityType = activeTab === 'users' ? 'user' : 'purchase_request';
      fetchPendingEntities(entityType);
    }
  }, [activeTab, filters]);

  const fetchOverview = async () => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/api/admin/structured-approval/overview`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setOverview(data);
        console.log('[StructuredApproval] Overview loaded:', data);
      }
    } catch (error) {
      console.error('[StructuredApproval] Error fetching overview:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingEntities = async (entityType) => {
    try {
      setLoading(true);
      const adminToken = localStorage.getItem('adminToken');
      
      let url = `${API_BASE_URL}/api/admin/structured-approval/${entityType}/pending`;
      const params = new URLSearchParams();
      if (filters.riskLevel) params.append('riskLevel', filters.riskLevel);
      if (filters.recommendation) params.append('recommendation', filters.recommendation);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPendingEntities(data.entities);
        console.log(`[StructuredApproval] Loaded ${data.entities.length} pending ${entityType}s`);
      }
    } catch (error) {
      console.error(`[StructuredApproval] Error fetching pending ${entityType}s:`, error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEntityDetails = async (entityType, entityId) => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      const response = await fetch(
        `${API_BASE_URL}/api/admin/structured-approval/${entityType}/${entityId}/details`,
        { headers: { 'Authorization': `Bearer ${adminToken}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setEntityDetails(data);
        console.log('[StructuredApproval] Entity details loaded:', data);
      }
    } catch (error) {
      console.error('[StructuredApproval] Error fetching entity details:', error);
    }
  };

  const handleApprove = async (entityType, entityId, notes = '') => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      const response = await fetch(
        `${API_BASE_URL}/api/admin/structured-approval/${entityType}/${entityId}/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ notes })
        }
      );

      if (response.ok) {
        console.log('[StructuredApproval] Entity approved successfully');
        // Refresh data
        fetchOverview();
        if (activeTab === 'users' || activeTab === 'purchases') {
          fetchPendingEntities(activeTab === 'users' ? 'user' : 'purchase_request');
        }
        setSelectedEntity(null);
        setEntityDetails(null);
      } else {
        const error = await response.json();
        alert(`Failed to approve: ${error.message}`);
      }
    } catch (error) {
      console.error('[StructuredApproval] Error approving entity:', error);
      alert('Failed to approve entity');
    }
  };

  const handleReject = async (entityType, entityId, reason) => {
    if (!reason) {
      reason = prompt('Please provide a rejection reason:');
      if (!reason) return;
    }

    try {
      const adminToken = localStorage.getItem('adminToken');
      const response = await fetch(
        `${API_BASE_URL}/api/admin/structured-approval/${entityType}/${entityId}/reject`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason })
        }
      );

      if (response.ok) {
        console.log('[StructuredApproval] Entity rejected successfully');
        // Refresh data
        fetchOverview();
        if (activeTab === 'users' || activeTab === 'purchases') {
          fetchPendingEntities(activeTab === 'users' ? 'user' : 'purchase_request');
        }
        setSelectedEntity(null);
        setEntityDetails(null);
      } else {
        const error = await response.json();
        alert(`Failed to reject: ${error.message}`);
      }
    } catch (error) {
      console.error('[StructuredApproval] Error rejecting entity:', error);
      alert('Failed to reject entity');
    }
  };

  const processAutoApprovals = async (entityType) => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      const response = await fetch(
        `${API_BASE_URL}/api/admin/structured-approval/${entityType}/process-auto`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${adminToken}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        alert(`Auto processing completed: ${data.result.approved} approved, ${data.result.rejected} rejected`);
        fetchOverview();
        if (activeTab === 'users' || activeTab === 'purchases') {
          fetchPendingEntities(activeTab === 'users' ? 'user' : 'purchase_request');
        }
      }
    } catch (error) {
      console.error('[StructuredApproval] Error processing auto approvals:', error);
      alert('Failed to process auto approvals');
    }
  };

  const getRiskBadge = (riskLevel) => {
    const badges = {
      low: { class: 'risk-low', icon: <FaCheckCircle />, label: 'Low Risk' },
      medium: { class: 'risk-medium', icon: <FaExclamationTriangle />, label: 'Medium Risk' },
      high: { class: 'risk-high', icon: <FaBan />, label: 'High Risk' }
    };
    const badge = badges[riskLevel] || badges.medium;
    return (
      <span className={`risk-badge ${badge.class}`}>
        {badge.icon} {badge.label}
      </span>
    );
  };

  const getRecommendationBadge = (recommendation) => {
    const badges = {
      approve: { class: 'rec-approve', icon: <FaCheck />, label: 'Approve' },
      reject: { class: 'rec-reject', icon: <FaTimes />, label: 'Reject' },
      review: { class: 'rec-review', icon: <FaEye />, label: 'Manual Review' }
    };
    const badge = badges[recommendation] || badges.review;
    return (
      <span className={`recommendation-badge ${badge.class}`}>
        {badge.icon} {badge.label}
      </span>
    );
  };

  const getScoreColor = (percentage) => {
    if (percentage >= 80) return '#10b981'; // Green
    if (percentage >= 60) return '#f59e0b'; // Yellow
    if (percentage >= 40) return '#f97316'; // Orange
    return '#ef4444'; // Red
  };

  if (loading && !overview) {
    return (
      <div className="structured-approval-loading">
        <div className="loading-spinner"></div>
        <p>Loading approval system...</p>
      </div>
    );
  }

  return (
    <div className="structured-approval-container">
      <div className="structured-approval-header">
        <div>
          <h1>Structured Approval System</h1>
          <p>Advanced approval management with scoring and validation criteria</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="approval-tabs">
        <button 
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          <FaChartBar /> Overview
        </button>
        <button 
          className={activeTab === 'users' ? 'active' : ''}
          onClick={() => setActiveTab('users')}
        >
          <FaUsers /> User Approvals
        </button>
        <button 
          className={activeTab === 'purchases' ? 'active' : ''}
          onClick={() => setActiveTab('purchases')}
        >
          <FaClipboardList /> Purchase Requests
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && overview && (
        <div className="approval-overview">
          {/* Summary Cards */}
          <div className="overview-cards">
            <div className="overview-card">
              <div className="card-icon users">
                <FaUsers />
              </div>
              <div className="card-content">
                <div className="card-value">{overview.summary.totalPendingUsers}</div>
                <div className="card-label">Pending Users</div>
                <div className="card-meta">
                  {overview.summary.highRiskUsers} high risk • {overview.summary.autoApprovableUsers} auto-approvable
                </div>
              </div>
            </div>

            <div className="overview-card">
              <div className="card-icon purchases">
                <FaClipboardList />
              </div>
              <div className="card-content">
                <div className="card-value">{overview.summary.totalPendingPurchases}</div>
                <div className="card-label">Pending Purchases</div>
                <div className="card-meta">
                  {overview.summary.highRiskPurchases} high risk • {overview.summary.autoApprovablePurchases} auto-approvable
                </div>
              </div>
            </div>

            <div className="overview-card">
              <div className="card-icon auto">
                <FaRobot />
              </div>
              <div className="card-content">
                <div className="card-value">
                  {overview.summary.autoApprovableUsers + overview.summary.autoApprovablePurchases}
                </div>
                <div className="card-label">Auto-Approvable</div>
                <div className="card-meta">
                  Ready for automatic processing
                </div>
              </div>
            </div>

            <div className="overview-card">
              <div className="card-icon risk">
                <FaShieldAlt />
              </div>
              <div className="card-content">
                <div className="card-value">
                  {overview.summary.highRiskUsers + overview.summary.highRiskPurchases}
                </div>
                <div className="card-label">High Risk</div>
                <div className="card-meta">
                  Requires manual review
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions">
            <h3>Quick Actions</h3>
            <div className="action-buttons">
              <button 
                className="action-btn auto"
                onClick={() => processAutoApprovals('user')}
                disabled={overview.summary.autoApprovableUsers === 0}
              >
                <FaBolt /> Process Auto User Approvals ({overview.summary.autoApprovableUsers})
              </button>
              <button 
                className="action-btn auto"
                onClick={() => processAutoApprovals('purchase_request')}
                disabled={overview.summary.autoApprovablePurchases === 0}
              >
                <FaBolt /> Process Auto Purchase Approvals ({overview.summary.autoApprovablePurchases})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users/Purchases Tab */}
      {(activeTab === 'users' || activeTab === 'purchases') && (
        <div className="approval-entities">
          {/* Filters */}
          <div className="approval-filters">
            <div className="filter-group">
              <FaFilter />
              <label>Risk Level:</label>
              <select 
                value={filters.riskLevel} 
                onChange={(e) => setFilters({...filters, riskLevel: e.target.value})}
              >
                <option value="">All Risk Levels</option>
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Recommendation:</label>
              <select 
                value={filters.recommendation} 
                onChange={(e) => setFilters({...filters, recommendation: e.target.value})}
              >
                <option value="">All Recommendations</option>
                <option value="approve">Approve</option>
                <option value="reject">Reject</option>
                <option value="review">Manual Review</option>
              </select>
            </div>
            <div className="filter-stats">
              Showing {pendingEntities.length} entities
            </div>
          </div>

          {/* Entity List */}
          {loading ? (
            <div className="entities-loading">
              <div className="loading-spinner"></div>
              <p>Loading entities...</p>
            </div>
          ) : pendingEntities.length === 0 ? (
            <div className="no-entities">
              <FaCheckCircle />
              <p>No pending {activeTab} found</p>
            </div>
          ) : (
            <div className="entities-list">
              {pendingEntities.map((entity) => (
                <div key={entity.id} className="entity-card">
                  <div className="entity-header">
                    <div className="entity-info">
                      <h3>
                        {activeTab === 'users' 
                          ? (entity.display_name || entity.email)
                          : `${entity.product_name} - ${entity.organization_name}`
                        }
                      </h3>
                      <p>
                        {activeTab === 'users' 
                          ? `${entity.role} • ${entity.email}`
                          : `${entity.industry_name} • ${entity.stakeholder_email}`
                        }
                      </p>
                    </div>
                    <div className="entity-badges">
                      {getRiskBadge(entity.risk_level)}
                      {getRecommendationBadge(entity.recommendation)}
                    </div>
                  </div>

                  <div className="entity-score">
                    <div className="score-bar">
                      <div 
                        className="score-fill" 
                        style={{ 
                          width: `${entity.score_percentage || 0}%`,
                          backgroundColor: getScoreColor(entity.score_percentage || 0)
                        }}
                      ></div>
                    </div>
                    <div className="score-text">
                      Score: {entity.score_percentage?.toFixed(1) || 0}%
                      {entity.failed_required > 0 && (
                        <span className="failed-required">
                          • {entity.failed_required} required criteria failed
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="entity-actions">
                    <button 
                      className="action-btn view"
                      onClick={() => {
                        setSelectedEntity(entity);
                        fetchEntityDetails(activeTab === 'users' ? 'user' : 'purchase_request', entity.id);
                      }}
                    >
                      <FaEye /> View Details
                    </button>
                    <button 
                      className="action-btn approve"
                      onClick={() => handleApprove(activeTab === 'users' ? 'user' : 'purchase_request', entity.id)}
                    >
                      <FaCheck /> Approve
                    </button>
                    <button 
                      className="action-btn reject"
                      onClick={() => handleReject(activeTab === 'users' ? 'user' : 'purchase_request', entity.id)}
                    >
                      <FaTimes /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Entity Details Modal */}
      {selectedEntity && entityDetails && (
        <div className="entity-modal-overlay" onClick={() => {setSelectedEntity(null); setEntityDetails(null);}}>
          <div className="entity-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {activeTab === 'users' ? 'User' : 'Purchase Request'} Approval Details
              </h2>
              <button className="modal-close" onClick={() => {setSelectedEntity(null); setEntityDetails(null);}}>
                ×
              </button>
            </div>

            <div className="modal-body">
              {/* Score Summary */}
              <div className="score-summary">
                <div className="score-circle">
                  <div className="score-value">
                    {entityDetails.score?.score_percentage?.toFixed(1) || 0}%
                  </div>
                  <div className="score-label">Overall Score</div>
                </div>
                <div className="score-details">
                  {getRiskBadge(entityDetails.score?.risk_level)}
                  {getRecommendationBadge(entityDetails.score?.recommendation)}
                  <div className="score-breakdown">
                    <span>Total: {entityDetails.score?.total_score || 0}</span>
                    <span>Max: {entityDetails.score?.max_possible_score || 100}</span>
                  </div>
                </div>
              </div>

              {/* Criteria Details */}
              <div className="criteria-section">
                <h3>Validation Criteria</h3>
                <div className="criteria-list">
                  {entityDetails.criteria.map((criteria, index) => (
                    <div key={index} className={`criteria-item ${criteria.status}`}>
                      <div className="criteria-header">
                        <span className={`criteria-status ${criteria.status}`}>
                          {criteria.status === 'passed' ? <FaCheckCircle /> : <FaTimesCircle />}
                        </span>
                        <span className="criteria-name">{criteria.criteria_type.replace(/_/g, ' ')}</span>
                        <span className="criteria-score">+{criteria.score} pts</span>
                        {criteria.is_required && <span className="required-badge">Required</span>}
                      </div>
                      {criteria.notes && (
                        <div className="criteria-notes">{criteria.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Fraud Indicators */}
              {entityDetails.fraudIndicators.length > 0 && (
                <div className="fraud-section">
                  <h3>Fraud Indicators</h3>
                  <div className="fraud-list">
                    {entityDetails.fraudIndicators.map((fraud, index) => (
                      <div key={index} className={`fraud-item ${fraud.severity}`}>
                        <FaExclamationTriangle />
                        <span>{fraud.detection_type}: {fraud.details}</span>
                        <span className="fraud-severity">{fraud.severity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Entity Information */}
              <div className="entity-info-section">
                <h3>Entity Information</h3>
                <div className="info-grid">
                  {Object.entries(entityDetails.entityInfo).map(([key, value]) => {
                    if (!value || key === 'id' || key.includes('password')) return null;
                    return (
                      <div key={key} className="info-item">
                        <span className="info-label">{key.replace(/_/g, ' ')}:</span>
                        <span className="info-value">{value.toString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button 
                className="action-btn approve"
                onClick={() => handleApprove(activeTab === 'users' ? 'user' : 'purchase_request', selectedEntity.id)}
              >
                <FaCheck /> Approve
              </button>
              <button 
                className="action-btn reject"
                onClick={() => handleReject(activeTab === 'users' ? 'user' : 'purchase_request', selectedEntity.id)}
              >
                <FaTimes /> Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StructuredApproval;