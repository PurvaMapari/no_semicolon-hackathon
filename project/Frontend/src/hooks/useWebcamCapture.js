/**
 * useWebcamCapture
 * ─────────────────────────────────────────────────────────────────────────────
 * Foundational webcam presence-detection layer for PRISM.
 *
 * Provides (and only provides):
 *   webcamStatus  — 'off' | 'loading' | 'ready' | 'denied' | 'unavailable'
 *                   | 'error' | 'model_failed'
 *   rawSamples    — array of the last MAX_SAMPLES detection objects
 *   webcamEnabled — boolean (consumer drives this)
 *   setWebcamEnabled — setter
 *
 * Each sample has the shape:
 *   { timestamp: number, faceDetected: boolean, detections: Detection[] }
 *
 * Does NOT expose:
 *   - presence ratios, stability scores, or any derived maths (Prompt 2)
 *   - any visible video element
 *   - tab-focus or network signals
 *
 * Design rules:
 *   • Camera never starts without explicit consent (toggle defaults OFF).
 *   • Model is loaded lazily — never on initial page load.
 *   • All mutable imperative state lives in refs so it never goes stale.
 *   • The single useEffect owns the full start/stop lifecycle so no helper
 *     function captures a stale closure.
 *   • The cleanup returned by useEffect is the canonical teardown path;
 *     toggling OFF simply flips `webcamEnabled` which re-runs the same effect.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const SAMPLE_INTERVAL_MS  = 1000;   // detection cadence (1s for snappy absence tracking)
const MAX_SAMPLES         = 8;      // ring-buffer size
const TINY_INPUT_SIZE     = 160;    // smallest/fastest TinyFaceDetector input
const SCORE_THRESHOLD     = 0.5;
const CDN_SCRIPT =
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/dist/face-api.min.js';
const CDN_MODEL_BASE =
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWebcamCapture() {
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [webcamStatus,  setWebcamStatus]  = useState('off');
  const [rawSamples,    setRawSamples]    = useState([]);
  const [mediaStream,   setMediaStream]   = useState(null);

  // All imperative handles live in refs — never trigger re-renders,
  // never go stale inside the effect.
  const streamRef       = useRef(null);   // MediaStream
  const videoRef        = useRef(null);   // hidden HTMLVideoElement
  const intervalRef     = useRef(null);   // setInterval handle
  const modelReadyRef   = useRef(false);  // true once tinyFaceDetector is loaded
  const cancelledRef    = useRef(false);  // lets async sequences abort cleanly

  // ── model loader (idempotent) ──────────────────────────────────────────────
  const loadFaceApi = useCallback(async () => {
    // 1. Script already injected by a previous call?
    if (window.faceapi && modelReadyRef.current) return true;

    try {
      // 2. Inject the script tag once.
      if (!window.faceapi) {
        await new Promise((resolve, reject) => {
          // Guard: another call may have injected it between the check and now.
          if (document.querySelector(`script[data-faceapi]`)) {
            // Wait for the script that's already in-flight.
            const existing = document.querySelector(`script[data-faceapi]`);
            existing.addEventListener('load',  resolve, { once: true });
            existing.addEventListener('error', reject,  { once: true });
            return;
          }
          const s = document.createElement('script');
          s.src              = CDN_SCRIPT;
          s.async            = true;
          s.dataset.faceapi  = '1';            // sentinel so we don't double-inject
          s.onload           = resolve;
          s.onerror          = reject;
          document.head.appendChild(s);
        });
      }

      // 3. Load TinyFaceDetector weights.
      await window.faceapi.nets.tinyFaceDetector.loadFromUri(CDN_MODEL_BASE);

      modelReadyRef.current = true;
      return true;

    } catch (err) {
      console.error('[useWebcamCapture] model load failed:', err);
      return false;
    }
  }, []);

  // ── full lifecycle effect ──────────────────────────────────────────────────
  useEffect(() => {
    if (!webcamEnabled) {
      // ── STOP PATH ─────────────────────────────────────────────────────────
      // Synchronous teardown — ensures camera light turns off immediately.

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
        // Remove from DOM if we appended it (it's always hidden)
        if (videoRef.current.parentNode) {
          videoRef.current.parentNode.removeChild(videoRef.current);
        }
        videoRef.current = null;
      }

      setRawSamples([]);
      setMediaStream(null);
      setWebcamStatus('off');
      return;   // no cleanup needed — we already cleaned up above
    }

    // ── START PATH ────────────────────────────────────────────────────────────
    cancelledRef.current = false;   // arm cancellation flag for this run

    let localInterval = null;       // kept in closure for cleanup

    async function start() {
      setWebcamStatus('loading');

      // 1. Load model.
      const modelOk = await loadFaceApi();
      if (cancelledRef.current) return;   // toggled OFF while model was loading

      if (!modelOk) {
        setWebcamStatus('model_failed');
        setWebcamEnabled(false);          // revert toggle
        return;
      }

      // 2. Request camera permission.
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        });
      } catch (err) {
        if (cancelledRef.current) return;
        console.error('[useWebcamCapture] getUserMedia error:', err);

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setWebcamStatus('denied');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setWebcamStatus('unavailable');
        } else {
          setWebcamStatus('error');
        }

        setWebcamEnabled(false);          // revert toggle
        return;
      }

      if (cancelledRef.current) {
        // toggled OFF while permission prompt was open — release tracks immediately
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;
      setMediaStream(stream);

      // 3. Create hidden video element (never shown to user).
      const video = document.createElement('video');
      video.muted      = true;
      video.autoplay   = true;
      video.playsInline = true;
      video.setAttribute('aria-hidden', 'true');
      video.setAttribute('data-webcam-capture', '1');  // sentinel for test harness
      // Keep it out of the visual layout but still in the DOM so face-api can
      // draw from it.
      video.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(video);
      videoRef.current  = video;
      video.srcObject   = stream;

      // 4. Wait for first frame metadata.
      await new Promise(resolve => {
        if (video.readyState >= 1) { resolve(); return; }
        video.addEventListener('loadedmetadata', resolve, { once: true });
      });
      if (cancelledRef.current) return;

      await video.play().catch(() => {});
      if (cancelledRef.current) return;

      setWebcamStatus('ready');

      // 5. Start sampling loop.
      localInterval = setInterval(async () => {
        // Guard: video or faceapi may be torn down between ticks.
        if (!videoRef.current || !window.faceapi || !modelReadyRef.current) return;
        if (videoRef.current.readyState < 2) return;  // HAVE_CURRENT_DATA

        try {
          const detections = await window.faceapi.detectAllFaces(
            videoRef.current,
            new window.faceapi.TinyFaceDetectorOptions({
              inputSize:       TINY_INPUT_SIZE,
              scoreThreshold:  SCORE_THRESHOLD,
            }),
          );

          const sample = {
            timestamp:    Date.now(),
            faceDetected: detections.length > 0,
            detections,                 // raw objects — derived maths come later
          };

          setRawSamples(prev => {
            const next = [...prev, sample];
            return next.length > MAX_SAMPLES
              ? next.slice(next.length - MAX_SAMPLES)
              : next;
          });

        } catch (err) {
          // Detection frame errors are non-fatal — log and skip this tick.
          console.warn('[useWebcamCapture] detection tick error:', err);
        }
      }, SAMPLE_INTERVAL_MS);

      intervalRef.current = localInterval;
    }

    start();

    // ── Cleanup (runs when webcamEnabled flips back to false, or on unmount) ─
    return () => {
      cancelledRef.current = true;

      if (localInterval) {
        clearInterval(localInterval);
        intervalRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setMediaStream(null);

      if (videoRef.current) {
        videoRef.current.srcObject = null;
        if (videoRef.current.parentNode) {
          videoRef.current.parentNode.removeChild(videoRef.current);
        }
        videoRef.current = null;
      }
    };
  }, [webcamEnabled, loadFaceApi]);

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    webcamEnabled,
    setWebcamEnabled,
    webcamStatus,
    rawSamples,
    mediaStream,
    // Convenience booleans consumed by the toggle UI
    isActive:  webcamStatus === 'ready',
    isLoading: webcamStatus === 'loading',
    hasError:  ['denied', 'unavailable', 'error', 'model_failed'].includes(webcamStatus),
  };
}
