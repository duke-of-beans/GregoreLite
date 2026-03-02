/**
 * Ghost Privacy Engine — Unit Tests
 * Sprint 6D
 *
 * Covers all four layers and the gate checklist from the execution brief.
 */

import { describe, it, expect } from 'vitest';
import { checkPathLayer1, checkContentLayer1 } from '../privacy/layer1';
import { checkChunkLayer2 } from '../privacy/layer2';
import { isValidLuhn, extractCardNumbers } from '../privacy/luhn';
import { checkFileLayer3, checkEmailLayer3 } from '../privacy/layer3';
import { NOT_EXCLUDED } from '../privacy/types';

// ─── Layer 1 — path checks ────────────────────────────────────────────────────

describe('Layer 1 — path exclusions', () => {
  it('excludes .env files', () => {
    const r = checkPathLayer1('/home/david/project/.env');
    expect(r.excluded).toBe(true);
    expect(r.layer).toBe(1);
  });

  it('excludes .pem files', () => {
    expect(checkPathLayer1('/certs/server.pem').excluded).toBe(true);
  });

  it('excludes .key files', () => {
    expect(checkPathLayer1('/keys/private.key').excluded).toBe(true);
  });

  it('excludes files in .ssh directory', () => {
    expect(checkPathLayer1('/home/david/.ssh/id_rsa').excluded).toBe(true);
  });

  it('excludes files in secrets directory', () => {
    expect(checkPathLayer1('/project/secrets/api.json').excluded).toBe(true);
  });

  it('excludes files with "password" in the name', () => {
    expect(checkPathLayer1('/config/database_password.json').excluded).toBe(true);
  });

  it('excludes files with "secret" in the name', () => {
    expect(checkPathLayer1('/config/app_secret.ts').excluded).toBe(true);
  });

  it('excludes files with "token" in the name', () => {
    expect(checkPathLayer1('/lib/auth_token.ts').excluded).toBe(true);
  });

  it('does NOT exclude a normal TypeScript file', () => {
    expect(checkPathLayer1('/project/src/components/Button.tsx').excluded).toBe(false);
  });

  it('does NOT exclude a README in the project root', () => {
    expect(checkPathLayer1('/project/README.md').excluded).toBe(false);
  });
});

describe('Layer 1 — content exclusions', () => {
  it('excludes content containing BEGIN PRIVATE KEY', () => {
    const content = `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg==\n-----END PRIVATE KEY-----`;
    expect(checkContentLayer1(content).excluded).toBe(true);
  });

  it('excludes content containing BEGIN RSA PRIVATE KEY', () => {
    const content = `-----BEGIN RSA PRIVATE KEY-----\ndata\n-----END RSA PRIVATE KEY-----`;
    expect(checkContentLayer1(content).excluded).toBe(true);
  });

  it('excludes content containing BEGIN OPENSSH PRIVATE KEY', () => {
    expect(checkContentLayer1('-----BEGIN OPENSSH PRIVATE KEY-----').excluded).toBe(true);
  });

  it('does NOT exclude normal source code', () => {
    const content = `export function greet(name: string) { return \`Hello \${name}\`; }`;
    expect(checkContentLayer1(content).excluded).toBe(false);
  });
});

// ─── Luhn algorithm ───────────────────────────────────────────────────────────

describe('Luhn algorithm', () => {
  it('validates a known-good Visa test number', () => {
    expect(isValidLuhn('4111111111111111')).toBe(true);
  });

  it('validates a known-good Mastercard test number', () => {
    expect(isValidLuhn('5500005555555559')).toBe(true);
  });

  it('rejects an invalid card number', () => {
    expect(isValidLuhn('4111111111111112')).toBe(false);
  });

  it('rejects all-same-digit sequences', () => {
    const cards = extractCardNumbers('4444444444444444');
    expect(cards).toHaveLength(0);
  });

  it('rejects sequential runs', () => {
    const cards = extractCardNumbers('1234567890123456');
    expect(cards).toHaveLength(0);
  });

  it('detects a valid card in text (with spaces)', () => {
    const cards = extractCardNumbers('card: 4111 1111 1111 1111 was used');
    expect(cards).toHaveLength(1);
  });
});

// ─── Layer 2 — PII scanner ────────────────────────────────────────────────────

describe('Layer 2 — PII scanner', () => {
  it('detects SSN pattern', () => {
    const r = checkChunkLayer2('SSN: 123-45-6789');
    expect(r.excluded).toBe(true);
    expect(r.layer).toBe(2);
  });

  it('does NOT flag version strings as SSN', () => {
    // "3-4-2024" — preceded/followed by letters (date context)
    const r = checkChunkLayer2('version 3-4-2024 released');
    expect(r.excluded).toBe(false);
  });

  it('detects valid credit card (Luhn pass)', () => {
    const r = checkChunkLayer2('Payment: 4111111111111111');
    expect(r.excluded).toBe(true);
    expect(r.layer).toBe(2);
  });

  it('does NOT flag invalid credit card (Luhn fail)', () => {
    const r = checkChunkLayer2('number: 4111111111111112');
    expect(r.excluded).toBe(false);
  });

  it('detects OpenAI/Anthropic sk- key', () => {
    const r = checkChunkLayer2('key = sk-abcdefghijklmnopqrstu');
    expect(r.excluded).toBe(true);
  });

  it('detects GitHub personal access token (ghp_)', () => {
    const r = checkChunkLayer2('token: ghp_' + 'a'.repeat(36));
    expect(r.excluded).toBe(true);
  });

  it('detects AWS access key (AKIA)', () => {
    const r = checkChunkLayer2('AKIAIOSFODNN7EXAMPLE');
    expect(r.excluded).toBe(true);
  });

  it('detects Slack xoxb token', () => {
    const r = checkChunkLayer2('token: xoxb-12345678901-abcdefghijk');
    expect(r.excluded).toBe(true);
  });

  it('does NOT flag normal code without secrets', () => {
    const r = checkChunkLayer2('export function add(a: number, b: number) { return a + b; }');
    expect(r.excluded).toBe(false);
  });
});

// ─── Layer 3 — contextual defaults ───────────────────────────────────────────

describe('Layer 3 — contextual defaults', () => {
  it('excludes files in medical directory', () => {
    expect(checkFileLayer3('/home/david/medical/records.pdf').excluded).toBe(true);
  });

  it('excludes files in legal directory', () => {
    expect(checkFileLayer3('/projects/legal/contract.docx').excluded).toBe(true);
  });

  it('does NOT exclude files in normal project dirs', () => {
    expect(checkFileLayer3('/projects/greglite/src/index.ts').excluded).toBe(false);
  });

  it('excludes email with attorney-client subject', () => {
    const r = checkEmailLayer3('RE: attorney-client privilege');
    expect(r.excluded).toBe(true);
    expect(r.layer).toBe(3);
  });

  it('excludes email with privileged subject', () => {
    expect(checkEmailLayer3('PRIVILEGED AND CONFIDENTIAL').excluded).toBe(true);
  });

  it('excludes email with confidential subject', () => {
    expect(checkEmailLayer3('Confidential: Q4 earnings').excluded).toBe(true);
  });

  it('does NOT exclude normal email subject', () => {
    expect(checkEmailLayer3('Sprint review notes').excluded).toBe(false);
  });
});

// ─── NOT_EXCLUDED constant ────────────────────────────────────────────────────

describe('NOT_EXCLUDED constant', () => {
  it('has excluded: false', () => {
    expect(NOT_EXCLUDED.excluded).toBe(false);
  });
});
