var fs = require('fs');
var c = fs.readFileSync('D:/Projects/GregLite/test_out.txt', 'utf8');
var lines = c.split('\n');
// Print last 25 lines
var last = lines.slice(Math.max(0, lines.length - 25));
console.log(last.join('\n'));
