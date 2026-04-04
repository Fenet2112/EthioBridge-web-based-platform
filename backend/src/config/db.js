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
  // Connection pool settings for Supabase
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
});

// Test connection
pool.on('connect', () => {
  console.log('✓ Connected to Supabase database');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

module.exports = pool;
