'use client';
import { apiFetch } from '@/lib/api-client';

/**
 * Onboarding Step 3 — System Monitor Connection
 * Sprint 8D: pings system monitor, graceful skip if not running.
 */

import { useState, useEffect } from 'react';

interface Props {
  onComplete: () => void;
}

export function OnboardingStep3Aegis({ onComplete }: Props) {
  const [status, setStatus] = useState<'checking' | 'connected' | 'unavailable'>('checking');

  useEffect(() => {
    checkAegis();
  }, []);

  async function checkAegis() {
    try {
      const res = await apiFetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-aegis' }),
      });
      const data = await res.json();
      setStatus(data.data?.connected ? 'connected' : 'unavailable');
    } catch {
      setStatus('unavailable');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">System Monitor</h2>
        <p className="text-sm text-gray-400">
          Optionally connect to resource monitoring for intelligent workload management.
          GregLite works fully without it — you can set this up later in Settings.
        </p>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4">
        {status === 'checking' && (
          <p className="text-gray-400 text-sm">Checking connection...</p>
        )}
        {status === 'connected' && (
          <p className="text-green-400 text-sm">System Monitor connected ✓</p>
        )}
        {status === 'unavailable' && (
          <div>
            <p className="text-yellow-400 text-sm mb-1">System Monitor not detected</p>
            <p className="text-gray-500 text-xs">No problem. You can connect later in Settings. Core functionality is unaffected.</p>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onComplete}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {status === 'unavailable' ? 'Skip & Continue' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
