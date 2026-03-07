/**
 * CapturePadController — Sprint 29.0
 *
 * Thin orchestration wrapper: renders CapturePad + CaptureToast together.
 * Mount this once at the root layout — it is always present, z-index above everything.
 * The CapturePad self-registers its keyboard shortcuts on mount.
 */

'use client';

import { useState, useCallback } from 'react';
import { CapturePad } from './CapturePad';
import { CaptureToast, type CaptureToastData } from './CaptureToast';

export function CapturePadController() {
  const [toast, setToast] = useState<CaptureToastData | null>(null);

  const handleCaptured = useCallback((result: {
    wasDuplicate: boolean;
    mergedWith?: string;
    mentionCount?: number;
    projectName?: string | null;
  }) => {
    if (result.wasDuplicate) {
      setToast({ variant: 'merged', mentionCount: result.mentionCount ?? 2 });
    } else if (result.projectName) {
      setToast({ variant: 'routed', projectName: result.projectName });
    } else if (result.projectName === null) {
      setToast({ variant: 'unrouted' });
    } else {
      setToast({ variant: 'captured' });
    }
  }, []);

  return (
    <>
      <CapturePad onCaptured={handleCaptured} />
      <CaptureToast data={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
