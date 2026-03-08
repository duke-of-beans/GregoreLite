const fs = require('fs');
const lines = fs.readFileSync('STATUS.md', 'utf8').split('\n');
// Show lines 18-22 and search for Sprint 25/26/27 entries
lines.slice(17, 23).forEach((l, i) => console.log(`${18+i}: ${l}`));
console.log('---');
lines.forEach((l, i) => {
  if (l.includes('SPRINT 25') || l.includes('SPRINT 26') || l.includes('SPRINT 27')) {
    console.log(`line ${i+1}: ${l.slice(0,80)}`);
  }
});
