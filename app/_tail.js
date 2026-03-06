const fs = require('fs');
const lines = fs.readFileSync('test-output.txt', 'utf8').split('\n');
console.log(lines.slice(-15).join('\n'));
