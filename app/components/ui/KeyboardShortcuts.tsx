/**
 * KeyboardShortcuts Component
 * 
 * Displays available keyboard shortcuts (Cmd+/).
 * Part of Phase 5.4 P4 - Settings & Polish.
 * 
 * Spec: docs/UI_UX_FINAL_DIRECTION.md Part 9 (Keyboard Shortcuts)
 */

'use client';

export interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  {
    category: 'Global',
    items: [
      { keys: ['Cmd', 'K'], description: 'Open command palette' },
      { keys: ['Cmd', 'N'], description: 'New conversation' },
      { keys: ['Cmd', '/'], description: 'Show keyboard shortcuts' },
      { keys: ['Cmd', ','], description: 'Open settings' },
      { keys: ['Cmd', 'I'], description: 'Toggle inspector drawer' },
      { keys: ['Cmd', '['], description: 'Toggle chat history' },
    ],
  },
  {
    category: 'Conversation',
    items: [
      { keys: ['Enter'], description: 'Send message' },
      { keys: ['Shift', 'Enter'], description: 'New line in message' },
      { keys: ['Cmd', 'M'], description: 'Open memory modal (when available)' },
      { keys: ['Cmd', 'E'], description: 'Edit last message' },
      { keys: ['Cmd', 'R'], description: 'Regenerate response' },
    ],
  },
];

export function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close shortcuts"
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--shadow)] bg-[var(--elevated)] shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--shadow)] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">⌨️</span>
            <h2
              id="shortcuts-title"
              className="text-lg font-semibold text-[var(--ice-white)]"
            >
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--mist)] transition-colors hover:text-[var(--ice-white)]"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            {shortcuts.map((section) => (
              <div key={section.category}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--frost)]">
                  {section.category}
                </h3>
                <div className="space-y-2">
                  {section.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg bg-[var(--deep-space)]/30 px-4 py-2"
                    >
                      <span className="text-sm text-[var(--ice-white)]">
                        {item.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {item.keys.map((key, keyIdx) => (
                          <span key={keyIdx} className="flex items-center gap-1">
                            <kbd className="rounded border border-[var(--shadow)] bg-[var(--elevated)] px-2 py-1 font-mono text-xs text-[var(--cyan)]">
                              {key}
                            </kbd>
                            {keyIdx < item.keys.length - 1 && (
                              <span className="text-xs text-[var(--mist)]">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Note */}
          <div className="mt-6 rounded-md bg-[var(--deep-space)]/50 p-3 text-xs text-[var(--mist)]">
            💡 <strong>Tip:</strong> Use{' '}
            <kbd className="rounded border border-[var(--shadow)] bg-[var(--elevated)] px-1.5 py-0.5 font-mono text-[var(--cyan)]">
              Cmd
            </kbd>{' '}
            +{' '}
            <kbd className="rounded border border-[var(--shadow)] bg-[var(--elevated)] px-1.5 py-0.5 font-mono text-[var(--cyan)]">
              K
            </kbd>{' '}
            to quickly access all commands
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-[var(--shadow)] px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-[var(--cyan)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--cyan-dark)]"
          >
            Got it
          </button>
        </div>
      </div>
    </>
  );
}
