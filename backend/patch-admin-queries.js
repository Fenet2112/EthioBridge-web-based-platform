/**
 * Patches admin.js to fix:
 * 1. Remove non-existent columns: login_count, last_login_at
 * 2. Fix SQL parameter syntax: ${n} -> $${n} (pg parameterized queries)
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/routes/admin.js');
let content = fs.readFileSync(filePath, 'utf8');

// ── Fix 1: Remove login_count and last_login_at from SELECT ──
content = content.replace(
  /\s*u\.last_login_at,\s*u\.login_count,\n/g,
  '\n'
);

// ── Fix 2: Remove login_count and last_login_at from GROUP BY ──
content = content.replace(
  /,\s*u\.last_login_at,\s*u\.login_count/g,
  ''
);

// ── Fix 3: Remove login_count from allowedSortColumns ──
content = content.replace(
  /"display_name", "product_count", "request_count", "login_count"/g,
  '"display_name", "product_count", "request_count"'
);

// ── Fix 4: Fix parameterized query syntax in users/all ──
// The broken pattern is: conditions.push(`u.role = ${paramCount++}`)
// It should be:          conditions.push(`u.role = $${paramCount++}`)
// We need to add $ before ${ in SQL string contexts

// Fix WHERE conditions in users/all
content = content.replace(
  /conditions\.push\(`u\.role = \$\{paramCount\+\+\}`\)/g,
  'conditions.push(`u.role = $${paramCount++}`)'
);
content = content.replace(
  /conditions\.push\(`u\.status = \$\{paramCount\+\+\}`\)/g,
  'conditions.push(`u.status = $${paramCount++}`)'
);
content = content.replace(
  /conditions\.push\(`u\.created_at >= \$\{paramCount\+\+\}`\)/g,
  'conditions.push(`u.created_at >= $${paramCount++}`)'
);
content = content.replace(
  /conditions\.push\(`u\.created_at <= \$\{paramCount\+\+\}`\)/g,
  'conditions.push(`u.created_at <= $${paramCount++}`)'
);

// Fix HAVING conditions
content = content.replace(
  /havingConditions\.push\(`COUNT\(DISTINCT p\.id\) >= \$\{paramCount\+\+\}`\)/g,
  'havingConditions.push(`COUNT(DISTINCT p.id) >= $${paramCount++}`)'
);
content = content.replace(
  /havingConditions\.push\(`COUNT\(DISTINCT p\.id\) <= \$\{paramCount\+\+\}`\)/g,
  'havingConditions.push(`COUNT(DISTINCT p.id) <= $${paramCount++}`)'
);
content = content.replace(
  /havingConditions\.push\(`COUNT\(DISTINCT pr\.id\) >= \$\{paramCount\+\+\}`\)/g,
  'havingConditions.push(`COUNT(DISTINCT pr.id) >= $${paramCount++}`)'
);
content = content.replace(
  /havingConditions\.push\(`COUNT\(DISTINCT pr\.id\) <= \$\{paramCount\+\+\}`\)/g,
  'havingConditions.push(`COUNT(DISTINCT pr.id) <= $${paramCount++}`)'
);

// Fix LIMIT/OFFSET in users/all
content = content.replace(
  /query \+= ` LIMIT \$\{paramCount\+\+\} OFFSET \$\{paramCount\+\+\}`;\s*queryParams\.push\(limitNum, offset\);/g,
  'query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;\n    queryParams.push(limitNum, offset);'
);

// Fix pending users query (same pattern)
content = content.replace(
  /query \+= ` AND u\.role = \$\{paramCount\+\+\}`/g,
  'query += ` AND u.role = $${paramCount++}`'
);
content = content.replace(
  /query \+= ` AND u\.role = \$\{paramCount\+\+\}`;/g,
  'query += ` AND u.role = $${paramCount++}`;'
);

// Fix search conditions in pending
content = content.replace(
  /LOWER\(u\.email\) LIKE LOWER\(\$\{paramCount\+\+\}\) OR\s*\n\s*LOWER\(COALESCE\(i\.company_name, ''\)\) LIKE LOWER\(\$\{paramCount\+\+\}\) OR\s*\n\s*LOWER\(COALESCE\(s\.organization_name, ''\)\) LIKE LOWER\(\$\{paramCount\+\+\}\)/g,
  "LOWER(u.email) LIKE LOWER($${paramCount++}) OR\n        LOWER(COALESCE(i.company_name, '')) LIKE LOWER($${paramCount++}) OR\n        LOWER(COALESCE(s.organization_name, '')) LIKE LOWER($${paramCount++})"
);

// Fix industries admin query
content = content.replace(
  /query \+= ` AND LOWER\(i\.sector\) LIKE LOWER\(\$\{paramCount\+\+\}\)`/g,
  'query += ` AND LOWER(i.sector) LIKE LOWER($${paramCount++})`'
);
content = content.replace(
  /query \+= ` AND LOWER\(i\.location\) LIKE LOWER\(\$\{paramCount\+\+\}\)`/g,
  'query += ` AND LOWER(i.location) LIKE LOWER($${paramCount++})`'
);
content = content.replace(
  /LOWER\(i\.company_name\) LIKE LOWER\(\$\{paramCount\+\+\}\) OR\s*\n\s*LOWER\(i\.description\) LIKE LOWER\(\$\{paramCount\+\+\}\)/g,
  'LOWER(i.company_name) LIKE LOWER($${paramCount++}) OR\n        LOWER(i.description) LIKE LOWER($${paramCount++})'
);
content = content.replace(
  /query \+= ` HAVING COUNT\(DISTINCT p\.id\) >= \$\{paramCount\+\+\}`/g,
  'query += ` HAVING COUNT(DISTINCT p.id) >= $${paramCount++}`'
);
content = content.replace(
  /query \+= ` HAVING COUNT\(DISTINCT p\.id\) <= \$\{paramCount\+\+\}`/g,
  'query += ` HAVING COUNT(DISTINCT p.id) <= $${paramCount++}`'
);

// Fix products admin query
content = content.replace(
  /query \+= ` AND LOWER\(p\.category\) LIKE LOWER\(\$\{paramCount\+\+\}\)`/g,
  'query += ` AND LOWER(p.category) LIKE LOWER($${paramCount++})`'
);
content = content.replace(
  /query \+= ` AND p\.is_available = \$\{paramCount\+\+\}`/g,
  'query += ` AND p.is_available = $${paramCount++}`'
);
content = content.replace(
  /query \+= ` AND LOWER\(i\.sector\) LIKE LOWER\(\$\{paramCount\+\+\}\)`/g,
  'query += ` AND LOWER(i.sector) LIKE LOWER($${paramCount++})`'
);
content = content.replace(
  /query \+= ` AND LOWER\(i\.location\) LIKE LOWER\(\$\{paramCount\+\+\}\)`/g,
  'query += ` AND LOWER(i.location) LIKE LOWER($${paramCount++})`'
);
content = content.replace(
  /LOWER\(p\.name\) LIKE LOWER\(\$\{paramCount\+\+\}\) OR\s*\n\s*LOWER\(p\.description\) LIKE LOWER\(\$\{paramCount\+\+\}\) OR\s*\n\s*LOWER\(i\.company_name\) LIKE LOWER\(\$\{paramCount\+\+\}\)/g,
  'LOWER(p.name) LIKE LOWER($${paramCount++}) OR\n        LOWER(p.description) LIKE LOWER($${paramCount++}) OR\n        LOWER(i.company_name) LIKE LOWER($${paramCount++})'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ admin.js patched successfully');

// Verify the module loads
try {
  delete require.cache[require.resolve('./src/routes/admin')];
  require('./src/routes/admin');
  console.log('✅ admin.js loads without errors');
} catch(e) {
  console.error('❌ admin.js still has errors:', e.message);
}
