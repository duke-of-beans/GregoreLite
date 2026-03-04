/**
 * keychain-store.ts — OS Keychain PAT Storage — Sprint 8A
 *
 * Wraps the `keytar` native module to store the GitHub PAT in the OS keychain
 * (Windows Credential Manager / macOS Keychain / libsecret on Linux).
 *
 * keytar 7.9.0 requires native rebuild for Node 22+ (prebuild binaries only
 * cover up to Node 20). Rebuild via: npx node-gyp rebuild in keytar's dir.
 *
 * Service/account naming follows the convention: service = app identifier,
 * account = secret type. This avoids collisions with other apps.
 *
 * SECURITY: PAT never touches SQLite. Only a "configured: true" flag is stored
 * in KERNL settings to indicate the keychain has a valid entry.
 */

import keytar from 'keytar';

const SERVICE_NAME = 'ai.greglite.app';
const ACCOUNT_GITHUB_PAT = 'github_pat';

/**
 * Store a GitHub PAT in the OS keychain.
 * Overwrites any existing entry for the same service/account pair.
 */
export async function storePAT(token: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_GITHUB_PAT, token);
}

/**
 * Retrieve the GitHub PAT from the OS keychain.
 * Returns null if no entry exists (PAT not configured).
 */
export async function getPAT(): Promise<string | null> {
  return keytar.getPassword(SERVICE_NAME, ACCOUNT_GITHUB_PAT);
}

/**
 * Delete the GitHub PAT from the OS keychain.
 * Returns true if an entry was deleted, false if none existed.
 */
export async function deletePAT(): Promise<boolean> {
  return keytar.deletePassword(SERVICE_NAME, ACCOUNT_GITHUB_PAT);
}
