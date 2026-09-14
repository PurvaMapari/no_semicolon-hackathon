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
 * Route-aware camera control:
 *   • Camera is only active on /profile (Step 2) and /learn (Step 3).
 *   • When navigating to any other route (upload, practice, progress),
 *     the camera is automatically disabled to save resources and privacy.
 *   • When returning to an allowed route, the camera is automatically restored
 *     if it was previously active.
 *
 * Additionally exposes `webcamSkipped` / `setWebcamSkipped` so Profile can
 * offer the Task-4 escape hatch for genuine hardware failures.
 */

import React, { createContext, useContext, useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useWebcamPresence } from './useWebcamPresence';

const WebcamCtx = createContext(null);

/** Routes where the webcam is allowed to be active */
const CAMERA_ALLOWED_ROUTES = ['/profile', '/learn'];

export function WebcamProvider({ children }) {
  const presence = useWebcamPresence();
  const location = useLocation();

  // Escape hatch: true only when user explicitly skips due to unavailable device
  const [webcamSkipped, setWebcamSkipped] = useState(false);

  // Track whether camera was active before leaving an allowed route
  const wasActiveRef = useRef(false);

  const isAllowedRoute = CAMERA_ALLOWED_ROUTES.some(
    (route) => location.pathname.startsWith(route)
  );

  // Auto-disable camera when navigating away from allowed routes,
  // and auto-restore when returning
  useEffect(() => {
    if (!isAllowedRoute) {
      // Leaving an allowed route — remember if camera was on, then disable
      if (presence.webcamEnabled) {
        wasActiveRef.current = true;
        presence.setWebcamEnabled(false);
      }
    } else {
      // Entering an allowed route — restore camera if it was previously active
      if (wasActiveRef.current && !presence.webcamEnabled) {
        presence.setWebcamEnabled(true);
        wasActiveRef.current = false;
      }
    }
  }, [isAllowedRoute]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(
    () => ({ ...presence, webcamSkipped, setWebcamSkipped }),
    [presence, webcamSkipped]
  );

  return (
    <WebcamCtx.Provider value={value}>
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
