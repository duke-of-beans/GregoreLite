const fs = require('fs');
const content = fs.readFileSync('lib/kernl/schema.sql', 'utf8');
console.log('File length:', content.length);
console.log('First 200 chars:', content.substring(0, 200));
const tables = content.match(/CREATE TABLE[^(]+/gi);
if (tables) {
  console.log('Tables found:', tables.length);
  tables.forEach(t => console.log('  ', t.trim()));
} else {
  console.log('No CREATE TABLE found');
}
