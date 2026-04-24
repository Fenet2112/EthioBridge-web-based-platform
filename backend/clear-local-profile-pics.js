/**
 * One-time script: clear profile_picture values that point to local /uploads/ paths
 * (these are broken on Render after deploy). Users will need to re-upload.
 * Run: node clear-local-profile-pics.js
 */
require('dotenv').config();
const pool = require('./src/config/db');

async function clearLocalProfilePics() {
  try {
    console.log('Clearing broken local profile picture URLs...');

    const stakeholders = await pool.query(`
      UPDATE stakeholders
      SET profile_picture = NULL
      WHERE profile_picture IS NOT NULL
        AND profile_picture NOT LIKE 'http%'
      RETURNING id, profile_picture
    `);
    console.log(`Cleared ${stakeholders.rowCount} stakeholder profile pictures`);

    const industries = await pool.query(`
      UPDATE industries
      SET profile_picture = NULL
      WHERE profile_picture IS NOT NULL
        AND profile_picture NOT LIKE 'http%'
      RETURNING id, profile_picture
    `);
    console.log(`Cleared ${industries.rowCount} industry profile pictures`);

    console.log('Done. Users will need to re-upload their profile photos.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

clearLocalProfilePics();
