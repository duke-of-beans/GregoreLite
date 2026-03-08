import { apiFetch } from '@/lib/api-client';
'use client';

/**
 * Onboarding Step 1 — Anthropic API Key
 * Sprint 8D: validates key against Anthropic API, stores in OS keychain.
 */

import { useState } from 'react';

interface Props {
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingStep1ApiKey({ onComplete, onSkip }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [error, setError] = useState('');

  async function handleValidateAndStore() {
    if (!apiKey.startsWith('sk-ant-')) {
      setError('Key should start with sk-ant-');
      return;
    }
    setStatus('validating');
    setError('');
    try {
      const valRes = await apiFetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate-api-key', apiKey }),
      });
      const valData = await valRes.json();
      if (!valData.data?.valid) {
        setStatus('invalid');
        setError('API key validation failed. Check the key and try again.');
        return;
      }
      // Key is valid — store in OS keychain
      await apiFetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'store-api-key', apiKey }),
      });
      setStatus('valid');
      setTimeout(onComplete, 800);
    } catch (err) {
      setStatus('invalid');
      setError(`Network error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Anthropic API Key</h2>
        <p className="text-sm text-gray-400">
          Enter your Anthropic API key to power Claude conversations. The key is stored
          securely in your OS keychain — never saved to disk in plaintext.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => { setApiKey(e.target.value); setStatus('idle'); setError(''); }}
          placeholder="sk-ant-..."
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white
                     placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
          autoFocus
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {status === 'valid' && <p className="text-green-400 text-sm">Key validated and stored securely.</p>}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onSkip} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          Skip for now
        </button>
        <button
          onClick={handleValidateAndStore}
          disabled={!apiKey || status === 'validating' || status === 'valid'}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500
                     text-white rounded-lg text-sm font-medium transition-colors"
        >
          {status === 'validating' ? 'Validating...' : status === 'valid' ? 'Stored ✓' : 'Validate & Store'}
        </button>
      </div>
    </div>
  );
}
