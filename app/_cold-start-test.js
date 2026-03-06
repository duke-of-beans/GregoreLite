/**
 * Sprint 14.0 — Cold Start Verification Script
 * 
 * Tests the API endpoints without a browser by hitting them directly.
 * Run with: node _cold-start-test.js
 * Requires: dev server running on localhost:3000
 */

const BASE = (process.env.BASE_URL || 'http://localhost:3000').trim();

async function test(label, fn) {
  try {
    const result = await fn();
    console.log(`  PASS  ${label}`);
    return result;
  } catch (err) {
    console.log(`  FAIL  ${label}: ${err.message}`);
    return null;
  }
}

async function fetchJson(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json, text: json ? null : text.substring(0, 200) };
}

async function run() {
  console.log('\n=== COLD START VERIFICATION ===\n');

  // Task 5: Onboarding endpoint
  console.log('--- Task 5: Onboarding ---');
  await test('GET /api/onboarding returns JSON', async () => {
    const r = await fetchJson('/api/onboarding');
    if (!r.json) throw new Error('Not JSON: ' + r.text);
    if (r.json.data === undefined) throw new Error('Missing data field');
    console.log('    firstRunComplete:', r.json.data.firstRunComplete);
    console.log('    kernlReady:', r.json.data.kernlReady);
    console.log('    apiKeyConfigured:', r.json.data.apiKeyConfigured);
  });

  // Task 5: Bootstrap endpoint
  await test('POST /api/bootstrap returns JSON', async () => {
    const r = await fetchJson('/api/bootstrap', { method: 'POST' });
    if (!r.json) throw new Error('Not JSON: ' + r.text);
    console.log('    success:', r.json.data?.success);
    console.log('    coldStartMs:', r.json.data?.coldStartMs);
  });

  // Task 5: Health check
  await test('GET /api/health returns JSON', async () => {
    const r = await fetchJson('/api/health');
    if (!r.json) throw new Error('Not JSON: ' + r.text);
  });

  // Task 7: Error recovery — invalid API key
  console.log('\n--- Task 7: Error Recovery ---');
  await test('POST /api/onboarding validate-api-key (invalid)', async () => {
    const r = await fetchJson('/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({ action: 'validate-api-key', apiKey: 'sk-ant-INVALID' }),
    });
    if (!r.json) throw new Error('Not JSON: ' + r.text);
    if (r.json.data?.valid !== false) throw new Error('Expected valid=false');
    console.log('    valid:', r.json.data.valid);
  });

  // Task 7: AEGIS offline
  await test('GET /api/aegis/health (AEGIS offline)', async () => {
    const r = await fetchJson('/api/aegis/health');
    if (!r.json) throw new Error('Not JSON: ' + r.text);
    console.log('    alive:', r.json.data?.alive);
  });

  // Task 10: API route error format — agent-sdk status
  console.log('\n--- Task 10: API Error Format ---');
  await test('GET /api/agent-sdk/status returns JSON', async () => {
    const r = await fetchJson('/api/agent-sdk/status');
    if (!r.json) throw new Error('Not JSON: ' + r.text);
    console.log('    apiKeyConfigured:', r.json.data?.apiKeyConfigured);
  });

  // Task 8: Feature smoke — threads list
  console.log('\n--- Task 8: Feature Smoke ---');
  await test('GET /api/threads returns JSON', async () => {
    const r = await fetchJson('/api/threads');
    if (!r.json) throw new Error('Not JSON: ' + r.text);
  });

  await test('GET /api/settings returns JSON', async () => {
    const r = await fetchJson('/api/settings');
    if (!r.json) throw new Error('Not JSON: ' + r.text);
  });

  await test('GET /api/costs/today returns JSON', async () => {
    const r = await fetchJson('/api/costs/today');
    if (!r.json) throw new Error('Not JSON: ' + r.text);
  });

  await test('GET /api/transit/events returns JSON', async () => {
    const r = await fetchJson('/api/transit/events');
    if (!r.json) throw new Error('Not JSON: ' + r.text);
  });

  await test('GET /api/context returns JSON', async () => {
    const r = await fetchJson('/api/context');
    if (!r.json) throw new Error('Not JSON: ' + r.text);
  });

  await test('GET /api/ghost/status returns JSON', async () => {
    const r = await fetchJson('/api/ghost/status');
    if (!r.json) throw new Error('Not JSON: ' + r.text);
  });

  console.log('\n=== DONE ===\n');
}

run().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
