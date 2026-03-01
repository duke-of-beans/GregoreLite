/**
 * Home Page — GregLite Cockpit
 *
 * Sprint 2B: wraps strategic thread with left context panel.
 * ContextPanel (20%) | ChatInterface (flex-1)
 */

import { ChatInterface } from '@/components/chat/ChatInterface';
import { ContextPanel } from '@/components/context';

export default function Home() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--deep-space)]">
      <ContextPanel />
      <div className="flex flex-1 flex-col overflow-hidden">
        <ChatInterface />
      </div>
    </div>
  );
}
