/**
 * keychain.ts — OS Keychain wrapper for Ghost Thread email tokens
 * Sprint 6B
 *
 * Primary: keytar (Windows DPAPI / macOS Keychain / libsecret on Linux)
 * Fallback: KERNL settings table with AES-256-GCM encryption using a
 *   machine key derived from hostname + fixed salt.
 *
 * SECURITY NOTE: The KERNL vault fallback is less secure than the OS
 * keychain because the encrypted values reside on disk. It activates ONLY
 * when keytar is unavailable (e.g. native module not compiled). The
 * machine key is deterministic — anyone with filesystem access could
 * reconstruct it. Use OS keychain wherever possible.
 */

import * as crypto from 'crypto';
import * as os from 'os';
import { getSetting, setSetting, deleteSetting } from '@/lib/kernl/settings-store';

// ── Constants ──────────────────────────────────────────────────────────────────

export const KEYCHAIN_SERVICE = 'greglite-ghost';

const VAULT_SALT = 'greglite-ghost-vault-salt-v1';
const VAULT_KEY_LEN = 32; // AES-256
const VAULT_IV_LEN = 16;
// VAULT_TAG_LEN is implicit in GCM (always 16 bytes) — not needed as a constant

// ── Machine key derivation (KERNL vault fallback) ─────────────────────────────

function deriveMachineKey(): Buffer {
  const material = os.hostname() + VAULT_SALT;
  return crypto.scryptSync(material, VAULT_SALT, VAULT_KEY_LEN);
}

function encryptForVault(plaintext: string): string {
  const key = deriveMachineKey();
  const iv = crypto.randomBytes(VAULT_IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: hex(iv):hex(tag):hex(ciphertext)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptFromVault(encoded: string): string {
  const parts = encoded.split(':');
  if (parts.length !== 3) throw new Error('Invalid vault encoding');
  const [ivHex, tagHex, dataHex] = parts as [string, string, string];
  const key = deriveMachineKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data).toString('utf8') + decipher.final('utf8');
}

// ── keytar lazy loader ─────────────────────────────────────────────────────────

let _keytar: typeof import('keytar') | null = null;
let _keytarUnavailable = false;

async function getKeytar(): Promise<typeof import('keytar') | null> {
  if (_keytarUnavailable) return null;
  if (_keytar) return _keytar;
  try {
    // Dynamic import so the module can be mocked in tests
    const mod = await import('keytar');
    _keytar = mod.default ?? (mod as unknown as typeof import('keytar'));
    return _keytar;
  } catch {
    console.warn('[ghost/keychain] keytar unavailable — falling back to KERNL vault');
    _keytarUnavailable = true;
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Store a secret. Tries keytar first; falls back to encrypted KERNL vault.
 */
export async function setSecret(account: string, secret: string): Promise<void> {
  const kt = await getKeytar();
  if (kt) {
    try {
      await kt.setPassword(KEYCHAIN_SERVICE, account, secret);
      return;
    } catch (err) {
      console.warn('[ghost/keychain] keytar setPassword failed, using vault fallback:', err);
    }
  }
  // KERNL vault fallback
  const vaultKey = `keychain_vault_${account}`;
  setSetting(vaultKey, encryptForVault(secret));
}

/**
 * Retrieve a secret. Tries keytar first; falls back to KERNL vault.
 * Returns null if not found.
 */
export async function getSecret(account: string): Promise<string | null> {
  const kt = await getKeytar();
  if (kt) {
    try {
      const val = await kt.getPassword(KEYCHAIN_SERVICE, account);
      if (val !== null) return val;
    } catch (err) {
      console.warn('[ghost/keychain] keytar getPassword failed, checking vault:', err);
    }
  }
  const vaultKey = `keychain_vault_${account}`;
  const encoded = getSetting(vaultKey);
  if (!encoded) return null;
  try {
    return decryptFromVault(encoded);
  } catch {
    console.error('[ghost/keychain] vault decryption failed for', account);
    return null;
  }
}

/**
 * Delete a secret from both keytar and KERNL vault.
 */
export async function deleteSecret(account: string): Promise<void> {
  const kt = await getKeytar();
  if (kt) {
    try {
      await kt.deletePassword(KEYCHAIN_SERVICE, account);
    } catch {
      // ignore — may not exist
    }
  }
  const vaultKey = `keychain_vault_${account}`;
  deleteSetting(vaultKey);
}

// ── Named token keys ───────────────────────────────────────────────────────────

export const TOKEN_KEYS = {
  gmailAccess:    'greglite-ghost-gmail-access',
  gmailRefresh:   'greglite-ghost-gmail-refresh',
  outlookAccess:  'greglite-ghost-outlook-access',
  outlookRefresh: 'greglite-ghost-outlook-refresh',
  gmailExpiry:    'greglite-ghost-gmail-expiry',
  outlookExpiry:  'greglite-ghost-outlook-expiry',
} as const;
