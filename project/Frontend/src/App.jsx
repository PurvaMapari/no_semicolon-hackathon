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
  computeSessionStruggleScore,
} from "./engine/signals";
import { measureOutcome } from "./engine/scale";

const PROFILE_LABELS = {
  dyslexia: "Dyslexia support",
  cognitive_load: "Cognitive load support",
  low_vision: "Low vision and clarity",
};

const STORAGE_KEY = "adaptlearn_user_state";

function getDefaultSession() {
  return {
    userName: "Alex Learner",
    userInitials: "AL",
    profile: "dyslexia",
    fileName: "",
    text: "",
    wordCount: 0,
    tables: [],
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
  };
}

function loadPersistedSession() {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return getDefaultSession();
    const parsed = JSON.parse(raw);
    const defaults = getDefaultSession();
    return {
      ...defaults,
      ...parsed,
      userName: parsed.userName || defaults.userName,
      userInitials: parsed.userInitials || defaults.userInitials,
      profile: parsed.profile || defaults.profile,
      signals: { ...defaults.signals, ...(parsed.signals || {}) },
      sessionMeta: { ...defaults.sessionMeta, ...(parsed.sessionMeta || {}) },
      practiceReport: {
        answered: parsed.practiceReport?.answered || [],
        failed: parsed.practiceReport?.failed || [],
        masteredSections: parsed.practiceReport?.masteredSections || [],
      },
      rewireState: { ...defaults.rewireState, ...(parsed.rewireState || {}) },
    };
  } catch (err) {
    console.warn("Could not load persisted user session:", err);
    return getDefaultSession();
  }
}

const SessionContext = createContext(null);
export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(loadPersistedSession);
  const [busy, setBusy] = useState("");

  // Persist state across refresh to a single namespaced key on every update
  React.useEffect(() => {
    try {
      const stateToSave = { ...session, error: null };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (err) {
      console.warn("Could not persist user session:", err);
    }
  }, [session]);

  function updateProfile({ name, initials, profile }) {
    setSession((current) => {
      const newName = name !== undefined ? name.trim() : current.userName;
      let newInitials = initials !== undefined ? initials.trim().toUpperCase() : current.userInitials;
      if (!newInitials && newName) {
        newInitials = newName.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
      }
      return {
        ...current,
        userName: newName || current.userName,
        userInitials: newInitials || current.userInitials,
        profile: profile !== undefined ? profile : current.profile,
      };
    });
  }

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

  function recordQuizAnswerAction(isCorrect, questionText = "Quiz Question", sectionIndex = 0) {
    setSession((current) => {
      const updatedSignals = recordQuizAnswer(current.signals, isCorrect, 4000);
      let updatedMeta = current.sessionMeta;
      let outcome = current.latestOutcome;

      if (current.rewireState.active) {
        const postAcc = isCorrect ? 1.0 : 0.0;
        updatedMeta = recordAdaptationOutcome(current.sessionMeta, postAcc);
        outcome = measureOutcome(updatedMeta.preAccuracy ?? 0.0, postAcc);
      }

      const newAnswer = {
        question: questionText,
        is_correct: isCorrect,
        correct: isCorrect,
        section_index: sectionIndex,
      };
      const prevAnswered = current.practiceReport?.answered || [];
      const answered = [...prevAnswered, newAnswer];
      const failed = answered.filter((item) => !item.is_correct && !item.correct);
      const masteredSections = isCorrect
        ? [...new Set([...(current.practiceReport?.masteredSections || []), sectionIndex])]
        : current.practiceReport?.masteredSections || [];

      return {
        ...current,
        signals: updatedSignals,
        sessionMeta: updatedMeta,
        latestOutcome: outcome,
        practiceReport: { answered, failed, masteredSections },
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
        updateProfile,
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
  const initials = session.userInitials || (session.userName ? session.userName.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "AL");

  return (
    <header className="topbar">
      <NavLink to="/progress" className="brand">
        <img src="/logo.png" alt="AdaptLearn" className="logo" />
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
        <NavLink
          to="/profile"
          className="avatar"
          title={`View Learner Profile (${session.userName || "Learner"})`}
          aria-label="View Learner Profile"
        >
          {initials}
        </NavLink>
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
            <img src="/logo.png" alt="AdaptLearn" className="logo" />
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
  const { session, busy, chooseProfile, updateProfile, detect, adapt } = useSession();
  const navigate = useNavigate();
  const [description, setDescription] = useState("");

  // Edit Profile Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(session.userName || "Alex Learner");
  const [editInitials, setEditInitials] = useState(session.userInitials || "AL");
  const [editProfile, setEditProfile] = useState(session.profile || "dyslexia");

  function startEditing() {
    setEditName(session.userName || "Alex Learner");
    setEditInitials(session.userInitials || "AL");
    setEditProfile(session.profile || "dyslexia");
    setIsEditing(true);
  }

  function handleSaveProfile(e) {
    if (e) e.preventDefault();
    updateProfile({
      name: editName,
      initials: editInitials,
      profile: editProfile,
    });
    setIsEditing(false);
  }

  const transformed = Boolean(session.transformed);
  const chunks =
    session.transformed?.profile === "cognitive_load"
      ? session.transformed.chunks || []
      : session.transformed?.text
        ? [session.transformed.text]
        : session.text
          ? [session.text]
          : [];

  const sections = chunks.filter(Boolean).flatMap((chunk) =>
    chunk
      .split(/\n\s*\n|(?<=[.!?])\s+(?=[A-Z])/)
      .map((part) => part.trim())
      .filter(Boolean)
  );

  const totalSections = Math.max(1, sections.length || chunks.length || 1);
  const completedSectionsCount = session.completedSections?.length || (session.completed || 0);
  const completionRatio = Math.min(1, completedSectionsCount / totalSections);

  const answeredList = session.practiceReport?.answered || [];
  const totalAnswered = answeredList.length;
  const correctCount = answeredList.filter((a) => a.is_correct || a.correct).length;
  const currentScoreRatio = totalAnswered > 0 ? correctCount / totalAnswered : null;
  const currentScorePct = currentScoreRatio !== null ? Math.round(currentScoreRatio * 100) : null;

  const struggleScore = computeSessionStruggleScore(session);
  const strugglePenalty = struggleScore * 0.25;

  let rawProgress = 0;
  if (totalAnswered > 0) {
    const performanceRatio = currentScoreRatio !== null ? currentScoreRatio : 0.85;
    rawProgress = (completionRatio * 0.35 + performanceRatio * 0.65) * (1 - strugglePenalty);
  } else if (completionRatio > 0) {
    rawProgress = completionRatio * 0.7 * (1 - strugglePenalty);
  } else {
    rawProgress = 0;
  }
  const masteryPct = Math.min(100, Math.max(0, Math.round(rawProgress * 100)));
  const mastered = session.practiceReport?.masteredSections?.length || (masteryPct >= 70 ? completedSectionsCount : 0);

  const xpTotal = computeXP({
    questionsAnswered: totalAnswered,
    chunksCompleted: completedSectionsCount,
    sectionsMastered: mastered,
  });
  const { level, xpInLevel, xpForNext } = xpToLevel(xpTotal);
  const xpBarPct = Math.min(100, Math.round((xpInLevel / xpForNext) * 100));

  const tier = getStruggleTier(struggleScore, transformed);
  const initials = session.userInitials || (session.userName ? session.userName.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "AL");

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

  // Milestone Achievements derived from live stats
  const achievements = [
    {
      id: "starter",
      title: "First Steps",
      desc: "Started an adaptive study session",
      icon: "🌱",
      unlocked: transformed || completedSectionsCount > 0,
    },
    {
      id: "momentum",
      title: "Building Momentum",
      desc: "Reached 40% mastery or 100 XP",
      icon: "⚡",
      unlocked: masteryPct >= 40 || xpTotal >= 100,
    },
    {
      id: "curious",
      title: "Active Inquirer",
      desc: "Answered comprehension questions",
      icon: "🎯",
      unlocked: totalAnswered >= 1,
    },
    {
      id: "master",
      title: "Concept Master",
      desc: "Mastered learning sections",
      icon: "🏆",
      unlocked: mastered >= 1 || masteryPct >= 70,
    },
    {
      id: "zen",
      title: "Smooth Sailing",
      desc: "Maintained calm cognitive flow",
      icon: "🧘",
      unlocked: tier.key === "smooth_sailing" && transformed,
    },
  ];

  return (
    <Layout section="Profile">
      <main className="page">
        <div className="eyebrow">
          <b>Learner Account</b>
          <span>Adaptive Profile & Progress</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h1 className="page-title" style={{ margin: 0 }}>Learner Profile</h1>
          {!isEditing && (
            <button
              className="secondary-action"
              onClick={startEditing}
              style={{ padding: "8px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
            >
              <I.Edit3 size={15} /> Edit Profile
            </button>
          )}
        </div>

        {/* 1. Main Profile & XP Header Card or Edit Form */}
        {isEditing ? (
          <section className="card" style={{ padding: 22, marginBottom: 18, border: "2px solid var(--primary)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <I.User size={18} style={{ color: "var(--primary)" }} />
              <b style={{ fontSize: 16, color: "var(--ink)" }}>Edit Learner Profile</b>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                  Display Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Alex Learner"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                  Avatar Initials (1-3 characters)
                </label>
                <input
                  type="text"
                  value={editInitials}
                  maxLength={3}
                  onChange={(e) => setEditInitials(e.target.value.toUpperCase())}
                  placeholder="e.g. AL"
                  style={{ width: "100%", textTransform: "uppercase" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                  Default Learning Profile
                </label>
                <div style={{ display: "grid", gap: 8 }}>
                  {cards.map(([pKey, pTitle, pDesc]) => (
                    <label
                      key={pKey}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: `1px solid ${editProfile === pKey ? "var(--primary)" : "var(--border-color)"}`,
                        background: editProfile === pKey ? "#f5f3ff" : "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="edit_profile"
                        value={pKey}
                        checked={editProfile === pKey}
                        onChange={() => setEditProfile(pKey)}
                      />
                      <div>
                        <b style={{ fontSize: 13, color: "var(--ink)" }}>{pTitle}</b>
                        <p style={{ fontSize: 11, color: "var(--muted)", margin: "2px 0 0" }}>{pDesc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="submit" className="primary-action" style={{ flex: 1 }}>
                  <I.Check size={16} /> Save Changes
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setIsEditing(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="card" style={{ padding: 22, marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div
                className="avatar"
                style={{
                  width: 60,
                  height: 60,
                  fontSize: 22,
                  boxShadow: "0 8px 20px rgba(99, 102, 241, 0.3)",
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 20, margin: 0, color: "var(--ink)" }}>
                    {session.userName || "Alex Learner"}
                  </h2>
                  <span className="access-badge" style={{ padding: "3px 10px", fontSize: 11 }}>
                    <span className="access-dot" />
                    <span>{PROFILE_LABELS[session.profile]}</span>
                  </span>
                </div>
                <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 0" }}>
                  Active Session: {session.fileName || "No document loaded"}
                </p>
              </div>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid var(--border-color)",
                  borderRadius: 14,
                  padding: "10px 18px",
                  textAlign: "right",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)", textTransform: "uppercase" }}>
                  Current Level
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-heading)" }}>
                  Level {level}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{xpTotal.toLocaleString()} Total XP</div>
              </div>
            </div>

            {/* XP Progress Bar */}
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                <span>
                  {xpInLevel.toLocaleString()} / {xpForNext.toLocaleString()} XP
                </span>
                <span style={{ color: "var(--muted)" }}>Level {level + 1}</span>
              </div>
              <div className="progressbar" style={{ height: 8 }}>
                <div
                  className="progressfill"
                  style={{
                    width: `${xpBarPct}%`,
                    background: "linear-gradient(90deg, #6366f1, #a855f7)",
                  }}
                />
              </div>
            </div>
          </section>
        )}

        {/* 2. Lifetime Stats Grid */}
        <section style={{ marginBottom: 18 }}>
          <b style={{ fontSize: 14, color: "var(--ink)", fontFamily: "var(--font-heading)", display: "block", marginBottom: 10 }}>
            Session & Performance Metrics
          </b>
          <div className="progress-stats-grid">
            <div className="progress-stat-card">
              <div
                className="progress-stat-icon-wrap"
                style={{ background: "#eef2ff", color: "#6366f1", borderColor: "#c7d2fe" }}
              >
                <I.Layers size={22} />
              </div>
              <div className="progress-stat-info">
                <b className="progress-stat-value">{completedSectionsCount} / {totalSections}</b>
                <span className="progress-stat-label">Learning Chunks</span>
              </div>
            </div>

            <div className="progress-stat-card">
              <div
                className="progress-stat-icon-wrap"
                style={{ background: "#e0f2fe", color: "#0284c7", borderColor: "#bae6fd" }}
              >
                <I.HelpCircle size={22} />
              </div>
              <div className="progress-stat-info">
                <b className="progress-stat-value">{totalAnswered}</b>
                <span className="progress-stat-label">
                  Questions Answered {totalAnswered > 0 ? `(${correctCount} correct)` : ""}
                </span>
              </div>
            </div>

            <div className="progress-stat-card">
              <div
                className="progress-stat-icon-wrap"
                style={{ background: "#fef3c7", color: "#d97706", borderColor: "#fde68a" }}
              >
                <I.Trophy size={22} />
              </div>
              <div className="progress-stat-info">
                <b className="progress-stat-value">{mastered}</b>
                <span className="progress-stat-label">Sections Mastered</span>
              </div>
            </div>

            <div className="progress-stat-card">
              <div
                className="progress-stat-icon-wrap"
                style={{ background: tier.bg, color: tier.color, borderColor: tier.border }}
              >
                <StruggleFaceIcon tierKey={tier.key} color={tier.color} size={22} />
              </div>
              <div className="progress-stat-info">
                <b className="progress-stat-value" style={{ color: tier.color, fontSize: 16 }}>
                  {tier.name}
                </b>
                <span className="progress-stat-label">
                  Cognitive Mood {transformed ? `(${(struggleScore * 100).toFixed(0)}%)` : ""}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Milestone Achievements */}
        <section className="card" style={{ padding: 20, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <b style={{ fontSize: 15, color: "var(--ink)", fontFamily: "var(--font-heading)" }}>
                Milestone Achievements
              </b>
              <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0" }}>
                Badges unlocked through active learning and mastery
              </p>
            </div>
            <span className="pill" style={{ background: "#f3e8ff", color: "#7e22ce" }}>
              {achievements.filter((a) => a.unlocked).length} / {achievements.length} Unlocked
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {achievements.map((ach) => (
              <div
                key={ach.id}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${ach.unlocked ? "rgba(99, 102, 241, 0.3)" : "var(--border-color)"}`,
                  background: ach.unlocked ? "linear-gradient(135deg, #f8faff, #f5f3ff)" : "#f8fafc",
                  opacity: ach.unlocked ? 1 : 0.55,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ fontSize: 24 }}>{ach.icon}</div>
                <div>
                  <b style={{ fontSize: 12, display: "block", color: ach.unlocked ? "var(--ink)" : "var(--muted)" }}>
                    {ach.title}
                  </b>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{ach.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Active Learning Mode / Accessibility Preferences */}
        <section className="card" style={{ padding: 20, marginBottom: 18 }}>
          <b style={{ fontSize: 15, color: "var(--ink)", fontFamily: "var(--font-heading)", display: "block" }}>
            Learning Mode Preference
          </b>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 14px" }}>
            Select how lessons are formatted and simplified for your learning needs.
          </p>

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

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <I.Sparkles size={16} style={{ color: "var(--primary)" }} />
              <b style={{ fontSize: 14, color: "var(--ink)" }}>Describe your learning needs</b>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 10px 0" }}>
              AI will analyze your description and recommend the best format.
            </p>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="For example: long paragraphs are hard for me to follow..."
              style={{ width: "100%", minHeight: 70 }}
            />
            <button
              className="secondary-action"
              disabled={!description.trim() || Boolean(busy)}
              onClick={() => detect(description)}
              style={{ marginTop: 10, width: "100%" }}
            >
              {busy === "profile" ? "Detecting profile..." : "Detect profile with AI"}
            </button>
          </div>
        </section>

        <ErrorNotice />

        {session.text ? (
          <button
            className="primary-action"
            disabled={Boolean(busy)}
            onClick={async () => {
              if (!transformed) {
                await adapt();
              }
              navigate("/learn");
            }}
            style={{ marginTop: 10 }}
          >
            {busy === "transform" ? "Adapting lesson..." : transformed ? "Continue to Lesson" : "Transform Lesson"}
            <I.Sparkles size={18} />
          </button>
        ) : (
          <button
            className="secondary-action"
            onClick={() => navigate("/upload")}
            style={{ width: "100%", marginTop: 10 }}
          >
            <I.CloudUpload size={18} /> Upload a document to begin
          </button>
        )}
      </main>
    </Layout>
  );
}

function VisualCard({ visual, onReadAloud }) {
  if (!visual) return null;

  const {
    source = "prism",
    visual_type = "none",
    title = "",
    subtitle = "",
    explanation = "",
    key_takeaways = [],
    why_visual = "",
    svg_html = null,
    source_images = [],
    spec = {},
    error = null,
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

  const struggleScore = computeSessionStruggleScore(session);
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
              className={`gauge-dot ${struggleScore >= 0.6
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
    recordQuizAnswerAction(isCorrect, adaptiveQuiz.question || "Adaptive Question", 0);
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
    const isCorrect = selected === currentQ.answer;
    const nextAnswers = [
      ...testAnswers,
      {
        question: currentQ.question,
        selected,
        correct: isCorrect,
      },
    ];
    setTestAnswers(nextAnswers);
    setSelected("");

    // Record into global session signals and practice report
    recordQuizAnswerAction(isCorrect, currentQ.question, testIndex);
    if (isCorrect) {
      completeSection(testIndex);
    }

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

/* ── XP system ── pure function, retune the multipliers here ─────────────── */
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
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="50%" stopColor="#818cf8" />
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
      <span className="orb-mood-pill">
        {mood === "tense" ? "Strain" : mood === "alert" ? "Focus" : "Calm"}
      </span>
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
        <ellipse cx="34" cy="14" rx="1.5" ry="2.2" fill="#93c5fd" opacity="0.7" />
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
      <ellipse cx="12" cy="25" rx="1.3" ry="2" fill="#93c5fd" opacity="0.65" />
    </svg>
  );
}

/* ── Struggle Slider (replaces HeartbeatLine) ───────────────── */
function HeartbeatLine({ struggleScore = 0, isTransformed = false }) {
  const [animPct, setAnimPct] = React.useState(0);

  const pct = Math.round((struggleScore || 0) * 100);
  const targetPct = Math.max(3, Math.min(97, pct));

  // Animate slider from 0 → target on every mount (~1.8s ease-in-out for gradual feel)
  React.useEffect(() => {
    if (!isTransformed) return;

    let animId = null;
    let start = null;
    const duration = 1800;

    setAnimPct(0);

    const step = (ts) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      // Ease-in-out cubic: smooth acceleration and deceleration
      const eased = t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
  { color: "#818CF8", bg: "#ede9fe", label: "Getting Started" },
  { color: "#60A5FA", bg: "#dbeafe", label: "Building Momentum" },
  { color: "#34D399", bg: "#d1fae5", label: "Almost Mastered" },
  { color: "#FBBF24", bg: "#fef3c7", label: "Mastered" },
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
    const duration = 1000; // ~1000ms ease-out fill on mount

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(1, elapsed / duration);
      // Ease-out cubic: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - t, 3);
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

      {/* Reactive Mascot Orb */}
      <ReactiveOrb struggleScore={struggleScore} />

      <div className={`mastery-ring-svg-wrap${masteryPct >= 100 && animFraction >= 0.9 ? " mastery-ring--gold" : ""}`}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Track */}
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none" stroke="#E5E7EB" strokeWidth={STROKE} />
          {/* Filled arc */}
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none"
            stroke={tier.color}
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
          <span className="mastery-ring-xp">{xpTotal.toLocaleString()} XP</span>
          <span className="mastery-ring-pct">{Math.round(currentMastery)}%</span>
        </div>
      </div>

      {/* XP progress bar to next level */}
      <div className="mastery-xp-bar-wrap">
        <div className="mastery-xp-bar-label">
          <span>{xpInLevel.toLocaleString()} / {xpForNext.toLocaleString()} XP</span>
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
            style={{ background: l.bg, color: l.color }}>
            <span className="mastery-legend-dot" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProgressStats({ chunks, qAnswered, mastered }) {
  const stats = [
    {
      id: "chunks",
      title: "Learning Chunks",
      value: chunks,
      icon: I.Layers,
      color: "#6366f1",
      bgColor: "#eef2ff",
      borderColor: "#c7d2fe",
    },
    {
      id: "questions",
      title: "Questions Answered",
      value: qAnswered,
      icon: I.HelpCircle,
      color: "#0284c7",
      bgColor: "#e0f2fe",
      borderColor: "#bae6fd",
    },
    {
      id: "mastered",
      title: "Sections Mastered",
      value: mastered,
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
  const chunks =
    session.transformed?.profile === "cognitive_load"
      ? session.transformed.chunks || []
      : session.transformed?.text
        ? [session.transformed.text]
        : session.text
          ? [session.text]
          : [];

  const sections = chunks.filter(Boolean).flatMap((chunk, chunkIndex) =>
    chunk
      .split(/\n\s*\n|(?<=[.!?])\s+(?=[A-Z])/)
      .map((part) => part.trim())
      .filter(Boolean)
  );

  const totalSections = Math.max(1, sections.length || chunks.length || 1);
  const completedSectionsCount = session.completedSections?.length || (session.completed || 0);
  const completionRatio = Math.min(1, completedSectionsCount / totalSections);

  // Current Score & Performance from all practice questions and tests
  const answeredList = session.practiceReport?.answered || [];
  const totalAnswered = answeredList.length;
  const correctCount = answeredList.filter((a) => a.is_correct || a.correct).length;
  const currentScoreRatio = totalAnswered > 0 ? correctCount / totalAnswered : null;
  const currentScorePct = currentScoreRatio !== null ? Math.round(currentScoreRatio * 100) : null;

  // Single source of truth for struggle score derived directly from session activity
  const struggleScore = computeSessionStruggleScore(session);

  // Dev-only sanity check log to verify telemetry and score responsiveness
  if (process.env.NODE_ENV !== "production") {
    console.log("[StruggleDebug / Telemetry Sanity Check]", {
      completedSectionsCount,
      totalSections,
      totalAnswered,
      correctCount,
      accuracyPct: currentScorePct,
      helpRequests: session.signals?.helpRequests || 0,
      voiceHelpRequests: session.signals?.voiceHelpRequests || 0,
      rereadCount: session.signals?.rereadCount || 0,
      retryCount: session.signals?.retryCount || 0,
      dwellTimeMs: session.signals?.dwellTime || 0,
      totalAdaptations: session.sessionMeta?.totalAdaptations || 0,
      isRewireActive: Boolean(session.rewireState?.active),
      computedStruggleScore: struggleScore,
      strugglePct: Math.round(struggleScore * 100),
    });
  }

  // Accurate Progress (Mastery %):
  // Correctly based on completion ratio, current score, and struggle score
  const performanceRatio = currentScoreRatio !== null ? currentScoreRatio : (completionRatio > 0 ? 0.85 : 0);
  const strugglePenalty = struggleScore * 0.25;

  let rawProgress = 0;
  if (totalAnswered > 0) {
    // Blend completion (35%) and quiz performance (65%), adjusted by struggle
    rawProgress = (completionRatio * 0.35 + performanceRatio * 0.65) * (1 - strugglePenalty);
  } else if (completionRatio > 0) {
    rawProgress = completionRatio * 0.7 * (1 - strugglePenalty);
  } else {
    rawProgress = 0;
  }
  const masteryPct = Math.min(100, Math.max(0, Math.round(rawProgress * 100)));

  // Mastered sections count
  const mastered = session.practiceReport?.masteredSections?.length || (masteryPct >= 70 ? completedSectionsCount : 0);

  // XP derived from active metrics
  const xpTotal = computeXP({
    questionsAnswered: totalAnswered,
    chunksCompleted: completedSectionsCount,
    sectionsMastered: mastered,
  });

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

        {/* Section 1: Staggered Entrance */}
        <div className="animate-stagger-1">
          <MasteryRing
            masteryPct={masteryPct}
            xpTotal={xpTotal}
            struggleScore={struggleScore}
          />
        </div>

        {/* Section 2: Staggered Entrance */}
        <div className="animate-stagger-2">
          <ProgressStats
            chunks={`${completedSectionsCount} / ${totalSections}`}
            qAnswered={totalAnswered}
            mastered={mastered}
          />
        </div>

        {/* SCALE Engine Cognitive Telemetry Card: Section 3 Staggered */}
        <section className="card scale-telemetry-card animate-stagger-3" style={{ marginTop: 18, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="pill" style={{ background: "#f3e8ff", color: "#7e22ce" }}>
              <I.Activity size={13} /> SCALE Cognitive Telemetry
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
              Variant Level: {session.sessionMeta.currentVariantLevel}
            </span>
          </div>

          {/* Current Struggle Score Section */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
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
                      padding: "4px 10px 4px 7px",
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, fontSize: 12, fontWeight: 700 }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
            {/* Total Adaptations */}
            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 12, border: "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>🛡️</span>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontWeight: 800 }}>
                  Total Adaptations
                </div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginTop: 2, fontFamily: "var(--font-heading)" }}>
                {session.sessionMeta.totalAdaptations}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.4 }}>
                Times the lesson adjusted to help you.
              </div>
            </div>

            {/* Latest Outcome Delta */}
            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 12, border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontWeight: 800, marginBottom: 6 }}>
                Latest Outcome Delta
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-heading)", marginTop: 2, display: "flex", alignItems: "baseline", gap: 4 }}>
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
                  <span style={{ color: "var(--muted)", fontSize: 14 }}>N/A</span>
                )}
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
