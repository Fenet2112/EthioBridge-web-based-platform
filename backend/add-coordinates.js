// Script to add latitude and longitude columns to industries table
require('dotenv').config();
const pool = require('./src/config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔄 Running migration: Add location coordinates...');
    
    const migrationPath = path.join(__dirname, '../database/migrations/019_add_location_coordinates.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('📍 Latitude and longitude columns added to industries table');
    
    // Check current industries
    const result = await pool.query('SELECT id, company_name, location, latitude, longitude FROM industries');
    console.log(`\n📊 Current industries (${result.rows.length}):`);
    result.rows.forEach(row => {
      console.log(`  - ${row.company_name} (${row.location}): lat=${row.latitude || 'null'}, lng=${row.longitude || 'null'}`);
    });
    
    console.log('\n💡 Next steps:');
    console.log('  1. Industries can now add their coordinates when creating/editing profiles');
    console.log('  2. Use the Industry page to update existing industries with coordinates');
    console.log('  3. Or manually update via SQL: UPDATE industries SET latitude=9.0320, longitude=38.7469 WHERE id=1;');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
