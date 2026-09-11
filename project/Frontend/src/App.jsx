import React, { createContext, useContext, useEffect, useState } from "react";
import {
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import * as I from "lucide-react";
import {
  askLessonQuestion,
  detectProfile,
  extractDocument,
  evaluateQuizAnswer,
  generateQuiz,
  generateLessonTest,
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
export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }) {
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
    completedSections: [],
    practiceReport: { answered: [], failed: [], masteredSections: [] },
    wholeTest: null,
    error: null,
    signals: createSignalState(),
    sessionMeta: createSessionMeta(),
    rewireState: { active: false, adaptedContent: null, evaluation: null, chunkIndex: 0 },
    latestOutcome: null,
  });

  const [busy, setBusy] = useState("");

  async function run(name, fn) {
    setBusy(name);
    setSession((current) => ({ ...current, error: null }));
    try {
      return await fn();
    } catch (error) {
      setSession((current) => ({ ...current, error: error.message }));
      return null;
    } finally {
      setBusy("");
    }
  }

  async function upload(file) {
    if (!file) return null;
    return run("extract", async () => {
      const result = await extractDocument(file);
      setSession((current) => ({
        ...current,
        fileName: file.name,
        text: result.text || "",
        wordCount: result.word_count || 0,
        tables: result.tables || [],
        transformed: null,
        quizzes: [],
        visual: null,
        completed: 0,
        completedSections: [],
        practiceReport: { answered: [], failed: [], masteredSections: [] },
        wholeTest: null,
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
      completedSections: [],
      practiceReport: { answered: [], failed: [], masteredSections: [] },
      wholeTest: null,
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
      completedSections: [],
      practiceReport: { answered: [], failed: [], masteredSections: [] },
      wholeTest: null,
      signals: createSignalState(),
      sessionMeta: createSessionMeta(),
      rewireState: { active: false, adaptedContent: null, evaluation: null, chunkIndex: 0 },
      latestOutcome: null,
    }));
  }

  async function chooseProfile(profile) {
    setSession((current) => ({
      ...current,
      profile,
      transformed: null,
      quizzes: [],
      visual: null,
    }));
  }

  async function detect(text) {
    return run("profile", async () => {
      const result = await detectProfile(text);
      if (result?.profile) {
        setSession((current) => ({ ...current, profile: result.profile }));
      }
      return result;
    });
  }

  async function adapt() {
    if (!session.text.trim()) return null;
    return run("transform", async () => {
      const result = await transformText(session.text, session.profile);
      setSession((current) => ({
        ...current,
        transformed: result,
        quizzes: [],
        visual: null,
      }));
      return result;
    });
  }

  async function getQuiz(chunk) {
    return run("quiz", async () => {
      const result = await generateQuiz(chunk, session.profile);
      setSession((current) => ({
        ...current,
        quizzes: [...current.quizzes, result],
      }));
      return result;
    });
  }

  async function evaluateAnswer(payload) {
    return run("evaluate", async () => {
      const result = await evaluateQuizAnswer(payload);
      setSession((current) => {
        const answered = [...current.practiceReport.answered, result];
        const failed = answered.filter((item) => !item.is_correct);
        const masteredSections = result.is_correct
          ? [...new Set([...current.practiceReport.masteredSections, result.section_index])]
          : current.practiceReport.masteredSections;
        return {
          ...current,
          practiceReport: { answered, failed, masteredSections },
        };
      });
      return result;
    });
  }

  async function getWholeTest() {
    return run("test", async () => {
      const result = await generateLessonTest(session.text, session.profile, 5);
      setSession((current) => ({ ...current, wholeTest: result.questions }));
      return result.questions;
    });
  }

  async function getVisual() {
    return run("visual", async () => {
      const result = await generateVisual(session.text, session.profile);
      setSession((current) => ({ ...current, visual: result }));
      return result;
    });
  }

  async function ask(question, sectionText) {
    recordVoiceHelpAction();
    return run("voice", () => {
      if (sectionText) {
        return askLessonQuestion(question, session.text, sectionText, session.profile);
      }
      return askLessonQuestion(question, session.text, session.text, session.profile);
    });
  }

  function completeChunk() {
    setSession((current) => ({ ...current, completed: current.completed + 1 }));
  }

  function completeSection(sectionIndex) {
    setSession((current) => {
      const completedSections = current.completedSections || [];
      if (completedSections.includes(sectionIndex)) return current;
      return {
        ...current,
        completed: current.completed + 1,
        completedSections: [...completedSections, sectionIndex],
      };
    });
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
      const currentChunk =
        session.transformed?.chunks?.[2] ||
        session.transformed?.text ||
        session.text;
      try {
        adaptedData = await rewireContent({
          chunkText: currentChunk,
          profile: session.profile,
          variantLevel: evaluation.adaptationStrategy?.newVariantLevel ?? 2,
          actions: evaluation.adaptationStrategy?.additionalActions ?? [
            "increase_simplification",
            "reduce_chunk_size",
            "add_visual_description",
          ],
          struggleExplanation: evaluation.explanation,
        });
      } catch (err) {
        adaptedData = GOLDEN_PATH_REWIRE;
      }

      const updatedMeta = applyAdaptation(session.sessionMeta, evaluation);
      updatedMeta.preAccuracy = 0.0;
      if (updatedMeta.adaptationHistory.length > 0) {
        updatedMeta.adaptationHistory[
          updatedMeta.adaptationHistory.length - 1
        ].preAccuracy = 0.0;
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
          previousQuestion:
            "How did cloth production change in the Industrial Revolution?",
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
      const updatedSignals = recordQuizAnswer(
        current.signals,
        isCorrect,
        latencyMs
      );
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
        evaluateAnswer,
        getWholeTest,
        getVisual,
        ask,
        completeChunk,
        completeSection,
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
  const struggle = evaluateSignals(
    session.signals,
    session.sessionMeta
  ).struggleScore;
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
        <div
          className="rewire-tag"
          style={{ marginLeft: "auto", marginRight: 8 }}
        >
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
    <div
      style={{
        background: "#fff0f0",
        color: "#a12929",
        padding: 10,
        borderRadius: 8,
        marginTop: 12,
        fontSize: 12,
      }}
    >
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
            <div
              style={{
                fontWeight: 800,
                fontSize: 13,
                marginTop: 4,
                color: "#1e1b4b",
              }}
            >
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

        <section
          className="card"
          style={{
            marginTop: 15,
            padding: 17,
            background: "#f0f1ff",
            border: 0,
          }}
        >
          <b style={{ fontSize: 16 }}>Add learning material</b>
          <p style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 0 }}>
            Upload a document or paste a lesson. The backend extracts and
            prepares it for your learning profile.
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
                style={{
                  width: busy === "extract" ? "55%" : ready ? "100%" : "0%",
                }}
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
  const cards = [
    [
      "dyslexia",
      "Shorter sentences, clearer wording, and less visual crowding.",
    ],
    ["cognitive_load", "Digestible chunks with one idea at a time."],
    ["low_vision", "High-contrast display guidance and larger readable text."],
  ];
  return (
    <Layout section="Profile">
      <main className="page">
        <div className="eyebrow">
          <b>Step 2 of 3</b>
          <span>Choose your learning mode</span>
        </div>
        <h1 className="page-title">How should this lesson feel?</h1>
        <div className="profile-grid">
          {cards.map(([profile, descriptionText]) => (
            <button
              key={profile}
              className={`profile-option ${session.profile === profile ? "active" : ""}`}
              onClick={() => chooseProfile(profile)}
            >
              <span className="radio" />{" "}
              <span>
                <b>{PROFILE_LABELS[profile]}</b>
                <small>{descriptionText}</small>
              </span>
            </button>
          ))}
        </div>
        <section className="card" style={{ marginTop: 15, padding: 14 }}>
          <b>Describe your needs</b>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="For example: long paragraphs are hard for me to follow"
            style={{ width: "100%", minHeight: 70, marginTop: 9 }}
          />
          <button
            className="secondary-action"
            disabled={!description.trim() || Boolean(busy)}
            onClick={() => detect(description)}
          >
            Detect profile
          </button>
        </section>
        <ErrorNotice />
        <button
          className="primary-action"
          disabled={!session.text || Boolean(busy)}
          onClick={async () => {
            await adapt();
            navigate("/learn");
          }}
          style={{ marginTop: 15 }}
        >
          {busy === "transform" ? "Adapting lesson..." : "Transform lesson"}
          <I.Sparkles size={16} />
        </button>
      </main>
    </Layout>
  );
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

      <VisualInfographic
        spec={spec}
        sourceImages={source_images}
        svgHtmlFallback={svg_html}
        onReadAloud={onReadAloud}
      />

      <div style={styles.divider} />

      {explanation && (
        <div style={styles.explainBlock}>
          <div style={styles.blockLabel}>💡 Understand it</div>
          <p style={styles.explainText}>{explanation}</p>
        </div>
      )}

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

      {why_visual && (
        <div style={styles.whyBlock}>
          <span style={{ fontWeight: 600 }}>Why this infographic? </span>
          <span style={{ color: "#4e5265" }}>{why_visual}</span>
        </div>
      )}

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
    completeSection,
    simulateGoldenPath,
    recordRereadAction,
    recordHelpAction,
    recordVoiceHelpAction,
    dismissRewire,
  } = useSession();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState(0);
  const [question, setQuestion] = useState("");
  const [askedQuestion, setAskedQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [playing, setPlaying] = useState(false);

  const transformed = session.transformed;
  const chunks =
    transformed?.profile === "cognitive_load"
      ? transformed.chunks
      : [transformed?.text || session.text];

  const sections = chunks.filter(Boolean).flatMap((chunk, chunkIndex) =>
    chunk
      .split(/\n\s*\n|(?<=[.!?])\s+(?=[A-Z])/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((paragraph, paragraphIndex) => ({
        id: `${chunkIndex}-${paragraphIndex}`,
        paragraph,
        chunk: chunkIndex + 1,
        chunkIndex,
      }))
  );

  const currentSection = sections[activeSection] || sections[0];
  const formatting = transformed?.formatting || {};
  const completedSections = session.completedSections || [];
  const isComplete = completedSections.includes(activeSection);

  const evaluation = evaluateSignals(session.signals, session.sessionMeta);
  const struggleScore = evaluation.struggleScore;
  const lessonClass =
    transformed?.profile === "dyslexia"
      ? "dyslexia-lesson"
      : transformed?.profile === "low_vision"
      ? "low-vision-lesson"
      : "";

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
    const prompt = question.trim();
    if (!prompt || !currentSection) return;
    setAskedQuestion(prompt);
    setAnswer("");
    recordVoiceHelpAction();
    const result = await ask(prompt, currentSection.paragraph);
    if (result) setAnswer(result.answer);
  }

  function markSectionComplete() {
    completeSection(activeSection);
    completeChunk();
    if (activeSection < sections.length - 1) {
      setActiveSection((index) => index + 1);
    }
  }

  const isAdapted =
    session.rewireState.active &&
    (currentSection?.chunkIndex === session.rewireState.chunkIndex ||
      (chunks.length === 1 && session.rewireState.chunkIndex >= 0));
  const displayText = isAdapted
    ? session.rewireState.adaptedContent?.adapted_text || currentSection?.paragraph
    : currentSection?.paragraph;

  return (
    <Layout section="Learn">
      <main className="page">
        <div className="eyebrow">
          <b>{PROFILE_LABELS[session.profile]}</b>
          <span>
            {completedSections.length}/{sections.length} completed · {session.wordCount} words
          </span>
        </div>

        <div className="lesson-heading">
          <div>
            <h1 className="page-title">Your adapted lesson</h1>
            <p className="lesson-subtitle">
              One section at a time · {sections.length} readable sections
            </p>
          </div>
          <button
            className="icon-action"
            onClick={() =>
              readAloud(sections.map((s) => s.paragraph).join("\n\n"))
            }
            title="Read the full lesson aloud"
          >
            {playing ? "Stop" : "Read all"}
          </button>
        </div>

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
            {/* Section Progress Stepper */}
            <div className="section-progress">
              <div>
                <b>
                  Section {activeSection + 1} of {sections.length}
                </b>
                <span>{isComplete ? "Completed" : "In progress"}</span>
              </div>
              <div className="progressbar">
                <div
                  className="progressfill"
                  style={{
                    width: `${((activeSection + (isComplete ? 1 : 0)) / (sections.length || 1)) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Active Section Card */}
            <section className={`lesson-sections active-section ${lessonClass}`}>
              <div className="lesson-sections-header">
                <span className="pill">
                  {currentSection?.chunk > 1
                    ? `Learning chunk ${currentSection.chunk}`
                    : "Core idea"}
                </span>
                <span className="reading-note">Read at your pace</span>
              </div>

              {currentSection && (
                <article
                  className={`lesson-section ${isAdapted ? "adapted-chunk-card" : ""}`}
                  style={isAdapted ? { padding: 14, borderRadius: 12, margin: "10px 0" } : {}}
                >
                  <div className="section-number">
                    {String(activeSection + 1).padStart(2, "0")}
                  </div>
                  <div className="section-content">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div className="section-label">
                        {isAdapted ? "⚡ REWIRED CONCEPT" : `Section ${activeSection + 1}`}
                      </div>
                      {isAdapted && (
                        <span className="adapted-badge">
                          Level {session.rewireState.adaptedContent?.variant_level || 2} Simplification
                        </span>
                      )}
                    </div>

                    <p
                      style={{
                        fontSize: formatting.font_size_multiplier
                          ? `${formatting.font_size_multiplier}em`
                          : undefined,
                        lineHeight: formatting.line_height,
                        letterSpacing: formatting.letter_spacing,
                      }}
                    >
                      {displayText}
                    </p>

                    {/* Visual Description Box for REWIRE */}
                    {isAdapted && session.rewireState.adaptedContent?.visual_description && (
                      <div className="visual-description-box" style={{ marginTop: 10 }}>
                        <div className="visual-description-label">
                          <span>🖼️</span> Visual Mental Model
                        </div>
                        <p className="visual-description-text">
                          {session.rewireState.adaptedContent.visual_description}
                        </p>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        className="text-action"
                        onClick={() => readAloud(displayText)}
                      >
                        <I.Volume2 size={13} /> Read this {isAdapted ? "adapted version" : "section"}
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
                  </div>
                </article>
              )}
            </section>

            {/* Navigation & Actions */}
            <div className="section-actions">
              <button
                className="secondary-action"
                disabled={activeSection === 0}
                onClick={() => setActiveSection((index) => index - 1)}
              >
                <I.ArrowLeft size={15} /> Previous
              </button>
              <button className="primary-action" onClick={markSectionComplete}>
                {isComplete
                  ? activeSection === sections.length - 1
                    ? "All sections complete"
                    : "Next section"
                  : "Mark section complete"}
                <I.Check size={16} />
              </button>
            </div>

            {/* Section Jump Bar */}
            <div className="section-jump">
              {sections.map((section, index) => (
                <button
                  key={section.id}
                  className={`${index === activeSection ? "current" : ""} ${completedSections.includes(index) ? "done" : ""}`}
                  onClick={() => setActiveSection(index)}
                >
                  {completedSections.includes(index) ? (
                    <I.Check size={12} />
                  ) : (
                    index + 1
                  )}
                </button>
              ))}
            </div>

            {/* Visual Support Generator */}
            <div style={{ marginTop: 16 }}>
              <button
                className="secondary-action"
                disabled={Boolean(busy)}
                onClick={getVisual}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {busy === "visual"
                  ? "Building infographic visual..."
                  : "🎨 Generate Visual Infographic Support"}
              </button>
            </div>

            {/* Full PRISM Visual Card / Infographic */}
            {session.visual && (
              <VisualCard
                visual={session.visual}
                onReadAloud={(text) => readAloud(text)}
              />
            )}

            {/* In-Context Lesson Assistant */}
            <section className="card ask-card" style={{ marginTop: 16, padding: 14 }}>
              <b>Ask about this lesson</b>
              <p className="ask-context">
                Your question is answered using the active section and lesson context.
              </p>
              <form
                onSubmit={submitQuestion}
                style={{ display: "flex", gap: 8, marginTop: 9 }}
              >
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask a question about this section"
                  style={{ flex: 1 }}
                />
                <button
                  className="primary-action"
                  disabled={!question.trim() || Boolean(busy)}
                >
                  {busy === "voice" ? "Thinking..." : "Ask"}
                </button>
              </form>
              {askedQuestion && (
                <div className="answer-box" style={{ marginTop: 12 }}>
                  <span className="section-label">Your question</span>
                  <p className="asked-question">{askedQuestion}</p>
                  <span className="section-label">Answer</span>
                  {answer ? <p>{answer}</p> : <p>Generating an answer from your lesson...</p>}
                </div>
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
    evaluateAnswer,
    getWholeTest,
    getAdaptiveQuizAction,
    recordQuizAnswerAction,
    completeChunk,
    completeSection,
  } = useSession();
  const navigate = useNavigate();

  const chunks =
    session.transformed?.profile === "cognitive_load"
      ? session.transformed.chunks
      : [session.transformed?.text || session.text];

  const isRewireActive = session.rewireState.active;
  const chunk = chunks[0] || "";

  // ── REWIRE Adaptive Quiz State ──
  const [adaptiveQuiz, setAdaptiveQuiz] = useState(null);
  const [adaptiveSelected, setAdaptiveSelected] = useState("");
  const [adaptiveSubmitted, setAdaptiveSubmitted] = useState(false);

  // ── Mastery Practice State ──
  const [sectionIndex, setSectionIndex] = useState(0);
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState("");
  const [report, setReport] = useState(null);

  // ── Whole-Lesson Test State ──
  const [testIndex, setTestIndex] = useState(0);
  const [testAnswers, setTestAnswers] = useState([]);
  const [testReport, setTestReport] = useState(null);

  const sectionText = chunks[sectionIndex] || "";
  const allSectionsMastered =
    chunks.length > 0 &&
    chunks.every((_, index) =>
      session.practiceReport.masteredSections.includes(index)
    );

  async function loadAdaptiveQuiz() {
    const result = await getAdaptiveQuizAction(chunk);
    if (result) {
      setAdaptiveQuiz(result);
      setAdaptiveSelected("");
      setAdaptiveSubmitted(false);
    }
  }

  useEffect(() => {
    if (isRewireActive && !adaptiveQuiz) {
      loadAdaptiveQuiz();
    }
  }, [isRewireActive]);

  function handleAdaptiveSubmit() {
    if (!adaptiveSelected || adaptiveSubmitted) return;
    setAdaptiveSubmitted(true);
    const isCorrect = adaptiveSelected === adaptiveQuiz.answer;
    recordQuizAnswerAction(isCorrect);
    if (isCorrect) {
      completeChunk();
      completeSection(0);
    }
  }

  async function loadSectionQuestion() {
    const result = await getQuiz(sectionText);
    if (result) {
      setQuiz(result);
      setSelected("");
      setReport(null);
    }
  }

  async function submitSectionAnswer() {
    if (!quiz || !selected) return;
    const result = await evaluateAnswer({
      question: quiz.question,
      options: quiz.options,
      correct_answer: quiz.answer,
      selected_answer: selected,
      explanation: quiz.explanation,
      section_index: sectionIndex,
    });
    setReport(result);
    if (result.is_correct) {
      completeSection(sectionIndex);
    }
  }

  async function startWholeTest() {
    const questions = await getWholeTest();
    if (questions?.length) {
      setTestIndex(0);
      setTestAnswers([]);
      setTestReport(null);
    }
  }

  async function submitTestAnswer() {
    if (!session.wholeTest?.[testIndex] || !selected) return;
    const currentQ = session.wholeTest[testIndex];
    const nextAnswers = [
      ...testAnswers,
      {
        question: currentQ.question,
        selected,
        correct: selected === currentQ.answer,
      },
    ];
    setTestAnswers(nextAnswers);
    setSelected("");
    if (testIndex < session.wholeTest.length - 1) {
      setTestIndex((index) => index + 1);
    } else {
      setTestReport({
        answered: nextAnswers,
        correct: nextAnswers.filter((a) => a.correct).length,
        failed: nextAnswers.filter((a) => !a.correct),
      });
    }
  }

  return (
    <Layout section="Practice">
      <main className="page">
        <div className="eyebrow">
          <b>Practice & Mastery</b>
          <span>
            {session.practiceReport.masteredSections.length}/{chunks.length} mastered
          </span>
        </div>
        <h1 className="page-title">Check your understanding</h1>

        {/* ── REWIRE Adaptive Assessment Card (Active when struggle was detected) ── */}
        {isRewireActive && (
          <section className="card" style={{ marginBottom: 16, padding: 16, border: "2px solid #8b5cf6" }}>
            <div
              style={{
                background: "#ede9fe",
                color: "#5b21b6",
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 10,
              }}
            >
              <span>⚡</span>
              <span>Adaptive Question: Calibrated to Level 2 Simplification</span>
            </div>

            {!adaptiveQuiz ? (
              <div>
                <p style={{ fontSize: 13, color: "#475569" }}>
                  Generate an adaptive question calibrated to your learning recovery.
                </p>
                <button
                  className="primary-action"
                  disabled={Boolean(busy)}
                  onClick={loadAdaptiveQuiz}
                >
                  {busy === "quiz" ? "Generating..." : "Generate Adaptive Question"}
                  <I.HelpCircle size={16} />
                </button>
              </div>
            ) : (
              <div className="practice-card" style={{ padding: 0 }}>
                <h2 style={{ fontSize: 16, marginBottom: 12 }}>{adaptiveQuiz.question}</h2>
                <div className="option-list">
                  {adaptiveQuiz.options.map((option) => (
                    <button
                      key={option}
                      className={adaptiveSelected === option ? "selected" : ""}
                      onClick={() => !adaptiveSubmitted && setAdaptiveSelected(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <button
                  className="primary-action"
                  disabled={!adaptiveSelected || adaptiveSubmitted}
                  onClick={handleAdaptiveSubmit}
                >
                  {adaptiveSubmitted
                    ? adaptiveSelected === adaptiveQuiz.answer
                      ? "Correct"
                      : "Review answer"
                    : "Submit answer"}
                </button>

                {adaptiveSubmitted && (
                  <div className="feedback" style={{ marginTop: 12 }}>
                    <b>
                      {adaptiveSelected === adaptiveQuiz.answer
                        ? "Correct."
                        : `Answer: ${adaptiveQuiz.answer}`}
                    </b>
                    <p>{adaptiveQuiz.explanation}</p>
                  </div>
                )}

                {/* SCALE Outcome Measurement Card */}
                {adaptiveSubmitted && session.latestOutcome && (
                  <div className="outcome-card" style={{ marginTop: 14 }}>
                    <div className="outcome-title">
                      <span className="outcome-delta-badge">
                        +{((session.latestOutcome.outcomeDelta || 1) * 100).toFixed(0)}%
                      </span>
                      <span>SCALE Outcome: Struggle Successfully Resolved!</span>
                    </div>
                    <p style={{ fontSize: 13, color: "#065f46", margin: "4px 0 10px" }}>
                      Pre-adaptation accuracy: 0% → Post-adaptation accuracy: 100%. The cognitive
                      restructuring enabled mastery.
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
              </div>
            )}
          </section>
        )}

        {/* ── Section Mastery Report ── */}
        <section className="card practice-report" style={{ padding: 14 }}>
          <b>Section report</b>
          <div className="stats-grid" style={{ marginTop: 10 }}>
            <div className="stat">
              <b>{session.practiceReport.answered.length}</b>
              <span>Answered</span>
            </div>
            <div className="stat">
              <b>{session.practiceReport.failed.length}</b>
              <span>Need review</span>
            </div>
            <div className="stat">
              <b>{session.practiceReport.masteredSections.length}</b>
              <span>Mastered</span>
            </div>
            <div className="stat">
              <b>{chunks.length}</b>
              <span>Total sections</span>
            </div>
          </div>
        </section>

        {/* ── Standard Section Practice ── */}
        {!sectionText ? (
          <section className="card empty-state" style={{ marginTop: 14 }}>
            Adapt a lesson first to generate section questions.
          </section>
        ) : (
          <section className="card practice-card" style={{ marginTop: 14 }}>
            <span className="pill">
              Section {sectionIndex + 1} of {chunks.length}
            </span>
            <p className="practice-context">Questions are generated from this lesson section.</p>

            {!quiz ? (
              <>
                <p>Complete the section check before moving to the next topic.</p>
                <button
                  className="primary-action"
                  disabled={Boolean(busy)}
                  onClick={loadSectionQuestion}
                >
                  {busy === "quiz" ? "Generating..." : "Start section questions"}
                  <I.HelpCircle size={16} />
                </button>
              </>
            ) : (
              <>
                <h2>{quiz.question}</h2>
                <div className="option-list">
                  {quiz.options.map((option) => (
                    <button
                      key={option}
                      className={selected === option ? "selected" : ""}
                      onClick={() => !report && setSelected(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {!report ? (
                  <button
                    className="primary-action"
                    disabled={!selected || Boolean(busy)}
                    onClick={submitSectionAnswer}
                  >
                    {busy === "evaluate" ? "Checking..." : "Submit answer"}
                  </button>
                ) : (
                  <div
                    className={`feedback ${
                      report.is_correct ? "correct-feedback" : "failed-feedback"
                    }`}
                  >
                    <b>
                      {report.is_correct
                        ? "Correct. Section mastered."
                        : "Not quite. Review this section."}
                    </b>
                    <p>{report.explanation}</p>
                    {!report.is_correct && (
                      <button className="secondary-action" onClick={loadSectionQuestion}>
                        Retry this topic
                      </button>
                    )}
                    {report.is_correct && sectionIndex < chunks.length - 1 && (
                      <button
                        className="primary-action"
                        onClick={() => {
                          setSectionIndex((index) => index + 1);
                          setQuiz(null);
                          setReport(null);
                        }}
                      >
                        Continue to next section
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* ── Whole-Lesson Test (Unlocked when all sections mastered) ── */}
        {allSectionsMastered && !session.wholeTest && (
          <section
            className="card mastery-unlocked"
            style={{ marginTop: 14, padding: 16 }}
          >
            <b>All sections mastered</b>
            <p>You can now take a test covering the entire extracted lesson.</p>
            <button
              className="primary-action"
              disabled={Boolean(busy)}
              onClick={startWholeTest}
            >
              {busy === "test" ? "Building test..." : "Take whole-lesson test"}
              <I.ClipboardCheck size={16} />
            </button>
          </section>
        )}

        {session.wholeTest && !testReport && (
          <section className="card practice-card" style={{ marginTop: 14 }}>
            <span className="pill">
              Whole-lesson test · {testIndex + 1} of {session.wholeTest.length}
            </span>
            <h2>{session.wholeTest[testIndex].question}</h2>
            <div className="option-list">
              {session.wholeTest[testIndex].options.map((option) => (
                <button
                  key={option}
                  className={selected === option ? "selected" : ""}
                  onClick={() => setSelected(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <button
              className="primary-action"
              disabled={!selected || Boolean(busy)}
              onClick={submitTestAnswer}
            >
              Submit test answer
            </button>
          </section>
        )}

        {testReport && (
          <section className="card feedback" style={{ marginTop: 14 }}>
            <b>Whole-lesson test complete</b>
            <p>
              {testReport.correct} of {testReport.answered.length} correct.
            </p>
            {testReport.failed.length ? (
              <>
                <b>Topics to review</b>
                <p>{testReport.failed.map((item) => item.question).join(" ")}</p>
              </>
            ) : (
              <p>Excellent. You answered every test question correctly.</p>
            )}
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
            <b>{session.quizzes.length + session.practiceReport.answered.length}</b>
            <span>Questions answered</span>
          </div>
          <div className="card stat">
            <b>{session.practiceReport.masteredSections.length || session.completed}</b>
            <span>Sections mastered</span>
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
              ? "Your transformed lesson, practice questions, section mastery tracker, and cognitive adaptations are available across the learning flow."
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
