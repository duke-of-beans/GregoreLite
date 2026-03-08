'use client';
import { apiFetch } from '@/lib/api-client';

/**
 * Onboarding Step 2 — Memory Setup
 * Sprint 8D: shows table counts, confirms memory database initialized.
 */

import { useState, useEffect } from 'react';

interface Props {
  onComplete: () => void;
}

export function OnboardingStep2Kernl({ onComplete }: Props) {
  const [tables, setTables] = useState<Record<string, number> | null>(null);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkKernl();
  }, []);

  async function checkKernl() {
    setChecking(true);
    try {
      const res = await apiFetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-kernl' }),
      });
      const data = await res.json();
      if (data.data?.ready) {
        setTables(data.data.tables);
        setReady(true);
      }
    } catch {
      // DB not ready
    }
    setChecking(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Memory Setup</h2>
        <p className="text-sm text-gray-400">
          GregLite remembers your conversations, decisions, and context across sessions.
          This database stores everything so you never lose track.
        </p>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 font-mono text-sm">
        {checking ? (
          <p className="text-gray-400">Checking database...</p>
        ) : ready && tables ? (
          <div className="flex flex-col gap-1">
            <p className="text-green-400 mb-2">Database initialized ✓</p>
            {Object.entries(tables).slice(0, 10).map(([name, count]) => (
              <div key={name} className="flex justify-between text-gray-300">
                <span>{name}</span>
                <span className="text-gray-500">{count} rows</span>
              </div>
            ))}
            {Object.keys(tables).length > 10 && (
              <p className="text-gray-500 mt-1">+{Object.keys(tables).length - 10} more tables</p>
            )}
          </div>
        ) : (
          <p className="text-yellow-400">Database not initialized — it will be created on first use.</p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onComplete}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
