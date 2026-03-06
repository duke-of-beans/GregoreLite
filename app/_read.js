const fs = require('fs');
const file = process.argv[2];
console.log(fs.readFileSync(file, 'utf8'));
