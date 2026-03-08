const fs = require('fs');
const base = 'D:/Projects/GregLite';
const dna = fs.readFileSync(base + '/PROJECT_DNA.yaml', 'utf8').split('\n');
process.stderr.write('=== PROJECT_DNA.yaml head (0-65) ===\n');
dna.slice(0, 65).forEach((l, i) => process.stderr.write(i + ': ' + JSON.stringify(l) + '\n'));
