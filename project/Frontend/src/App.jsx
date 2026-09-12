import React, { createContext, useContext, useState } from "react";
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
import VoiceAssistant from "./components/VoiceAssistant";
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
} from "./engine/signals";
import { measureOutcome } from "./engine/scale";

const PROFILE_LABELS = {
  dyslexia: "Dyslexia support",
  cognitive_load: "Cognitive load support",
  low_vision: "Low vision and clarity",
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
      setSession((current) => ({ ...current, error: error.message || "An unexpected error occurred." }));
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

        // Organic cognitive tracking trigger
        const isCorrect = result.is_correct;
        const updatedSignals = recordQuizAnswer(current.signals, isCorrect, 4000);
        const evalState = evaluateSignals(updatedSignals, current.sessionMeta);

        return {
          ...current,
          signals: updatedSignals,
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

  // Organic SCALE Signals & REWIRE Adaptation Trigger
  async function triggerRewireForChunk(chunkIndex, chunkText, struggleExplanation = "Detected difficulty during reading and comprehension checks.") {
    return run("rewire", async () => {
      const evaluation = evaluateSignals(session.signals, session.sessionMeta);
      const targetLevel = evaluation.adaptationStrategy?.newVariantLevel ?? 2;
      const actions = evaluation.adaptationStrategy?.additionalActions ?? ["increase_simplification", "add_visual_description"];

      let adaptedData = null;
      try {
        adaptedData = await rewireContent({
          chunkText: chunkText || session.text,
          profile: session.profile,
          variantLevel: targetLevel,
          actions,
          struggleExplanation,
        });
      } catch (err) {
        adaptedData = {
          adapted_text: chunkText,
          variant_level: targetLevel,
          explanation: struggleExplanation,
          actions_applied: actions,
        };
      }

      const updatedMeta = applyAdaptation(session.sessionMeta, evaluation);
      updatedMeta.preAccuracy = 0.0;

      setSession((current) => ({
        ...current,
        sessionMeta: updatedMeta,
        rewireState: {
          active: true,
          adaptedContent: adaptedData,
          evaluation,
          chunkIndex,
        },
        latestOutcome: null,
      }));
      return adaptedData;
    });
  }

  function recordRereadAction(chunkIndex, chunkText) {
    setSession((current) => {
      const updatedSignals = recordReread(current.signals);
      const evalState = evaluateSignals(updatedSignals, current.sessionMeta);
      
      // Auto-trigger REWIRE if struggle score passes threshold (>= 0.5)
      if (evalState.struggleScore >= 0.5 && !current.rewireState.active) {
        setTimeout(() => {
          triggerRewireForChunk(chunkIndex, chunkText, evalState.explanation);
        }, 100);
      }

      return { ...current, signals: updatedSignals };
    });
  }

  function recordHelpAction(chunkIndex, chunkText) {
    setSession((current) => {
      const updatedSignals = recordHelpRequest(current.signals);
      const evalState = evaluateSignals(updatedSignals, current.sessionMeta);

      if (evalState.struggleScore >= 0.5 && !current.rewireState.active) {
        setTimeout(() => {
          triggerRewireForChunk(chunkIndex, chunkText, evalState.explanation);
        }, 100);
      }

      return { ...current, signals: updatedSignals };
    });
  }

  function recordVoiceHelpAction() {
    setSession((current) => {
      const updatedSignals = recordVoiceHelp(current.signals);
      return { ...current, signals: updatedSignals };
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
          struggleScore: session.rewireState.evaluation?.struggleScore || 0.7,
        });
      } catch (err) {
        quizData = await generateQuiz(chunk, session.profile);
      }
      setSession((current) => ({
        ...current,
        quizzes: [...current.quizzes, quizData],
      }));
      return quizData;
    });
  }

  function recordQuizAnswerAction(isCorrect) {
    setSession((current) => {
      const updatedSignals = recordQuizAnswer(current.signals, isCorrect, 4000);
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
        triggerRewireForChunk,
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
  return (
    <header className="topbar">
      <NavLink to="/progress" className="brand">
        <div className="logo">A</div>
        <div>
          <div className="brandname">AdaptLearn</div>
          <div className="subtitle">{section}</div>
        </div>
      </NavLink>
      <div className="header-right">
        {session.rewireState?.active && (
          <span className="rewire-tag">
            <I.Zap size={12} style={{ marginRight: 4 }} /> REWIRED
          </span>
        )}
        <button
          type="button"
          className="voice-status-pill"
          onClick={() => {
            const el = document.querySelector(".voice-assistant-card");
            if (el) {
              el.scrollIntoView({ behavior: "smooth" });
              const btn = el.querySelector("button[aria-label='Toggle voice input']");
              if (btn) btn.click();
            }
          }}
          title="Voice Assistant & Speech-to-Text (Click to activate voice)"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            background: "rgba(99, 102, 241, 0.09)",
            border: "1px solid rgba(99, 102, 241, 0.22)",
            borderRadius: 99,
            padding: "5px 11px",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--primary)",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          <I.Mic size={13} />
          <span>Voice</span>
        </button>
        <div className="access-badge">
          <span className="access-dot" />
          <span>{PROFILE_LABELS[session.profile]}</span>
        </div>
        <div className="avatar">AL</div>
      </div>
    </header>
  );
}

function Layout({ children, section }) {
  const location = useLocation();
  const { session } = useSession();
  const items = [
    ["/upload", "Upload", I.CloudUpload],
    ["/learn", "Learn", I.BookOpen],
    ["/practice", "Practice", I.BadgeHelp],
    ["/progress", "Progress", I.BarChart3],
  ];

  return (
    <div className="app-container">
      <div className="desktop-layout">
        <aside className="desktop-sidebar">
          <NavLink to="/progress" className="brand" style={{ marginBottom: 12 }}>
            <div className="logo">A</div>
            <div>
              <div className="brandname">AdaptLearn</div>
              <div className="subtitle">Adaptive Engine</div>
            </div>
          </NavLink>

          <nav className="sidebar-nav">
            {items.map(([to, label, Icon]) => (
              <NavLink
                key={to}
                to={to}
                className={`sidebar-link ${location.pathname === to ? "active" : ""}`}
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div
            style={{
              padding: 14,
              background: "linear-gradient(135deg, rgba(238, 242, 255, 0.8), rgba(245, 243, 257, 0.8))",
              borderRadius: 14,
              border: "1px solid rgba(199, 210, 254, 0.6)",
              marginTop: "auto",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "var(--primary)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Active Profile
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginTop: 4 }}>
              {PROFILE_LABELS[session.profile]}
            </div>
            {session.fileName && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                <I.FileText size={12} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.fileName}</span>
              </div>
            )}
          </div>
        </aside>

        <div className="main-content">
          <Header section={section} />
          {children}
        </div>
      </div>

      <nav className="bottom-nav">
        {items.map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            className={`nav-item ${location.pathname === to ? "active" : ""}`}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function ErrorNotice() {
  const { session } = useSession();
  return session.error ? (
    <div
      style={{
        background: "var(--amber-light)",
        border: "1px solid #fde68a",
        color: "#92400e",
        padding: "12px 16px",
        borderRadius: 12,
        marginTop: 14,
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <I.AlertCircle size={18} style={{ flexShrink: 0 }} />
      <span>{session.error}</span>
    </div>
  ) : null;
}

function Upload() {
  const { session, busy, upload, setText } = useSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState("upload");
  const [draft, setDraft] = useState(session.text);
  const ready = Boolean(session.text.trim());

  return (
    <Layout section="Upload">
      <main className="page">
        <div className="eyebrow">
          <b>Step 1 of 3</b>
          <span>Document Extraction & Setup</span>
        </div>
        <h1 className="page-title">Add learning material</h1>

        <section className="hero-card">
          <b>Smart Document Reader</b>
          <p>
            Upload your document or paste lesson text. AdaptLearn automatically extracts content, preserves context, and transforms it according to your accessibility preferences.
          </p>
        </section>

        <div className="segmented">
          {[
            ["upload", "Upload File"],
            ["text", "Paste Raw Text"],
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

        <section className="card" style={{ marginTop: 16, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span className="pill">
              <I.Zap size={13} /> OCR Fallback & Intelligent Extractor
            </span>
            {ready && (
              <span className="pill" style={{ background: "var(--emerald-light)", color: "#047857" }}>
                <I.Check size={13} /> Content Loaded
              </span>
            )}
          </div>

          {tab === "upload" ? (
            <label className="dropzone">
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx,.epub,.txt"
                onChange={(event) => upload(event.target.files?.[0])}
              />
              <I.UploadCloud size={40} />
              <b>{session.fileName || "Choose a document to upload"}</b>
              <span>Supports PDF, DOCX, EPUB, or TXT (up to 45MB)</span>
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
              background: "#f8fafc",
              border: "1px solid var(--border-color)",
              borderRadius: 14,
              padding: 14,
              fontSize: 12,
              marginTop: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span style={{ color: busy === "extract" ? "var(--primary)" : "var(--ink)" }}>
                {busy === "extract"
                  ? "Extracting document content..."
                  : ready
                    ? "Ready for adaptation"
                    : "Waiting for content"}
              </span>
              <span style={{ color: "var(--muted)" }}>{session.wordCount} words</span>
            </div>

            <div className="progressbar" style={{ marginTop: 10 }}>
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
                  marginTop: 12,
                  background: "#ffffff",
                  border: "1px solid var(--border-color)",
                  padding: 12,
                  borderRadius: 10,
                  maxHeight: 100,
                  overflow: "auto",
                  lineHeight: 1.5,
                  color: "#475569",
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
          style={{ marginTop: 20 }}
        >
          Continue to learner profile <I.ArrowRight size={18} />
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
      "Dyslexia support",
      "Shorter sentences, clear dyslexia-friendly spacing, and reduced visual crowding.",
      I.BookOpen,
    ],
    [
      "cognitive_load",
      "Cognitive load support",
      "Digestible chunked sections presenting one main concept at a time.",
      I.Layers,
    ],
    [
      "low_vision",
      "Low vision and clarity",
      "High contrast theme guidance, larger typography, and distinct line height.",
      I.Eye,
    ],
  ];

  return (
    <Layout section="Profile">
      <main className="page">
        <div className="eyebrow">
          <b>Step 2 of 3</b>
          <span>Choose learning mode</span>
        </div>
        <h1 className="page-title">How should this lesson feel?</h1>

        <div className="profile-grid">
          {cards.map(([profile, title, descriptionText, Icon]) => (
            <button
              key={profile}
              className={`profile-option ${session.profile === profile ? "active" : ""}`}
              onClick={() => chooseProfile(profile)}
            >
              <span className="radio" />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon size={18} style={{ color: session.profile === profile ? "var(--primary)" : "var(--muted)" }} />
                  <b>{title}</b>
                </div>
                <small>{descriptionText}</small>
              </div>
            </button>
          ))}
        </div>

        <section className="card" style={{ marginTop: 20, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <I.Sparkles size={16} style={{ color: "var(--primary)" }} />
            <b style={{ fontSize: 15, color: "var(--ink)" }}>Describe your learning needs</b>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 10px 0" }}>
            Not sure which setting is best? Describe what reading format works best for you and AI will choose.
          </p>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="For example: long paragraphs are hard for me to follow"
            style={{ width: "100%", minHeight: 80 }}
          />
          <button
            className="secondary-action"
            disabled={!description.trim() || Boolean(busy)}
            onClick={() => detect(description)}
            style={{ marginTop: 10, width: "100%" }}
          >
            {busy === "profile" ? "Detecting profile..." : "Detect profile"}
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
          style={{ marginTop: 20 }}
        >
          {busy === "transform" ? "Adapting lesson..." : "Transform lesson"}
          <I.Sparkles size={18} />
        </button>
      </main>
    </Layout>
  );
}

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

  if (error) {
    return (
      <section className="card" style={{ padding: 18, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#b91c1c" }}>
          <I.AlertCircle size={20} />
          <span>{error}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="card" style={{ marginTop: 16, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <span className="pill" style={{ background: source === "pdf" ? "#fef3c7" : "var(--primary-light)", color: source === "pdf" ? "#92400e" : "var(--primary)", marginBottom: 6 }}>
            {source === "pdf" ? "SOURCE VISUAL" : "EDUCATIONAL INFOGRAPHIC"}
          </span>
          {title && <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 18, margin: "4px 0 0", color: "var(--ink)" }}>{title}</h2>}
          {subtitle && <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>{subtitle}</p>}
        </div>
      </div>

      <VisualInfographic
        spec={spec}
        sourceImages={source_images}
        svgHtmlFallback={svg_html}
        onReadAloud={onReadAloud}
      />

      {explanation && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-color)" }}>
          <b style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
            <I.Lightbulb size={14} /> Understand It
          </b>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#334155", marginTop: 4 }}>{explanation}</p>
        </div>
      )}

      {key_takeaways.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <b style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Key Takeaways</b>
          <ul style={{ marginTop: 6, paddingLeft: 20 }}>
            {key_takeaways.map((t, i) => (
              <li key={i} style={{ fontSize: 13, color: "#334155", marginBottom: 4, lineHeight: 1.5 }}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {why_visual && (
        <div className="visual-description-box" style={{ marginTop: 12 }}>
          <span style={{ fontWeight: 700, color: "#854d0e" }}>Why this infographic? </span>
          <span style={{ color: "#713f12" }}>{why_visual}</span>
        </div>
      )}

      {explanation && (
        <button
          className="secondary-action"
          style={{ marginTop: 14, fontSize: 12, padding: "8px 14px" }}
          onClick={() => onReadAloud && onReadAloud(explanation + " " + key_takeaways.join(". "))}
        >
          <I.Volume2 size={14} /> Read explanation
        </button>
      )}
    </section>
  );
}

function splitIntoLessonSections(text) {
  if (!text || typeof text !== "string") return [];
  const clean = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!clean) return [];

  const lines = clean.split("\n");

  // Patterns for logical section headings:
  // e.g. "1. What is OOP?", "1) Introduction", "Section 1:", "Chapter 2", "## Topic"
  const numberedHeadingRegex = /^(\d+)[\.\)]\s+([A-Z].*)$/;
  const mdHeadingRegex = /^#{1,4}\s+(.*)$/;
  const labelHeadingRegex = /^(?:Chapter|Section|Module|Part|Topic)\s+\d+[:\.]?\s*(.*)$/i;

  let firstHeadingNum = null;
  let matchesCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const numM = trimmed.match(numberedHeadingRegex);
    if (numM) {
      const num = parseInt(numM[1], 10);
      if (firstHeadingNum === null && (num === 1 || num === 0)) {
        firstHeadingNum = num;
      }
      matchesCount++;
    } else if (mdHeadingRegex.test(trimmed) || labelHeadingRegex.test(trimmed)) {
      matchesCount++;
    }
  }

  const hasHeadings = matchesCount >= 2;

  if (hasHeadings) {
    const sections = [];
    let currentLines = [];
    let expectedNextNumber = firstHeadingNum !== null ? firstHeadingNum : 1;
    let headingSeen = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) {
        if (currentLines.length > 0) currentLines.push("");
        continue;
      }

      const numM = trimmed.match(numberedHeadingRegex);
      const isMd = mdHeadingRegex.test(trimmed);
      const isLabel = labelHeadingRegex.test(trimmed);

      let isNewHeading = false;
      if (numM) {
        const num = parseInt(numM[1], 10);
        if (num === expectedNextNumber) {
          isNewHeading = true;
          expectedNextNumber = num + 1;
        }
      } else if (isMd || isLabel) {
        isNewHeading = true;
      }

      if (isNewHeading) {
        if (!headingSeen) {
          headingSeen = true;
          // Preamble before first heading (e.g. document title / subtitle)
          if (currentLines.length > 0) {
            const preambleText = currentLines.join("\n").trim();
            // If preamble is short (title / subtitle), attach it to the first section
            if (preambleText.split(/\s+/).length < 40) {
              currentLines = [preambleText, "", trimmed];
            } else {
              sections.push(preambleText);
              currentLines = [trimmed];
            }
          } else {
            currentLines = [trimmed];
          }
        } else {
          if (currentLines.length > 0) {
            sections.push(currentLines.join("\n").trim());
          }
          currentLines = [trimmed];
        }
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      sections.push(currentLines.join("\n").trim());
    }

    const filtered = sections.map((s) => s.trim()).filter(Boolean);
    if (filtered.length >= 2) {
      return filtered;
    }
  }

  // Fallback 2: Check for double line breaks (paragraphs)
  const paragraphs = clean.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length >= 2 && paragraphs.length <= 15) {
    return paragraphs;
  }

  // Fallback 3: Group paragraphs or sentences into 3-5 sentence chunks
  const sentenceRegex = /(?<=[.!?])\s+(?=[A-Z0-9])/;
  const rawParts = (paragraphs.length > 1 ? paragraphs : clean.split(sentenceRegex))
    .map((p) => p.trim())
    .filter(Boolean);

  const groupedSections = [];
  let currentGroup = [];
  let currentWordCount = 0;

  for (const part of rawParts) {
    const words = part.split(/\s+/).length;
    currentGroup.push(part);
    currentWordCount += words;

    // Group around 3-5 sentences or 60-120 words
    if (currentWordCount >= 70 || currentGroup.length >= 4) {
      groupedSections.push(currentGroup.join("\n\n").trim());
      currentGroup = [];
      currentWordCount = 0;
    }
  }

  if (currentGroup.length > 0) {
    if (groupedSections.length > 0 && currentWordCount < 30) {
      groupedSections[groupedSections.length - 1] += "\n\n" + currentGroup.join("\n\n").trim();
    } else {
      groupedSections.push(currentGroup.join("\n\n").trim());
    }
  }

  return groupedSections.length > 0 ? groupedSections : [clean];
}

function Learn() {
  const {
    session,
    busy,
    adapt,
    ask,
    getVisual,
    completeChunk,
    completeSection,
    recordRereadAction,
    recordHelpAction,
    recordVoiceHelpAction,
    dismissRewire,
  } = useSession();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState(0);
  const [playing, setPlaying] = useState(false);

  const transformed = session.transformed;
  const chunks =
    transformed?.profile === "cognitive_load"
      ? transformed.chunks
      : [transformed?.text || session.text];

  let globalIndex = 0;
  const sections = chunks.filter(Boolean).flatMap((chunk, chunkIndex) => {
    const parts = splitIntoLessonSections(chunk);
    return parts.map((paragraph, paragraphIndex) => {
      const idx = globalIndex++;
      return {
        id: `${chunkIndex}-${paragraphIndex}`,
        paragraph,
        chunk: chunkIndex + 1,
        chunkIndex,
        sectionIndex: idx,
      };
    });
  });

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
      if (playing) {
        window.speechSynthesis.cancel();
        setPlaying(false);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
      setPlaying(true);
      utterance.onend = () => setPlaying(false);
      utterance.onerror = () => setPlaying(false);
    }
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
    (currentSection?.sectionIndex === session.rewireState.chunkIndex ||
      currentSection?.chunkIndex === session.rewireState.chunkIndex ||
      (chunks.length === 1 && session.rewireState.chunkIndex === activeSection));
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
            <h1 className="page-title" style={{ margin: "4px 0" }}>Your adapted lesson</h1>
            <p className="lesson-subtitle">
              One section at a time · {sections.length} readable sections
            </p>
          </div>
          <button
            className="icon-action"
            onClick={() =>
              readAloud(sections.map((s) => s.paragraph).join("\n\n"))
            }
          >
            <I.Volume2 size={16} />
            {playing ? "Stop reading" : "Read all"}
          </button>
        </div>

        {/* Real-Time SCALE Cognitive Telemetry Bar */}
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
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <I.Activity size={14} style={{ color: "var(--primary)" }} />
              SCALE Cognitive Monitor: <b>{(struggleScore * 100).toFixed(0)}% struggle score</b>
              {struggleScore >= 0.6 ? " (REWIRE Active)" : " (Optimal Comprehension)"}
            </span>
          </div>
        </div>

        {/* REWIRE Restructuring Banner */}
        {session.rewireState.active && (
          <div className="rewire-banner">
            <div className="rewire-header">
              <span className="rewire-tag">
                <I.Zap size={13} style={{ marginRight: 4 }} /> REWIRE ACTIVATED
              </span>
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: 4,
                }}
                onClick={dismissRewire}
              >
                <I.X size={16} />
              </button>
            </div>
            <div className="rewire-title">
              Cognitive Adaptation Applied
            </div>
            <p className="rewire-explanation">
              {session.rewireState.adaptedContent?.explanation ||
                session.rewireState.evaluation?.explanation ||
                "Increased comprehension struggle was detected. The material has been automatically restructured into clearer terms."}
            </p>
            <div className="rewire-actions-pills">
              {(
                session.rewireState.adaptedContent?.actions_applied || [
                  "increase_simplification",
                  "add_visual_description",
                ]
              ).map((act) => (
                <span key={act} className="rewire-action-pill">
                  <I.Check size={11} style={{ marginRight: 3 }} /> {act.replace(/_/g, " ")}
                </span>
              ))}
            </div>
            <button
              className="primary-action"
              style={{
                marginTop: 14,
                background: "var(--primary-gradient)",
                color: "#ffffff",
                fontWeight: 700,
                width: "100%",
              }}
              onClick={() => navigate("/practice")}
            >
              Take Adapted Practice Quiz <I.ArrowRight size={16} />
            </button>
          </div>
        )}

        {!transformed ? (
          <section className="card empty-state" style={{ marginTop: 20 }}>
            <I.BookOpen size={36} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>
              This lesson has not been adapted yet.
            </p>
            <button className="primary-action" onClick={adapt} style={{ maxWidth: 220, margin: "0 auto" }}>
              Adapt now <I.Sparkles size={16} />
            </button>
          </section>
        ) : (
          <>
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

            <section className={`lesson-sections active-section ${lessonClass}`}>
              <div className="lesson-sections-header">
                <span className="pill">
                  {currentSection?.chunk > 1
                    ? `Learning chunk ${currentSection.chunk}`
                    : "Core idea"}
                </span>
                <span className="reading-note">Read at your own pace</span>
              </div>

              {currentSection && (
                <article className={`lesson-section ${isAdapted ? "adapted-chunk-card" : ""}`}>
                  <div className="section-number">
                    {String(activeSection + 1).padStart(2, "0")}
                  </div>
                  <div className="section-content">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div className="section-label">
                        {isAdapted ? "REWIRED CONCEPT" : `Section ${activeSection + 1}`}
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
                        whiteSpace: "pre-line",
                      }}
                    >
                      {displayText}
                    </p>

                    {isAdapted && session.rewireState.adaptedContent?.visual_description && (
                      <div className="visual-description-box">
                        <div className="visual-description-label">
                          <I.Image size={14} /> Visual Mental Model
                        </div>
                        <p className="visual-description-text">
                          {session.rewireState.adaptedContent.visual_description}
                        </p>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 12, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        className="text-action"
                        onClick={() => readAloud(displayText)}
                      >
                        <I.Volume2 size={14} /> Read section
                      </button>
                      <span style={{ color: "#cbd5e1" }}>•</span>
                      <button
                        className="text-action"
                        onClick={() => recordRereadAction(activeSection, currentSection.paragraph)}
                      >
                        <I.RotateCcw size={13} /> Re-read section
                      </button>
                      <span style={{ color: "#cbd5e1" }}>•</span>
                      <button
                        className="text-action"
                        onClick={() => recordHelpAction(activeSection, currentSection.paragraph)}
                      >
                        <I.HelpCircle size={13} /> Request explanation
                      </button>
                    </div>
                  </div>
                </article>
              )}
            </section>

            <div className="section-actions">
              <button
                className="secondary-action"
                disabled={activeSection === 0}
                onClick={() => setActiveSection((index) => index - 1)}
              >
                <I.ArrowLeft size={16} /> Previous
              </button>
              <button className="primary-action" onClick={markSectionComplete}>
                {isComplete
                  ? activeSection === sections.length - 1
                    ? "All sections complete"
                    : "Next section"
                  : "Mark section complete"}
                <I.Check size={18} />
              </button>
            </div>

            <div className="section-jump">
              {sections.map((section, index) => (
                <button
                  key={section.id}
                  className={`${index === activeSection ? "current" : ""} ${completedSections.includes(index) ? "done" : ""}`}
                  onClick={() => setActiveSection(index)}
                >
                  {completedSections.includes(index) ? (
                    <I.Check size={14} />
                  ) : (
                    index + 1
                  )}
                </button>
              ))}
            </div>

            <button
              className="secondary-action"
              disabled={Boolean(busy)}
              onClick={getVisual}
              style={{ width: "100%", marginTop: 14 }}
            >
              <I.PieChart size={16} />
              {busy === "visual"
                ? "Building infographic visual..."
                : "Generate Visual Infographic"}
            </button>

            {session.visual && (
              <VisualCard
                visual={session.visual}
                onReadAloud={(text) => readAloud(text)}
              />
            )}

            <VoiceAssistant
              currentSection={currentSection}
              onAsk={ask}
              busy={busy}
              onVoiceHelp={recordVoiceHelpAction}
              onReadSection={() => readAloud(displayText)}
            />

            <ErrorNotice />
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

  const [adaptiveQuiz, setAdaptiveQuiz] = useState(null);
  const [adaptiveSelected, setAdaptiveSelected] = useState("");
  const [adaptiveSubmitted, setAdaptiveSubmitted] = useState(false);

  const [sectionIndex, setSectionIndex] = useState(0);
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState("");
  const [report, setReport] = useState(null);

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
          <b>Mastery Practice</b>
          <span>
            {session.practiceReport.masteredSections.length}/{chunks.length} mastered
          </span>
        </div>
        <h1 className="page-title">Check your understanding</h1>

        {/* REWIRE Adaptive Question Card */}
        {isRewireActive && (
          <section className="card" style={{ marginBottom: 16, padding: 20, border: "2px solid #a855f7" }}>
            <div
              style={{
                background: "#f3e8ff",
                color: "#7e22ce",
                padding: "6px 12px",
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 12,
              }}
            >
              <I.Zap size={13} />
              <span>Adaptive Question: Calibrated to Simplified Level</span>
            </div>

            {!adaptiveQuiz ? (
              <div>
                <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 12 }}>
                  Generate an adaptive question calibrated to your learning recovery.
                </p>
                <button
                  className="primary-action"
                  disabled={Boolean(busy)}
                  onClick={loadAdaptiveQuiz}
                >
                  {busy === "quiz" ? "Generating..." : "Generate Adaptive Question"}
                  <I.HelpCircle size={18} />
                </button>
              </div>
            ) : (
              <div className="practice-card" style={{ padding: 0 }}>
                <h2 style={{ fontSize: 18, marginBottom: 14 }}>{adaptiveQuiz.question}</h2>
                <div className="option-list">
                  {adaptiveQuiz.options.map((option, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    return (
                      <button
                        key={option}
                        className={adaptiveSelected === option ? "selected" : ""}
                        onClick={() => !adaptiveSubmitted && setAdaptiveSelected(option)}
                      >
                        <span style={{
                          width: 24, height: 24, borderRadius: 6,
                          background: adaptiveSelected === option ? "var(--primary)" : "#e2e8f0",
                          color: adaptiveSelected === option ? "#fff" : "var(--muted)",
                          display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0
                        }}>{letter}</span>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  className="primary-action"
                  disabled={!adaptiveSelected || adaptiveSubmitted}
                  onClick={handleAdaptiveSubmit}
                >
                  {adaptiveSubmitted
                    ? adaptiveSelected === adaptiveQuiz.answer
                      ? "Correct"
                      : "Review Answer"
                    : "Submit Answer"}
                </button>

                {adaptiveSubmitted && (
                  <div className={`feedback ${adaptiveSelected === adaptiveQuiz.answer ? "correct-feedback" : "failed-feedback"}`} style={{ marginTop: 14 }}>
                    <b style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      {adaptiveSelected === adaptiveQuiz.answer ? (
                        <><I.CheckCircle2 size={16} /> Correct</>
                      ) : (
                        <><I.AlertCircle size={16} /> Answer: {adaptiveQuiz.answer}</>
                      )}
                    </b>
                    <p>{adaptiveQuiz.explanation}</p>
                  </div>
                )}

                {adaptiveSubmitted && session.latestOutcome && (
                  <div className="outcome-card" style={{ marginTop: 14 }}>
                    <div className="outcome-title">
                      <span className="outcome-delta-badge">
                        +{((session.latestOutcome.outcomeDelta || 1) * 100).toFixed(0)}%
                      </span>
                      <span>SCALE Outcome: Struggle Successfully Resolved</span>
                    </div>
                    <p style={{ fontSize: 13, color: "#065f46", margin: "6px 0 10px", lineHeight: 1.5 }}>
                      Cognitive restructuring enabled mastery. Accuracy improved significantly following adaptation.
                    </p>
                    <button
                      className="primary-action"
                      style={{ background: "#059669", fontSize: 12, padding: "8px 14px", width: "auto" }}
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

        <section className="card practice-report" style={{ padding: 18 }}>
          <b style={{ fontSize: 15, color: "var(--ink)", fontFamily: "var(--font-heading)" }}>Section Report</b>
          <div className="stats-grid" style={{ marginTop: 12 }}>
            <div className="stat">
              <b>{session.practiceReport.answered.length}</b>
              <span>Answered</span>
            </div>
            <div className="stat">
              <b>{session.practiceReport.failed.length}</b>
              <span>Need Review</span>
            </div>
            <div className="stat">
              <b>{session.practiceReport.masteredSections.length}</b>
              <span>Mastered</span>
            </div>
            <div className="stat">
              <b>{chunks.length}</b>
              <span>Total Sections</span>
            </div>
          </div>
        </section>

        {!sectionText ? (
          <section className="card empty-state" style={{ marginTop: 16 }}>
            <I.BadgeHelp size={36} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 15, color: "var(--ink)", fontWeight: 600 }}>Adapt a lesson first to generate section questions.</p>
          </section>
        ) : (
          <section className="card practice-card" style={{ marginTop: 16 }}>
            <span className="pill">Section {sectionIndex + 1} of {chunks.length}</span>
            <p className="practice-context" style={{ marginTop: 8 }}>Questions are generated from this lesson section.</p>

            {!quiz ? (
              <div style={{ marginTop: 16, textAlign: "center" }}>
                <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>Complete the section check before moving to the next topic.</p>
                <button className="primary-action" disabled={Boolean(busy)} onClick={loadSectionQuestion}>
                  {busy === "quiz" ? "Generating question..." : "Start section question"}
                  <I.HelpCircle size={18} />
                </button>
              </div>
            ) : (
              <>
                <h2>{quiz.question}</h2>
                <div className="option-list">
                  {quiz.options.map((option, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    return (
                      <button
                        key={option}
                        className={selected === option ? "selected" : ""}
                        onClick={() => !report && setSelected(option)}
                      >
                        <span style={{
                          width: 24, height: 24, borderRadius: 6,
                          background: selected === option ? "var(--primary)" : "#e2e8f0",
                          color: selected === option ? "#fff" : "var(--muted)",
                          display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0
                        }}>{letter}</span>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>
                {!report ? (
                  <button className="primary-action" disabled={!selected || Boolean(busy)} onClick={submitSectionAnswer}>
                    {busy === "evaluate" ? "Evaluating answer..." : "Submit answer"}
                  </button>
                ) : (
                  <div className={`feedback ${report.is_correct ? "correct-feedback" : "failed-feedback"}`}>
                    <b style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      {report.is_correct ? (
                        <><I.CheckCircle2 size={16} /> Correct! Section mastered.</>
                      ) : (
                        <><I.AlertCircle size={16} /> Review this topic</>
                      )}
                    </b>
                    <p>{report.explanation}</p>
                    <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                      {!report.is_correct && (
                        <button className="secondary-action" onClick={loadSectionQuestion}>
                          Retry this topic
                        </button>
                      )}
                      {report.is_correct && sectionIndex < chunks.length - 1 && (
                        <button className="primary-action" onClick={() => { setSectionIndex((index) => index + 1); setQuiz(null); setReport(null); }}>
                          Continue to next section <I.ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {allSectionsMastered && !session.wholeTest && (
          <section className="card mastery-unlocked" style={{ marginTop: 16 }}>
            <b style={{ fontSize: 16, color: "#065f46", display: "flex", alignItems: "center", gap: 8 }}>
              <I.Award size={20} /> All Sections Mastered
            </b>
            <p style={{ margin: "6px 0 14px" }}>You can now take a comprehensive test covering the entire extracted lesson.</p>
            <button className="primary-action" disabled={Boolean(busy)} onClick={startWholeTest} style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}>
              {busy === "test" ? "Building test..." : "Take whole-lesson test"}
              <I.ClipboardCheck size={18} />
            </button>
          </section>
        )}

        {session.wholeTest && !testReport && (
          <section className="card practice-card" style={{ marginTop: 16 }}>
            <span className="pill">Whole-lesson test · {testIndex + 1} of {session.wholeTest.length}</span>
            <h2>{session.wholeTest[testIndex].question}</h2>
            <div className="option-list">
              {session.wholeTest[testIndex].options.map((option, idx) => {
                const letter = String.fromCharCode(65 + idx);
                return (
                  <button key={option} className={selected === option ? "selected" : ""} onClick={() => setSelected(option)}>
                    <span style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: selected === option ? "var(--primary)" : "#e2e8f0",
                      color: selected === option ? "#fff" : "var(--muted)",
                      display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0
                    }}>{letter}</span>
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>
            <button className="primary-action" disabled={!selected || Boolean(busy)} onClick={submitTestAnswer}>
              Submit test answer
            </button>
          </section>
        )}

        {testReport && (
          <section className="card feedback correct-feedback" style={{ marginTop: 16, padding: 20 }}>
            <b style={{ fontSize: 16, display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <I.Award size={20} /> Whole-lesson test complete
            </b>
            <p style={{ fontSize: 14 }}>You scored {testReport.correct} of {testReport.answered.length} correct.</p>
            {testReport.failed.length ? (
              <div style={{ marginTop: 10 }}>
                <b>Topics to review:</b>
                <p style={{ marginTop: 4 }}>{testReport.failed.map((item) => item.question).join(" ")}</p>
              </div>
            ) : (
              <p style={{ marginTop: 6, fontWeight: 600 }}>Excellent work! You answered every test question correctly.</p>
            )}
          </section>
        )}

        <ErrorNotice />
      </main>
    </Layout>
  );
}

function Progress() {
  const { session } = useSession();

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
          <b>Session Progress</b>
          <span>{session.fileName || "No lesson loaded"}</span>
        </div>
        <h1 className="page-title">Your learning session</h1>

        <div className="stats-grid">
          <div className="stat">
            <b>{session.wordCount}</b>
            <span>Source Words</span>
          </div>
          <div className="stat">
            <b>{chunks}</b>
            <span>Learning Chunks</span>
          </div>
          <div className="stat">
            <b>{session.quizzes.length + session.practiceReport.answered.length}</b>
            <span>Questions Answered</span>
          </div>
          <div className="stat">
            <b>{session.practiceReport.masteredSections.length || session.completed}</b>
            <span>Sections Mastered</span>
          </div>
        </div>

        {/* SCALE Engine Cognitive Telemetry Card */}
        <section className="card" style={{ marginTop: 18, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="pill" style={{ background: "#f3e8ff", color: "#7e22ce" }}>
              <I.Activity size={13} /> SCALE Cognitive Telemetry
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
              Variant Level: {session.sessionMeta.currentVariantLevel}
            </span>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
              <span>Current Struggle Score</span>
              <span>{(struggleScore * 100).toFixed(0)}% / 100%</span>
            </div>
            <div className="progressbar" style={{ marginTop: 8, height: 12 }}>
              <div
                className="progressfill"
                style={{
                  width: `${Math.min(100, struggleScore * 100)}%`,
                  background:
                    struggleScore >= 0.6
                      ? "linear-gradient(90deg, #7c3aed 0%, #a855f7 100%)"
                      : struggleScore >= 0.4
                      ? "linear-gradient(90deg, #f59e0b 0%, #d97706 100%)"
                      : "linear-gradient(90deg, #10b981 0%, #059669 100%)",
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 12, border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontWeight: 800 }}>
                Total Adaptations
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginTop: 2, fontFamily: "var(--font-heading)" }}>
                {session.sessionMeta.totalAdaptations}
              </div>
            </div>
            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 12, border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontWeight: 800 }}>
                Latest Outcome Delta
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--emerald)", marginTop: 2, fontFamily: "var(--font-heading)" }}>
                {latestOutcome ? `+${((latestOutcome.outcomeDelta || 1) * 100).toFixed(0)}%` : "N/A"}
              </div>
            </div>
          </div>
        </section>

        {/* Adaptation History Timeline */}
        <section className="card" style={{ marginTop: 18, padding: 20 }}>
          <b style={{ fontSize: 16, color: "var(--ink)", fontFamily: "var(--font-heading)" }}>Cognitive Adaptation Log</b>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            Real-time interventions triggered by the SCALE behavioral engine.
          </p>

          {history.length === 0 ? (
            <div style={{ padding: "18px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              <p>No struggle adaptations triggered in this session yet.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
              {history.map((rec) => (
                <div
                  key={rec.id}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid var(--border-color)",
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ fontWeight: 800, color: "var(--primary)" }}>
                      Level {rec.previousLevel} → Level {rec.newLevel}
                    </span>
                    <span style={{ color: "var(--muted)" }}>
                      Struggle Score: {(rec.struggleScore * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: "#334155", margin: "6px 0", lineHeight: 1.5 }}>
                    {rec.explanation}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <span className="pill" style={{ background: "#ecfdf5", color: "#047857", fontSize: 11 }}>
                      Outcome: Accuracy Improvement Recorded
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card" style={{ marginTop: 18, padding: 22 }}>
          <span className="pill" style={{ marginBottom: 10 }}>
            {PROFILE_LABELS[session.profile]}
          </span>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 22, margin: "6px 0" }}>
            {transformed ? "Lesson adapted & active" : "Ready to begin"}
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            {transformed
              ? "Your transformed lesson, practice questions, section mastery tracker, and cognitive adaptations are available across the learning flow."
              : "Upload a document or choose a profile to start your study session."}
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
