const pool = require('./src/config/db');

pool.query(`
  ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2) DEFAULT NULL CHECK (discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100));
  ALTER TABLE products ADD COLUMN IF NOT EXISTS request_count INTEGER NOT NULL DEFAULT 0;
`).then(() => {
  console.log('✅ Added discount_percentage and request_count columns to products');
  process.exit(0);
}).catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
