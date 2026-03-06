const { execSync } = require('child_process');
const pattern = process.argv[2];
try {
  const result = execSync(`findstr /s /i /n "${pattern}" *.ts *.tsx`, { 
    cwd: process.argv[3] || '.', 
    encoding: 'utf8',
    timeout: 15000
  });
  console.log(result.substring(0, 5000));
} catch(e) {
  console.log(e.stdout ? e.stdout.substring(0, 5000) : 'No matches');
}
