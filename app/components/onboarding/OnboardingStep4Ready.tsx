import { apiFetch } from '@/lib/api-client';
'use client';

/**
 * Onboarding Step 4 — Ready to Launch
 * Sprint 8D: summary of setup status + launch button.
 */

import { useState, useEffect } from 'react';

interface Props {
  onComplete: () => void;
}

interface SetupStatus {
  apiKeyConfigured: boolean;
  kernlReady: boolean;
  aegisConnected: boolean;
}

export function OnboardingStep4Ready({ onComplete }: Props) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const res = await apiFetch('/api/onboarding');
      const data = await res.json();
      setStatus({
        apiKeyConfigured: data.data?.apiKeyConfigured ?? false,
        kernlReady: data.data?.kernlReady ?? false,
        aegisConnected: data.data?.aegisConnected ?? false,
      });
    } catch {
      setStatus({ apiKeyConfigured: false, kernlReady: false, aegisConnected: false });
    }
  }

  async function handleLaunch() {
    setLaunching(true);
    try {
      await apiFetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });
      onComplete();
    } catch {
      onComplete(); // proceed anyway — worst case they see onboarding again
    }
  }

  const items = status
    ? [
        { label: 'Anthropic API Key', ok: status.apiKeyConfigured },
        { label: 'Memory Database', ok: status.kernlReady },
        { label: 'System Monitor', ok: status.aegisConnected, optional: true },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Ready to Launch</h2>
        <p className="text-sm text-gray-400">
          Here's where things stand. Everything here can be changed later in Settings.
        </p>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 flex flex-col gap-3">
        {!status ? (
          <p className="text-gray-400 text-sm">Loading status...</p>
        ) : (
          items.map((item) => (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <span className="text-gray-300">{item.label}</span>
              <span className={item.ok ? 'text-green-400' : item.optional ? 'text-yellow-400' : 'text-yellow-400'}>
                {item.ok ? 'Connected ✓' : item.optional ? 'Skipped' : 'Not configured'}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleLaunch}
          disabled={launching}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500
                     text-white rounded-lg text-sm font-semibold transition-colors"
        >
          {launching ? 'Launching...' : 'Launch Gregore Lite'}
        </button>
      </div>
    </div>
  );
}
