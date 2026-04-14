// PM2 ecosystem configuration for production deployment
// Run with: pm2 start ecosystem.config.js

module.exports = {
  apps: [{
    name: 'ethiobridge-backend',
    script: './index.js',
    instances: 1, // Use 'max' for cluster mode with all CPU cores
    exec_mode: 'fork', // Use 'cluster' for multiple instances
    watch: false, // Set to true in development
    max_memory_restart: '500M', // Restart if memory exceeds 500MB
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Auto-restart configuration
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    // Monitoring
    instance_var: 'INSTANCE_ID',
  }]
};
