const fs = require('fs');
const raw = fs.readFileSync('./test_json.txt', 'utf8');
// The JSON reporter may prefix with non-JSON output — find the first {
const start = raw.indexOf('{');
const j = JSON.parse(raw.slice(start));
console.log('passed:', j.numPassedTests);
console.log('failed:', j.numFailedTests);
console.log('total:', j.numTotalTests);
console.log('files:', j.numTotalTestSuites || j.testResults?.length);
if (j.numFailedTests > 0) {
  const failed = j.testResults?.filter(t => t.status === 'failed') || [];
  failed.forEach(f => console.log('FAIL:', f.testFilePath));
}
