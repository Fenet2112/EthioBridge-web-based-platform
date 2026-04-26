/**
 * Run: node run-system-settings-migration.js
 * Creates the system_settings table and seeds the default row.
 */
require('dotenv').config();
const pool = require('./src/config/db');
const fs   = require('fs');
const path = require('path');

async function run() {
  const sql = fs.readFileSync(
    path.join(__dirname, '../database/migrations/022_system_settings.sql'),
    'utf8'
  );
  try {
    await pool.query(sql);
    console.log('✅ system_settings migration applied');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

run();
