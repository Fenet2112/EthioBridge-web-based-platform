const pool = require('./src/config/db');

async function checkColumns() {
  try {
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'stakeholders'
      ORDER BY ordinal_position
    `);
    
    console.log('Stakeholders table columns:', result.rows.map(c => c.column_name).join(', '));
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

checkColumns();
