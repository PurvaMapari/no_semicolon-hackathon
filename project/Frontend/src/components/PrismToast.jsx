/**
 * PrismToast
 * ─────────────────────────────────────────────────────────────────────────────
 * Premium floating alert system for PRISM.
 * Matches the reference screenshot: top-center/top-right of content area,
 * pill category badge, icon badge with pip, high contrast title, body,
 * and optional action buttons.
 */

import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';

// ─── Theme ────────────────────────────────────────────────────────────────────

const THEME = {
  success: {
    accent:      '#10b981',
    pillBg:      '#d1fae5',
    pillText:    '#065f46',
    iconBg:      '#ecfdf5',
    iconColor:   '#059669',
    iconBorder:  '#a7f3d0',
    title:       '#0f172a',
    body:        '#475569',
    bg:          '#ffffff',
    border:      '#6ee7b7',
    shadow:      '0 12px 36px rgba(15,23,42,0.16), 0 4px 12px rgba(16,185,129,0.12)',
    actionBg:    '#10b981',
    actionText:  '#ffffff',
  },
  warning: {
    accent:      '#f59e0b',
    pillBg:      '#fef3c7',
    pillText:    '#b45309',
    iconBg:      '#fffbeb',
    iconColor:   '#d97706',
    iconBorder:  '#fde68a',
    title:       '#0f172a',
    body:        '#475569',
    bg:          '#ffffff',
    border:      '#fde68a',
    shadow:      '0 12px 36px rgba(15,23,42,0.16), 0 4px 12px rgba(245,158,11,0.12)',
    actionBg:    '#f59e0b',
    actionText:  '#ffffff',
  },
  error: {
    accent:      '#e11d48',
    pillBg:      '#ffe4e6',
    pillText:    '#9f1239',
    iconBg:      '#fff1f2',
    iconColor:   '#e11d48',
    iconBorder:  '#fecdd3',
    title:       '#0f172a',
    body:        '#475569',
    bg:          '#ffffff',
    border:      '#fecdd3',
    shadow:      '0 12px 36px rgba(15,23,42,0.16), 0 4px 12px rgba(225,29,72,0.12)',
    actionBg:    '#e11d48',
    actionText:  '#ffffff',
  },
  info: {
    accent:      '#4f46e5',
    pillBg:      '#e0e7ff',
    pillText:    '#3730a3',
    iconBg:      '#eef2ff',
    iconColor:   '#4f46e5',
    iconBorder:  '#c7d2fe',
    title:       '#0f172a',
    body:        '#475569',
    bg:          '#ffffff',
    border:      '#c7d2fe',
    shadow:      '0 12px 36px rgba(15,23,42,0.16), 0 4px 12px rgba(79,70,229,0.12)',
    actionBg:    '#4f46e5',
    actionText:  '#ffffff',
  },
  neutral: {
    accent:      '#6366f1',
    pillBg:      '#ede9fe',
    pillText:    '#4c1d95',
    iconBg:      '#f5f3ff',
    iconColor:   '#6366f1',
    iconBorder:  '#ddd6fe',
    title:       '#0f172a',
    body:        '#475569',
    bg:          '#ffffff',
    border:      '#ddd6fe',
    shadow:      '0 12px 36px rgba(15,23,42,0.16), 0 4px 12px rgba(99,102,241,0.12)',
    actionBg:    '#6366f1',
    actionText:  '#ffffff',
  },
};

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((toast) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev.slice(-3), { id, variant: 'info', duration: 6000, ...toast }]);
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastCtx.Provider value={{ push, dismiss, toasts }}>
      {children}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>');
  return ctx;
}

// ─── Individual Alert Card ────────────────────────────────────────────────────

function ToastCard({ toast, onDismiss }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef(null);

  const startExit = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 280);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    console.log('[TOAST] rendered:', toast.title, `(${toast.id})`);
    if (toast.duration > 0) {
      timerRef.current = setTimeout(startExit, toast.duration);
    }
    return () => clearTimeout(timerRef.current);
  }, [toast.duration, toast.id, toast.title, startExit]);

  const t = THEME[toast.variant] || THEME.info;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        width: 350,
        maxWidth: 'calc(100vw - 32px)',
        background: t.bg,
        border: `1.5px solid ${t.border}`,
        borderRadius: 16,
        boxShadow: t.shadow,
        padding: '14px 16px',
        overflow: 'hidden',
        animation: exiting
          ? 'prismToastOut 0.28s cubic-bezier(0.4,0,1,1) forwards'
          : 'prismToastIn 0.32s cubic-bezier(0.16,1,0.3,1) forwards',
        cursor: 'default',
      }}
    >
      {/* Left Icon Square matching reference */}
      <div style={{
        position: 'relative',
        width: 40,
        height: 40,
        borderRadius: 12,
        background: t.iconBg,
        border: `1px solid ${t.iconBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: t.iconColor,
        marginTop: 2,
      }}>
        {toast.icon}
        {/* Warning Badge Pip */}
        {toast.variant === 'warning' && (
          <span style={{
            position: 'absolute',
            bottom: -3,
            right: -3,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#f59e0b',
            color: '#ffffff',
            fontSize: 9,
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #ffffff',
          }}>!</span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Category capsule pill */}
        {toast.category && (
          <div style={{
            display: 'inline-block',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: t.pillText,
            background: t.pillBg,
            borderRadius: 9999,
            padding: '2px 9px',
            marginBottom: 5,
          }}>
            {toast.category}
          </div>
        )}

        {/* Title */}
        <div style={{
          fontWeight: 800,
          fontSize: 14,
          color: t.title,
          lineHeight: 1.25,
          letterSpacing: '-0.01em',
        }}>
          {toast.title}
        </div>

        {/* Body */}
        {toast.body && (
          <div style={{
            fontSize: 12,
            color: t.body,
            marginTop: 4,
            lineHeight: 1.45,
          }}>
            {toast.body}
          </div>
        )}

        {/* Action buttons */}
        {toast.actions && toast.actions.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {toast.actions.map((action, i) => (
              <button
                key={i}
                onClick={() => { action.onClick(); startExit(); }}
                style={{
                  background: i === 0 ? t.actionBg : 'transparent',
                  color: i === 0 ? t.actionText : t.body,
                  border: i === 0 ? 'none' : `1px solid ${t.border}`,
                  borderRadius: 8,
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '-0.01em',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={startExit}
        aria-label="Dismiss notification"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#94a3b8',
          fontSize: 18,
          lineHeight: 1,
          padding: '2px 4px',
          fontWeight: 400,
          marginLeft: 4,
          marginTop: -2,
          borderRadius: 4,
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#475569'}
        onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
      >×</button>
    </div>
  );
}

// ─── Container — floating above content area ───────────────────────────────────

export function ToastContainer() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="PRISM notifications"
      style={{
        position: 'fixed',
        top: 24,
        right: 28,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'all' }}>
          <ToastCard toast={t} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  );
}
