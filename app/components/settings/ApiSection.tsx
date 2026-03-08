import { apiFetch } from '@/lib/api-client';
/**
 * ApiSection — S9-13
 * Shows API key status — configured or not.
 */

'use client';

import { useState, useEffect } from 'react';

export function ApiSection() {
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if API key is configured by testing if we can reach our own API
    void (async () => {
      try {
        const res = await apiFetch('/api/agent-sdk/status');
        if (res.ok) {
          const body = await res.json() as { data?: { apiKeyConfigured?: boolean } };
          setConfigured(body.data?.apiKeyConfigured ?? false);
        } else {
          setConfigured(false);
        }
      } catch {
        setConfigured(false);
      }
    })();
  }, []);

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ice-white)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        API
      </h3>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: 'var(--frost)' }}>Anthropic API Key</span>
        {configured === null ? (
          <span style={{ fontSize: 12, color: 'var(--frost)' }}>Checking…</span>
        ) : configured ? (
          <span style={{ fontSize: 12, color: 'var(--success)' }}>✓ Configured</span>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--warning)' }}>✗ Not configured</span>
        )}
      </div>
    </div>
  );
}