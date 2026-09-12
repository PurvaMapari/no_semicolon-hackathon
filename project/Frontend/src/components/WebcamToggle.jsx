/**
 * WebcamToggle
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure presentational toggle for the webcam presence-detection feature.
 * Now includes an (i) privacy tooltip and accepts toggleCamera in addition to
 * the raw setWebcamEnabled so callers can use either API.
 *
 * Props:
 *   webcamEnabled    boolean
 *   setWebcamEnabled (enabled: boolean) => void   ← direct setter (optional)
 *   toggleCamera     () => void                   ← convenience wrapper (optional)
 *   webcamStatus     string
 *   isLoading        boolean
 *   hasError         boolean
 *
 * At least one of setWebcamEnabled or toggleCamera must be provided.
 */

import React, { useState } from 'react';

const STATUS_MESSAGES = {
  denied:       'Camera access denied — continuing without it.',
  unavailable:  'No camera available — continuing without it.',
  error:        'Camera initialization failed — continuing without it.',
  model_failed: 'Face detection model failed to load — continuing without it.',
};

const PRIVACY_TOOLTIP =
  'Used only to check if you\'re at the screen. ' +
  'No video is stored or sent anywhere.';

export function WebcamToggle({
  webcamEnabled,
  setWebcamEnabled,
  toggleCamera,
  webcamStatus,
  isLoading,
  hasError,
}) {
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // Accept either toggleCamera or setWebcamEnabled — prefer toggleCamera
  function handleToggle() {
    if (isLoading) return;
    if (toggleCamera) {
      toggleCamera();
    } else if (setWebcamEnabled) {
      setWebcamEnabled(!webcamEnabled);
    }
  }

  return (
    <div style={styles.wrap} className="webcam-toggle-wrap">

      {/* ── Row: icon + label + (i) + toggle ── */}
      <div style={styles.row}>
        {/* Camera icon */}
        <span style={styles.iconCircle} aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.2"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 7l-7 5 7 5V7z"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        </span>

        {/* Label text */}
        <span style={styles.labelGroup}>
          <span style={styles.labelRow}>
            <span style={styles.labelMain}>Enable camera check?</span>

            {/* (i) Privacy info button */}
            <span
              style={styles.infoBtn}
              role="button"
              tabIndex={0}
              aria-label="Camera privacy information"
              onMouseEnter={() => setTooltipVisible(true)}
              onMouseLeave={() => setTooltipVisible(false)}
              onFocus={() => setTooltipVisible(true)}
              onBlur={() => setTooltipVisible(false)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2.5"
                   strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>

              {/* Tooltip */}
              {tooltipVisible && (
                <span style={styles.tooltip} role="tooltip">
                  {PRIVACY_TOOLTIP}
                </span>
              )}
            </span>
          </span>

          <span style={styles.labelSub}>
            optional — helps detect if you're at the screen
          </span>
        </span>

        {/* Toggle switch */}
        <span
          role="switch"
          aria-checked={webcamEnabled}
          aria-label="Enable camera presence check"
          style={{
            ...styles.track,
            ...(webcamEnabled ? styles.trackOn  : {}),
            ...(isLoading     ? styles.trackDisabled : {}),
          }}
          onClick={handleToggle}
          onKeyDown={e => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              handleToggle();
            }
          }}
          tabIndex={0}
        >
          <span style={{
            ...styles.knob,
            ...(webcamEnabled ? styles.knobOn : {}),
          }} />
        </span>
      </div>

      {/* ── Loading notice ── */}
      {isLoading && (
        <p style={styles.notice} role="status">
          <span style={styles.spinner} aria-hidden="true">●</span>
          Initializing camera check…
        </p>
      )}

      {/* ── Error / denied notice (non-blocking) ── */}
      {hasError && STATUS_MESSAGES[webcamStatus] && (
        <p style={styles.errorNotice} role="alert">
          {STATUS_MESSAGES[webcamStatus]}
        </p>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  wrap: {
    padding: '12px 0 4px',
    backgroundColor: 'transparent',
  },

  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    userSelect: 'none',
  },

  iconCircle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    borderRadius: '50%',
    background: '#ede9fe',
    color: '#1f5e63',
    flexShrink: 0,
  },

  labelGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    minWidth: 0,
  },

  labelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },

  labelMain: {
    fontSize: 12,
    fontWeight: 600,
    color: '#1e1b4b',
    lineHeight: 1.3,
  },

  labelSub: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 1.3,
  },

  // ── (i) info button ──
  infoBtn: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    cursor: 'default',
    flexShrink: 0,
    outline: 'none',
  },

  tooltip: {
    position: 'absolute',
    bottom: 'calc(100% + 6px)',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 210,
    background: '#1e293b',
    color: '#e8e6df',
    fontSize: 11,
    lineHeight: 1.5,
    padding: '7px 10px',
    borderRadius: 8,
    pointerEvents: 'none',
    zIndex: 300,
    whiteSpace: 'normal',
    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
  },

  // ── toggle track ──
  track: {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    width: 40,
    height: 22,
    borderRadius: 11,
    background: '#cbd5e1',
    padding: '0 2px',
    transition: 'background 0.2s',
    outline: 'none',
    cursor: 'pointer',
  },

  trackOn: {
    background: '#1f5e63',
  },

  trackDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },

  knob: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,.22)',
    transition: 'transform 0.2s',
    transform: 'translateX(0)',
    flexShrink: 0,
  },

  knobOn: {
    transform: 'translateX(18px)',
  },

  // ── status notices ──
  notice: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: '5px 10px',
    borderRadius: 7,
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    fontSize: 11,
    color: '#1e40af',
    lineHeight: 1.5,
  },

  spinner: {
    display: 'inline-block',
    animation: 'prism-pulse 1.4s ease-in-out infinite',
    color: '#60a5fa',
  },

  errorNotice: {
    marginTop: 8,
    padding: '5px 10px',
    borderRadius: 7,
    background: '#fefce8',
    border: '1px solid #fde68a',
    fontSize: 11,
    color: '#92400e',
    lineHeight: 1.5,
  },
};
