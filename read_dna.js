const fs = require('fs');
const lines = fs.readFileSync('PROJECT_DNA.yaml', 'utf8').split('\n');
lines.slice(0, 75).forEach((l, i) => console.log(`${i+1}: ${l}`));
