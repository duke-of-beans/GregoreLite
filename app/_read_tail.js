const fs = require('fs');
const lines = fs.readFileSync('_test_output.txt', 'utf8').split('\n');
const last20 = lines.slice(-20);
console.log(last20.join('\n'));
