const fs = require('fs');
const t = fs.readFileSync('SPRINT_13_0_COMPLETE.md', 'utf8');
console.log(t.substring(0, 2000));
