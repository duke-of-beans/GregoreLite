var fs = require('fs');
var c = fs.readFileSync('D:/Projects/GregLite/app/app/globals.css', 'utf8');
var lines = c.split('\n');
var found = false;
lines.forEach(function(l, i) {
  if (l.indexOf('reduced-motion') >= 0 || l.indexOf('prefers-reduced') >= 0) {
    // print surrounding context
    var start = Math.max(0, i - 1);
    var end = Math.min(lines.length, i + 8);
    if (!found) { found = true; console.log('--- prefers-reduced-motion block ---'); }
    for (var j = start; j < end; j++) {
      console.log((j+1) + ': ' + lines[j]);
    }
    console.log('...');
  }
});
if (!found) console.log('NOT FOUND — prefers-reduced-motion missing from globals.css');
