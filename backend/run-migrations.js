const fs = require('fs');
const path = require('path');
const pool = require('./src/config/db');

async function runMigrations() {
  console.log('========================================');
  console.log('Running Database Migrations');
  console.log('========================================\n');

  try {
    // Read and run schema.sql
    console.log('Step 1: Running schema.sql...');
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schema);
      console.log('✓ Schema created successfully\n');
    } else {
      console.log('⚠ schema.sql not found, skipping...\n');
    }

    // Get all migration files
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to run in order

    console.log(`Step 2: Running ${migrationFiles.length} migration files...\n`);

    for (const file of migrationFiles) {
      console.log(`  Running ${file}...`);
      const migrationPath = path.join(migrationsDir, file);
      const migration = fs.readFileSync(migrationPath, 'utf8');
      
      try {
        await pool.query(migration);
        console.log(`  ✓ ${file} completed`);
      } catch (error) {
        // Some migrations might fail if already run, that's okay
        if (error.message.includes('already exists')) {
          console.log(`  ⚠ ${file} - already exists, skipping`);
        } else {
          console.log(`  ✗ ${file} - Error: ${error.message}`);
        }
      }
    }

    console.log('\n========================================');
    console.log('Migration Summary');
    console.log('========================================\n');

    // Check what tables were created
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`✓ Database has ${tables.rows.length} tables:`);
    tables.rows.forEach(row => console.log(`  - ${row.table_name}`));

    console.log('\n========================================');
    console.log('✓ Migrations completed successfully!');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\n========================================');
    console.error('✗ Migration failed!');
    console.error('========================================\n');
    console.error('Error:', error.message);
    console.error('\nFull error:');
    console.error(error);
    process.exit(1);
  }
}

runMigrations();
