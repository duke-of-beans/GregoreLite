var fs = require('fs');
var c = fs.readFileSync('D:/Projects/GregLite/STATUS.md', 'utf8');
var lines = c.split('\n');
// Print first 20 lines to find the header/last updated line
console.log(lines.slice(0, 20).join('\n'));
