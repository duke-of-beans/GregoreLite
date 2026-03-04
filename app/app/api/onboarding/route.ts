/**
 * Onboarding API — Sprint 8D
 *
 * GET  /api/onboarding → { firstRunComplete, apiKeyConfigured, aegisConnected, kernlReady }
 * POST /api/onboarding → actions: validate-api-key, store-api-key, check-kernl, check-aegis, complete
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/kernl/settings-store';
import { storeAnthropicKey } from '@/lib/security/keychain-store';
import { getDatabase } from '@/lib/kernl/database';

export async function GET() {
  try {
    const firstRunComplete = getSetting('first_run_complete') === 'true';
    const apiKeyConfigured = getSetting('anthropic_api_key_configured') === 'true';
    const aegisConnected = getSetting('aegis_connected') === 'true';

    // Check KERNL DB tables exist
    let kernlReady = false;
    try {
      const db = getDatabase();
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as { name: string }[];
      kernlReady = tables.length >= 3;
    } catch {
      kernlReady = false;
    }

    return NextResponse.json({
      data: { firstRunComplete, apiKeyConfigured, aegisConnected, kernlReady },
    });
  } catch (err) {
    console.error('[onboarding] GET failed:', err);
    return NextResponse.json({ data: { firstRunComplete: false, apiKeyConfigured: false, aegisConnected: false, kernlReady: false } });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { action: string; apiKey?: string };

    switch (body.action) {
      case 'validate-api-key': {
        if (!body.apiKey) {
          return NextResponse.json({ error: 'API key required' }, { status: 400 });
        }
        // Test the key against Anthropic's models endpoint
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': body.apiKey,
            'anthropic-version': '2023-06-01',
          },
        });
        if (res.ok) {
          return NextResponse.json({ data: { valid: true } });
        }
        return NextResponse.json({ data: { valid: false, status: res.status } });
      }

      case 'store-api-key': {
        if (!body.apiKey) {
          return NextResponse.json({ error: 'API key required' }, { status: 400 });
        }
        await storeAnthropicKey(body.apiKey);
        setSetting('anthropic_api_key_configured', 'true');
        return NextResponse.json({ data: { stored: true } });
      }

      case 'check-kernl': {
        try {
          const db = getDatabase();
          const tables = db
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .all() as { name: string }[];
          const tableCounts: Record<string, number> = {};
          for (const t of tables) {
            const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get() as { c: number };
            tableCounts[t.name] = count.c;
          }
          return NextResponse.json({ data: { ready: true, tables: tableCounts } });
        } catch (err) {
          return NextResponse.json({ data: { ready: false, error: String(err) } });
        }
      }

      case 'check-aegis': {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const res = await fetch('http://localhost:3033/health', {
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (res.ok) {
            setSetting('aegis_connected', 'true');
            return NextResponse.json({ data: { connected: true } });
          }
          return NextResponse.json({ data: { connected: false } });
        } catch {
          return NextResponse.json({ data: { connected: false } });
        }
      }

      case 'complete': {
        setSetting('first_run_complete', 'true');
        return NextResponse.json({ data: { complete: true } });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
    }
  } catch (err) {
    console.error('[onboarding] POST failed:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
