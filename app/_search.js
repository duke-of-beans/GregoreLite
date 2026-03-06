const fs = require('fs');
const path = require('path');
const patterns = process.argv.slice(2);

function walk(dir) {
  let results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '.next') {
        results = results.concat(walk(full));
      } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx'))) {
        results.push(full);
      }
    }
  } catch {}
  return results;
}

const files = walk('.');
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const p of patterns) {
      if (lines[i].includes(p)) {
        console.log(`${f}:${i+1}: ${lines[i].trim()}`);
      }
    }
  }
}
