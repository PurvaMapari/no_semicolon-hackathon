import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as I from "lucide-react";
import { useSession } from "../../context/SessionContext";
import { Layout } from "../../components/Layout/Layout";
import { computeSessionStruggleScore } from "../../engine/signals";
import "./ProgressPage.css";

function computeXP({ questionsAnswered, chunksCompleted, sectionsMastered }) {
  return (questionsAnswered * 10) + (chunksCompleted * 15) + (sectionsMastered * 50);
}

// Triangular level scale: level N costs N×100 XP (so L2=100, L3=300, L4=600…)
function xpToLevel(totalXP) {
  let xp = totalXP;
  let level = 1;
  while (xp >= level * 100) { xp -= level * 100; level++; }
  return { level, xpInLevel: xp, xpForNext: level * 100 };
}

/* ── Expressive Mascot Face Icons for Struggle Tiers ─────────── */
function StruggleFaceIcon({ tierKey, color, size = 16 }) {
  if (tierKey === "smooth_sailing") {
    // Calm, half-closed-eyes "chill" face (zen smile)
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill={`${color}18`} />
        {/* Zen happy curved eyes */}
        <path d="M 6.5 10.5 Q 8.5 8, 10.5 10.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M 13.5 10.5 Q 15.5 8, 17.5 10.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
        {/* Chill smile */}
        <path d="M 8.5 14.5 Q 12 17.5, 15.5 14.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (tierKey === "some_friction") {
    // Furrowed brow, thinking face
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill={`${color}18`} />
        {/* Thinking brows: one raised, one furrowed */}
        <path d="M 6.5 7.5 L 10.5 8.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M 13.5 8.5 L 17.5 6.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        {/* Curious dot eyes */}
        <circle cx="8.5" cy="11" r="1.5" fill={color} />
        <circle cx="15.5" cy="11" r="1.5" fill={color} />
        {/* Thoughtful line mouth */}
        <path d="M 9 15.5 Q 12 14, 15 15.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (tierKey === "struggling") {
    // Sweating / strained face
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill={`${color}18`} />
        {/* Strained squinting eyes */}
        <path d="M 7 12 L 10 10 L 7 8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 17 12 L 14 10 L 17 8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {/* Sweat drop on brow */}
        <path d="M 19 3.5 C 19 3.5, 17 6, 17 7.5 C 17 8.6, 17.9 9.5, 19 9.5 C 20.1 9.5, 21 8.6, 21 7.5 C 21 6, 19 3.5, 19 3.5 Z" fill="#0284c7" stroke="#0284c7" strokeWidth="0.8" />
        {/* Wavy nervous mouth */}
        <path d="M 8.5 15.5 Q 10.5 17.5, 12 15.5 Q 13.5 13.5, 15.5 15.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (tierKey === "high_strain") {
    // Wide-eyed overwhelmed face
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill={`${color}18`} />
        {/* Wide overwhelmed eyes */}
        <circle cx="8" cy="9.5" r="3" stroke={color} strokeWidth="1.6" fill="#ffffff" />
        <circle cx="8" cy="9.5" r="1.2" fill={color} />
        <circle cx="16" cy="9.5" r="3" stroke={color} strokeWidth="1.6" fill="#ffffff" />
        <circle cx="16" cy="9.5" r="1.2" fill={color} />
        {/* Open 'o' overwhelmed mouth */}
        <ellipse cx="12" cy="16" rx="2.8" ry="2.4" stroke={color} strokeWidth="2" fill={`${color}25`} />
        {/* Stress sparks */}
        <path d="M 6 4 L 7.5 5.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M 18 4 L 16.5 5.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  // "not_started" / default: sleepy neutral dot-eyed face
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill={`${color}18`} />
      {/* Sleepy resting horizontal eyes */}
      <path d="M 6.5 10.5 L 10.5 10.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M 13.5 10.5 L 17.5 10.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Calm neutral line mouth */}
      <path d="M 9.5 15 L 14.5 15" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ── Struggle Score Tier Helper ───────────────────────────────────────────── */
function getStruggleTier(score, isTransformed = true) {
  if (!isTransformed) {
    return {
      key: "not_started",
      name: "Not started",
      color: "#6b7280",
      bg: "#f3f4f6",
      border: "#e5e7eb",
    };
  }

  const pct = (score || 0) * 100;
  if (pct >= 80) {
    return {
      key: "high_strain",
      name: "High Strain",
      color: "#dc2626",
      bg: "#fef2f2",
      border: "#fecaca",
    };
  } else if (pct >= 60) {
    return {
      key: "struggling",
      name: "Struggling",
      color: "#ea580c",
      bg: "#fff7ed",
      border: "#fed7aa",
    };
  } else if (pct >= 30) {
    return {
      key: "some_friction",
      name: "Some Friction",
      color: "#d97706",
      bg: "#fffbeb",
      border: "#fde68a",
    };
  } else {
    return {
      key: "smooth_sailing",
      name: "Smooth Sailing",
      color: "#16a34a",
      bg: "#f0fdf4",
      border: "#bbf7d0",
    };
  }
}

/* ── Gamified HUD Cognitive Mood Helper ──────────────────────── */
function getCognitiveMood(score = 0, isTransformed = true) {
  if (!isTransformed) {
    return {
      label: "CALM",
      emoji: "🧘",
      color: "#1f5e63",
      glow: "rgba(252, 224, 114, 0.45)",
    };
  }

  const pct = (score || 0) * 100;
  if (pct >= 80) {
    return {
      label: "STRAIN",
      emoji: "🔥",
      color: "#dc2626",
      glow: "rgba(220, 38, 38, 0.55)",
    };
  } else if (pct >= 60) {
    return {
      label: "STRUGGLING",
      emoji: "😅",
      color: "#ea580c",
      glow: "rgba(234, 88, 12, 0.5)",
    };
  } else if (pct >= 35) {
    return {
      label: "FOCUS",
      emoji: "🎯",
      color: "#d97706",
      glow: "rgba(217, 119, 6, 0.45)",
    };
  } else {
    return {
      label: "CALM",
      emoji: "🧘",
      color: "#1f5e63",
      glow: "rgba(252, 224, 114, 0.45)",
    };
  }
}

/* ── Reactive Mascot Orb ─────────────────────────────────────── */
function ReactiveOrb({ struggleScore = 0 }) {
  const isHighStruggle = struggleScore >= 0.7;
  const isMediumStruggle = struggleScore >= 0.35 && struggleScore < 0.7;
  const mood = isHighStruggle ? "tense" : isMediumStruggle ? "alert" : "calm";

  return (
    <div
      className={`reactive-orb-container reactive-orb--${mood}`}
      title={`Cognitive State: ${mood === "tense" ? "High Strain" : mood === "alert" ? "Focusing" : "Calm & In the Zone"}`}
    >
      <svg className="reactive-orb-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="orb-grad-calm" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fce072" />
            <stop offset="50%" stopColor="#1f5e63" />
            <stop offset="100%" stopColor="#fbbf24" />
          </radialGradient>
          <radialGradient id="orb-grad-alert" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="50%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </radialGradient>
          <radialGradient id="orb-grad-tense" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fca5a5" />
            <stop offset="50%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#991b1b" />
          </radialGradient>
        </defs>

        {/* Ambient aura */}
        <circle cx="50" cy="50" r="32" className="orb-aura" />

        {/* Dynamic morphing blob */}
        {isHighStruggle ? (
          <path
            d="M 50 16 C 68 14, 82 26, 84 44 C 86 60, 74 76, 58 82 C 42 88, 24 82, 18 64 C 12 48, 20 28, 34 20 Z"
            fill="url(#orb-grad-tense)"
            className="orb-blob"
          />
        ) : isMediumStruggle ? (
          <path
            d="M 50 18 C 66 18, 78 30, 78 48 C 78 66, 64 78, 48 78 C 32 78, 22 66, 22 48 C 22 30, 34 18, 50 18 Z"
            fill="url(#orb-grad-alert)"
            className="orb-blob"
          />
        ) : (
          <path
            d="M 50 20 C 66 20, 78 32, 78 50 C 78 68, 64 80, 50 80 C 34 80, 22 68, 22 50 C 22 32, 34 20, 50 20 Z"
            fill="url(#orb-grad-calm)"
            className="orb-blob"
          />
        )}

        {/* Mascot eye sparkles */}
        <circle cx="43" cy="47" r="2.5" fill="#ffffff" opacity="0.9" />
        <circle cx="57" cy="47" r="2.5" fill="#ffffff" opacity="0.9" />
      </svg>
    </div>
  );
}

/* ── Struggle Slider Face SVGs ────────────────────────────── */
function SliderFace({ tierKey, size = 44 }) {
  // All faces: soft round head, increasingly sad/discouraged expression
  // Never angry — droopy eyes/mouth, not furrowed brows
  const s = size;
  const half = s / 2;
  const eyeY = half - 3;
  const mouthY = half + 7;

  if (tierKey === "smooth_sailing") {
    // 😊 Content calm smiling face
    return (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <circle cx="22" cy="22" r="20" fill="#dcfce7" stroke="#16a34a" strokeWidth="2" />
        {/* Happy eyes - slight upward curve */}
        <path d="M13 18 Q15 15, 17 18" stroke="#15803d" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M27 18 Q29 15, 31 18" stroke="#15803d" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Eye sparkles */}
        <circle cx="15" cy="17" r="1" fill="#15803d" />
        <circle cx="29" cy="17" r="1" fill="#15803d" />
        {/* Cheerful smile */}
        <path d="M15 27 Q22 34, 29 27" stroke="#15803d" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Rosy cheeks */}
        <circle cx="12" cy="25" r="3" fill="#bbf7d0" opacity="0.7" />
        <circle cx="32" cy="25" r="3" fill="#bbf7d0" opacity="0.7" />
      </svg>
    );
  }

  if (tierKey === "some_friction") {
    // 🙂 Slightly neutral/content — mild concern creeping in
    return (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <circle cx="22" cy="22" r="20" fill="#fef9c3" stroke="#d97706" strokeWidth="2" />
        {/* Neutral round eyes */}
        <circle cx="15" cy="19" r="2.5" fill="#92400e" />
        <circle cx="29" cy="19" r="2.5" fill="#92400e" />
        {/* Inner eye highlight */}
        <circle cx="16" cy="18" r="0.8" fill="#ffffff" />
        <circle cx="30" cy="18" r="0.8" fill="#ffffff" />
        {/* Flat/slightly upturned mouth */}
        <path d="M16 28 Q22 30, 28 28" stroke="#92400e" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        {/* Mild brow furrow (gentle, not angry) */}
        <path d="M12 14 Q15 13, 18 14.5" stroke="#b45309" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        <path d="M26 14.5 Q29 13, 32 14" stroke="#b45309" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      </svg>
    );
  }

  if (tierKey === "struggling") {
    // 🙁 Worried/downturned — subtle sadness, droopy
    return (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <circle cx="22" cy="22" r="20" fill="#ffedd5" stroke="#ea580c" strokeWidth="2" />
        {/* Worried round eyes — slightly larger, looking down */}
        <ellipse cx="15" cy="19" rx="2.8" ry="3" fill="#9a3412" />
        <ellipse cx="29" cy="19" rx="2.8" ry="3" fill="#9a3412" />
        <circle cx="16" cy="18.5" r="0.9" fill="#ffffff" />
        <circle cx="30" cy="18.5" r="0.9" fill="#ffffff" />
        {/* Worried brows — inner ends raised */}
        <path d="M11 14 Q14.5 11.5, 18 13.5" stroke="#c2410c" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M26 13.5 Q29.5 11.5, 33 14" stroke="#c2410c" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        {/* Subtle frown — turned down at edges */}
        <path d="M15 29 Q22 25, 29 29" stroke="#9a3412" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Sweat drop */}
        <ellipse cx="34" cy="14" rx="1.5" ry="2.2" fill="#fce072" opacity="0.8" />
      </svg>
    );
  }

  // high_strain or default: 😔 Sad, droopy-eyed, downcast
  return (
    <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
      <circle cx="22" cy="22" r="20" fill="#fef2f2" stroke="#991b1b" strokeWidth="2" />
      {/* Sad droopy eyes — half-lidded, looking down */}
      <ellipse cx="15" cy="20" rx="3" ry="2.5" fill="#7f1d1d" />
      <ellipse cx="29" cy="20" rx="3" ry="2.5" fill="#7f1d1d" />
      {/* Heavy eyelids drooping over top of eyes */}
      <path d="M11.5 19 Q15 17, 18.5 19" stroke="#991b1b" strokeWidth="1.8" strokeLinecap="round" fill="#fef2f2" />
      <path d="M25.5 19 Q29 17, 32.5 19" stroke="#991b1b" strokeWidth="1.8" strokeLinecap="round" fill="#fef2f2" />
      <circle cx="14" cy="19.5" r="0.7" fill="#ffffff" opacity="0.6" />
      <circle cx="28" cy="19.5" r="0.7" fill="#ffffff" opacity="0.6" />
      {/* Sad eyebrows — drooping at outer edges */}
      <path d="M11 15 Q14 13.5, 18 15.5" stroke="#991b1b" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M26 15.5 Q30 13.5, 33 15" stroke="#991b1b" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Deep frown — downcast sadness */}
      <path d="M14 31 Q22 26, 30 31" stroke="#7f1d1d" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Tear drop */}
      <ellipse cx="12" cy="25" rx="1.3" ry="2" fill="#fce072" opacity="0.8" />
    </svg>
  );
}

/* ── Struggle Slider (replaces HeartbeatLine) ───────────────── */
function HeartbeatLine({ struggleScore = 0, isTransformed = false }) {
  const [animPct, setAnimPct] = React.useState(0);

  const pct = Math.round((struggleScore || 0) * 100);
  const targetPct = Math.max(3, Math.min(97, pct));

  // Animate slider from 0 → target on mount/change with silky smooth quartic ease-out
  React.useEffect(() => {
    if (!isTransformed) return;

    let animId = null;
    let start = null;
    const duration = 1200;

    setAnimPct(0);

    const step = (ts) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      // Quartic ease-out for organic, butter-smooth deceleration
      const eased = 1 - Math.pow(1 - t, 4);
      setAnimPct(eased * targetPct);
      if (t < 1) animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => { if (animId) cancelAnimationFrame(animId); };
  }, [isTransformed, targetPct]);

  if (!isTransformed) {
    return (
      <div className="slider-track-card slider-track-card--idle">
        <div className="slider-track-rail">
          <div className="slider-track-empty" />
        </div>
        <span className="slider-idle-label">Waiting for lesson telemetry…</span>
      </div>
    );
  }

  const tier = getStruggleTier(struggleScore);
  const color = tier.color;

  return (
    <div
      className={`slider-track-card ${struggleScore >= 0.8 ? "slider-track-card--strained" : ""}`}
      style={{
        borderColor: struggleScore >= 0.8 ? "#fca5a5" : undefined,
        backgroundColor: struggleScore >= 0.8 ? "#fff5f5" : undefined,
      }}
    >
      {/* Track rail */}
      <div className="slider-track-rail">
        {/* Filled portion behind marker */}
        <div
          className="slider-track-filled"
          style={{
            width: `${animPct}%`,
            background: `linear-gradient(90deg, ${color}50, ${color})`,
          }}
        />
        {/* Empty portion ahead */}
        <div
          className="slider-track-empty"
          style={{ left: `${animPct}%`, width: `${100 - animPct}%` }}
        />
      </div>

      {/* Emoji face marker */}
      <div
        className="slider-face-marker"
        style={{ left: `${animPct}%` }}
      >
        {/* % label above the face */}
        <div
          className="slider-face-label"
          style={{
            color: color,
            background: `${color}14`,
            borderColor: `${color}35`,
          }}
        >
          {pct}%
        </div>
        {/* The actual face */}
        <div className="slider-face-circle">
          <SliderFace tierKey={tier.key} size={44} />
        </div>
      </div>
    </div>
  );
}


/* ── Mastery Ring ─────────────────────────────────────────────────────────── */
const MASTERY_LEGEND = [
  { color: "#1f5e63", strokeColor: "#1f5e63", bg: "#dfeae5", label: "Getting Started" },
  { color: "#713f12", strokeColor: "#fce072", bg: "#fef9c3", border: "1px solid #fce072", label: "Building Momentum" },
  { color: "#34D399", strokeColor: "#34D399", bg: "#d1fae5", label: "Almost Mastered" },
  { color: "#FBBF24", strokeColor: "#FBBF24", bg: "#fef3c7", label: "Mastered" },
];

function MasteryRing({ masteryPct = 0, xpTotal = 0, struggleScore = 0 }) {
  const SIZE = 160;
  const STROKE = 14;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;

  // Local animation progress (0 -> 1) resetting on every mount
  const [animFraction, setAnimFraction] = React.useState(0);

  React.useEffect(() => {
    let animId = null;
    let startTime = null;
    const duration = 1200; // ~1200ms silky ease-out fill on mount

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(1, elapsed / duration);
      // Ease-out quart for smooth deceleration without sudden stop
      const eased = 1 - Math.pow(1 - t, 4);
      setAnimFraction(eased);

      if (t < 1) {
        animId = requestAnimationFrame(step);
      }
    };

    setAnimFraction(0);
    animId = requestAnimationFrame(step);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [masteryPct, xpTotal]);

  const currentMastery = (masteryPct || 0) * animFraction;
  const filled = (currentMastery / 100) * CIRC;

  const tier =
    masteryPct >= 100 ? MASTERY_LEGEND[3] :
      masteryPct >= 70 ? MASTERY_LEGEND[2] :
        masteryPct >= 40 ? MASTERY_LEGEND[1] :
          MASTERY_LEGEND[0];

  const { level, xpInLevel, xpForNext } = xpToLevel(xpTotal);
  const xpBarPct = Math.min(100, Math.round((xpInLevel / xpForNext) * 100));
  const currentXpBarPct = xpBarPct * animFraction;
  const currentXpTotal = Math.round(xpTotal * animFraction);
  const currentXpInLevel = Math.round(xpInLevel * animFraction);

  // +XP toast: compare to localStorage-cached previous value (frontend-only)
  const [toast, setToast] = React.useState(null);
  React.useEffect(() => {
    const CACHE_KEY = "adaptlearn_last_xp";
    const prev = parseInt(localStorage.getItem(CACHE_KEY) || "0", 10);
    const diff = xpTotal - prev;
    if (diff > 0) setToast(`+${diff} XP`);
    localStorage.setItem(CACHE_KEY, String(xpTotal));
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mastery-ring-wrap">
      {toast && <div className="mastery-xp-toast">{toast}</div>}

      <div className={`mastery-ring-svg-wrap${masteryPct >= 100 && animFraction >= 0.9 ? " mastery-ring--gold" : ""}`}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mastery-ring-svg" style={{ width: "100%", height: "100%", shapeRendering: "geometricPrecision" }}>
          {/* Track */}
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none" stroke="#E5E7EB" strokeWidth={STROKE} />
          {/* Filled arc */}
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none"
            stroke={tier.strokeColor || tier.color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={CIRC - filled}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            className="mastery-ring-arc"
          />
        </svg>
        <div className="mastery-ring-center">
          <span className="mastery-ring-level">Lvl {level}</span>
          <span className="mastery-ring-xp">{currentXpTotal.toLocaleString()} XP</span>
          <span className="mastery-ring-pct">{Math.round(currentMastery)}%</span>
        </div>
      </div>

      {/* XP progress bar to next level */}
      <div className="mastery-xp-bar-wrap">
        <div className="mastery-xp-bar-label">
          <span>{currentXpInLevel.toLocaleString()} / {xpForNext.toLocaleString()} XP</span>
          <span>to Level {level + 1}</span>
        </div>
        <div className="progressbar mastery-xp-bar-track">
          <div className="progressfill mastery-xp-bar-fill"
            style={{ width: `${currentXpBarPct}%` }} />
        </div>
      </div>

      {/* Tier legend */}
      <div className="mastery-legend">
        {MASTERY_LEGEND.map((l) => (
          <span key={l.label} className="mastery-legend-pill"
            style={{ background: l.bg, color: l.color, border: l.border || "none" }}>
            <span className="mastery-legend-dot" style={{ background: l.strokeColor || l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProgressStats({ chunks, qAnswered, mastered }) {
  const [animFraction, setAnimFraction] = React.useState(0);

  React.useEffect(() => {
    let animId = null;
    let startTime = null;
    const duration = 1000;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setAnimFraction(eased);

      if (t < 1) {
        animId = requestAnimationFrame(step);
      }
    };

    setAnimFraction(0);
    animId = requestAnimationFrame(step);
    return () => { if (animId) cancelAnimationFrame(animId); };
  }, [chunks, qAnswered, mastered]);

  const formatAnimatedChunks = (chunksStr, fraction) => {
    if (typeof chunksStr === "string" && chunksStr.includes("/")) {
      const parts = chunksStr.split("/").map((s) => s.trim());
      const current = parseInt(parts[0], 10);
      const total = parts[1];
      if (!isNaN(current)) {
        return `${Math.round(current * fraction)} / ${total}`;
      }
    }
    return chunksStr;
  };

  const animQAnswered = Math.round((Number(qAnswered) || 0) * animFraction);
  const animMastered = Math.round((Number(mastered) || 0) * animFraction);

  const stats = [
    {
      id: "chunks",
      title: "Learning Chunks",
      value: formatAnimatedChunks(chunks, animFraction),
      icon: I.Layers,
      color: "#1f5e63",
      bgColor: "#dfeae5",
      borderColor: "#a9c4b2",
    },
    {
      id: "questions",
      title: "Questions Answered",
      value: animQAnswered,
      icon: I.HelpCircle,
      color: "#0284c7",
      bgColor: "#e0f2fe",
      borderColor: "#bae6fd",
    },
    {
      id: "mastered",
      title: "Sections Mastered",
      value: animMastered,
      icon: I.Trophy,
      color: "#d97706",
      bgColor: "#fef3c7",
      borderColor: "#fde68a",
    },
  ];

  return (
    <div className="progress-stats-grid">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.id} className="progress-stat-card">
            <div
              className="progress-stat-icon-wrap"
              style={{
                background: stat.bgColor,
                color: stat.color,
                borderColor: stat.borderColor,
              }}
            >
              <Icon size={24} />
            </div>
            <div className="progress-stat-info">
              <b className="progress-stat-value">{stat.value}</b>
              <span className="progress-stat-label">{stat.title}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Progress() {
  const { session } = useSession();
  const transformed = Boolean(session.transformed);

  // Single authoritative source of truth for struggle score derived directly from session activity
  const struggleScore = transformed ? computeSessionStruggleScore(session) : 0;

  // Sections & chunk counts
  const sections = Array.isArray(session.transformed?.sections)
    ? session.transformed.sections
    : Array.isArray(session.transformed?.chunks)
      ? session.transformed.chunks
      : transformed
        ? [session.text]
        : [];
  const totalSections = sections.length || (transformed ? 1 : 0);
  const completedSectionsCount = session.completedSections?.length || session.completed || 0;

  // Quiz / Practice stats
  const answeredList = session.practiceReport?.answered || [];
  const totalAnswered = answeredList.length;
  const correctCount = answeredList.filter((a) => a.is_correct || a.correct).length;
  const currentScorePct = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : null;
  const mastered = session.practiceReport?.masteredSections?.length || 0;

  // XP & Mastery calculation
  const xpTotal = computeXP({
    questionsAnswered: totalAnswered,
    chunksCompleted: completedSectionsCount,
    sectionsMastered: mastered,
  });

  const completionRatio = Math.min(1, completedSectionsCount / totalSections);
  const currentScoreRatio = totalAnswered > 0 ? correctCount / totalAnswered : null;
  const performanceRatio = currentScoreRatio !== null ? currentScoreRatio : (completionRatio > 0 ? 0.85 : 0);
  const strugglePenalty = struggleScore * 0.25;

  let rawProgress = 0;
  if (totalAnswered > 0) {
    rawProgress = (completionRatio * 0.35 + performanceRatio * 0.65) * (1 - strugglePenalty);
  } else if (completionRatio > 0) {
    rawProgress = completionRatio * 0.7 * (1 - strugglePenalty);
  } else {
    rawProgress = 0;
  }
  const masteryPct = totalSections > 0 ? Math.min(100, Math.max(0, Math.round(rawProgress * 100))) : 0;

  const history = session.sessionMeta.adaptationHistory || [];
  const latestOutcome = session.latestOutcome;

  return (
    <Layout section="Progress">
      <main className="page progress-page">
        {/* Section 1: Header */}
        <div className="animate-stagger-1">
          <div className="eyebrow">
            <b>Session Progress</b>
            <span>{session.fileName || "No lesson loaded"}</span>
          </div>
          <div className="progress-header-row">
            <h1 className="page-title" style={{ margin: 0 }}>Your learning session</h1>
            {(() => {
              const moodInfo = getCognitiveMood(struggleScore, transformed);
              return (
                <span
                  className="hud-mood-label"
                  style={{
                    color: moodInfo.color,
                    textShadow: `0 0 12px ${moodInfo.glow}`,
                  }}
                >
                  <span className="hud-mood-emoji">{moodInfo.emoji}</span>
                  <span>{moodInfo.label}</span>
                </span>
              );
            })()}
          </div>
        </div>

        {/* Section 2: Mastery Ring */}
        <div className="animate-stagger-2">
          <MasteryRing
            masteryPct={masteryPct}
            xpTotal={xpTotal}
            struggleScore={struggleScore}
          />
        </div>

        {/* Section 3: Progress Stats */}
        <div className="animate-stagger-3">
          <ProgressStats
            chunks={`${completedSectionsCount} / ${totalSections}`}
            qAnswered={totalAnswered}
            mastered={mastered}
          />
        </div>

        {/* Section 4: SCALE Engine Cognitive Telemetry Card */}
        <section className="card scale-telemetry-card animate-stagger-4">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="pill" style={{ background: "#fef9c3", color: "#713f12", border: "1px solid #fce072" }}>
              <I.Activity size={13} color="#713f12" /> SCALE Cognitive Telemetry
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
              Variant Level: {session.sessionMeta.currentVariantLevel}
            </span>
          </div>

          {/* Current Struggle Score Section */}
          <div style={{ marginTop: "clamp(4px, 0.8vh, 10px)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Current Struggle Score</span>
              {/* Status Pill */}
              {(() => {
                const tier = getStruggleTier(struggleScore, transformed);
                const isStrained = transformed && struggleScore >= 0.8;
                return (
                  <span
                    className={`struggle-status-pill ${isStrained ? "struggle-status-pulse" : ""}`}
                    style={{
                      background: tier.bg,
                      color: tier.color,
                      border: `1px solid ${tier.border}`,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 10px 3px 7px",
                      borderRadius: 20,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.2s ease",
                    }}
                  >
                    <StruggleFaceIcon tierKey={tier.key} color={tier.color} size={17} />
                    {tier.name}
                  </span>
                );
              })()}
            </div>

            {/* Heartbeat EKG Telemetry Line */}
            <HeartbeatLine struggleScore={struggleScore} isTransformed={transformed} />

            {/* Score Readout with Tier Color & Current Score */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, fontSize: 12, fontWeight: 700 }}>
              <span style={{ color: getStruggleTier(struggleScore, transformed).color }}>
                {transformed ? `Struggle: ${(struggleScore * 100).toFixed(0)}% / 100%` : "Not started"}
              </span>
              {transformed && currentScorePct !== null && (
                <span style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>
                  Current Score:{" "}
                  <b style={{ color: currentScorePct >= 70 ? "#16a34a" : currentScorePct >= 50 ? "#d97706" : "#dc2626" }}>
                    {currentScorePct}%
                  </b>{" "}
                  ({correctCount}/{totalAnswered} correct)
                </span>
              )}
            </div>
          </div>

          {/* Total Adaptations & Latest Outcome Delta */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(6px, 1vw, 10px)", marginTop: "clamp(6px, 0.8vh, 10px)" }}>
            {/* Total Adaptations */}
            <div style={{ background: "#f3f1eb", padding: "clamp(6px, 0.8vh, 10px) clamp(10px, 1vw, 14px)", borderRadius: 12, border: "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 15 }}>🛡️</span>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontWeight: 800 }}>
                  Total Adaptations
                </div>
              </div>
              <div style={{ fontSize: "clamp(16px, 1.8vw, 20px)", fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-heading)" }}>
                {session.sessionMeta.totalAdaptations}
              </div>
            </div>

            {/* Latest Outcome Delta */}
            <div style={{ background: "#f3f1eb", padding: "clamp(6px, 0.8vh, 10px) clamp(10px, 1vw, 14px)", borderRadius: 12, border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontWeight: 800, marginBottom: 2 }}>
                Latest Outcome Delta
              </div>
              <div style={{ fontSize: "clamp(16px, 1.8vw, 20px)", fontWeight: 800, fontFamily: "var(--font-heading)", display: "flex", alignItems: "baseline", gap: 4 }}>
                {latestOutcome ? (
                  <>
                    <span style={{ color: latestOutcome.outcomeDelta > 0 ? "#16a34a" : "#dc2626" }}>
                      {latestOutcome.outcomeDelta > 0 ? "▲" : "▼"}
                    </span>
                    <span style={{ color: latestOutcome.outcomeDelta > 0 ? "#16a34a" : "#dc2626" }}>
                      {latestOutcome.outcomeDelta > 0 ? "+" : ""}{((latestOutcome.outcomeDelta || 1) * 100).toFixed(0)}%
                    </span>
                  </>
                ) : (
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>N/A</span>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}



export default Progress;
export { Progress };
