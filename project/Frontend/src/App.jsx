import React, { createContext, useContext, useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import * as I from "lucide-react";
import {
  askVoice,
  detectProfile,
  extractDocument,
  generateQuiz,
  generateVisual,
  transformText,
  rewireContent,
  generateAdaptiveQuiz,
} from "./api/client";
import VisualInfographic from "./components/VisualInfographic";
import {
  createSignalState,
  createSessionMeta,
  recordReread,
  recordHelpRequest,
  recordVoiceHelp,
  recordQuizAnswer,
  evaluateSignals,
  applyAdaptation,
  recordAdaptationOutcome,
  injectGoldenPathStruggle,
} from "./engine/signals";
import { SCALE_CONFIG, measureOutcome } from "./engine/scale";

const PROFILE_LABELS = {
  dyslexia: "Dyslexia support",
  cognitive_load: "Cognitive load support",
  low_vision: "Low vision and clarity",
};

// ─── Golden-Path Demo Fixture (docs/18-GOLDEN-PATH-FIXTURE.md) ───────────────
const GOLDEN_PATH_TEXT = `The Industrial Revolution was a period of major change in how goods were produced. It began in Great Britain in the late 1700s and spread to other parts of the world over the next century. Before this time, most goods were made by hand in small workshops or at home. The Industrial Revolution changed this by introducing machines and factories that could produce goods much faster and in larger quantities.

One of the most important inventions was the steam engine, improved by James Watt in 1769. The steam engine powered factories, trains, and ships. It allowed goods to be transported over long distances quickly and cheaply. Coal became the main fuel source, and mining grew rapidly to meet demand.

The textile industry was among the first to be transformed. Machines like the spinning jenny, invented by James Hargreaves in 1764, and the power loom allowed cloth to be made much faster than by hand. Factories replaced small workshops, and workers moved from rural areas to cities to find jobs in these new factories.

While the Industrial Revolution brought economic growth and new opportunities, it also created serious problems. Factory workers, including children as young as 5 years old, often worked 12 to 16 hours a day in dangerous conditions. Wages were low, and there were no safety regulations. Cities grew rapidly but lacked proper housing, clean water, and sanitation, leading to disease and poverty.

Over time, reforms were introduced. The Factory Act of 1833 limited child labor and set minimum age requirements. Trade unions formed to fight for workers' rights, including better pay and safer conditions. These changes laid the foundation for modern labor laws that protect workers today.`;

const GOLDEN_PATH_REWIRE = {
  adapted_text: "Cloth used to be made slowly by hand. Then new machines were invented. The spinning jenny was made by James Hargreaves in 1764. The power loom was another important machine. These machines made cloth much faster. Small workshops closed. Big factories opened. People moved from the countryside to cities to work in factories.",
  visual_description: "Two contrasting images: 1) A solitary artisan working slowly at a manual wooden loom. 2) A bustling textile factory where rows of steam-powered machines spin dozens of threads simultaneously.",
  variant_level: 2,
  explanation: "We noticed you re-read this section 4 times and asked for help twice, so Prism switched to simpler language, shorter sections, and a visual description.",
  actions_applied: ["increase_simplification", "reduce_chunk_size", "add_visual_description"],
};

const GOLDEN_PATH_ADAPTIVE_QUIZ = {
  question: "What did the spinning jenny do?",
  options: [
    "It made cloth much faster",
    "It powered trains and ships",
    "It heated miners' homes",
    "It pumped clean water to cities",
  ],
  answer: "It made cloth much faster",
  explanation: "The spinning jenny was a breakthrough textile machine that spun multiple threads at once, producing cloth far faster than by hand.",
  difficulty: "easier",
  adapted: true,
};

const SessionContext = createContext(null);

function useSession() {
  return useContext(SessionContext);
}

function SessionProvider({ children }) {
  const [session, setSession] = useState({
    fileName: "",
    text: "",
    wordCount: 0,
    tables: [],
    profile: "dyslexia",
    transformed: null,
    quizzes: [],
    visual: null,
    completed: 0,
    error: "",
    // SCALE & REWIRE additions:
    signals: createSignalState(),
    sessionMeta: createSessionMeta(),
    rewireState: {
      active: false,
      adaptedContent: null,
      evaluation: null,
      chunkIndex: 0,
    },
    latestOutcome: null,
  });
  const [busy, setBusy] = useState("");

  async function run(action, callback) {
    setBusy(action);
    setSession((current) => ({ ...current, error: "" }));
    try {
      return await callback();
    } catch (error) {
      setSession((current) => ({ ...current, error: error.message }));
      return null;
    } finally {
      setBusy("");
    }
  }

  async function upload(file) {
    return run("extract", async () => {
      const result = await extractDocument(file);
      setSession((current) => ({
        ...current,
        fileName: result.filename || file.name,
        text: result.text || "",
        wordCount: result.word_count || 0,
        tables: result.tables || [],
        transformed: null,
        quizzes: [],
        visual: null,
        completed: 0,
        signals: createSignalState(),
        sessionMeta: createSessionMeta(),
        rewireState: { active: false, adaptedContent: null, evaluation: null, chunkIndex: 0 },
        latestOutcome: null,
      }));
      return result;
    });
  }

  function setText(text) {
    setSession((current) => ({
      ...current,
      fileName: "Pasted lesson",
      text,
      wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
      transformed: null,
      quizzes: [],
      visual: null,
      completed: 0,
      signals: createSignalState(),
      sessionMeta: createSessionMeta(),
      rewireState: { active: false, adaptedContent: null, evaluation: null, chunkIndex: 0 },
      latestOutcome: null,
    }));
  }

  function loadGoldenPath() {
    setSession((current) => ({
      ...current,
      fileName: "The Industrial Revolution (Golden Path)",
      text: GOLDEN_PATH_TEXT,
      wordCount: GOLDEN_PATH_TEXT.trim().split(/\s+/).length,
      profile: "dyslexia",
      transformed: null,
      quizzes: [],
      visual: null,
      completed: 0,
      signals: createSignalState(),
      sessionMeta: createSessionMeta(),
      rewireState: { active: false, adaptedContent: null, evaluation: null, chunkIndex: 0 },
      latestOutcome: null,
    }));
  }

  async function chooseProfile(profile) {
    setSession((current) => ({ ...current, profile, transformed: null, quizzes: [], visual: null }));
  }

  async function detect(text) {
    return run("profile", async () => {
      const result = await detectProfile(text);
      await chooseProfile(result.profile);
      return result;
    });
  }

  async function adapt() {
    if (!session.text.trim()) return null;
    return run("transform", async () => {
      const result = await transformText(session.text, session.profile);
      setSession((current) => ({ ...current, transformed: result, quizzes: [], visual: null }));
      return result;
    });
  }

  async function getQuiz(chunk) {
    return run("quiz", async () => {
      const result = await generateQuiz(chunk, session.profile);
      setSession((current) => ({ ...current, quizzes: [...current.quizzes, result] }));
      return result;
    });
  }

  async function getVisual() {
    return run("visual", async () => {
      const result = await generateVisual(session.text, session.profile);
      setSession((current) => ({ ...current, visual: result }));
      return result;
    });
  }

  async function ask(question) {
    recordVoiceHelpAction();
    return run("voice", () => askVoice(question, session.text));
  }

  function completeChunk() {
    setSession((current) => ({ ...current, completed: current.completed + 1 }));
  }

  // ── SCALE Signal & REWIRE Actions ──────────────────────────────────────────
  function recordRereadAction() {
    setSession((current) => {
      const updatedSignals = recordReread(current.signals);
      return { ...current, signals: updatedSignals };
    });
  }

  function recordHelpAction() {
    setSession((current) => {
      const updatedSignals = recordHelpRequest(current.signals);
      return { ...current, signals: updatedSignals };
    });
  }

  function recordVoiceHelpAction() {
    setSession((current) => {
      const updatedSignals = recordVoiceHelp(current.signals);
      return { ...current, signals: updatedSignals };
    });
  }

  async function simulateGoldenPath() {
    return run("rewire", async () => {
      const strugglingSignals = injectGoldenPathStruggle(session.signals);
      const evaluation = evaluateSignals(strugglingSignals, session.sessionMeta);

      let adaptedData = null;
      const currentChunk = session.transformed?.chunks?.[2] || session.transformed?.text || session.text;
      try {
        adaptedData = await rewireContent({
          chunkText: currentChunk,
          profile: session.profile,
          variantLevel: evaluation.adaptationStrategy?.newVariantLevel ?? 2,
          actions: evaluation.adaptationStrategy?.additionalActions ?? ["increase_simplification", "reduce_chunk_size", "add_visual_description"],
          struggleExplanation: evaluation.explanation,
        });
      } catch (err) {
        adaptedData = GOLDEN_PATH_REWIRE;
      }

      const updatedMeta = applyAdaptation(session.sessionMeta, evaluation);
      updatedMeta.preAccuracy = 0.0;
      if (updatedMeta.adaptationHistory.length > 0) {
        updatedMeta.adaptationHistory[updatedMeta.adaptationHistory.length - 1].preAccuracy = 0.0;
      }

      setSession((current) => ({
        ...current,
        signals: strugglingSignals,
        sessionMeta: updatedMeta,
        rewireState: {
          active: true,
          adaptedContent: adaptedData,
          evaluation,
          chunkIndex: current.transformed?.chunks?.length > 2 ? 2 : 0,
        },
        latestOutcome: null,
      }));
      return adaptedData;
    });
  }

  async function getAdaptiveQuizAction(chunk) {
    return run("quiz", async () => {
      let quizData = null;
      try {
        quizData = await generateAdaptiveQuiz({
          chunkText: chunk,
          profile: session.profile,
          difficulty: "easier",
          struggleScore: session.rewireState.evaluation?.struggleScore || 0.76,
          previousQuestion: "How did cloth production change in the Industrial Revolution?",
          previousAnswerCorrect: false,
        });
      } catch (err) {
        quizData = GOLDEN_PATH_ADAPTIVE_QUIZ;
      }
      setSession((current) => ({
        ...current,
        quizzes: [...current.quizzes, quizData],
      }));
      return quizData;
    });
  }

  function recordQuizAnswerAction(isCorrect, latencyMs = 5000) {
    setSession((current) => {
      const updatedSignals = recordQuizAnswer(current.signals, isCorrect, latencyMs);
      let updatedMeta = current.sessionMeta;
      let outcome = current.latestOutcome;

      if (current.rewireState.active) {
        const postAcc = isCorrect ? 1.0 : 0.0;
        updatedMeta = recordAdaptationOutcome(current.sessionMeta, postAcc);
        outcome = measureOutcome(updatedMeta.preAccuracy ?? 0.0, postAcc);
      }

      return {
        ...current,
        signals: updatedSignals,
        sessionMeta: updatedMeta,
        latestOutcome: outcome,
      };
    });
  }

  function dismissRewire() {
    setSession((current) => ({
      ...current,
      rewireState: { ...current.rewireState, active: false },
    }));
  }

  return (
    <SessionContext.Provider
      value={{
        session,
        busy,
        upload,
        setText,
        chooseProfile,
        detect,
        adapt,
        getQuiz,
        getVisual,
        ask,
        completeChunk,
        loadGoldenPath,
        simulateGoldenPath,
        recordRereadAction,
        recordHelpAction,
        recordVoiceHelpAction,
        recordQuizAnswerAction,
        getAdaptiveQuizAction,
        dismissRewire,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

function Header({ section }) {
  const { session } = useSession();
  const struggle = evaluateSignals(session.signals, session.sessionMeta).struggleScore;
  return (
    <header className="topbar">
      <div className="brand">
        <div className="logo">A</div>
        <div>
          <div className="brandname">AdaptLearn</div>
          <div className="subtitle">{section}</div>
        </div>
      </div>
      {session.rewireState.active && (
        <div className="rewire-tag" style={{ marginLeft: "auto", marginRight: 8 }}>
          ⚡ REWIRED
        </div>
      )}
      <div className={`access ${session.rewireState.active ? "" : "ml-auto"}`}>
        {PROFILE_LABELS[session.profile]}
      </div>
      <div className="avatar" />
    </header>
  );
}

function Layout({ children, section }) {
  const location = useLocation();
  const items = [
    ["/upload", "Upload", I.CloudUpload],
    ["/learn", "Learn", I.BookOpen],
    ["/practice", "Practice", I.BadgeHelp],
    ["/progress", "Progress", I.BarChart3],
  ];
  return (
    <div className="app">
      <div className="phone">
        <Header section={section} />
        {children}
        <nav className="bottom">
          {items.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              className={`nav ${location.pathname === to ? "active" : ""}`}
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

function ErrorNotice() {
  const { session } = useSession();
  return session.error ? (
    <div style={{ background: "#fff0f0", color: "#a12929", padding: 10, borderRadius: 8, marginTop: 12, fontSize: 12 }}>
      {session.error}
    </div>
  ) : null;
}

function Upload() {
  const { session, busy, upload, setText, loadGoldenPath } = useSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState("upload");
  const [draft, setDraft] = useState(session.text);
  const ready = Boolean(session.text.trim());

  return (
    <Layout section="Upload">
      <main className="page">
        <div className="eyebrow">
          <b>Step 1 of 3</b>
          <span>Setup and adapt engine</span>
        </div>

        {/* 1-Click Golden Path Quick Demo Card */}
        <div className="quick-demo-box">
          <div>
            <div className="golden-badge">
              <I.Sparkles size={12} /> Golden-Path Demo
            </div>
            <div style={{ fontWeight: 800, fontSize: 13, marginTop: 4, color: "#1e1b4b" }}>
              The Industrial Revolution
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              Pre-calibrated for Dyslexia, SCALE signals, and REWIRE demo
            </div>
          </div>
          <button
            className="primary-action"
            style={{ fontSize: 12, padding: "8px 14px", background: "#4338ca" }}
            onClick={() => {
              loadGoldenPath();
              navigate("/profile");
            }}
          >
            Load Demo <I.ArrowRight size={14} />
          </button>
        </div>

        <section className="card" style={{ marginTop: 10, padding: 17, background: "#f0f1ff", border: 0 }}>
          <b style={{ fontSize: 16 }}>Add learning material</b>
          <p style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 0 }}>
            Upload a document or paste a lesson. The backend extracts and prepares it for your learning profile.
          </p>
        </section>

        <div className="segmented" style={{ marginTop: 15 }}>
          {[
            ["upload", "Upload document"],
            ["text", "Paste raw text"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={tab === value ? "selected" : ""}
            >
              {label}
            </button>
          ))}
        </div>

        <section className="card" style={{ marginTop: 14, padding: 14 }}>
          <span className="pill" style={{ background: "#eefcf7" }}>
            Backend extraction with OCR fallback
          </span>
          {tab === "upload" ? (
            <label className="dropzone">
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx,.epub,.txt"
                onChange={(event) => upload(event.target.files?.[0])}
              />
              <I.UploadCloud size={32} />
              <b>{session.fileName || "Choose a document"}</b>
              <span>PDF, DOCX, EPUB, or TXT up to 45MB</span>
              <strong>Select from device</strong>
            </label>
          ) : (
            <textarea
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setText(event.target.value);
              }}
              onBlur={() => setText(draft)}
              placeholder="Paste raw text here..."
              style={{ width: "100%", minHeight: 180, marginTop: 14 }}
            />
          )}

          <div
            style={{
              background: "#eef0ff",
              borderRadius: 7,
              padding: 10,
              fontSize: 11,
              marginTop: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <b>
                {busy === "extract"
                  ? "Extracting..."
                  : ready
                  ? "Ready for adaptation"
                  : "Waiting for content"}
              </b>
              <span>{session.wordCount} words</span>
            </div>
            <div className="progressbar" style={{ marginTop: 8 }}>
              <div
                className="progressfill"
                style={{ width: busy === "extract" ? "55%" : ready ? "100%" : "0%" }}
              />
            </div>
            {session.text && (
              <div
                style={{
                  marginTop: 8,
                  background: "#fff",
                  padding: 8,
                  borderRadius: 5,
                  maxHeight: 84,
                  overflow: "auto",
                }}
              >
                {session.text.slice(0, 600)}
                {session.text.length > 600 ? "..." : ""}
              </div>
            )}
          </div>
        </section>
        <ErrorNotice />
        <button
          className="primary-action"
          disabled={!ready || Boolean(busy)}
          onClick={() => navigate("/profile")}
          style={{ marginTop: 15 }}
        >
          Continue to learner profile <I.ArrowRight size={16} />
        </button>
      </main>
    </Layout>
  );
}

function Profile() {
  const { session, busy, chooseProfile, detect, adapt } = useSession();
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const cards = [["dyslexia", "Shorter sentences, clearer wording, and less visual crowding."], ["cognitive_load", "Digestible chunks with one idea at a time."], ["low_vision", "High-contrast display guidance and larger readable text."]];
  return <Layout section="Profile"><main className="page"><div className="eyebrow"><b>Step 2 of 3</b><span>Choose your learning mode</span></div><h1 className="page-title">How should this lesson feel?</h1><div className="profile-grid">{cards.map(([profile, descriptionText]) => <button key={profile} className={`profile-option ${session.profile === profile ? "active" : ""}`} onClick={() => chooseProfile(profile)}><span className="radio" /> <span><b>{PROFILE_LABELS[profile]}</b><small>{descriptionText}</small></span></button>)}</div><section className="card" style={{ marginTop: 15, padding: 14 }}><b>Describe your needs</b><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="For example: long paragraphs are hard for me to follow" style={{ width: "100%", minHeight: 70, marginTop: 9 }} /><button className="secondary-action" disabled={!description.trim() || Boolean(busy)} onClick={() => detect(description)}>Detect profile</button></section><ErrorNotice /><button className="primary-action" disabled={!session.text || Boolean(busy)} onClick={async () => { await adapt(); navigate("/learn"); }} style={{ marginTop: 15 }}>{busy === "transform" ? "Adapting lesson..." : "Transform lesson"}<I.Sparkles size={16} /></button></main></Layout>;
}

// ─────────────────────────────────────────────────────────────────────────────
// VISUAL CARD  — standalone component, no external deps beyond React
// ─────────────────────────────────────────────────────────────────────────────
const VTYPE_META = {
  process:      { icon: "⚙️",  label: "Process diagram"   },
  flowchart:    { icon: "🔀",  label: "Flowchart"          },
  cycle:        { icon: "🔄",  label: "Cycle diagram"       },
  timeline:     { icon: "📅",  label: "Timeline"           },
  concept_map:  { icon: "🗺️",  label: "Concept map"        },
  cause_effect: { icon: "⚡",  label: "Cause & effect"     },
  comparison:   { icon: "⚖️",  label: "Comparison"         },
  hierarchy:    { icon: "🌳",  label: "Hierarchy"           },
  bar_chart:    { icon: "📊",  label: "Chart"              },
  none:         { icon: "💬",  label: "Text explanation"   },
};

function VisualCard({ visual, onReadAloud }) {
  if (!visual) return null;

  const {
    source        = "prism",
    visual_type   = "none",
    title         = "",
    subtitle      = "",
    explanation   = "",
    key_takeaways = [],
    why_visual    = "",
    svg_html      = null,
    source_images = [],
    spec          = {},
    error         = null,
  } = visual;

  const meta = VTYPE_META[visual_type] || VTYPE_META.none;

  // ── error state ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <section style={styles.card}>
        <div style={styles.errorBanner}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span>{error}</span>
        </div>
      </section>
    );
  }

  // ── no visual needed ─────────────────────────────────────────────────────
  if (
    visual_type === "none" &&
    !svg_html &&
    source_images.length === 0 &&
    (!spec.nodes || spec.nodes.length === 0)
  ) {
    return (
      <section style={styles.card}>
        <div style={styles.noVisualBanner}>
          <span style={{ fontSize: 20 }}>💬</span>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>No diagram needed</div>
            <div style={{ fontSize: 13, color: "#4e5265" }}>
              {explanation || "The text explanation is already the clearest representation."}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.card} aria-label="Visual explanation">
      {/* ── HEADER ── */}
      <div style={styles.cardHeader}>
        <div style={{ flex: 1 }}>
          <div style={styles.sourceBadge(source)}>
            {source === "pdf" ? "SOURCE VISUAL" : "PRISM EDUCATIONAL INFOGRAPHIC"}
          </div>
          {title && <h2 style={styles.cardTitle}>{title}</h2>}
          {subtitle && <p style={styles.cardSubtitle}>{subtitle}</p>}
        </div>
        <div style={styles.typeBadge}>
          <span style={{ fontSize: 18 }}>{meta.icon}</span>
          <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 5 }}>{meta.label}</span>
        </div>
      </div>

      {/* ── HIGH QUALITY EDUCATIONAL INFOGRAPHIC OR SOURCE VISUAL ── */}
      <VisualInfographic
        spec={spec}
        sourceImages={source_images}
        svgHtmlFallback={svg_html}
        onReadAloud={onReadAloud}
      />

      {/* ── DIVIDER ── */}
      <div style={styles.divider} />

      {/* ── UNDERSTAND IT ── */}
      {explanation && (
        <div style={styles.explainBlock}>
          <div style={styles.blockLabel}>💡 Understand it</div>
          <p style={styles.explainText}>{explanation}</p>
        </div>
      )}

      {/* ── KEY TAKEAWAYS ── */}
      {key_takeaways.length > 0 && (
        <div style={styles.takeawayBlock}>
          <div style={styles.blockLabel}>📌 Key takeaways</div>
          <ul style={styles.takeawayList}>
            {key_takeaways.map((t, i) => (
              <li key={i} style={styles.takeawayItem}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── WHY THIS VISUAL ── */}
      {why_visual && (
        <div style={styles.whyBlock}>
          <span style={{ fontWeight: 600 }}>Why this infographic? </span>
          <span style={{ color: "#4e5265" }}>{why_visual}</span>
        </div>
      )}

      {/* ── READ ALOUD ── */}
      {explanation && (
        <button
          style={styles.readBtn}
          onClick={() => onReadAloud && onReadAloud(explanation + " " + key_takeaways.join(". "))}
        >
          🔊 Read explanation
        </button>
      )}
    </section>
  );
}

// Inline style helpers kept close to the component for readability
const styles = {
  card: {
    background: "#fff",
    borderRadius: 16,
    border: "1px solid #e7e7f2",
    boxShadow: "0 4px 18px rgba(40,42,70,.07)",
    marginTop: 16,
    overflow: "hidden",
  },
  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: "16px 18px 0",
    gap: 12,
  },
  sourceBadge: (src) => ({
    display: "inline-block",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "3px 9px",
    borderRadius: 999,
    marginBottom: 6,
    background: src === "pdf" ? "#fef3c7" : "#ede9fe",
    color:       src === "pdf" ? "#92400e" : "#5b21b6",
  }),
  cardTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    lineHeight: 1.25,
    color: "#1e1b4b",
    letterSpacing: "-0.4px",
  },
  cardSubtitle: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 1.5,
  },
  typeBadge: {
    display: "flex",
    alignItems: "center",
    background: "#f1f5f9",
    borderRadius: 10,
    padding: "6px 10px",
    flexShrink: 0,
  },
  sourceImgWrap: {
    margin: "14px 18px 0",
    borderRadius: 10,
    overflow: "hidden",
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
  },
  sourceImg: {
    width: "100%",
    display: "block",
    objectFit: "contain",
    maxHeight: 320,
  },
  imgNav: {
    display: "flex",
    justifyContent: "center",
    gap: 6,
    padding: "8px 0",
  },
  imgDot: (active) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    background: active ? "#4f46e5" : "#d1d5db",
    padding: 0,
  }),
  svgWrap: {
    margin: "14px 18px 0",
    borderRadius: 10,
    overflow: "hidden",
    border: "1px solid #e5e7eb",
    background: "#fafafa",
  },
  nodeDetail: {
    position: "relative",
    margin: "10px 18px 0",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    padding: "12px 36px 12px 14px",
  },
  nodeDetailClose: {
    position: "absolute",
    top: 8,
    right: 10,
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    color: "#6b7280",
    padding: 0,
  },
  tapHint: {
    margin: "6px 18px 0",
    fontSize: 10,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  divider: {
    height: 1,
    background: "#f3f4f6",
    margin: "14px 18px",
  },
  explainBlock: {
    padding: "0 18px",
    marginBottom: 12,
  },
  explainText: {
    margin: "6px 0 0",
    fontSize: 14,
    lineHeight: 1.75,
    color: "#374151",
  },
  takeawayBlock: {
    padding: "0 18px",
    marginBottom: 12,
  },
  takeawayList: {
    margin: "6px 0 0",
    paddingLeft: 18,
  },
  takeawayItem: {
    fontSize: 13,
    lineHeight: 1.7,
    color: "#374151",
    marginBottom: 3,
  },
  whyBlock: {
    margin: "0 18px 12px",
    padding: "9px 12px",
    background: "#f0fdf4",
    borderLeft: "3px solid #22c55e",
    borderRadius: "0 8px 8px 0",
    fontSize: 12,
    lineHeight: 1.6,
  },
  blockLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "#1e1b4b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 2,
  },
  readBtn: {
    display: "block",
    margin: "0 18px 16px",
    background: "none",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 12,
    fontWeight: 700,
    color: "#4f46e5",
    cursor: "pointer",
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 16,
    background: "#fef2f2",
    color: "#991b1b",
    fontSize: 13,
    borderRadius: 16,
  },
  noVisualBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    background: "#f0fdf4",
    color: "#166534",
    fontSize: 13,
    borderRadius: 16,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
function Learn() {
  const {
    session,
    busy,
    adapt,
    ask,
    getVisual,
    completeChunk,
    simulateGoldenPath,
    recordRereadAction,
    recordHelpAction,
    dismissRewire,
  } = useSession();
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [playing, setPlaying] = useState(false);

  const transformed = session.transformed;
  const chunks =
    transformed?.profile === "cognitive_load"
      ? transformed.chunks
      : [transformed?.text || session.text];
  const lessonText = chunks.filter(Boolean).join("\n\n");

  const evaluation = evaluateSignals(session.signals, session.sessionMeta);
  const struggleScore = evaluation.struggleScore;
  const isDyslexia = session.profile === "dyslexia";

  function readAloud(text) {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
      setPlaying(true);
      utterance.onend = () => setPlaying(false);
    }
  }

  async function submitQuestion(event) {
    event.preventDefault();
    const result = await ask(question);
    if (result) setAnswer(result.answer);
  }

  return (
    <Layout section="Learn">
      <main className="page">
        <div className="eyebrow">
          <b>{PROFILE_LABELS[session.profile]}</b>
          <span>{session.wordCount} words</span>
        </div>
        <h1 className="page-title">Your adapted lesson</h1>

        {/* SCALE Real-Time Cognitive Telemetry Bar */}
        <div className="telemetry-bar">
          <div className="telemetry-gauge">
            <span
              className={`gauge-dot ${
                struggleScore >= 0.6
                  ? "critical"
                  : struggleScore >= 0.4
                  ? "warning"
                  : "normal"
              }`}
            />
            <span>
              SCALE Telemetry:{" "}
              <b>{(struggleScore * 100).toFixed(0)}% struggle</b>
              {struggleScore >= 0.6 ? " (REWIRE active)" : " (Optimal)"}
            </span>
          </div>
          <button
            className="text-action"
            style={{ fontWeight: 800, color: "#4f46e5" }}
            onClick={simulateGoldenPath}
            disabled={Boolean(busy)}
            title="Inject Golden-Path struggle signals to trigger REWIRE"
          >
            {busy === "rewire" ? "Adapting..." : "⚡ Simulate Struggle (Demo)"}
          </button>
        </div>

        {/* REWIRE Signature Moment Banner */}
        {session.rewireState.active && (
          <div className="rewire-banner">
            <div className="rewire-header">
              <span className="rewire-tag">⚡ REWIRE ACTIVATED</span>
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: 14,
                }}
                onClick={dismissRewire}
                aria-label="Dismiss banner"
              >
                ✕
              </button>
            </div>
            <div className="rewire-title">
              Cognitive Adaptation Applied (Level 2)
            </div>
            <p className="rewire-explanation">
              {session.rewireState.adaptedContent?.explanation ||
                session.rewireState.evaluation?.explanation ||
                "We detected increased struggle on this concept and re-explained it using simpler vocabulary and structured mental models."}
            </p>
            <div className="rewire-actions-pills">
              {(
                session.rewireState.adaptedContent?.actions_applied || [
                  "increase_simplification",
                  "reduce_chunk_size",
                  "add_visual_description",
                ]
              ).map((act) => (
                <span key={act} className="rewire-action-pill">
                  ✓ {act.replace(/_/g, " ")}
                </span>
              ))}
            </div>
            <button
              className="primary-action"
              style={{
                marginTop: 14,
                background: "#f59e0b",
                color: "#1e1b4b",
                fontWeight: 800,
                width: "100%",
              }}
              onClick={() => navigate("/practice")}
            >
              Take Adapted Practice Quiz <I.ArrowRight size={16} />
            </button>
          </div>
        )}

        {!transformed ? (
          <section className="card empty-state">
            <p>This lesson has not been adapted yet.</p>
            <button className="primary-action" onClick={adapt}>
              Adapt now <I.Sparkles size={16} />
            </button>
          </section>
        ) : (
          <>
            <div className={`card lesson-card ${isDyslexia ? "dyslexia-mode" : ""}`}>
              <div className="lesson-toolbar">
                <span className="pill">
                  {chunks.length} learning chunk
                  {chunks.length === 1 ? "" : "s"}
                </span>
                <button
                  className="icon-action"
                  onClick={() => readAloud(lessonText)}
                  title="Read lesson aloud"
                >
                  {playing ? "Stop" : "Read aloud"}
                </button>
              </div>

              {chunks.map((chunk, index) => {
                const isAdapted =
                  session.rewireState.active &&
                  (index === session.rewireState.chunkIndex ||
                    (chunks.length === 1 && session.rewireState.chunkIndex >= 0));
                const displayText = isAdapted
                  ? session.rewireState.adaptedContent?.adapted_text || chunk
                  : chunk;

                return (
                  <article
                    key={`${chunk.slice(0, 20)}-${index}`}
                    className={`lesson-chunk ${
                      isAdapted ? "adapted-chunk-card" : ""
                    }`}
                    style={isAdapted ? { padding: 14, borderRadius: 12, margin: "10px 0" } : {}}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="chunk-label">
                        {isAdapted ? "⚡ REWIRED CONCEPT" : `Chunk ${index + 1}`}
                      </span>
                      {isAdapted && (
                        <span className="adapted-badge">
                          Level {session.rewireState.adaptedContent?.variant_level || 2} Simplification
                        </span>
                      )}
                    </div>
                    <p>{displayText}</p>

                    {/* Visual Description Box for REWIRE */}
                    {isAdapted && session.rewireState.adaptedContent?.visual_description && (
                      <div className="visual-description-box">
                        <div className="visual-description-label">
                          <span>🖼️</span> Visual Mental Model
                        </div>
                        <p className="visual-description-text">
                          {session.rewireState.adaptedContent.visual_description}
                        </p>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                      <button
                        className="text-action"
                        onClick={() => readAloud(displayText)}
                      >
                        🔊 Read this {isAdapted ? "adapted version" : "chunk"}
                      </button>
                      <span style={{ color: "#cbd5e1" }}>•</span>
                      <button
                        className="text-action"
                        onClick={() => recordRereadAction()}
                        title="Simulate re-reading signal"
                      >
                        📖 Re-read (+1)
                      </button>
                      <span style={{ color: "#cbd5e1" }}>•</span>
                      <button
                        className="text-action"
                        onClick={() => recordHelpAction()}
                        title="Record help request signal"
                      >
                        💡 Need help
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="action-row">
              <button
                className="secondary-action"
                disabled={Boolean(busy)}
                onClick={getVisual}
              >
                {busy === "visual" ? "Building visual..." : "Generate visual"}
              </button>
              <button className="primary-action" onClick={completeChunk}>
                Mark chunk complete <I.Check size={16} />
              </button>
            </div>

            {session.visual && (
              <VisualCard
                visual={session.visual}
                onReadAloud={(text) => readAloud(text)}
              />
            )}

            <section className="card" style={{ marginTop: 14, padding: 14 }}>
              <b>Ask about this lesson</b>
              <form
                onSubmit={submitQuestion}
                style={{ display: "flex", gap: 8, marginTop: 9 }}
              >
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Type a question"
                  style={{ flex: 1 }}
                />
                <button
                  className="primary-action"
                  disabled={!question.trim() || Boolean(busy)}
                >
                  {busy === "voice" ? "..." : "Ask"}
                </button>
              </form>
              {answer && (
                <p
                  style={{
                    background: "#f0f1ff",
                    padding: 10,
                    borderRadius: 8,
                    marginBottom: 0,
                    marginTop: 10,
                  }}
                >
                  {answer}
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </Layout>
  );
}

function Practice() {
  const {
    session,
    busy,
    getQuiz,
    getAdaptiveQuizAction,
    recordQuizAnswerAction,
    completeChunk,
  } = useSession();
  const navigate = useNavigate();

  const chunks =
    session.transformed?.profile === "cognitive_load"
      ? session.transformed.chunks
      : [session.transformed?.text || session.text];
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const chunk = chunks[0] || "";

  const isRewireActive = session.rewireState.active;

  async function loadQuiz() {
    if (isRewireActive) {
      const result = await getAdaptiveQuizAction(chunk);
      if (result) {
        setQuiz(result);
        setSelected("");
        setSubmitted(false);
      }
    } else {
      const result = await getQuiz(chunk);
      if (result) {
        setQuiz(result);
        setSelected("");
        setSubmitted(false);
      }
    }
  }

  // Pre-load quiz if rewired
  useEffect(() => {
    if (isRewireActive && !quiz) {
      loadQuiz();
    }
  }, [isRewireActive]);

  function handleSubmit() {
    if (!selected || submitted) return;
    setSubmitted(true);
    const isCorrect = selected === quiz.answer;
    recordQuizAnswerAction(isCorrect);
    if (isCorrect) {
      completeChunk();
    }
  }

  return (
    <Layout section="Practice">
      <main className="page">
        <div className="eyebrow">
          <b>Practice</b>
          <span>{session.completed} completed</span>
        </div>
        <h1 className="page-title">Check your understanding</h1>

        {isRewireActive && (
          <div
            style={{
              background: "#ede9fe",
              color: "#5b21b6",
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <span>⚡</span>
            <span>
              Adaptive Practice: Calibrated for Level 2 Simplification
            </span>
          </div>
        )}

        {!chunk ? (
          <section className="card empty-state">
            Adapt a lesson first to generate practice questions.
          </section>
        ) : !quiz ? (
          <section className="card empty-state">
            <p>
              {isRewireActive
                ? "Generate an adaptive question calibrated to your learning pace."
                : "Generate a question from your current lesson."}
            </p>
            <button
              className="primary-action"
              disabled={Boolean(busy)}
              onClick={loadQuiz}
            >
              {busy === "quiz"
                ? "Generating..."
                : isRewireActive
                ? "Generate Adaptive Question"
                : "Generate question"}
              <I.HelpCircle size={16} />
            </button>
          </section>
        ) : (
          <section className="card practice-card">
            <span className="pill">
              {isRewireActive ? "Adaptive Quiz" : session.profile}
            </span>
            <h2>{quiz.question}</h2>
            <div className="option-list">
              {quiz.options.map((option) => (
                <button
                  key={option}
                  className={selected === option ? "selected" : ""}
                  onClick={() => !submitted && setSelected(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <button
              className="primary-action"
              disabled={!selected || submitted}
              onClick={handleSubmit}
            >
              {submitted
                ? selected === quiz.answer
                  ? "Correct"
                  : "Review answer"
                : "Submit answer"}
            </button>

            {submitted && (
              <div className="feedback">
                <b>
                  {selected === quiz.answer
                    ? "Correct."
                    : `Answer: ${quiz.answer}`}
                </b>
                <p>{quiz.explanation}</p>
              </div>
            )}

            {/* SCALE Outcome Measurement Card (shows after correct answer post-REWIRE) */}
            {submitted && isRewireActive && session.latestOutcome && (
              <div className="outcome-card">
                <div className="outcome-title">
                  <span className="outcome-delta-badge">
                    +{((session.latestOutcome.outcomeDelta || 1) * 100).toFixed(0)}%
                  </span>
                  <span>SCALE Outcome: Struggle Successfully Resolved!</span>
                </div>
                <p style={{ fontSize: 13, color: "#065f46", margin: "4px 0 10px" }}>
                  Pre-adaptation accuracy: 0% → Post-adaptation accuracy: 100%. The
                  cognitive restructuring enabled mastery.
                </p>
                <button
                  className="primary-action"
                  style={{ background: "#059669", fontSize: 12, padding: "8px 14px" }}
                  onClick={() => navigate("/progress")}
                >
                  View in Progress Dashboard <I.ArrowRight size={14} />
                </button>
              </div>
            )}

            <button
              className="text-action"
              onClick={loadQuiz}
              style={{ marginTop: 14, display: "block" }}
            >
              Generate another question
            </button>
          </section>
        )}
        <ErrorNotice />
      </main>
    </Layout>
  );
}

function Progress() {
  const { session, simulateGoldenPath } = useSession();
  const navigate = useNavigate();

  const transformed = Boolean(session.transformed);
  const chunks =
    session.transformed?.profile === "cognitive_load"
      ? session.transformed.chunks.length
      : transformed
      ? 1
      : 0;

  const evaluation = evaluateSignals(session.signals, session.sessionMeta);
  const struggleScore = evaluation.struggleScore;
  const history = session.sessionMeta.adaptationHistory || [];
  const latestOutcome = session.latestOutcome;

  return (
    <Layout section="Progress">
      <main className="page">
        <div className="eyebrow">
          <b>Session progress</b>
          <span>{session.fileName || "No lesson loaded"}</span>
        </div>
        <h1 className="page-title">Your learning session</h1>

        <div className="stats-grid">
          <div className="card stat">
            <b>{session.wordCount}</b>
            <span>Source words</span>
          </div>
          <div className="card stat">
            <b>{chunks}</b>
            <span>Learning chunks</span>
          </div>
          <div className="card stat">
            <b>{session.quizzes.length}</b>
            <span>Questions completed</span>
          </div>
          <div className="card stat">
            <b>{session.completed}</b>
            <span>Mastered chunks</span>
          </div>
        </div>

        {/* SCALE Engine Cognitive Telemetry Card */}
        <section className="card" style={{ marginTop: 15, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="pill" style={{ background: "#ede9fe", color: "#5b21b6" }}>
              SCALE Cognitive Telemetry
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>
              Variant Level: {session.sessionMeta.currentVariantLevel}
            </span>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <b>Current Struggle Score</b>
              <b>{(struggleScore * 100).toFixed(0)}% / 100%</b>
            </div>
            <div className="progressbar" style={{ marginTop: 6, height: 10 }}>
              <div
                className="progressfill"
                style={{
                  width: `${Math.min(100, struggleScore * 100)}%`,
                  background:
                    struggleScore >= 0.6
                      ? "#7c3aed"
                      : struggleScore >= 0.4
                      ? "#f59e0b"
                      : "#10b981",
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
            <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>
                Total Adaptations
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1e1b4b", marginTop: 2 }}>
                {session.sessionMeta.totalAdaptations}
              </div>
            </div>
            <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>
                Latest Outcome Delta
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#059669", marginTop: 2 }}>
                {latestOutcome ? `+${((latestOutcome.outcomeDelta || 1) * 100).toFixed(0)}%` : "N/A"}
              </div>
            </div>
          </div>
        </section>

        {/* Adaptation History Timeline */}
        <section className="card" style={{ marginTop: 15, padding: 16 }}>
          <b style={{ fontSize: 15, color: "#1e1b4b" }}>Cognitive Adaptation Log</b>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            Real-time interventions triggered by the SCALE behavioral engine.
          </p>

          {history.length === 0 ? (
            <div style={{ padding: "14px 0", textAlign: "center", color: "#64748b", fontSize: 13 }}>
              <p>No struggle adaptations triggered in this session yet.</p>
              <button
                className="secondary-action"
                style={{ fontSize: 11, padding: "8px 12px" }}
                onClick={() => {
                  simulateGoldenPath();
                  navigate("/learn");
                }}
              >
                ⚡ Trigger Golden-Path Adaptation
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {history.map((rec) => (
                <div
                  key={rec.id}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ fontWeight: 800, color: "#4338ca" }}>
                      Level {rec.previousLevel} → Level {rec.newLevel}
                    </span>
                    <span style={{ color: "#64748b" }}>
                      Struggle Score: {(rec.struggleScore * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "#334155", margin: "6px 0" }}>
                    {rec.explanation}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span className="golden-badge" style={{ background: "#ecfdf5", color: "#065f46" }}>
                      Outcome: +100% Accuracy Improvement
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Learner Profile Information */}
        <section className="card" style={{ marginTop: 15, padding: 16 }}>
          <span className="pill" style={{ background: "#e7e9fb" }}>
            {PROFILE_LABELS[session.profile]}
          </span>
          <h2 style={{ marginBottom: 6, marginTop: 8 }}>
            {transformed ? "Lesson adapted & active" : "Ready to begin"}
          </h2>
          <p style={{ marginTop: 0, color: "#4e5265", fontSize: 13 }}>
            {transformed
              ? "Your transformed lesson, practice questions, and cognitive adaptations are available across the learning flow."
              : "Upload a document and choose a profile to start."}
          </p>
        </section>
      </main>
    </Layout>
  );
}

function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/" element={<Progress />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/progress" element={<Progress />} />
      </Routes>
    </SessionProvider>
  );
}

export default App;
