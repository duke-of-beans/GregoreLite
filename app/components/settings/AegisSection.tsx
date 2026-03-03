/**
 * AegisSection — S9-13
 * AEGIS port display + test connection button.
 */

'use client';

import { useState } from 'react';

export function AegisSection() {
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'fail'>('idle');

  async function handleTestConnection() {
    setTesting(true);
    setStatus('idle');
    try {
      const res = await fetch('/api/aegis/health');
      if (res.ok) {
        const body = await res.json() as { data?: { alive: boolean } };
        setStatus(body.data?.alive ? 'ok' : 'fail');
      } else {
        setStatus('fail');
      }
    } catch {
      setStatus('fail');
    }
    setTesting(false);
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ice-white)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        AEGIS
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--frost)' }}>Port</span>
          <span style={{ fontSize: 13, color: 'var(--ice-white)', fontFamily: 'monospace', padding: '4px 10px', background: 'var(--surface)', borderRadius: 4 }}>
            8743
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--frost)' }}>Connection</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {status === 'ok' && <span style={{ fontSize: 12, color: 'var(--success)' }}>● Connected</span>}
            {status === 'fail' && <span style={{ fontSize: 12, color: 'var(--error)' }}>● Offline</span>}
            <button
              onClick={() => void handleTestConnection()}
              disabled={testing}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--shadow)',
                background: 'var(--elevated)',
                color: testing ? 'var(--frost)' : 'var(--cyan)',
                cursor: testing ? 'wait' : 'pointer',
                fontSize: 12,
                transition: 'all 0.15s ease',
              }}
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}