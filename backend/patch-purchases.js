/**
 * Patches purchases.js to fix:
 * 1. SQL parameter syntax: ${n} -> $${n} in my-requests and industry-requests routes
 * 2. Remove requireApproved from industry-requests (causes 403 for non-approved industry users)
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/routes/purchases.js');
let content = fs.readFileSync(filePath, 'utf8');

// ── Fix 1: Remove requireApproved from industry-requests ──
// The route currently has: requireRole("industry"), requireApproved,
// We want: requireRole("industry"),
content = content.replace(
  /requireRole\("industry"\),\s*\n\s*requireApproved,\s*\n\s*async \(req, res\) => \{\s*\n\s*try \{\s*\n\s*const industryResult/,
  'requireRole("industry"),\n  async (req, res) => {\n    try {\n      const industryResult'
);

// ── Fix 2: Fix SQL parameter syntax in my-requests ──
// Pattern: where += ` AND pr.status = ${n++}`  ->  where += ` AND pr.status = $${n++}`
// We need to find the my-requests route and fix its parameter syntax

// Find the my-requests route section and fix it
const myRequestsStart = content.indexOf('"purchases/my-requests"');
const industryRequestsStart = content.indexOf('"purchases/industry-requests"');

if (myRequestsStart !== -1 && industryRequestsStart !== -1) {
  // Extract the my-requests section
  let mySection = content.substring(myRequestsStart, industryRequestsStart);
  
  // Fix parameter syntax in my-requests section
  mySection = mySection
    .replace(/pr\.status = \$\{n\+\+\}/g, 'pr.status = $${n++}')
    .replace(/pr\.created_at >= \$\{n\+\+\}/g, 'pr.created_at >= $${n++}')
    .replace(/pr\.created_at <= \$\{n\+\+\}::date/g, 'pr.created_at <= $${n++}::date')
    .replace(/LIMIT \$\{n\+\+\} OFFSET \$\{n\+\+\}/g, 'LIMIT $${n++} OFFSET $${n++}');
  
  content = content.substring(0, myRequestsStart) + mySection + content.substring(industryRequestsStart);
}

// Fix parameter syntax in industry-requests section
const industryStart = content.indexOf('"purchases/industry-requests"');
const adminPurchasesStart = content.indexOf('"admin/purchases"');

if (industryStart !== -1 && adminPurchasesStart !== -1) {
  let industrySection = content.substring(industryStart, adminPurchasesStart);
  
  industrySection = industrySection
    .replace(/pr\.status = \$\{n\+\+\}/g, 'pr.status = $${n++}')
    .replace(/pr\.created_at >= \$\{n\+\+\}/g, 'pr.created_at >= $${n++}')
    .replace(/pr\.created_at <= \$\{n\+\+\}::date/g, 'pr.created_at <= $${n++}::date')
    .replace(/LIMIT \$\{n\+\+\} OFFSET \$\{n\+\+\}/g, 'LIMIT $${n++} OFFSET $${n++}');
  
  content = content.substring(0, industryStart) + industrySection + content.substring(adminPurchasesStart);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ purchases.js patched');

// Verify
try {
  delete require.cache[require.resolve('./src/routes/purchases')];
  require('./src/routes/purchases');
  console.log('✅ purchases.js loads without errors');
} catch(e) {
  console.error('❌ Still has errors:', e.message);
}
