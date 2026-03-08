const fs = require('fs');
const lines = fs.readFileSync('STATUS.md', 'utf8').split('\n');
lines.slice(0, 35).forEach((l, i) => console.log(`${i+1}: ${l}`));
