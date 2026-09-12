import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../store/useAppStore";
import "./PracticePage.css";

/* XP awarded per correct answer */
const XP_PER_CORRECT = 10;

/* ── Empty state ─────────────────────────────────────── */
function NoSessionState({ onGoLearn }) {
  return (
    <div className="pc-empty-wrap">
      <div className="pc-empty-icon">🎯</div>
      <h2 className="pc-empty-title">No active session</h2>
      <p className="pc-empty-desc">
        Start a learning session first, then return here to test your understanding.
      </p>
      <button className="pc-empty-btn" onClick={onGoLearn}>
        Go to Learn →
      </button>
    </div>
  );
}

/* ── Main component ─────────────────────────────────── */
export default function PracticePage() {
  const nav = useNavigate();
  const {
    uploads,
    currentSession,
    preferences,
    activity,
    completeQuestion,
    completeSession,
  } = useAppStore();

  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [dwellSecs, setDwellSecs] = useState(0);

  const material = uploads[0] ?? null;
  const session = currentSession;

  // Simulate dwell tracking so shield can trigger
  React.useEffect(() => {
    if (submitted) return;
    const t = setInterval(() => setDwellSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [submitted]);

  const shieldActive = dwellSecs >= 45;
  const masteryRequired = [1, 2, 3][preferences.masteryLevel ?? 1];

  function handleSubmit() {
    if (!selected) return;
    setSubmitted(true);
    completeQuestion(XP_PER_CORRECT);
  }

  function handleContinue() {
    // Record completed session with real data
    completeSession({
      title: material?.name?.replace(/\.[^.]+$/, "") ?? "Session",
      comprehensionGain: 20,             // placeholder until backend scoring
      readingMins: Math.round((session?.dwellSeconds ?? 60) / 60),
      rewrites: session?.rewrites ?? 0,
      adaptations: shieldActive ? ["Struggle Shield activated"] : [],
    });
    nav("/progress");
  }

  if (!material || !session) {
    return (
      <div className="page">
        <NoSessionState onGoLearn={() => nav("/learn")} />
      </div>
    );
  }

  const chunkIndex = session.chunkIndex ?? 1;
  const totalChunks = session.totalChunks ?? 1;
  const progressPct = Math.round((chunkIndex / (masteryRequired * totalChunks)) * 50);

  return (
    <div className="page">
      {/* Top meta row */}
      <div className="pc-meta-row">
        <span className="pill pc-chunk-pill">
          ❔ Chunk {chunkIndex} • Step 1/{masteryRequired}
        </span>
        <span className="pill pc-xp-pill">⚡ +{XP_PER_CORRECT} XP Earnable</span>
      </div>

      {/* Progress bar */}
      <div className="progressbar pc-progress">
        <div className="progressfill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Mastery gate banner */}
      <div className="pc-mastery-gate">
        ▰ &nbsp; Mastery Gate Active: Complete {masteryRequired}{" "}
        {masteryRequired === 1 ? "question" : "questions"} accurately to unlock
        Chunk {chunkIndex + 1}. Skipping is locked until mastered.
      </div>

      {/* Question placeholder — real questions come from backend */}
      <div className="card pc-question-card">
        <div className="pc-concept-row">
          <span className="pc-concept-tag">
            Chunk {chunkIndex}<br />Comprehension
          </span>
          <button className="pc-listen-btn">🔊 Listen</button>
        </div>

        <div className="pc-question-placeholder">
          <div className="pc-qp-icon">🔗</div>
          <h2 className="pc-qp-title">Question ready to load</h2>
          <p className="pc-qp-desc">
            Connect the Groq backend to receive adaptive questions for{" "}
            <b>{material.name.replace(/\.[^.]+$/, "")}</b>, Chunk {chunkIndex}.
          </p>
          <p className="pc-qp-desc" style={{ marginTop: 6 }}>
            For now, tap any option below to simulate answering.
          </p>
        </div>

        {/* Simulated options */}
        <div className="pc-options">
          {["A", "B", "C", "D"].map((key) => (
            <button
              key={key}
              onClick={() => !submitted && setSelected(key)}
              className={`pc-option ${selected === key ? "pc-option--selected" : ""}`}
            >
              <span className={`pc-option-key ${selected === key ? "pc-option-key--selected" : ""}`}>
                {selected === key ? "✓" : key}
              </span>
              <span className="pc-option-text">
                Option {key} — answer will appear once backend is connected.
                {selected === key && (
                  <small className="pc-option-note">◉ Selected</small>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Hint / relisten */}
        <div className="pc-helper-row">
          <button className="pc-hint-btn">💡 Hint</button>
          <button className="pc-relisten-btn">↻ Re-listen Audio</button>
        </div>

        {/* Memory cue placeholder */}
        <div className="pc-memory-cue">
          <b>⚙ Gentle Memory Cue:</b>
          <br />
          Memory cues will be generated by the Groq engine based on your
          document content.
        </div>
      </div>

      {/* Adaptive Coach Shield — shown after 45 s dwell */}
      {shieldActive && (
        <div className="pc-shield">
          <div className="pc-shield-header">
            <div>
              <b className="pc-shield-title">🧠 Adaptive Coach Shield</b>
              <div className="pc-shield-sub">Active struggle detection</div>
            </div>
            <span className="pill pc-shield-pill">• Shielded</span>
          </div>
          <div className="pc-shield-message">
            "You've been on this question for a while — no worries! Adaptive Shield
            activated: no XP penalty on this check."
          </div>
          <div className="pc-shield-stats">
            {[
              ["Dwell Time", `${dwellSecs}s`],
              ["Re-reads", `${session.rereads ?? 0}`],
              ["Heart Shield", "Safe 🛡️"],
            ].map(([label, val]) => (
              <div key={label} className="pc-shield-stat">
                <div className="pc-stat-label">{label}</div>
                <b className="pc-stat-val" style={{ color: label === "Heart Shield" ? "#079968" : "#22264c" }}>
                  {val}
                </b>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit button */}
      {!submitted && (
        <button
          className={`pc-submit-btn ${!selected ? "pc-submit-btn--disabled" : ""}`}
          onClick={handleSubmit}
          disabled={!selected}
        >
          Submit Answer
        </button>
      )}

      {/* Success / continue */}
      {submitted && (
        <div className="pc-success">
          <div className="pc-success-row">
            <div className="pc-success-icon">✓</div>
            <div>
              <b className="pc-success-title">Nice work! 🎉</b>
              <div className="pc-success-sub">+{XP_PER_CORRECT} XP gained · Chunk recorded!</div>
            </div>
            <span className="pc-success-audio">🔊</span>
          </div>
          <button className="pc-continue-btn" onClick={handleContinue}>
            CONTINUE 🚀
          </button>
          <div className="pc-skip-notice">
            🔒 Skipping disabled by Mastery Gate — learn with confidence!
          </div>
        </div>
      )}
    </div>
  );
}
