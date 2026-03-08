import { apiFetch } from '@/lib/api-client';
'use client';

/**
 * SourceAdditionFlow — Sprint 28.0 Ceremonial Onboarding
 *
 * The per-source mini-ceremony. Five steps per source:
 *   1. Source selection card
 *   2. Configuration (path or OAuth)
 *   3. Indexing progress — animated counter + live preview snippets
 *   4. Per-source synthesis — Greg's analysis, typewriter-style
 *   5. Combination synthesis — what combining with previous sources unlocks
 *
 * After step 5: "Add Another Source" or "Done for now" (with skipped-source notice).
 * Ghost Thread NEVER blocks the UI. All synthesis runs async via polling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SYNTHESIS } from '@/lib/voice/copy-templates';
import {
  getTypewriterDelay,
  getTypewriterSlice,
  isTypewriterComplete,
  getCounterValue,
  COUNTER_DURATION_MS,
  staggerContainer,
  staggerChild,
  capabilityCard,
  sourceCardSpring,
  snippetFade,
  prefersReducedMotion,
} from '@/lib/design/synthesis-animations';
import type { IndexingSource, IndexingSourceType, SynthesisResult } from '@/lib/synthesis/types';

// ── Source metadata ───────────────────────────────────────────────────────────

interface SourceMeta {
  type: IndexingSourceType;
  title: string;
  desc: string;
  icon: string;
  requiresPath: boolean;
}

const SOURCE_OPTIONS: SourceMeta[] = [
  { type: 'local_files',   title: SYNTHESIS.source_local_files_title,   desc: SYNTHESIS.source_local_files_desc,   icon: '📁', requiresPath: true  },
  { type: 'projects',      title: SYNTHESIS.source_projects_title,      desc: SYNTHESIS.source_projects_desc,      icon: '🗂️', requiresPath: false },
  { type: 'email',         title: SYNTHESIS.source_email_title,         desc: SYNTHESIS.source_email_desc,         icon: '✉️', requiresPath: false },
  { type: 'conversations', title: SYNTHESIS.source_conversations_title, desc: SYNTHESIS.source_conversations_desc, icon: '💬', requiresPath: false },
  { type: 'calendar',      title: SYNTHESIS.source_calendar_title,      desc: SYNTHESIS.source_calendar_desc,      icon: '📅', requiresPath: false },
  { type: 'notes',         title: SYNTHESIS.source_notes_title,         desc: SYNTHESIS.source_notes_desc,         icon: '📝', requiresPath: true  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type FlowStep =
  | 'select'
  | 'configure'
  | 'indexing'
  | 'synthesis'
  | 'combination'
  | 'complete';

interface Props {
  completedSources: IndexingSource[];
  onSourceAdded: (source: IndexingSource) => void;
  onDone: () => void;
}

// ── Typewriter sub-component ──────────────────────────────────────────────────

function Typewriter({ text, mode }: { text: string; mode: 'source' | 'master' }) {
  const [charIndex, setCharIndex] = useState(prefersReducedMotion() ? text.length : 0);

  useEffect(() => {
    setCharIndex(prefersReducedMotion() ? text.length : 0);
  }, [text]);

  useEffect(() => {
    if (isTypewriterComplete(text, charIndex)) return;
    const delay = getTypewriterDelay(mode);
    const t = setTimeout(() => setCharIndex((i) => i + 1), delay);
    return () => clearTimeout(t);
  }, [charIndex, text, mode]);

  return <span>{getTypewriterSlice(text, charIndex)}</span>;
}

// ── Indexing progress sub-component ──────────────────────────────────────────

function IndexingProgress({
  source,
  onComplete,
}: {
  source: IndexingSource;
  onComplete: (updated: IndexingSource) => void;
}) {
  const [displayCount, setDisplayCount] = useState(0);
  const [snippet, setSnippet] = useState<string | null>(null);
  const counterStart = useRef(Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate counter smoothly toward indexed_count
  useEffect(() => {
    const frame = () => {
      const elapsed = Date.now() - counterStart.current;
      const animated = getCounterValue(0, source.indexed_count, elapsed, COUNTER_DURATION_MS);
      setDisplayCount(animated);
    };
    const raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [source.indexed_count]);

  // Poll for source completion
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiFetch('/api/synthesis/status');
        if (!res.ok) return;
        const data = (await res.json()) as { sources: IndexingSource[] };
        const updated = data.sources.find((s) => s.id === source.id);
        if (updated && (updated.status === 'complete' || updated.status === 'error')) {
          clearInterval(pollRef.current!);
          onComplete(updated);
        }
      } catch {
        // swallow — polling is best-effort
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [source.id, onComplete]);

  // Cycle through preview snippets every few seconds
  useEffect(() => {
    const previews = [
      SYNTHESIS.indexing_scanning(source.indexed_count),
      source.indexed_count > 100
        ? SYNTHESIS.category_files(source.indexed_count)
        : null,
    ].filter(Boolean) as string[];

    let idx = 0;
    const t = setInterval(() => {
      idx = (idx + 1) % previews.length;
      setSnippet(previews[idx] ?? null);
    }, 3000);
    return () => clearInterval(t);
  }, [source.indexed_count]);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-[var(--text-muted)]">
        {SYNTHESIS.indexing_heading(source.label)}
      </p>

      {/* Animated counter */}
      <div className="text-4xl font-mono font-bold text-[var(--cyan)]">
        {displayCount.toLocaleString()}
      </div>
      <p className="text-xs text-[var(--text-muted)] -mt-4">
        {SYNTHESIS.indexing_scanning(source.indexed_count)}
      </p>

      {/* Preview snippet */}
      <AnimatePresence mode="wait">
        {snippet && (
          <motion.p
            key={snippet}
            variants={snippetFade}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="text-xs text-[var(--text-secondary)] font-mono"
          >
            {SYNTHESIS.indexing_preview(snippet)}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Indeterminate progress bar */}
      <div className="h-0.5 w-full bg-[var(--border)] overflow-hidden rounded-full">
        <motion.div
          className="h-full bg-[var(--cyan)]"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SourceAdditionFlow({ completedSources, onSourceAdded, onDone }: Props) {
  const [step, setStep] = useState<FlowStep>('select');
  const [selectedMeta, setSelectedMeta] = useState<SourceMeta | null>(null);
  const [pathInput, setPathInput] = useState('');
  const [activeSource, setActiveSource] = useState<IndexingSource | null>(null);
  const [synthesisResult, setSynthesisResult] = useState<Partial<SynthesisResult> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const alreadyIndexedTypes = new Set(completedSources.map((s) => s.type));

  // ── Step 1: Source selection ──────────────────────────────────────────────

  const handleSelectSource = (meta: SourceMeta) => {
    setSelectedMeta(meta);
    setStep(meta.requiresPath ? 'configure' : 'indexing');
    if (!meta.requiresPath) void handleStartIndexing(meta, null);
  };

  // ── Step 2: Configure + start indexing ───────────────────────────────────

  const handleStartIndexing = useCallback(
    async (meta: SourceMeta, path: string | null) => {
      setIsSubmitting(true);
      try {
        const res = await apiFetch('/api/synthesis/add-source', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: meta.type, pathOrConfig: path }),
        });
        if (!res.ok) throw new Error('Failed to register source');
        const data = (await res.json()) as { source: IndexingSource };
        setActiveSource(data.source);
        setStep('indexing');
      } catch (err) {
        console.error('[SourceAdditionFlow] Start indexing error:', err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  // ── Step 3→4: Indexing complete → wait for synthesis ─────────────────────

  const handleIndexingComplete = useCallback(
    (updatedSource: IndexingSource) => {
      setActiveSource(updatedSource);
      onSourceAdded(updatedSource);
      setStep('synthesis');

      // Poll for synthesis text (generator runs async, won't be instant)
      const poll = setInterval(async () => {
        try {
          const res = await apiFetch('/api/synthesis/status');
          if (!res.ok) return;
          const data = (await res.json()) as { sources: IndexingSource[] };
          const src = data.sources.find((s) => s.id === updatedSource.id);
          if (src?.synthesis_text) {
            clearInterval(poll);
            setSynthesisResult({
              sourceId: src.id,
              sourceSynthesis: src.synthesis_text,
              combinationSynthesis: src.combination_text ?? null,
              capabilitiesUnlocked: [],
            });
          }
        } catch {
          // swallow
        }
      }, 2500);
    },
    [onSourceAdded],
  );

  // ── Step 4→5: Show combination synthesis if it exists ────────────────────

  const handleSynthesisContinue = () => {
    if (synthesisResult?.combinationSynthesis && completedSources.length > 0) {
      setStep('combination');
    } else {
      setStep('complete');
    }
  };

  // ── Reset for next source ─────────────────────────────────────────────────

  const handleAddAnother = () => {
    setStep('select');
    setSelectedMeta(null);
    setPathInput('');
    setActiveSource(null);
    setSynthesisResult(null);
  };

  // ── Skipped source notice ─────────────────────────────────────────────────

  const skippedNotices = SOURCE_OPTIONS.filter(
    (s) => !alreadyIndexedTypes.has(s.type) && s.type !== selectedMeta?.type,
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-8 max-w-xl mx-auto py-8 px-4">

      <AnimatePresence mode="wait">

        {/* ── Step 1: Source selection ─────────────────────────────────── */}
        {step === 'select' && (
          <motion.div
            key="select"
            variants={sourceCardSpring}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-col gap-4"
          >
            <h2 className="text-base font-medium text-[var(--text-primary)]">
              {completedSources.length === 0
                ? SYNTHESIS.onboarding_first_source
                : SYNTHESIS.add_another_source}
            </h2>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 gap-3"
            >
              {SOURCE_OPTIONS.filter((s) => !alreadyIndexedTypes.has(s.type)).map((meta) => (
                <motion.button
                  key={meta.type}
                  variants={staggerChild}
                  onClick={() => handleSelectSource(meta)}
                  className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-left hover:border-[var(--cyan)] hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <span className="text-xl leading-none mt-0.5" role="img" aria-hidden>
                    {meta.icon}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{meta.title}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{meta.desc}</p>
                  </div>
                </motion.button>
              ))}
            </motion.div>

            {completedSources.length > 0 && (
              <button
                onClick={onDone}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] underline-offset-2 hover:underline mt-2 text-left"
              >
                {SYNTHESIS.done_for_now}
              </button>
            )}
          </motion.div>
        )}

        {/* ── Step 2: Configure ────────────────────────────────────────── */}
        {step === 'configure' && selectedMeta && (
          <motion.div
            key="configure"
            variants={sourceCardSpring}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-col gap-4"
          >
            <h2 className="text-base font-medium text-[var(--text-primary)]">
              {selectedMeta.title}
            </h2>
            <p className="text-sm text-[var(--text-muted)]">{selectedMeta.desc}</p>

            <input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder={`Path to ${selectedMeta.title.toLowerCase()}…`}
              className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--cyan)] focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && pathInput.trim()) {
                  void handleStartIndexing(selectedMeta, pathInput.trim());
                }
              }}
            />

            <div className="flex gap-3">
              <button
                onClick={() => void handleStartIndexing(selectedMeta, pathInput.trim())}
                disabled={!pathInput.trim() || isSubmitting}
                className="rounded bg-[var(--cyan)] px-4 py-2 text-xs font-medium text-[var(--deep-space)] disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {isSubmitting ? 'Starting…' : SYNTHESIS.add_source_button}
              </button>
              <button
                onClick={() => setStep('select')}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                {SYNTHESIS.back}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 3: Indexing ─────────────────────────────────────────── */}
        {step === 'indexing' && activeSource && (
          <motion.div
            key="indexing"
            variants={sourceCardSpring}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <IndexingProgress
              source={activeSource}
              onComplete={handleIndexingComplete}
            />
          </motion.div>
        )}

        {/* ── Step 4: Per-source synthesis ─────────────────────────────── */}
        {step === 'synthesis' && (
          <motion.div
            key="synthesis"
            variants={sourceCardSpring}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-col gap-6"
          >
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--cyan)]">
              {SYNTHESIS.synthesis_heading}
            </p>

            <p className="text-sm text-[var(--text-primary)] leading-relaxed min-h-[4rem]">
              {synthesisResult?.sourceSynthesis ? (
                <Typewriter text={synthesisResult.sourceSynthesis} mode="source" />
              ) : (
                <span className="text-[var(--text-muted)]">{SYNTHESIS.master_generating}</span>
              )}
            </p>

            {synthesisResult?.sourceSynthesis && (
              <button
                onClick={handleSynthesisContinue}
                className="self-start rounded bg-[var(--cyan)] px-4 py-2 text-xs font-medium text-[var(--deep-space)] hover:opacity-90 transition-opacity"
              >
                Continue
              </button>
            )}
          </motion.div>
        )}

        {/* ── Step 5: Combination synthesis ────────────────────────────── */}
        {step === 'combination' && synthesisResult?.combinationSynthesis && (
          <motion.div
            key="combination"
            variants={sourceCardSpring}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-col gap-6"
          >
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--cyan)]">
              {SYNTHESIS.combination_intro}
            </p>

            <p className="text-sm text-[var(--text-primary)] leading-relaxed">
              <Typewriter text={synthesisResult.combinationSynthesis} mode="source" />
            </p>

            {synthesisResult.capabilitiesUnlocked && synthesisResult.capabilitiesUnlocked.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest">
                  {SYNTHESIS.capabilities_heading}
                </p>
                <motion.ul
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="flex flex-col gap-2"
                >
                  {synthesisResult.capabilitiesUnlocked.map((cap, i) => (
                    <motion.li
                      key={i}
                      variants={capabilityCard}
                      className="flex items-start gap-2 text-sm text-[var(--text-secondary)]"
                    >
                      <span className="text-[var(--cyan)] mt-0.5">→</span>
                      {SYNTHESIS.capability_unlocked(cap)}
                    </motion.li>
                  ))}
                </motion.ul>
              </div>
            )}

            <button
              onClick={() => setStep('complete')}
              className="self-start rounded bg-[var(--cyan)] px-4 py-2 text-xs font-medium text-[var(--deep-space)] hover:opacity-90 transition-opacity"
            >
              Continue
            </button>
          </motion.div>
        )}

        {/* ── Complete: add another or done ────────────────────────────── */}
        {step === 'complete' && (
          <motion.div
            key="complete"
            variants={sourceCardSpring}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-col gap-6"
          >
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {SYNTHESIS.indexing_complete(
                activeSource?.indexed_count ?? 0,
                selectedMeta?.title.toLowerCase() ?? 'items',
              )}
            </p>

            <div className="flex gap-3">
              {SOURCE_OPTIONS.some((s) => !alreadyIndexedTypes.has(s.type) && s.type !== selectedMeta?.type) && (
                <button
                  onClick={handleAddAnother}
                  className="rounded bg-[var(--cyan)] px-4 py-2 text-xs font-medium text-[var(--deep-space)] hover:opacity-90 transition-opacity"
                >
                  {SYNTHESIS.add_another_source}
                </button>
              )}
              <button
                onClick={onDone}
                className="rounded border border-[var(--border)] px-4 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--text-muted)] transition-colors"
              >
                {SYNTHESIS.done_for_now}
              </button>
            </div>

            {/* Skipped source notices */}
            {skippedNotices.length > 0 && (
              <div className="flex flex-col gap-2 mt-2 border-t border-[var(--border)] pt-4">
                {skippedNotices.slice(0, 2).map((s) => (
                  <p key={s.type} className="text-xs text-[var(--text-muted)]">
                    {SYNTHESIS.skipped_gentle(s.title, s.desc)}
                  </p>
                ))}
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
