const fs = require('fs');
const c = fs.readFileSync('D:\\Projects\\GregLite\\app\\app\\globals.css','utf8');
const lines = c.split('\n');
lines.forEach((l, i) => {
  if (l.includes('@media') || l.includes('min-width') || l.includes('max-width') || l.includes('responsive'))
    console.log((i+1) + ': ' + l.trim());
});
