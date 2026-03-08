const fs = require('fs');
const lines = fs.readFileSync('D:/Projects/GregLite/STATUS.md', 'utf8').split('\n');
// Find lines mentioning Sprint 29 or Sprint 30 or Sprint 31 or Sprint 32
lines.forEach((l, i) => {
  if (/Sprint (29|30|31|32)/.test(l)) {
    process.stderr.write(i + ': ' + JSON.stringify(l) + '\n');
  }
});
