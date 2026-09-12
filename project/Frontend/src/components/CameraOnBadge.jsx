/**
 * CameraOnBadge
 * ─────────────────────────────────────────────────────────────────────────────
 * Shown top-right of the lesson card ONLY when webcamStatus === 'ready'.
 * Renders a pulsing green dot + "Camera on" label.
 * Clicking it calls toggleCamera() to turn the camera off.
 *
 * When the camera is OFF / denied / error: renders nothing.
 * Never shows a video preview — the dot is a static status indicator only.
 *
 * Props:
 *   webcamStatus  string
 *   toggleCamera  () => void
 */

import React from 'react';

export function CameraOnBadge({ webcamStatus, toggleCamera }) {
  if (webcamStatus !== 'ready') return null;

  return (
    <button
      onClick={toggleCamera}
      title="Camera presence check active — click to turn off"
      aria-label="Camera on — click to disable"
      style={styles.badge}
    >
      <span style={styles.dot} aria-hidden="true" />
      Camera on
    </button>
  );
}

const styles = {
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 9px 3px 6px',
    borderRadius: 99,
    border: '1px solid #a7f3d0',
    background: '#ecfdf5',
    color: '#065f46',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    lineHeight: 1,
    transition: 'background 0.15s',
    whiteSpace: 'nowrap',
    // no box-shadow — keep it subtle
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#10b981',
    boxShadow: '0 0 0 2px rgba(16,185,129,0.25)',
    animation: 'pulseGlow 2s infinite',
    flexShrink: 0,
  },
};
