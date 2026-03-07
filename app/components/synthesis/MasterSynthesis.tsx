'use client';

/**
 * MasterSynthesis — Sprint 28.0 Ceremonial Onboarding
 *
 * Full-screen ceremony. The moment Greg truly sees the user for the first time.
 * Design: dark background, centred content, breathing room.
 *
 * Sequence:
 *   1. "I see you now." — fade in over 2s, 2-second pause
 *   2. Overview — typewriter, 50ms/char
 *   3. Patterns — staggered cards, 1s apart
 *   4. Insights — same treatment
 *   5. Blind spots — only if data.blind_spots.length > 0
 *   6. Capabilities grid
 *   7. "Let's get to work." button
 *
 * The master synthesis is stored permanently. Accessible from Settings/Inspector.
 * This component can be rendered in full-screen modal or standalone page.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SYNTHESIS } from '@/lib/voice/copy-templates';
import {
  masterReveal,
  sectionReveal,
  staggerContainer,
  staggerChild,
  getTypewriterDelay,
  getTypewriterSlice,
  isTypewriterComplete,
  prefersReducedMotion,
} from '@/lib/design/synthesis-animations';
import type { MasterSynthesis as MasterSynthesisType } from '@/lib/synthesis/types';

// ── Typewriter (master speed: 50ms/char) ─────────────────────────────────────

function MasterTypewriter({
  text,
  onComplete,
}: {
  text: string;
  onComplete?: () => void;
}) {
  const [charIndex, setCharIndex] = useState(
    prefersReducedMotion() ? text.length : 0,
  );

  useEffect(() => {
    setCharIndex(prefersReducedMotion() ? text.length : 0);
  }, [text]);

  useEffect(() => {
    if (isTypewriterComplete(text, charIndex)) {
      onComplete?.();
      return;
    }
    const delay = getTypewriterDelay('master');
    const t = setTimeout(() => setCharIndex((i) => i + 1), delay);
    return () => clearTimeout(t);
  }, [charIndex, text, onComplete]);

  return <span>{getTypewriterSlice(text, charIndex)}</span>;
}

// ── Pattern / Insight card ────────────────────────────────────────────────────

function InsightCard({ text }: { text: string }) {
  return (
    <motion.div
      variants={staggerChild}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4"
    >
      <p className="text-sm text-[var(--text-primary)] leading-relaxed">{text}</p>
    </motion.div>
  );
}

// ── Capability card ───────────────────────────────────────────────────────────

function CapabilityCard({ text, index }: { text: string; index: number }) {
  return (
    <motion.div
      variants={staggerChild}
      custom={index}
      className="rounded-lg border border-[var(--cyan)] border-opacity-30 bg-[var(--surface)] px-4 py-3"
    >
      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{text}</p>
    </motion.div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-medium uppercase tracking-widest text-[var(--cyan)] opacity-70">
      {label}
    </p>
  );
}

// ── Loading state ─────────────────────────────────────────────────────────────

function GeneratingState() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-[var(--text-muted)]">{SYNTHESIS.master_generating}</p>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  /** Pass a pre-loaded synthesis, or null to load from API */
  synthesis?: MasterSynthesisType | null;
  /** Called when user clicks "Let's get to work." */
  onDismiss: () => void;
  /** Whether to render as full-screen overlay (default true) */
  fullScreen?: boolean;
}

// ── Sequence stages ───────────────────────────────────────────────────────────

type Stage =
  | 'opening'    // "I see you now." fading in
  | 'overview'   // overview typewriter
  | 'patterns'   // pattern cards staggering in
  | 'insights'   // insight cards
  | 'blindspots' // optional
  | 'capabilities' // capability grid
  | 'done';      // dismiss button visible

// ── Main component ────────────────────────────────────────────────────────────

export function MasterSynthesis({ synthesis: propSynthesis, onDismiss, fullScreen = true }: Props) {
  const [synthesis, setSynthesis] = useState<MasterSynthesisType | null>(
    propSynthesis ?? null,
  );
  const [stage, setStage] = useState<Stage>('opening');
  const [isLoading, setIsLoading] = useState(!propSynthesis);

  // Load from API if not provided
  useEffect(() => {
    if (propSynthesis !== undefined) return;
    fetch('/api/synthesis/master')
      .then((r) => r.json())
      .then((data: { synthesis: MasterSynthesisType | null }) => {
        setSynthesis(data.synthesis);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [propSynthesis]);

  // Advance stage after opening pause
  useEffect(() => {
    if (stage !== 'opening' || !synthesis) return;
    const delay = prefersReducedMotion() ? 100 : 2500; // 2s fade + 500ms pause
    const t = setTimeout(() => setStage('overview'), delay);
    return () => clearTimeout(t);
  }, [stage, synthesis]);

  const advance = (nextStage: Stage) => setStage(nextStage);

  const wrapperClass = fullScreen
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-[var(--deep-space)] overflow-y-auto'
    : 'flex items-start justify-center bg-[var(--deep-space)] min-h-[600px]';

  if (isLoading) {
    return (
      <div className={wrapperClass}>
        <GeneratingState />
      </div>
    );
  }

  if (!synthesis) {
    return (
      <div className={wrapperClass}>
        <div className="flex flex-col items-center gap-4 p-8">
          <p className="text-sm text-[var(--text-muted)]">{SYNTHESIS.master_error}</p>
          <button
            onClick={() => {
              setIsLoading(true);
              fetch('/api/synthesis/generate-master', { method: 'POST' })
                .then((r) => r.json())
                .then((d: { synthesis: MasterSynthesisType }) => {
                  setSynthesis(d.synthesis);
                  setIsLoading(false);
                })
                .catch(() => setIsLoading(false));
            }}
            className="text-xs text-[var(--cyan)] hover:opacity-80"
          >
            {SYNTHESIS.master_retry}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <div className="w-full max-w-2xl mx-auto px-6 py-16 flex flex-col gap-12">

        {/* ── Opening: "I see you now." ──────────────────────────────────── */}
        <motion.div
          variants={masterReveal}
          initial="hidden"
          animate="visible"
          className="text-center"
        >
          <p className="text-2xl font-light tracking-wide text-[var(--text-primary)]">
            {SYNTHESIS.master_opening}
          </p>
        </motion.div>

        {/* ── Overview ──────────────────────────────────────────────────── */}
        <AnimatePresence>
          {stage !== 'opening' && (
            <motion.div
              key="overview"
              variants={sectionReveal(0)}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-3"
            >
              <p className="text-base text-[var(--text-primary)] leading-relaxed">
                <MasterTypewriter
                  text={synthesis.overview}
                  onComplete={() => advance('patterns')}
                />
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Patterns ──────────────────────────────────────────────────── */}
        <AnimatePresence>
          {(stage === 'patterns' || stage === 'insights' || stage === 'blindspots' || stage === 'capabilities' || stage === 'done') && synthesis.patterns.length > 0 && (
            <motion.div
              key="patterns"
              variants={sectionReveal(0)}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-4"
            >
              <SectionHeader label={SYNTHESIS.master_patterns_header} />
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                onAnimationComplete={() => {
                  if (stage === 'patterns') advance('insights');
                }}
                className="flex flex-col gap-3"
              >
                {synthesis.patterns.map((pattern, i) => (
                  <InsightCard key={i} text={pattern} />
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Insights ──────────────────────────────────────────────────── */}
        <AnimatePresence>
          {(stage === 'insights' || stage === 'blindspots' || stage === 'capabilities' || stage === 'done') && synthesis.insights.length > 0 && (
            <motion.div
              key="insights"
              variants={sectionReveal(0)}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-4"
            >
              <SectionHeader label={SYNTHESIS.master_insights_header} />
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                onAnimationComplete={() => {
                  if (stage === 'insights') {
                    advance(synthesis.blind_spots.length > 0 ? 'blindspots' : 'capabilities');
                  }
                }}
                className="flex flex-col gap-3"
              >
                {synthesis.insights.map((insight, i) => (
                  <InsightCard key={i} text={insight} />
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Blind spots (conditional) ──────────────────────────────────── */}
        <AnimatePresence>
          {(stage === 'blindspots' || stage === 'capabilities' || stage === 'done') && synthesis.blind_spots.length > 0 && (
            <motion.div
              key="blindspots"
              variants={sectionReveal(0)}
              initial="hidden"
              animate="visible"
              onAnimationComplete={() => {
                if (stage === 'blindspots') advance('capabilities');
              }}
              className="flex flex-col gap-4"
            >
              <SectionHeader label={SYNTHESIS.master_blindspots_header} />
              <div className="flex flex-col gap-3">
                {synthesis.blind_spots.map((spot, i) => (
                  <p key={i} className="text-sm text-[var(--text-muted)] leading-relaxed border-l-2 border-[var(--border)] pl-4">
                    {spot}
                  </p>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Capabilities ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {(stage === 'capabilities' || stage === 'done') && synthesis.capability_summary && (
            <motion.div
              key="capabilities"
              variants={sectionReveal(0)}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-4"
            >
              <SectionHeader label={SYNTHESIS.master_capabilities_header} />
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                onAnimationComplete={() => {
                  if (stage === 'capabilities') advance('done');
                }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                {synthesis.capability_summary.split('.').filter(s => s.trim().length > 10).map((cap, i) => (
                  <CapabilityCard key={i} text={cap.trim() + '.'} index={i} />
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Dismiss button ────────────────────────────────────────────── */}
        <AnimatePresence>
          {stage === 'done' && (
            <motion.div
              key="dismiss"
              variants={sectionReveal(0)}
              initial="hidden"
              animate="visible"
              className="flex justify-center pt-4"
            >
              <button
                onClick={onDismiss}
                className="rounded bg-[var(--cyan)] px-8 py-3 text-sm font-medium text-[var(--deep-space)] hover:opacity-90 transition-opacity"
              >
                {SYNTHESIS.master_dismiss}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
