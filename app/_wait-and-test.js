// Wait for server to be ready, then run cold start tests
const BASE = 'http://localhost:3000';

async function waitForServer(maxWaitMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}

async function main() {
  console.log('Waiting for dev server...');
  const ready = await waitForServer();
  if (!ready) {
    console.log('Server not ready after 15s — check _dev-server.log');
    process.exit(1);
  }
  console.log('Server ready!');
  
  // Now run the tests
  require('./_cold-start-test.js');
}

main();
