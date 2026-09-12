import React from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../store/useAppStore";
import "./ProgressPage.css";

/* ── helpers ─────────────────────────────────────────── */
function fmtDate(isoStr) {
  if (!isoStr) return "";
  return new Date(isoStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

function fmtMins(mins) {
  if (!mins) return "0 mins";
  if (mins < 60) return `${mins} min${mins !== 1 ? "s" : ""}`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/* ── Empty state ─────────────────────────────────────── */
function NoActivityState({ onGoLearn }) {
  return (
    <div className="pg-empty-wrap">
      <div className="pg-empty-icon">📊</div>
      <h2 className="pg-empty-title">No activity yet</h2>
      <p className="pg-empty-desc">
        Complete a learning session and practice questions to see your progress,
        analytics, and earned badges here.
      </p>
      <button className="pg-empty-btn" onClick={onGoLearn}>
        Start Learning →
      </button>
    </div>
  );
}

/* ── Main component ─────────────────────────────────── */
export default function ProgressPage() {
  const nav = useNavigate();
  const { activity, uploads, hasActivity, earnedBadges, preferences } = useAppStore();

  if (!hasActivity) {
    return (
      <div className="page">
        <NoActivityState onGoLearn={() => nav("/learn")} />
      </div>
    );
  }

  const lastSession = activity.sessions[0];
  const material = uploads[0];

  return (
    <div className="page">
      {/* Session complete badge */}
      <span className="pill pg-session-pill">⚙ Session Complete</span>

      {/* Session summary */}
      <div className="card pg-summary">
        <div className="pg-summary-icon">📄</div>
        <h1 className="pg-summary-title">
          {lastSession?.title ?? material?.name?.replace(/\.[^.]+$/, "") ?? "Session"}
        </h1>
        <p className="pg-summary-desc">
          Paced mastery session · {fmtDate(lastSession?.completedAt)}
        </p>
      </div>

      {/* Smart adaptation — only shown if rewrites happened */}
      {(lastSession?.rewrites > 0 || lastSession?.adaptations?.length > 0) && (
        <div className="card pg-adaptation">
          <span className="pill pg-adapt-pill">✣ Smart Adaptation Triggered &amp; Explained</span>
          <div className="pg-adapt-sub">Real-time Diagnostic</div>
          <div className="pg-adapt-body">
            <div className="blue pg-adapt-label">♧ Adaptive Rewire Diagnosis</div>
            <p className="pg-adapt-quote">
              {lastSession.adaptations?.length > 0
                ? lastSession.adaptations.join(" • ")
                : `${lastSession.rewrites} content rewrite${lastSession.rewrites !== 1 ? "s" : ""} applied during this session.`}
            </p>
          </div>
          <div className="pg-adapt-reason">
            ▥ &nbsp; Why this helped: Cognitive Load Reduction &nbsp; ⌄
          </div>
        </div>
      )}

      {/* Analytics */}
      <div className="pg-analytics-header">
        <h2 className="pg-analytics-title">Session Analytics</h2>
        <span className="pg-live">● Live Telemetry</span>
      </div>
      <div className="pg-analytics-grid">
        {[
          {
            icon: "↗",
            value: lastSession?.comprehensionGain > 0 ? `+${lastSession.comprehensionGain}%` : "—",
            label: "Comprehension Gain",
            meta: lastSession?.comprehensionGain > 0 ? "Based on practice score" : "Complete practice to measure",
            green: true,
          },
          {
            icon: "♧",
            value: activity.chunksCleared > 0 ? "Low" : "—",
            label: "Cognitive Fatigue",
            meta: "Paced Chunks applied",
            green: false,
          },
          {
            icon: "☷",
            value: activity.rewrites > 0 ? `${activity.rewrites} Rewire${activity.rewrites !== 1 ? "s" : ""}` : "0 Rewires",
            label: "Adaptations Done",
            meta: "Lexical & Audio",
            green: activity.rewrites > 0,
          },
          {
            icon: "◷",
            value: fmtMins(lastSession?.readingMins ?? 0),
            label: "Active Reading",
            meta: "This session",
            green: false,
          },
        ].map((s) => (
          <div key={s.label} className="card pg-stat-card">
            <div className="pg-stat-icon">{s.icon}</div>
            <b className="pg-stat-value" style={{ color: s.green ? "#087d5a" : "#202333" }}>
              {s.value}
            </b>
            <div className="pg-stat-label">{s.label}</div>
            <div className="pg-stat-meta">{s.meta}</div>
          </div>
        ))}
      </div>

      {/* Cached formats — static UI feature labels, no fake data */}
      <div className="card pg-cached">
        <div className="blue pg-cached-eyebrow">▤ Offline SQLite Storage</div>
        <div className="pg-cached-header">
          <h2 className="pg-cached-title">Cached Reading Formats</h2>
          <span className="pg-instant-switch">Instant<br />Switch</span>
        </div>
        <p className="pg-cached-desc">
          Synchronized representations are preserved locally for revision without
          network latency.
        </p>

        {uploads.length === 0 ? (
          <div className="pg-formats-empty">
            No documents cached yet — upload material to populate this section.
          </div>
        ) : (
          [
            { icon: "▤", label: "Standard Textbook Extract", meta: `${uploads[0]?.wordCount?.toLocaleString() ?? "—"} words`, status: "Baseline", active: false },
            { icon: "♧", label: "Metaphorical Rewire", meta: preferences.cognitiveMode !== null ? "Active mode selected" : "No mode selected", status: preferences.cognitiveMode !== null ? "Used" : "Ready", active: preferences.cognitiveMode !== null },
            { icon: "A", label: "Dyslexia Lexical Format", meta: preferences.controls["Dyslexic Letterforms"] ? "Active" : "Off", status: "Ready", active: false },
            { icon: "♧", label: "Audio-First Script", meta: preferences.controls["Web Speech Pacing"] ? "Active" : "Off", status: "Ready", active: false },
          ].map((f) => (
            <div key={f.label} className={`pg-format ${f.active ? "pg-format--active" : ""}`}>
              <div
                className="pg-format-icon"
                style={{ background: f.active ? "#2941c8" : "#e0e2f1", color: f.active ? "#fff" : "#555" }}
              >
                {f.icon}
              </div>
              <div className="pg-format-info">
                <b className="pg-format-label" style={{ color: f.active ? "#2842c6" : "#202333" }}>
                  {f.label}
                </b>
                <div className="pg-format-meta">{f.meta}</div>
              </div>
              <span
                className="pill pg-format-status"
                style={{
                  background: f.status === "Ready" ? "#8fefc2" : "#e2e4f6",
                  color: f.status === "Used" ? "#2942c7" : "#4e5265",
                }}
              >
                {f.status}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Session history */}
      {activity.sessions.length > 1 && (
        <>
          <h2 className="pg-next-title">Session History</h2>
          {activity.sessions.slice(0, 5).map((s) => (
            <div key={s.id} className="pg-next-btn">
              <span className="pg-next-icon" style={{ background: "#f0f1ff" }}>📄</span>
              <span className="pg-next-info">
                <b className="pg-next-label">{s.title}</b>
                <span className="pg-next-meta">
                  {fmtDate(s.completedAt)} · {fmtMins(s.readingMins)}
                  {s.comprehensionGain > 0 ? ` · +${s.comprehensionGain}% gain` : ""}
                </span>
              </span>
            </div>
          ))}
        </>
      )}

      {/* Badges earned */}
      {earnedBadges.length > 0 && (
        <>
          <h2 className="pg-next-title">Earned Badges</h2>
          <div className="pg-badges-row">
            {earnedBadges.map((b) => (
              <div key={b.id} className="card pg-badge-mini" style={{ background: b.color, border: 0 }}>
                <span className="pg-badge-icon">{b.icon}</span>
                <span className="pg-badge-name">{b.name}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Next steps */}
      <h2 className="pg-next-title">Next Steps &amp; Continuity</h2>
      <button
        className="pg-next-btn pg-next-btn--primary"
        onClick={() => nav("/upload")}
      >
        <span className="pg-next-icon" style={{ background: "#3854d3" }}>→</span>
        <span className="pg-next-info">
          <b className="pg-next-label">Upload New Material</b>
          <span className="pg-next-meta">Start your next learning session</span>
        </span>
        <b className="pg-next-arrow">▷</b>
      </button>

      <button className="pg-next-btn" onClick={() => nav("/learn")}>
        <span className="pg-next-icon" style={{ background: "#f0f1ff" }}>📖</span>
        <span className="pg-next-info">
          <b className="pg-next-label">Continue Current Session</b>
          <span className="pg-next-meta">
            {uploads[0] ? uploads[0].name.replace(/\.[^.]+$/, "") : "No active session"}
          </span>
        </span>
        <b className="pg-next-arrow">›</b>
      </button>
    </div>
  );
}
