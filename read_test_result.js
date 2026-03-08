var fs = require('fs');
var raw = fs.readFileSync('/sessions/quirky-dreamy-euler/mnt/.claude/projects/-sessions-quirky-dreamy-euler/8a6716b2-3af5-411e-8d14-d703576747fa/tool-results/mcp-Desktop_Commander-start_process-1772786225046.txt', 'utf8');
var d = JSON.parse(raw);
var t = d.map(function(x) { return x.text; }).join('');
var lines = t.split('\n');
var last = lines.slice(-30);
console.log(last.join('\n'));
