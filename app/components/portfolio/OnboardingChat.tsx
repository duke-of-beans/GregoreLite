import { apiFetch } from '@/lib/api-client';
/**
 * OnboardingChat — Sprint 25.0
 *
 * Conversational Q&A interface for the Add Existing Project flow.
 * Greg asks questions one at a time in chat bubbles. User types answers.
 * After final question, shows draft DNA for review/approval.
 *
 * All copy from lib/voice/copy-templates.ts ONBOARDING section.
 * Voice: deadpan professional, data-forward, no exclamation marks.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ONBOARDING } from '@/lib/voice/copy-templates';
import type { DirectoryScanResult, InferResult, OnboardingQuestion, ProjectDnaYaml } from '@/lib/portfolio/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'greg' | 'user';
  text: string;
}

export interface OnboardingChatProps {
  scan: DirectoryScanResult;
  inferred: InferResult;
  questions: OnboardingQuestion[];
  onApproved: (dna: ProjectDnaYaml, answers: Record<string, string>, projectName: string) => void;
  onReset: () => void;
}

// ── Acknowledgment cycle ──────────────────────────────────────────────────────
const ACKS = Object.values(ONBOARDING.ack) as string[];
function nextAck(index: number): string {
  return ACKS[index % ACKS.length] ?? ONBOARDING.ack.got_it;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildScanSummary(scan: DirectoryScanResult, inferred: InferResult): string {
  const folderName = scan.path.split(/[\\/]/).pop() ?? scan.path;
  const dominantType = inferred.type === 'custom'
    ? `unclear type (${inferred.reason})`
    : inferred.type;
  const buildSys = scan.buildSystem.slice(0, 2).join(', ');
  return ONBOARDING.scan.summary(folderName, scan.totalFiles, dominantType, buildSys);
}

// ── Styles (inline — Gregore design system vars) ──────────────────────────────
const S = {
  container: {
    display: 'flex', flexDirection: 'column' as const,
    height: '100%', gap: 0,
  },
  scanBanner: {
    background: 'rgba(0, 212, 232, 0.06)',
    border: '1px solid rgba(0, 212, 232, 0.2)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 12,
    color: 'var(--mist)',
    marginBottom: 16,
    lineHeight: 1.5,
  },
  chatArea: {
    flex: 1, overflowY: 'auto' as const,
    display: 'flex', flexDirection: 'column' as const,
    gap: 10, paddingBottom: 12,
  },
  bubble: (role: 'greg' | 'user') => ({
    maxWidth: '80%',
    alignSelf: role === 'greg' ? 'flex-start' as const : 'flex-end' as const,
    background: role === 'greg' ? 'var(--elevated)' : 'rgba(0, 212, 232, 0.1)',
    border: `1px solid ${role === 'greg' ? 'var(--shadow)' : 'rgba(0, 212, 232, 0.25)'}`,
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    color: role === 'greg' ? 'var(--frost)' : 'var(--ice-white)',
    lineHeight: 1.55,
  }),
  inputRow: {
    display: 'flex', gap: 8, marginTop: 12,
  },
  input: {
    flex: 1,
    background: 'var(--surface)',
    border: '1px solid var(--shadow)',
    borderRadius: 6,
    padding: '8px 12px',
    fontSize: 13,
    color: 'var(--frost)',
    outline: 'none',
  },
  sendBtn: (disabled: boolean) => ({
    background: disabled ? 'transparent' : 'rgba(0, 212, 232, 0.1)',
    border: '1px solid var(--cyan)',
    borderRadius: 6, padding: '8px 16px',
    fontSize: 12, fontWeight: 600,
    color: 'var(--cyan)',
    cursor: disabled ? 'not-allowed' as const : 'pointer' as const,
    opacity: disabled ? 0.4 : 1,
    whiteSpace: 'nowrap' as const,
  }),
  dnaPreview: {
    background: 'var(--surface)',
    border: '1px solid var(--shadow)',
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: 11,
    fontFamily: 'monospace',
    color: 'var(--mist)',
    whiteSpace: 'pre-wrap' as const,
    maxHeight: 200,
    overflowY: 'auto' as const,
    marginTop: 8,
  },
  actionRow: {
    display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' as const,
  },
  approveBtn: {
    background: 'rgba(0, 212, 232, 0.1)',
    border: '1px solid var(--cyan)', borderRadius: 6,
    padding: '8px 18px', fontSize: 12, fontWeight: 600,
    color: 'var(--cyan)', cursor: 'pointer' as const,
  },
  resetLink: {
    background: 'none', border: 'none',
    fontSize: 12, color: 'var(--mist)',
    cursor: 'pointer' as const, padding: '8px 4px',
    textDecoration: 'underline',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function OnboardingChat({ scan, inferred, questions, onApproved, onReset }: OnboardingChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ackIndex, setAckIndex] = useState(0);
  const [phase, setPhase] = useState<'questions' | 'preview'>('questions');
  const [dnaPreview, setDnaPreview] = useState<{ yaml: string; dna: ProjectDnaYaml } | null>(null);
  const projectName = scan.path.split(/[\\/]/).pop() ?? '';
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initial Greg message with scan summary
  useEffect(() => {
    const summary = buildScanSummary(scan, inferred);
    const firstQuestion = questions[0];
    const msgs: ChatMessage[] = [
      { id: 'scan-summary', role: 'greg', text: summary },
    ];
    if (firstQuestion) {
      msgs.push({ id: `q-${firstQuestion.id}`, role: 'greg', text: firstQuestion.question });
    }
    setMessages(msgs);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submitAnswer = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    // Record answer + add user bubble
    const newAnswers = { ...answers, [currentQuestion.id]: trimmed };
    setAnswers(newAnswers);
    setInputValue('');

    const userMsg: ChatMessage = { id: `ans-${currentQuestion.id}`, role: 'user', text: trimmed };
    const nextIndex = currentQuestionIndex + 1;

    if (nextIndex < questions.length) {
      // Acknowledgment + next question
      const ack = nextAck(ackIndex);
      setAckIndex((i) => i + 1);
      const nextQ = questions[nextIndex];
      const gregMsgs: ChatMessage[] = [
        { id: `ack-${nextIndex}`, role: 'greg', text: ack },
        { id: `q-${nextQ!.id}`,  role: 'greg', text: nextQ!.question },
      ];
      setMessages((prev) => [...prev, userMsg, ...gregMsgs]);
      setCurrentQuestionIndex(nextIndex);
    } else {
      // Last answer — generate DNA preview
      setMessages((prev) => [...prev, userMsg]);
      try {
        const res = await apiFetch('/api/portfolio/onboarding-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scanResult: scan, answers: newAnswers, inferredType: inferred, projectName }),
        });
        const body = await res.json() as { success: boolean; data?: { yaml: string; dna: ProjectDnaYaml }; error?: string };
        if (body.success && body.data) {
          setDnaPreview(body.data);
          setPhase('preview');
          setMessages((prev) => [
            ...prev,
            { id: 'dna-intro', role: 'greg', text: ONBOARDING.dnaPreview.intro },
          ]);
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { id: 'dna-err', role: 'greg', text: `Could not generate draft: ${err instanceof Error ? err.message : 'Network error'}` },
        ]);
      }
    }
  }, [inputValue, answers, currentQuestionIndex, questions, ackIndex, scan, inferred, projectName]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submitAnswer(); }
  };

  const handleApprove = () => {
    if (!dnaPreview) return;
    onApproved(dnaPreview.dna, answers, projectName);
  };

  const isLastQuestion = currentQuestionIndex >= questions.length - 1;
  const sendLabel = isLastQuestion ? 'Done' : 'Send';

  return (
    <div style={S.container}>
      {/* Scan banner */}
      <div style={S.scanBanner}>
        <strong style={{ color: 'var(--ice-white)' }}>
          {scan.path.split(/[\\/]/).pop() ?? scan.path}
        </strong>
        {'  ·  '}{scan.totalFiles.toLocaleString()} files
        {scan.buildSystem.length > 0 && `  ·  ${scan.buildSystem.slice(0, 2).join(', ')}`}
        {scan.versionControl.hasGit && `  ·  git (${scan.versionControl.branch ?? 'detached'})`}
        {inferred.confidence !== 'high' && (
          <div style={{ marginTop: 4, color: 'var(--amber, #f5a623)', fontSize: 11 }}>
            {inferred.reason}
          </div>
        )}
      </div>

      {/* Chat messages */}
      <div style={S.chatArea}>
        {messages.map((msg) => (
          <div key={msg.id} style={S.bubble(msg.role)}>{msg.text}</div>
        ))}

        {/* DNA preview (shown after all questions answered) */}
        {phase === 'preview' && dnaPreview && (
          <>
            <div style={S.dnaPreview}>{dnaPreview.yaml}</div>
            <div style={S.actionRow}>
              <button style={S.approveBtn} onClick={handleApprove}>
                {ONBOARDING.dnaPreview.approveBtn}
              </button>
              <button style={S.resetLink} onClick={onReset}>
                {ONBOARDING.dnaPreview.startOver}
              </button>
            </div>
          </>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input (hidden once in preview phase) */}
      {phase === 'questions' && (
        <div style={S.inputRow}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer…"
            style={S.input}
            autoFocus
          />
          <button
            onClick={() => { void submitAnswer(); }}
            disabled={!inputValue.trim()}
            style={S.sendBtn(!inputValue.trim())}
          >
            {sendLabel}
          </button>
        </div>
      )}
    </div>
  );
}
