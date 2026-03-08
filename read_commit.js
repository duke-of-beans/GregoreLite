const fs = require('fs');
const lines = fs.readFileSync('commit26_stat.txt', 'utf8').split('\n');
lines.slice(0, 30).forEach((l, i) => console.log(`${i+1}: ${l}`));
