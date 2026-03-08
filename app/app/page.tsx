import { apiFetch } from '@/lib/api-client';
'use client';

/**
 * Home Page — GregLite Cockpit
 *
 * Sprint 2B: wraps strategic thread with left context panel.
 * Sprint 8D: gates on first_run_complete — shows onboarding wizard on first launch.
 * ContextPanel (20%) | ChatInterface (flex-1)
 */

import { useState, useEffect } from 'react';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { ContextPanel } from '@/components/context';
import { OnboardingFlow } from '@/components/onboarding';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function Home() {
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    checkFirstRun();
  }, []);

  // Sprint 20.0 — Wire Ghost shutdown on app close.
  // Works in both dev mode (Next.js browser) and Tauri WebView.
  // sendBeacon is fire-and-forget and works during the beforeunload event.
  useEffect(() => {
    const handleBeforeUnload = () => {
      navigator.sendBeacon('/api/ghost/stop', '{}');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  async function checkFirstRun() {
    try {
      const res = await apiFetch('/api/onboarding');
      const data = await res.json();
      setShowOnboarding(!data.data?.firstRunComplete);
    } catch {
      // If API fails, skip onboarding (don't block the app)
      setShowOnboarding(false);
    }
  }

  // Loading state — brief flash while checking first_run_complete
  if (showOnboarding === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--deep-space)]">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  // First-run onboarding wizard
  if (showOnboarding) {
    return <OnboardingFlow onComplete={() => setShowOnboarding(false)} />;
  }

  // Main application — ErrorBoundary wraps ChatInterface independently so a
  // chat crash doesn't kill the context panel or the whole app.
  return (
    <ErrorBoundary region="Application">
      <div className="flex h-screen w-full overflow-hidden bg-[var(--deep-space)]">
        <ContextPanel />
        <div className="flex flex-1 flex-col overflow-hidden">
          <ErrorBoundary region="Chat">
            <ChatInterface />
          </ErrorBoundary>
        </div>
      </div>
    </ErrorBoundary>
  );
}
