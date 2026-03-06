const fs = require('fs');
const file = process.argv[2];
const pattern = process.argv[3];
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(pattern)) {
    console.log(`${i+1}: ${lines[i].trim()}`);
  }
}
