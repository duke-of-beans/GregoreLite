var fs = require('fs');
var c = fs.readFileSync('D:/Projects/GregLite/app/components/transit/EventDetailPanel.tsx', 'utf8');
var lines = c.split('\n');
lines.forEach(function(l, i) {
  if (l.indexOf('slide-in') >= 0 || l.indexOf('AnimatePresence') >= 0 ||
      l.indexOf('framer-motion') >= 0 || l.indexOf('drawerSlide') >= 0 ||
      l.indexOf('fadeIn') >= 0) {
    console.log((i+1) + ': ' + l);
  }
});
// Also print lines 1-20 for import check
console.log('\n--- FIRST 20 LINES ---');
lines.slice(0,20).forEach(function(l,i){console.log((i+1)+': '+l);});
// Print last 60 lines for return block
console.log('\n--- LAST 60 LINES ---');
var start = Math.max(0, lines.length - 60);
lines.slice(start).forEach(function(l,i){console.log((start+i+1)+': '+l);});
