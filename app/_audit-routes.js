const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) results = results.concat(walk(full));
      else if (e.name === 'route.ts') results.push(full);
    }
  } catch {}
  return results;
}

const routes = walk('app/api');
for (const r of routes) {
  const content = fs.readFileSync(r, 'utf8');
  const hasSafe = content.includes('safeHandler');
  const hasTryCatch = content.includes('try {') || content.includes('try{');
  const exports = content.match(/export\s+(const|async\s+function)\s+(\w+)/g) || [];
  console.log(`${hasSafe ? 'OK' : hasTryCatch ? 'TC' : 'NO'} ${r.replace(/\\/g,'/')}  [${exports.length} exports]`);
}
