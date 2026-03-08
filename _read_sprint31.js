const fs = require('fs');
const lines = fs.readFileSync('D:/Projects/GregLite/STATUS.md', 'utf8').split('\n');
// Read Sprint 31 section (lines 1030-1083)
lines.slice(1030).forEach((l, i) => {
  process.stderr.write((1030 + i) + ': ' + JSON.stringify(l) + '\n');
});
