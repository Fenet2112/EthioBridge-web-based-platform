import React, { useState, useEffect } from 'react';
import { checkBackendHealth } from '../utils/api';
import './HealthCheck.css';

/**
 * Health Check Component
 * Monitors backend connectivity and shows status
 */
function HealthCheck() {
  const [health, setHealth] = useState({ healthy: true, checking: true });
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    checkHealth();
    
    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const checkHealth = async () => {
    try {
      const result = await checkBackendHealth();
      setHealth({ ...result, checking: false });
    } catch (error) {
      setHealth({ healthy: false, checking: false, error: error.message });
    }
  };

  // Don't show anything if healthy
  if (health.healthy && !showDetails) {
    return null;
  }

  return (
    <div className={`health-check ${health.healthy ? 'healthy' : 'unhealthy'}`}>
      <div className="health-check-content">
        <div className="health-status">
          <span className="health-icon">
            {health.checking ? '⏳' : health.healthy ? '✅' : '⚠️'}
          </span>
          <span className="health-text">
            {health.checking 
              ? 'Checking connection...' 
              : health.healthy 
                ? 'Connected' 
                : 'Connection issue - Retrying...'}
          </span>
        </div>
        
        {!health.healthy && (
          <button 
            className="health-retry-btn" 
            onClick={checkHealth}
            disabled={health.checking}
          >
            Retry
          </button>
        )}
        
        <button 
          className="health-details-btn" 
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? '▼' : '▶'}
        </button>
      </div>
      
      {showDetails && (
        <div className="health-details">
          <div className="health-detail-item">
            <strong>Status:</strong> {health.status || 'Unknown'}
          </div>
          {health.uptime && (
            <div className="health-detail-item">
              <strong>Uptime:</strong> {health.uptime}
            </div>
          )}
          {health.database && (
            <div className="health-detail-item">
              <strong>Database:</strong> {health.database.healthy ? 'Connected' : 'Disconnected'}
            </div>
          )}
          {health.error && (
            <div className="health-detail-item error">
              <strong>Error:</strong> {health.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HealthCheck;
