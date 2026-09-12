import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../store/useAppStore";
import "./LearnPage.css";

/* ── Empty state when no material has been uploaded ─── */
function NoMaterialState({ onGoUpload }) {
  return (
    <div className="ln-empty-wrap">
      <div className="ln-empty-icon">📚</div>
      <h2 className="ln-empty-title">No learning material yet</h2>
      <p className="ln-empty-desc">
        Upload a document or paste text first, then come back here to start
        your session.
      </p>
      <button className="ln-empty-btn" onClick={onGoUpload}>
        Go to Upload →
      </button>
    </div>
  );
}

/* ── Main component ─────────────────────────────────── */
export default function LearnPage() {
  const nav = useNavigate();
  const {
    uploads,
    preferences,
    activity,
    startSession,
    currentSession,
    recordDwell,
  } = useAppStore();

  const [playing, setPlaying] = useState(false);

  // Pick the most recent upload as the active material
  const material = uploads[0] ?? null;

  // Start a session automatically when material exists and none is active
  useEffect(() => {
    if (material && !currentSession) {
      startSession(material.id, material.name, material.chunks ?? 1);
    }
  }, [material?.id]); // eslint-disable-line

  // Track dwell time while on this page
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") recordDwell(5);
    }, 5000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line

  if (!material) {
    return (
      <div className="page">
        <NoMaterialState onGoUpload={() => nav("/upload")} />
      </div>
    );
  }

  const activeMode = preferences.cognitiveMode !== null ? preferences.cognitiveMode : null;
  const dyslexiaOn = preferences.controls["Dyslexic Letterforms"] ?? false;
  const chunkIndex = currentSession?.chunkIndex ?? 1;
  const totalChunks = currentSession?.totalChunks ?? material.chunks ?? 1;
  const progressPct = Math.round((chunkIndex / totalChunks) * 100);

  return (
    <div className="page">
      {/* Dwell calibration bar */}
      <div className="ln-dwell-bar">
        <span className="ln-dwell-dot">●</span>
        &nbsp; Calibrating dwell time &amp; focus cues
        {dyslexiaOn && (
          <span className="ln-dyslexia-badge">Dyslexia Mode Active</span>
        )}
      </div>

      {/* Chunk label — driven by session state */}
      <div className="ln-chunk-row">
        <b className="blue ln-chunk-label">
          CHUNK {chunkIndex} OF {totalChunks}
        </b>
        <span className="ln-read-time">
          ~{Math.max(1, Math.round(((material.wordCount ?? 300) / totalChunks) / 238))} min read
        </span>
      </div>

      {/* Title from uploaded material name */}
      <h1 className="ln-title">{material.name.replace(/\.[^.]+$/, "")}</h1>

      {/* Progress bar */}
      <div className="progressbar ln-progress">
        <div className="ln-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Text controls */}
      <div className="card ln-text-controls">
        <b className="ln-text-label">Text:</b>
        {["A−", "A+", "A♢ Dyslexic Font", "▥ Ruler"].map((x, i) => (
          <button
            key={x}
            className={`ln-text-btn ${dyslexiaOn && i === 2 ? "ln-text-btn--active" : ""}`}
          >
            {x}
          </button>
        ))}
      </div>

      {/* Audio player */}
      <div className="ln-audio-player">
        <div className="ln-audio-header">
          <div>
            <b className="ln-audio-title">♧ &nbsp; Calm Assist Voice</b>
            <div className="ln-audio-sub">Web Speech API • Humanist tone</div>
          </div>
          <button className="ln-speed-btn" onClick={() => setPlaying(!playing)}>
            {playing ? "◼" : "◉"} 1.0x
          </button>
        </div>
        <div className="ln-audio-controls">
          <button className="ln-play-btn" onClick={() => setPlaying(!playing)}>
            {playing ? "Ⅱ" : "▶"}
          </button>
          <div className="ln-waveform">▮▮▮▮▮▮▮▮▮</div>
        </div>
        <div className="ln-seek-track">
          <div className="ln-seek-fill" style={{ width: playing ? "43%" : "0%" }} />
        </div>
        <div className="ln-seek-times">
          <span>00:00</span>
          <span>--:--</span>
        </div>
      </div>

      {/* Content card */}
      <div className="card ln-content-card">
        <div className="ln-principle-tag">▤ Key Structural Principle</div>

        {/* Placeholder content block — backend will supply real chunk text */}
        <div className="ln-no-content">
          <div className="ln-no-content-icon">📄</div>
          <p className="ln-no-content-text">
            Chunk {chunkIndex} of <b>{material.name.replace(/\.[^.]+$/, "")}</b> will
            appear here once the Groq engine processes your document.
          </p>
          <p className="ln-no-content-sub">
            Connect the backend to enable real-time adaptive content delivery.
          </p>
        </div>

        {/* Bottom actions */}
        <div className="ln-card-actions">
          <button className="ln-ask-btn">♧ Ask Assistant</button>
          <button className="ln-flag-btn">⚑</button>
          <button
            className="ln-test-btn"
            onClick={() => nav("/practice")}
          >
            Test Chunk {chunkIndex} →
          </button>
        </div>
      </div>
    </div>
  );
}
