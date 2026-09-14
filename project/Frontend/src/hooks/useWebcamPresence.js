/**
 * useWebcamPresence
 * ─────────────────────────────────────────────────────────────────────────────
 * Prompt 2 derived-signals layer. Wraps useWebcamCapture (Prompt 1) and adds:
 *
 *   presenceRatio  — float 0–1: fraction of the last N samples where a face
 *                    was detected. Recomputed on every new sample.
 *
 *   headStable     — boolean: true if the variance of the detected face's
 *                    centre-point across the presence window is below
 *                    HEAD_STABLE_VARIANCE_PX (tunable constant, not inline).
 *                    false when too few face-present samples exist or when the
 *                    head is moving significantly.
 *
 *   tabFocused     — boolean: document.visibilityState === "visible", updated
 *                    immediately on the `visibilitychange` event — no polling.
 *
 *   webcamStatus   — forwarded directly from useWebcamCapture
 *   toggleCamera   — () => void: turns the camera on or off (convenience
 *                    wrapper around setWebcamEnabled)
 *
 * Privacy contract (do NOT break these):
 *   • Raw video frames are NEVER stored, transmitted, or serialised.
 *   • Detection objects from face-api carry only bounding-box geometry —
 *     no face embeddings, no recognition, no identity information.
 *   • Nothing is written to localStorage, sessionStorage, or IndexedDB.
 *   • All computation is local; no network requests originate from this hook.
 *
 * Interface handed to SCALE integration (Prompt 3):
 *   { webcamStatus, presenceRatio, headStable, tabFocused, toggleCamera }
 *
 * Everything else (webcamEnabled, setWebcamEnabled, rawSamples, isLoading,
 * hasError) is still available for the UI layer but is NOT part of the
 * SCALE-facing contract.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWebcamCapture } from './useWebcamCapture';

// ─── Tunable constants ────────────────────────────────────────────────────────

/**
 * Maximum allowed variance (in pixels²) of the face centre-point for
 * headStable to be true. Increase for more tolerance, decrease for stricter.
 * Centre-point is computed as (box.x + box.width/2, box.y + box.height/2).
 */
const HEAD_STABLE_VARIANCE_PX = 20;

/**
 * Minimum number of face-present samples required before headStable can ever
 * be true. Avoids a false "stable" from a single sample.
 */
const HEAD_STABLE_MIN_SAMPLES = 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute the 2-D variance of a set of {x, y} centre-points.
 * Returns the mean of varX and varY (scalar, in px²).
 * Returns Infinity when points.length < 2.
 */
function centreVariance(points) {
  if (points.length < 2) return Infinity;

  const n   = points.length;
  const mx  = points.reduce((s, p) => s + p.x, 0) / n;
  const my  = points.reduce((s, p) => s + p.y, 0) / n;
  const vx  = points.reduce((s, p) => s + (p.x - mx) ** 2, 0) / n;
  const vy  = points.reduce((s, p) => s + (p.y - my) ** 2, 0) / n;

  return (vx + vy) / 2;
}

/**
 * Extract the bounding-box centre from a face-api Detection object.
 * Works with both the full Detection wrapper and a plain {x,y,width,height}.
 * Returns null when the object doesn't have a usable box.
 */
function extractCentre(detection) {
  try {
    // face-api wraps box in detection.box or detection._box
    const box = detection.box ?? detection._box ?? detection;
    if (box == null) return null;
    const x = box.x      ?? box.left ?? 0;
    const y = box.y      ?? box.top  ?? 0;
    const w = box.width  ?? box.right  - x ?? 1;
    const h = box.height ?? box.bottom - y ?? 1;
    return { x: x + w / 2, y: y + h / 2 };
  } catch {
    return null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWebcamPresence() {
  // ── Layer 1: raw capture from Prompt 1 ─────────────────────────────────────
  const {
    webcamEnabled,
    setWebcamEnabled,
    webcamStatus,
    rawSamples,
    mediaStream,
    isActive,
    isLoading,
    hasError,
  } = useWebcamCapture();

  // ── Layer 2a: tabFocused via Page Visibility API ───────────────────────────
  const [tabFocused, setTabFocused] = useState(
    () => typeof document !== 'undefined'
      ? document.visibilityState === 'visible'
      : true,
  );

  useEffect(() => {
    function handleVisibility() {
      const isFocused = document.visibilityState === 'visible';
      setTabFocused(isFocused);
      console.log(`[WEBCAM] tabFocused = ${isFocused}`);
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // ── Layer 2b: facePresent, presenceRatio, and headStable ───────────────────
  const facePresent = useMemo(() => {
    if (webcamStatus !== 'ready' || rawSamples.length === 0) return false;
    return rawSamples[rawSamples.length - 1]?.faceDetected ?? false;
  }, [webcamStatus, rawSamples]);

  const presenceRatio = useMemo(() => {
    if (rawSamples.length === 0) return 0;
    const faceCount = rawSamples.filter(s => s.faceDetected).length;
    return Number((faceCount / rawSamples.length).toFixed(2));
  }, [rawSamples]);

  const headStable = useMemo(() => {
    // Collect centre-points only from samples where a face was actually detected
    const centres = [];

    for (const sample of rawSamples) {
      if (!sample.faceDetected) continue;
      // Take the first detection only (most prominent face)
      const det = sample.detections?.[0];
      if (!det) continue;
      const centre = extractCentre(det);
      if (centre) centres.push(centre);
    }

    if (centres.length < HEAD_STABLE_MIN_SAMPLES) return false;

    const variance = centreVariance(centres);
    return variance <= HEAD_STABLE_VARIANCE_PX;
  }, [rawSamples]);

  // ── Signal Transition Logging (Requirements 5, 6, 7) ────────────────────────
  const prevHeadStableRef = useRef(null);
  useEffect(() => {
    if (webcamStatus === 'ready' && prevHeadStableRef.current !== headStable) {
      prevHeadStableRef.current = headStable;
      console.log(`[WEBCAM] headStable = ${headStable}`);
    }
  }, [headStable, webcamStatus]);

  const prevPresenceRatioRef = useRef(null);
  useEffect(() => {
    if (webcamStatus === 'ready' && prevPresenceRatioRef.current !== presenceRatio) {
      prevPresenceRatioRef.current = presenceRatio;
      console.log(`[WEBCAM] presenceRatio = ${presenceRatio}`);
    }
  }, [presenceRatio, webcamStatus]);

  // ── Layer 2c: Absence Timer and Real Presence Events ───────────────────────
  const [presenceEvent, setPresenceEvent] = useState(null);
  const prevFacePresentRef = useRef(null);
  const absenceTimerRunningRef = useRef(false);
  const absenceAlertFiredRef = useRef(false);
  const absenceStartRef = useRef(null);
  const lastLoggedSecRef = useRef(0);

  // Synchronize facePresent state transitions
  useEffect(() => {
    if (webcamStatus !== 'ready') {
      absenceTimerRunningRef.current = false;
      absenceAlertFiredRef.current = false;
      absenceStartRef.current = null;
      lastLoggedSecRef.current = 0;
      prevFacePresentRef.current = null;
      return;
    }

    const prev = prevFacePresentRef.current;
    if (prev !== facePresent) {
      prevFacePresentRef.current = facePresent;
      console.log(`[WEBCAM] facePresent = ${facePresent}`);

      if (!facePresent) {
        // Face is absent -> start absence timer
        absenceTimerRunningRef.current = true;
        absenceStartRef.current = Date.now();
        lastLoggedSecRef.current = 0;
        console.log('[WEBCAM] absence timer started');
      } else {
        // Face has returned
        absenceTimerRunningRef.current = false;
        absenceStartRef.current = null;
        lastLoggedSecRef.current = 0;

        // If absence alert was fired, fire restored alert event!
        if (absenceAlertFiredRef.current) {
          absenceAlertFiredRef.current = false;
          console.log('[WEBCAM] FACE_RESTORED_EVENT fired');
          setPresenceEvent({
            type: 'FACE_RESTORED',
            timestamp: Date.now(),
          });
        }
      }
    }
  }, [facePresent, webcamStatus]);

  // Active absence timer tick loop (every 500ms)
  useEffect(() => {
    if (webcamStatus !== 'ready') return;

    const intervalId = setInterval(() => {
      if (!absenceTimerRunningRef.current || !absenceStartRef.current) return;

      const elapsedSec = Math.floor((Date.now() - absenceStartRef.current) / 1000);

      // Log each whole second from 1.0s to 8.0s
      if (elapsedSec > lastLoggedSecRef.current && elapsedSec <= 10) {
        lastLoggedSecRef.current = elapsedSec;
        console.log(`[WEBCAM] absence duration = ${elapsedSec}.0s`);
      }

      // Check 4-second threshold (triggers alert after 4s when face not detected)
      if (elapsedSec >= 4 && !absenceAlertFiredRef.current) {
        absenceAlertFiredRef.current = true;
        console.log('[WEBCAM] FACE_NOT_DETECTED event fired (4s threshold reached)');
        setPresenceEvent({
          type: 'FACE_NOT_DETECTED',
          timestamp: Date.now(),
        });
      }
    }, 500);

    return () => clearInterval(intervalId);
  }, [webcamStatus]);

  // ── Convenience: toggleCamera ──────────────────────────────────────────────
  const toggleCamera = useCallback(() => setWebcamEnabled(prev => !prev), [setWebcamEnabled]);

  // ── Public API (memoized to prevent cascading re-renders) ───────────────────
  return useMemo(() => ({
    // SCALE-facing contract (Prompt 3 reads these)
    webcamStatus,
    presenceRatio,
    headStable,
    tabFocused,
    toggleCamera,

    // Step 2 & Step 3 Signals
    facePresent,
    presenceEvent,
    mediaStream,

    // UI-facing extras
    webcamEnabled,
    setWebcamEnabled,
    rawSamples,
    isActive,
    isLoading,
    hasError,
  }), [
    webcamStatus,
    presenceRatio,
    headStable,
    tabFocused,
    toggleCamera,
    facePresent,
    presenceEvent,
    mediaStream,
    webcamEnabled,
    setWebcamEnabled,
    rawSamples,
    isActive,
    isLoading,
    hasError,
  ]);
}
