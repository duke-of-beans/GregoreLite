const fs = require('fs');
const lines = fs.readFileSync('STATUS.md', 'utf8').split('\n');
// Find the first - [x] SPRINT entry
const idx = lines.findIndex(l => l.includes('- [x] **SPRINT') || l.includes('- [ ] **SPRINT'));
console.log('First sprint entry at line:', idx + 1);
lines.slice(Math.max(0, idx - 2), idx + 6).forEach((l, i) => console.log(`${idx - 1 + i}: ${l}`));
