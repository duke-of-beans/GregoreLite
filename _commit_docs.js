const { execSync } = require('child_process');
const opts = { cwd: 'D:/Projects/GregLite', stdio: ['pipe','pipe','pipe'] };

function run(cmd) {
  try {
    const out = execSync(cmd, opts);
    process.stderr.write('OK: ' + cmd + '\n' + out.toString() + '\n');
  } catch(e) {
    process.stderr.write('ERR: ' + cmd + '\n' + e.stderr.toString() + '\n' + e.stdout.toString() + '\n');
    process.exit(1);
  }
}

run('git add STATUS.md PROJECT_DNA.yaml');
run('git status --short');
run('git commit -m "docs: Sprint 32.0 COMPLETE — Headless Browser Mode\n\nSTATUS.md + PROJECT_DNA.yaml updated.\n1667 tests across 87 files. tsc clean.\nCommits: a38bf15 (commit 1), 494efed (commit 2), f820ebd (fallback.ts)"');
run('git push');
run('git log --oneline -5');
