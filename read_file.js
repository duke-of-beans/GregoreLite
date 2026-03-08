var fs = require('fs');
var path = process.argv[2];
var start = parseInt(process.argv[3] || '0');
var count = parseInt(process.argv[4] || '9999');
var c = fs.readFileSync(path, 'utf8');
var lines = c.split('\n');
lines.slice(start, start + count).forEach(function(l, i) {
  console.log((start + i + 1) + ': ' + l);
});
