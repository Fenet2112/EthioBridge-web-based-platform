const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/routes/products.js');
let content = fs.readFileSync(filePath, 'utf8');

// Add business_role to destructured query params
content = content.replace(
  "      industry_id,\n      search,",
  "      industry_id,\n      business_role,\n      search,"
);

// Add business_role filter after industry_id filter
content = content.replace(
  "    if (industry_id) {\n      query += ` AND i.id = $${paramCount++}`;\n      queryParams.push(parseInt(industry_id));\n    }",
  "    if (business_role) {\n      query += ` AND LOWER(i.business_role) = LOWER($${paramCount++})`;\n      queryParams.push(business_role);\n    }\n\n    if (industry_id) {\n      query += ` AND i.id = $${paramCount++}`;\n      queryParams.push(parseInt(industry_id));\n    }"
);

// Also add business_role to the SELECT so frontend can use it
content = content.replace(
  "        i.company_name, i.id as industry_id, i.location as industry_location,\n        i.sector as industry_sector",
  "        i.company_name, i.id as industry_id, i.location as industry_location,\n        i.sector as industry_sector, i.business_role"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Added business_role filter to products/all route');

try {
  delete require.cache[require.resolve('./src/routes/products')];
  require('./src/routes/products');
  console.log('✅ products.js loads OK');
} catch(e) {
  console.error('❌ Error:', e.message);
}
