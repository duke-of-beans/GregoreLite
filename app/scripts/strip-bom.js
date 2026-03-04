const fs = require('fs');
const path = require('path');

const files = [
  'lib/agent-sdk/shim-tool.ts',
  'lib/eos/character.ts',
  'lib/eos/debt.ts',
  'lib/eos/engine.ts',
  'lib/eos/fp-tracker.ts',
  'lib/eos/health-score.ts',
  'lib/eos/index.ts',
  'lib/eos/patterns.ts',
  'lib/eos/types.ts',
  'lib/shim/job-context.ts',
  'lib/shim/pattern-learner.ts',
];

let count = 0;
for (const f of files) {
  const buf = fs.readFileSync(f);
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    fs.writeFileSync(f, buf.slice(3));
    count++;
    console.log('Stripped BOM:', f);
  } else {
    console.log('No BOM:', f);
  }
}
console.log(count + ' files fixed');
