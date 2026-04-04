require('dotenv').config();
const pool = require('./src/config/db');

async function testSupabaseConnection() {
  console.log('========================================');
  console.log('Testing Supabase Connection');
  console.log('========================================\n');

  console.log('Configuration:');
  console.log('  Host:', process.env.DB_HOST);
  console.log('  Port:', process.env.DB_PORT);
  console.log('  Database:', process.env.DB_NAME);
  console.log('  User:', process.env.DB_USER);
  console.log('  SSL:', process.env.DB_SSL);
  console.log('');

  try {
    // Test 1: Basic connection
    console.log('Test 1: Testing basic connection...');
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✓ Connection successful!');
    console.log('  Current time:', result.rows[0].current_time);
    console.log('  PostgreSQL version:', result.rows[0].pg_version.split(' ')[0], result.rows[0].pg_version.split(' ')[1]);
    console.log('');

    // Test 2: Check if tables exist
    console.log('Test 2: Checking database tables...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tables.rows.length > 0) {
      console.log(`✓ Found ${tables.rows.length} tables:`);
      tables.rows.forEach(row => console.log('  -', row.table_name));
    } else {
      console.log('⚠ No tables found. You need to run migrations.');
      console.log('  Run: psql "YOUR_CONNECTION_STRING" -f database/schema.sql');
    }
    console.log('');

    // Test 3: Check pool stats
    console.log('Test 3: Connection pool stats...');
    console.log('  Total connections:', pool.totalCount);
    console.log('  Idle connections:', pool.idleCount);
    console.log('  Waiting requests:', pool.waitingCount);
    console.log('');

    // Test 4: Test a simple query
    console.log('Test 4: Testing query execution...');
    const testQuery = await pool.query('SELECT 1 + 1 as result');
    console.log('✓ Query executed successfully');
    console.log('  Result:', testQuery.rows[0].result);
    console.log('');

    console.log('========================================');
    console.log('✓ All tests passed!');
    console.log('Your Supabase connection is working correctly.');
    console.log('========================================');

    process.exit(0);
  } catch (error) {
    console.error('========================================');
    console.error('✗ Connection test failed!');
    console.error('========================================\n');
    console.error('Error:', error.message);
    console.error('');
    console.error('Common issues:');
    console.error('  1. Check your .env file has correct Supabase credentials');
    console.error('  2. Make sure DB_SSL=true for Supabase');
    console.error('  3. Verify your Supabase project is active');
    console.error('  4. Check if your IP is allowed (Supabase allows all by default)');
    console.error('  5. Ensure password has no special characters that need escaping');
    console.error('');
    console.error('Full error details:');
    console.error(error);
    
    process.exit(1);
  }
}

testSupabaseConnection();
