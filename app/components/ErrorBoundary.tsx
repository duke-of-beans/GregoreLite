'use client';

/**
 * Global Error Boundary — Sprint 14.0
 *
 * Catches unhandled React render errors and displays a recovery UI
 * instead of a white screen. Wraps both ChatInterface and the full app.
 */

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Label shown in the error UI (e.g. "Chat", "Application") */
  region?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.region ? `:${this.props.region}` : ''}]`,
      error,
      info.componentStack,
    );
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearAndReload = () => {
    // Clear the current thread from localStorage so the app doesn't
    // immediately re-render the same crashing state
    try {
      localStorage.removeItem('greglite-active-thread');
      localStorage.removeItem('greglite-chat-state');
    } catch {
      // Ignore — localStorage may not be available
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const region = this.props.region ?? 'Application';
    const message = this.state.error?.message ?? 'Unknown error';

    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--deep-space,#0a0a0f)] p-8">
        <div className="max-w-md space-y-4 rounded-lg border border-red-500/30 bg-red-950/20 p-6">
          <h2 className="text-lg font-semibold text-red-400">
            {region} Error
          </h2>
          <p className="text-sm text-gray-400">
            Something went wrong rendering this section. The error has been
            logged to the console.
          </p>
          <pre className="max-h-32 overflow-auto rounded bg-black/40 p-3 text-xs text-red-300">
            {message}
          </pre>
          <div className="flex gap-3">
            <button
              onClick={this.handleReload}
              className="rounded bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition-colors"
            >
              Reload
            </button>
            <button
              onClick={this.handleClearAndReload}
              className="rounded bg-red-500/20 px-4 py-2 text-sm text-red-300 hover:bg-red-500/30 transition-colors"
            >
              Clear thread &amp; reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
