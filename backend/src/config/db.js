const { Pool } = require("pg");
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "ethiobridge",
  password: process.env.DB_PASSWORD || "1234",
  port: parseInt(process.env.DB_PORT) || 5432,
});

module.exports = pool;
