var fs = require('fs');
var c = fs.readFileSync('D:/Projects/GregLite/app/components/transit/EventDetailPanel.tsx', 'utf8');
var lines = c.split('\n');
// Print lines 14-25 and 155-195
console.log('--- IMPORTS (lines 14-25) ---');
lines.slice(13,25).forEach(function(l,i){console.log((14+i)+': '+l);});
console.log('\n--- RETURN BLOCK (lines 155-195) ---');
lines.slice(154,195).forEach(function(l,i){console.log((155+i)+': '+l);});
