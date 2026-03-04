'use client';

/**
 * ContextPanel — Left intelligence cockpit panel.
 *
 * 20% width when expanded. 40px icon strip when collapsed.
 * Cmd+B toggles via KeyboardShortcuts handler.
 * Collapse preference persisted in localStorage.
 *
 * Sprint 2B: Context Panel + KERNL UI
 */

import { useEffect } from 'react';
import {
  ContextPanelContext,
  useContextPanel,
  useContextPanelProvider,
} from '@/lib/context/context-provider';
import { useState } from 'react';
import { ProjectSection } from './ProjectSection';
import { SessionSection } from './SessionSection';
import { DecisionList } from './DecisionList';
import { AEGISStatus } from './AEGISStatus';
import { SuggestionSlot } from './SuggestionSlot';
import { EoSIssueRow } from './EoSIssueRow';
import { scoreClass } from '@/lib/eos/score-class';
import { GhostCardList } from '@/components/ghost/GhostCardList';
import { EoSSparkLine } from './EoSSparkLine';
import { EoSHistoryPanel } from './EoSHistoryPanel';
import { RecentChats } from './RecentChats';

// ─── Collapsed icon strip ─────────────────────────────────────────────────────

function CollapsedStrip({ onExpand }: { onExpand: () => void }) {
  return (
    <aside
      className="flex h-full w-10 flex-shrink-0 flex-col items-center border-r border-[var(--shadow)] bg-[var(--elevated)] py-4 gap-4"
      aria-label="Context panel (collapsed)"
    >
      {/* Expand button — FIRST so it sits above indicator dots (Sprint 10.9 Task 6) */}
      <button
        onClick={onExpand}
        className="text-[var(--mist)] hover:text-[var(--ice-white)] transition-colors"
        aria-label="Expand context panel (Cmd+B)"
        title="Expand (Cmd+B)"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {/* Project dot */}
      <div
        className="h-2 w-2 rounded-full bg-[var(--cyan)]"
        title="Active project"
      />
      {/* Session icon */}
      <span title="Session">
      <svg
        className="h-4 w-4 text-[var(--mist)]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
        />
      </svg>
      </span>
      {/* KERNL dot */}
      <div
        className="h-2 w-2 rounded-full bg-[var(--success)]"
        title="KERNL indexed"
      />
    </aside>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

function PanelContent() {
  const { collapsed, toggleCollapsed, state } = useContextPanel();
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [historyOpen, setHistoryOpen] = useState(false);

  const handleDismissed = (ruleId: string, file: string) => {
    setDismissedKeys((prev) => new Set(prev).add(`${ruleId}:${file}`));
  };

  const visibleIssues = (state.eosSummary?.issues ?? [])
    .filter((i) => !dismissedKeys.has(`${i.ruleId}:${i.file}`))
    .slice(0, 5);

  // Cmd+B keyboard shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggleCollapsed();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggleCollapsed]);

  // Sprint 10.9 Task 11: StatusBar AEGIS/KERNL clicks expand the context panel
  useEffect(() => {
    function handleExpand() {
      if (collapsed) toggleCollapsed();
    }
    window.addEventListener('greglite:open-context-panel', handleExpand);
    return () => window.removeEventListener('greglite:open-context-panel', handleExpand);
  }, [collapsed, toggleCollapsed]);

  if (collapsed) {
    return <CollapsedStrip onExpand={toggleCollapsed} />;
  }

  return (
    <aside
      className="flex h-full w-[20%] min-w-[200px] max-w-[280px] flex-shrink-0 flex-col border-r border-[var(--shadow)] bg-[var(--elevated)] overflow-y-auto"
      aria-label="Context panel"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-[var(--shadow)] px-4 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--mist)]">
          Context
        </span>
        <button
          onClick={toggleCollapsed}
          className="text-[var(--mist)] hover:text-[var(--ice-white)] transition-colors"
          aria-label="Collapse context panel (Cmd+B)"
          title="Collapse (Cmd+B)"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Recent Chats */}
      <RecentChats
        onLoadThread={(id) => {
          // Will be wired via props from ChatInterface
          window.dispatchEvent(new CustomEvent('greglite:load-thread', { detail: { conversationId: id } }));
        }}
        onSeeAll={() => {
          // Trigger Cmd+[ equivalent
          window.dispatchEvent(new CustomEvent('greglite:open-history'));
        }}
      />

      {/* Sections */}
      <ProjectSection />
      <div className="mx-4 h-px bg-[var(--shadow)] opacity-30" />
      <SessionSection />
      <div className="mx-4 h-px bg-[var(--shadow)] opacity-30" />
      <DecisionList />
      <div className="mx-4 h-px bg-[var(--shadow)] opacity-30" />

      {/* Ghost suggestion cards — shown only when suggestions are active */}
      <GhostCardList />

      {/* Quality section — always present; content depends on scan state */}
      <>
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--mist)]">
              Quality
            </span>
            {state.eosSummary && state.activeProject && (
              <EoSSparkLine
                projectId={state.activeProject.id}
                currentScore={state.eosSummary.healthScore}
                onOpenHistory={() => setHistoryOpen(true)}
              />
            )}
            {state.eosSummary && !state.activeProject && (
              <span className={`text-[11px] font-medium tabular-nums ${scoreClass(state.eosSummary.healthScore)}`}>
                {state.eosSummary.healthScore}/100
              </span>
            )}
          </div>
        </div>
        {state.eosSummary ? (
          visibleIssues.length > 0 ? (
            <>
              {visibleIssues.map((issue) => (
                <EoSIssueRow
                  key={`${issue.ruleId}:${issue.file}:${issue.line ?? 0}`}
                  issue={issue}
                  projectId={state.activeProject?.id ?? ''}
                  onDismissed={handleDismissed}
                />
              ))}
              {(state.eosSummary.issues.length - dismissedKeys.size) > 5 && (
                <p className="px-4 pb-1 text-[10px] text-[var(--mist)]">
                  +{state.eosSummary.issues.length - dismissedKeys.size - 5} more issues
                </p>
              )}
            </>
          ) : (
            <p className="px-4 pb-2 text-[11px] text-[var(--success)]">✓ No issues detected</p>
          )
        ) : (
          <p className="px-4 pb-2 text-[11px] text-[var(--mist)] italic">No scan data yet</p>
        )}
        <div className="mx-4 h-px bg-[var(--shadow)] opacity-30" />
      </>

      {/* Status footer — KERNLStatus removed (shown in StatusBar only) Sprint 10.9 Task 4 */}
      <div className="mt-auto border-t border-[var(--shadow)] py-2">
        <AEGISStatus />
        <SuggestionSlot />
      </div>

      {/* EoS History Panel (S9-09) — drawer on right side */}
      {historyOpen && state.activeProject && (
        <EoSHistoryPanel
          projectId={state.activeProject.id}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </aside>
  );
}

// ─── Exported component (owns context provider) ───────────────────────────────

export function ContextPanel() {
  const ctx = useContextPanelProvider();

  return (
    <ContextPanelContext.Provider value={ctx}>
      <PanelContent />
    </ContextPanelContext.Provider>
  );
}
