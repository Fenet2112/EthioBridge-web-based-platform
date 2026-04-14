const { Pool } = require("pg");
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

// Supabase connection configuration
// Support both individual parameters and connection string
const poolConfig = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false,
} : {
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "ethiobridge",
  password: process.env.DB_PASSWORD || "1234",
  port: parseInt(process.env.DB_PORT) || 5432,
  // SSL configuration for Supabase
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false,
};

const pool = new Pool({
  ...poolConfig,
  // Connection pool settings optimized for stability
  max: 20, // Maximum number of clients in the pool
  min: 2, // Minimum number of clients to keep alive
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
  // Keep connections alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Connection event handlers
pool.on('connect', (client) => {
  console.log('✓ Connected to Supabase database');
});

pool.on('acquire', (client) => {
  // Client acquired from pool
});

pool.on('remove', (client) => {
  console.log('⚠️  Database client removed from pool');
});

pool.on('error', (err, client) => {
  console.error('❌ Unexpected database pool error:', err);
  console.error('Error details:', {
    message: err.message,
    code: err.code,
    stack: err.stack
  });
  // Don't exit process - let the pool handle reconnection
});

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing database pool...');
  await pool.end();
  process.exit(0);
});

// Health check function
pool.healthCheck = async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    return { healthy: true, timestamp: result.rows[0].now };
  } catch (error) {
    console.error('Database health check failed:', error.message);
    return { healthy: false, error: error.message };
  }
};

module.exports = pool;
