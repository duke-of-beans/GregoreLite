/**
 * GhostSection — S9-13
 * Ghost scan cadence display + link to Privacy Dashboard exclusion form.
 */

'use client';

export function GhostSection() {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ice-white)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Ghost
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--frost)' }}>Scan Cadence</span>
          <span style={{ fontSize: 13, color: 'var(--ice-white)', padding: '4px 10px', background: 'var(--surface)', borderRadius: 4 }}>
            Every 5 minutes
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--frost)' }}>Privacy Exclusions</span>
          <button
            onClick={() => {
              // Open Privacy Dashboard — uses command registry
              import('@/lib/stores/ui-store').then((m) => {
                m.useUIStore.getState().openModal('privacy-dashboard');
              }).catch(() => { /* silent */ });
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--shadow)',
              background: 'var(--elevated)',
              color: 'var(--cyan)',
              cursor: 'pointer',
              fontSize: 12,
              transition: 'all 0.15s ease',
            }}
          >
            Manage Exclusions →
          </button>
        </div>
      </div>
    </div>
  );
}