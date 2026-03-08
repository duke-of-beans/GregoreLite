var fs = require('fs');
var c = fs.readFileSync('D:/Projects/GregLite/STATUS.md', 'utf8');
var lines = c.split('\n');
var last = lines.slice(Math.max(0, lines.length - 40));
console.log(last.join('\n'));
console.log('\n--- TOTAL LINES:', lines.length, '---');
