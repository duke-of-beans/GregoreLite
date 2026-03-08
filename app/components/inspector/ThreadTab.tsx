'use client';
/**
 * ThreadTab — S9-14
 * Current thread stats: token count, message count, last checkpoint.
 */


import { useThreadTabsStore, selectActiveTab } from '@/lib/stores/thread-tabs-store';

export function ThreadTab() {
  const activeTab = useThreadTabsStore(selectActiveTab);

  const messageCount = activeTab?.messages.length ?? 0;
  const totalTokens = activeTab?.messages.reduce((sum, m) => {
    // Messages may have a tokens field if available
    return sum + ((m as unknown as { tokens?: number }).tokens ?? 0);
  }, 0) ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
        Current Thread
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderRadius: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--frost)' }}>Thread ID</span>
          <span style={{ fontSize: 12, color: 'var(--ice-white)', fontFamily: 'monospace' }}>
            {activeTab?.id ? activeTab.id.slice(0, 8) + '…' : '—'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderRadius: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--frost)' }}>Messages</span>
          <span style={{ fontSize: 12, color: 'var(--ice-white)', fontWeight: 600 }}>{messageCount}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderRadius: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--frost)' }}>Token Count</span>
          <span style={{ fontSize: 12, color: 'var(--ice-white)', fontWeight: 600 }}>
            {totalTokens > 0 ? totalTokens.toLocaleString() : '—'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderRadius: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--frost)' }}>Conversation ID</span>
          <span style={{ fontSize: 12, color: 'var(--ice-white)', fontFamily: 'monospace' }}>
            {activeTab?.conversationId ? activeTab.conversationId.slice(0, 8) + '…' : 'unsaved'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderRadius: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--frost)' }}>Ghost Context</span>
          <span style={{ fontSize: 12, color: activeTab?.ghostContextActive ? 'var(--success)' : 'var(--frost)' }}>
            {activeTab?.ghostContextActive ? '● Active' : '○ Inactive'}
          </span>
        </div>

        {activeTab?.artifact && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderRadius: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--frost)' }}>Artifact</span>
            <span style={{ fontSize: 12, color: 'var(--cyan)' }}>
              {activeTab.artifact.type ?? 'detected'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}