/**
 * WebcamContext
 * ─────────────────────────────────────────────────────────────────────────────
 * Lifts useWebcamPresence into a React context so the hook instance persists
 * across the Step 2 (Profile) → Step 3 (Learn) route transition.
 *
 * The hook is instantiated ONCE inside <WebcamProvider>.  Both Profile and
 * Learn read from the same instance via useWebcam().  This guarantees:
 *   • Permission is requested exactly once per session.
 *   • The camera stream is NOT torn down when navigating from /profile to /learn.
 *   • The stream IS torn down when the provider unmounts (app close / hard nav).
 *
 * Additionally exposes `webcamSkipped` / `setWebcamSkipped` so Profile can
 * offer the Task-4 escape hatch for genuine hardware failures.
 */

import React, { createContext, useContext, useState } from 'react';
import { useWebcamPresence } from './useWebcamPresence';

const WebcamCtx = createContext(null);

export function WebcamProvider({ children }) {
  const presence = useWebcamPresence();

  // Escape hatch: true only when user explicitly skips due to unavailable device
  const [webcamSkipped, setWebcamSkipped] = useState(false);

  return (
    <WebcamCtx.Provider value={{ ...presence, webcamSkipped, setWebcamSkipped }}>
      {children}
    </WebcamCtx.Provider>
  );
}

/**
 * useWebcam — consume the shared webcam presence state anywhere in the tree.
 * Throws a clear error if used outside <WebcamProvider>.
 */
export function useWebcam() {
  const ctx = useContext(WebcamCtx);
  if (!ctx) {
    throw new Error('useWebcam must be used inside <WebcamProvider>');
  }
  return ctx;
}
