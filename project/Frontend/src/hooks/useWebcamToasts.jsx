/**
 * useWebcamToasts
 * ─────────────────────────────────────────────────────────────────────────────
 * Watches existing webcam signals and presence events from WebcamContext
 * and fires premium PrismAlert notifications for meaningful state transitions.
 *
 * Anti-spam rules:
 *   Face absent < 8s      → silent (handled by presence timer in useWebcamPresence)
 *   Face absent ≥ 8s      → ONE "Face not detected" alert
 *   Face remains absent   → no repeated alerts
 *   Face returns          → ONE "Camera signal restored" alert (only if absence was announced)
 *   Repeated absence      → respects 30s cooldown, never blocks first alert
 *   Tab focus loss        → silent
 *   Tab restored          → brief "Welcome back" (with 60s cooldown)
 */

import React, { useEffect, useRef } from 'react';

const COOLDOWN_MS             = 30000;  // 30-second cooldown for repeated alerts
const TAB_RESTORE_COOLDOWN_MS = 60000;  // welcome-back cooldown

export function showFaceNotDetectedAlert(push, I) {
  console.log('[TOAST] show face-not-detected');
  return push({
    category: 'ATTENTION TRACKING',
    variant: 'warning',
    icon: <I.CameraOff size={18} />,
    title: 'Face not detected',
    body: "PRISM can't detect your face right now. Attention signals may be unavailable.",
    duration: 0,
    actions: [
      { label: 'Check camera', onClick: () => {} },
    ],
  });
}

export function showCameraRestoredAlert(push, I) {
  console.log('[TOAST] show camera-restored');
  return push({
    category: 'ATTENTION TRACKING',
    variant: 'success',
    icon: <I.CheckCircle size={18} />,
    title: 'Camera signal restored',
    body: 'Your face is visible again and attention signals are active.',
    duration: 4000,
  });
}

export function useWebcamToasts({ webcam, push, dismiss, I, toggleCamera, setWebcamSkipped }) {
  const {
    webcamStatus,
    tabFocused,
    webcamSkipped,
    presenceEvent,
  } = webcam;

  const prevStatusRef             = useRef(null); // start null so initial 'ready' announces
  const prevTabFocusedRef         = useRef(tabFocused);
  const lastAlertTimeRef          = useRef({});
  const lastEventTsRef            = useRef(null);
  const activeAbsenceToastIdRef   = useRef(null);

  // ── Cooled push ─────────────────────────────────────────────────────────────
  function cooledPush(type, payload, cooldown = COOLDOWN_MS) {
    const now = Date.now();
    const lastTime = lastAlertTimeRef.current[type] ?? 0;
    if (lastTime > 0 && (now - lastTime) < cooldown) return false;
    lastAlertTimeRef.current[type] = now;
    return push(payload);
  }

  // ── Status transitions ───────────────────────────────────────────────────────
  useEffect(() => {
    const prev = prevStatusRef.current;
    const curr = webcamStatus;
    if (prev === curr) return;
    prevStatusRef.current = curr;

    if (curr === 'off' || webcamSkipped) return;

    // CAMERA READY
    if (curr === 'ready') {
      cooledPush('cam_ready', {
        category: 'Camera',
        variant: 'success',
        icon: <I.CheckCircle size={18} />,
        title: 'Camera ready',
        body: 'PRISM can now use optional attention signals while you learn.',
        duration: 4000,
      });
    }

    // PERMISSION DENIED
    if (curr === 'denied') {
      cooledPush('cam_denied', {
        category: 'Camera',
        variant: 'neutral',
        icon: <I.ShieldOff size={18} />,
        title: 'Camera access denied',
        body: "PRISM can't use webcam attention signals. You can continue learning normally.",
        duration: 0,
        actions: [
          { label: 'Try again', onClick: () => toggleCamera?.() },
          { label: 'Continue without camera', onClick: () => setWebcamSkipped?.(true) },
        ],
      });
    }

    // NO CAMERA / UNAVAILABLE
    if (curr === 'unavailable') {
      cooledPush('cam_unavailable', {
        category: 'Camera',
        variant: 'neutral',
        icon: <I.CameraOff size={18} />,
        title: 'No camera detected',
        body: 'No compatible camera was found. You can continue learning without webcam signals.',
        duration: 0,
        actions: [
          { label: 'Continue without camera', onClick: () => setWebcamSkipped?.(true) },
        ],
      });
    }

    // INTERRUPTED / ERROR
    if (curr === 'model_failed' || curr === 'error') {
      cooledPush('cam_error', {
        category: 'Camera',
        variant: 'warning',
        icon: <I.AlertTriangle size={18} />,
        title: 'Camera disconnected',
        body: 'Your webcam connection was interrupted. Your lesson will continue normally.',
        duration: 0,
        actions: [
          { label: 'Reconnect', onClick: () => toggleCamera?.() },
          { label: 'Continue without camera', onClick: () => setWebcamSkipped?.(true) },
        ],
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webcamStatus, webcamSkipped]);

  // ── Presence Events (Absence ≥ 4s & Restoration) ────────────────────────────
  useEffect(() => {
    if (!presenceEvent) return;
    if (presenceEvent.timestamp === lastEventTsRef.current) return;
    lastEventTsRef.current = presenceEvent.timestamp;

    if (webcamStatus !== 'ready' || webcamSkipped) return;

    if (presenceEvent.type === 'FACE_NOT_DETECTED') {
      console.log('[TOAST] FACE_NOT_DETECTED received -> triggering alert');
      // If a previous absence toast is still showing, dismiss it first
      if (activeAbsenceToastIdRef.current && dismiss) {
        dismiss(activeAbsenceToastIdRef.current);
      }
      activeAbsenceToastIdRef.current = showFaceNotDetectedAlert(push, I);
    } else if (presenceEvent.type === 'FACE_RESTORED') {
      console.log('[TOAST] FACE_RESTORED received -> dismissing absence alert & showing restored');
      if (activeAbsenceToastIdRef.current && dismiss) {
        dismiss(activeAbsenceToastIdRef.current);
        activeAbsenceToastIdRef.current = null;
      }
      showCameraRestoredAlert(push, I);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenceEvent, webcamStatus, webcamSkipped]);

  // ── Tab focus restore ────────────────────────────────────────────────────────
  useEffect(() => {
    const prev = prevTabFocusedRef.current;
    const curr = tabFocused;
    if (prev === curr) return;
    prevTabFocusedRef.current = curr;

    if (webcamStatus !== 'ready' || webcamSkipped) return;

    if (curr === true && prev === false) {
      cooledPush('tab_restore', {
        category: 'Session',
        variant: 'info',
        icon: <I.Monitor size={18} />,
        title: 'Welcome back',
        body: 'Your learning session is still active.',
        duration: 3000,
      }, TAB_RESTORE_COOLDOWN_MS);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFocused, webcamStatus, webcamSkipped]);
}
