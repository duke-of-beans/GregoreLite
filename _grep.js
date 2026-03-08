const fs = require('fs');
const c = fs.readFileSync('D:\\Projects\\GregLite\\app\\components\\chat\\Message.tsx','utf8');
const lines = c.split('\n');
lines.forEach((l, i) => {
  if (l.includes('GregLite') || l.includes('Greg') || (l.includes('assistant') && l.includes('name')))
    console.log((i+1) + ': ' + l.trim());
});
