const fs = require('fs');
const path = require('path');
const base = 'D:/Projects/GregLite';

// Read STATUS.md first 20 lines
const status = fs.readFileSync(path.join(base, 'STATUS.md'), 'utf8').split('\n');
process.stderr.write('=== STATUS.md head ===\n');
status.slice(0, 20).forEach((l, i) => process.stderr.write(i + ': ' + JSON.stringify(l) + '\n'));

// Read PROJECT_DNA.yaml last 45 lines
const dna = fs.readFileSync(path.join(base, 'PROJECT_DNA.yaml'), 'utf8').split('\n');
process.stderr.write('\n=== PROJECT_DNA.yaml tail ===\n');
dna.slice(-45).forEach((l, i) => process.stderr.write((dna.length - 45 + i) + ': ' + JSON.stringify(l) + '\n'));
