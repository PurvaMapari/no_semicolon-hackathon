import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore, COGNITIVE_MODES } from "../../store/useAppStore";
import "./DashboardPage.css";

export default function DashboardPage() {
  const nav = useNavigate();
  const { preferences, setPreferences } = useAppStore();

  // Initialise selection from saved preference; fall back to 0
  const [selected, setSelected] = useState(
    preferences.cognitiveMode !== null ? preferences.cognitiveMode : 0
  );

  function handleTransform() {
    setPreferences({ cognitiveMode: selected });
    nav("/learn");
  }

  return (
    <div className="page">
      {/* Step progress */}
      <div className="db-steps-row">
        <b className="db-step-label">Step 3 of 3</b>
        <span className="db-step-sub">Profile</span>
      </div>
      <div className="db-stepper">
        {["1. Upload", "2. Extracted", "3. Profile"].map((s, i) => (
          <div key={s} className={`db-step ${i <= 2 ? "db-step--active" : ""}`}>
            {s}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="db-header-row">
        <b className="db-header-title">
          Learner Profile{" "}
          <span className="db-header-count">{COGNITIVE_MODES.length}</span>
        </b>
        <span className="db-customize">Customize</span>
      </div>
      <p className="db-header-desc">
        Pick the cognitive visual scaffolding that matches your brain today.
      </p>

      {/* Profile cards — driven entirely by COGNITIVE_MODES catalogue */}
      <div className="db-cards">
        {COGNITIVE_MODES.map((p, i) => (
          <div
            key={p.name}
            className={`card db-card ${selected === i ? "db-card--active" : ""}`}
            onClick={() => setSelected(i)}
          >
            <div className="db-card-inner">
              <div className={`db-radio ${selected === i ? "db-radio--on" : ""}`} />
              <div className="db-card-body">
                <div className="db-card-top">
                  <b className={`db-card-name ${selected === i ? "db-card-name--blue" : ""}`}>
                    {p.name}
                  </b>
                  {p.badge && (
                    <span
                      className="pill"
                      style={{
                        background: p.badge.color,
                        color: p.badge.text,
                        fontSize: 8,
                        padding: "3px 7px",
                      }}
                    >
                      {p.badge.label}
                    </span>
                  )}
                </div>
                <p className="db-card-desc">{p.desc}</p>
                <div className="db-card-tags">
                  {p.tags.map((t, ti) => (
                    <span
                      key={t}
                      className="pill db-tag"
                      style={{
                        background:
                          p.name === "Cognitive Load Support" && ti === 1
                            ? "#91efc3"
                            : "#e9ebff",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Groq banner */}
      <div className="db-groq-banner">
        <b>⚡ Groq Adaptive Engine v3.4 Ready</b>
        <div className="db-groq-sub">
          Pre-cached variants: Simplified, Real-life Metaphors, Audio in SQLite
        </div>
      </div>

      <button className="db-transform-btn" onClick={handleTransform}>
        ✦ &nbsp; Transform &amp; Adapt with Groq Intelligence
      </button>

      <div className="db-footer">
        Zero data retained for training • Instant offline fallbacks supported
      </div>
    </div>
  );
}
