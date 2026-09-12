/**
 * WebcamStatusBadge
 * ─────────────────────────────────────────────────────────────────────────────
 * Compact, non-interactive badge that shows the single most relevant webcam
 * state. Renders nothing when the camera is off and not skipped.
 *
 * Priority order (highest wins):
 *   error / model_failed → "Camera unavailable"
 *   denied              → "Camera access denied"
 *   unavailable         → "No camera detected"
 *   skipped             → "Learning without camera"
 *   loading             → "Starting camera…"
 *   ready + face absent → "Attention signal paused"
 *   ready + no tab      → "Attention signal paused"
 *   ready               → "Attention signals active"
 *   off                 → (hidden)
 *
 * Props:
 *   webcamStatus   string     — from useWebcam()
 *   facePresent    boolean    — latest sample's faceDetected
 *   tabFocused     boolean    — from useWebcam()
 *   webcamSkipped  boolean    — from useWebcam()
 *   presenceRatio  number     — 0–1 from useWebcam()
 *
 * Includes a (?) privacy tooltip on hover.
 */

import React, { useState } from 'react';
import * as I from 'lucide-react';

const PRIVACY_TIP =
  'Webcam signals are optional and processed entirely in your browser. ' +
  'No video frames are uploaded or stored anywhere.';

export function WebcamStatusBadge({
  webcamStatus,
  facePresent,
  tabFocused,
  webcamSkipped,
  presenceRatio,
}) {
  const [tip, setTip] = useState(false);

  // ── Decide which state to show ─────────────────────────────────────────────

  let variant   = null; // 'active' | 'paused' | 'neutral' | 'warn' | 'hidden'
  let icon      = null;
  let label     = null;

  if (webcamStatus === 'error' || webcamStatus === 'model_failed') {
    variant = 'warn';
    icon    = <I.CameraOff size={11} />;
    label   = 'Camera unavailable';
  } else if (webcamStatus === 'denied') {
    variant = 'neutral';
    icon    = <I.CameraOff size={11} />;
    label   = 'Camera access denied';
  } else if (webcamStatus === 'unavailable') {
    variant = 'neutral';
    icon    = <I.CameraOff size={11} />;
    label   = 'No camera detected';
  } else if (webcamSkipped) {
    variant = 'neutral';
    icon    = <I.Eye size={11} />;
    label   = 'Learning without camera';
  } else if (webcamStatus === 'loading') {
    variant = 'neutral';
    icon    = <I.Camera size={11} />;
    label   = 'Starting camera…';
  } else if (webcamStatus === 'ready') {
    const attentionPaused = !facePresent || !tabFocused;
    if (attentionPaused) {
      variant = 'paused';
      icon    = <I.Eye size={11} />;
      label   = 'Attention signal paused';
    } else {
      variant = 'active';
      icon    = <I.Eye size={11} />;
      label   = 'Attention signals active';
    }
  } else {
    // 'off' with no skip → render nothing
    return null;
  }

  // ── Style map ──────────────────────────────────────────────────────────────

  const styles = {
    active:  { bg: '#ecfdf5', border: '#a7f3d0', dot: '#10b981', text: '#065f46' },
    paused:  { bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b', text: '#92400e' },
    warn:    { bg: '#fff1f2', border: '#fecdd3', dot: '#e11d48', text: '#9f1239' },
    neutral: { bg: '#f1f5f9', border: '#e2e8f0', dot: '#94a3b8', text: '#475569' },
  };

  const s = styles[variant];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px 3px 5px',
        borderRadius: 99,
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.text,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        position: 'relative',
      }}
      aria-label={`Camera status: ${label}`}
    >
      {/* Pulsing dot */}
      <span style={{
        width: 7, height: 7, borderRadius: '50%', background: s.dot,
        flexShrink: 0,
        boxShadow: variant === 'active' ? `0 0 0 2px ${s.border}` : 'none',
        animation: variant === 'active' ? 'pulseGlow 2s infinite' : 'none',
      }} aria-hidden="true" />

      {/* Icon */}
      <span style={{ color: s.dot, flexShrink: 0 }} aria-hidden="true">
        {icon}
      </span>

      {/* Label */}
      {label}

      {/* Privacy (?) button */}
      <span
        role="button"
        tabIndex={0}
        aria-label="Camera privacy info"
        style={{ color: s.dot, cursor: 'default', opacity: 0.7, marginLeft: 1 }}
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
        onFocus={() => setTip(true)}
        onBlur={() => setTip(false)}
      >
        <I.Info size={10} />
      </span>

      {/* Tooltip */}
      {tip && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            right: 0,
            width: 230,
            background: '#1e293b',
            color: '#f1f5f9',
            fontSize: 11,
            lineHeight: 1.5,
            padding: '8px 11px',
            borderRadius: 10,
            pointerEvents: 'none',
            zIndex: 500,
            fontWeight: 400,
            boxShadow: '0 4px 20px rgba(0,0,0,.25)',
            whiteSpace: 'normal',
          }}
        >
          {PRIVACY_TIP}
        </span>
      )}
    </span>
  );
}
