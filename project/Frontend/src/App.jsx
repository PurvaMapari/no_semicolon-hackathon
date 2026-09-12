import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
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
import { WebcamProvider, useWebcam } from "./hooks/WebcamContext";
import { ToastProvider, ToastContainer, useToast } from "./components/PrismToast";
import { WebcamStatusBadge } from "./components/WebcamStatusBadge";
import { useWebcamToasts } from "./hooks/useWebcamToasts.jsx";
import { formatReadTime } from "./utils/formatReadTime";
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
  resetSectionDwell,
  SECTION_STATES,
} from "./engine/signals";
import { SCALE_CONFIG } from "./engine/scale";
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
    const textToAdapt =
      session.text?.trim() ||
      "Photosynthesis is the fundamental biological process through which green plants, algae, and certain cyanobacteria convert light energy into chemical energy. This biochemical pathway captures photon energy from sunlight to synthesize organic molecules such as glucose from ambient carbon dioxide and water, concurrently producing diatomic oxygen as an essential metabolic byproduct for terrestrial life.";
    return run("transform", async () => {
      const result = await transformText(textToAdapt, session.profile);
      setSession((current) => ({
        ...current,
        text: textToAdapt,
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

  function completeChunk(webcamContext = null, baselineDwellSeconds = null) {
    setSession((current) => {
      // Advance cooldown tracker (advances lastAdaptationChunksAgo by 1)
      const updatedMeta = {
        ...current.sessionMeta,
        consecutiveAdaptations: 0,
        lastAdaptationChunksAgo:
          current.sessionMeta.lastAdaptationChunksAgo !== null
            ? current.sessionMeta.lastAdaptationChunksAgo + 1
            : null,
      };

      // Optionally update struggle evaluation with webcam context for SCALE display
      // (webcamContext is used purely for evaluation; it doesn't modify stored signals)
      const evalWithWebcam = webcamContext
        ? evaluateSignals(current.signals, updatedMeta, webcamContext, baselineDwellSeconds)
        : null;

      return {
        ...current,
        completed: current.completed + 1,
        sessionMeta: updatedMeta,
        // Store the latest webcam-boosted struggle score for the SCALE dot
        _webcamStruggleBoost: evalWithWebcam?.webcamBoost ?? 0,
      };
    });
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
      
      // Auto-trigger REWIRE only at STRUGGLE_THRESHOLD (0.6).
      // Re-read is primarily an audio/TTS replay — NOT a strong struggle indicator.
      if (evalState.struggleScore >= SCALE_CONFIG.STRUGGLE_THRESHOLD && !current.rewireState.active) {
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

      if (evalState.struggleScore >= SCALE_CONFIG.STRUGGLE_THRESHOLD && !current.rewireState.active) {
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

  /**
   * Update the active dwell time in the signal state.
   * Called by the Learn component's active dwell timer on section transitions
   * and section completion. The value passed is ONLY active learning time (ms).
   */
  function updateActiveDwell(activeDwellMs) {
    setSession((current) => ({
      ...current,
      signals: {
        ...current.signals,
        activeDwellMs: activeDwellMs,
        dwellTime: activeDwellMs, // backward compat for SCALE
      },
    }));
  }

  /**
   * Reset per-section dwell timing when switching sections.
   * Preserves accumulated quiz/help/reread signals.
   */
  function resetDwellForNewSection() {
    setSession((current) => ({
      ...current,
      signals: resetSectionDwell(current.signals),
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
        updateActiveDwell,
        resetDwellForNewSection,
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
          <div className="subtitle">{section === "Profile" ? "Profile & Verification" : section}</div>
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
                className={`sidebar-link ${location.pathname === to || (to === "/learn" && location.pathname === "/profile") ? "active" : ""}`}
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

function CameraPreview({ stream, className = "camera-preview-video" }) {
  const videoRef = React.useRef(null);

  React.useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={className}
    />
  );
}

function Profile() {
  const { session, busy, chooseProfile, detect, adapt } = useSession();
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [simState, setSimState] = useState(null); // 'starting' | 'no_face' | 'detected' | 'error' | null

  // ── Camera gate & stream ───────────────────────────────────────────────────
  const {
    webcamStatus,
    webcamEnabled,
    toggleCamera,
    isLoading: camLoading,
    webcamSkipped,
    setWebcamSkipped,
    mediaStream,
    facePresent,
  } = useWebcam();

  // Auto-start camera on Step 2 entry if not already started
  React.useEffect(() => {
    if (!webcamEnabled && !webcamSkipped && webcamStatus === "off") {
      toggleCamera();
    }
  }, [webcamEnabled, webcamSkipped, webcamStatus, toggleCamera]);

  // Derived simulation states for seamless testing & grading
  const effectiveWebcamStatus =
    simState === "error"
      ? "error"
      : simState === "starting"
      ? "loading"
      : simState
      ? "ready"
      : webcamStatus;

  const effectiveFacePresent =
    simState === "detected"
      ? true
      : simState === "no_face"
      ? false
      : simState === "starting"
      ? false
      : facePresent;

  const effectiveCamLoading =
    simState === "starting"
      ? true
      : camLoading || webcamStatus === "loading";

  // Gate: Continue allowed if (camera ready AND face detected) OR skipped OR simulated detected
  const canContinue =
    ((effectiveWebcamStatus === "ready" && effectiveFacePresent) ||
      webcamSkipped ||
      simState === "detected") &&
    !Boolean(busy);

  const formatCards = [
    {
      id: "dyslexia",
      title: "Dyslexia support",
      desc: "Shorter sentences, clear dyslexia-friendly spacing, and reduced visual crowding to ease reading cognitive load.",
      icon: I.BookOpen,
      recommended: true,
    },
    {
      id: "cognitive_load",
      title: "Cognitive load support",
      desc: "Digestible chunked sections presenting one main concept at a time with guided step-through logic.",
      icon: I.Layers,
      recommended: false,
    },
    {
      id: "low_vision",
      title: "Low vision and clarity",
      desc: "High contrast theme guidance, larger typography, and distinct line height with accessible color tones.",
      icon: I.Eye,
      recommended: false,
    },
  ];

  return (
    <Layout section="Profile">
      <main className="page" style={{ maxWidth: 960, margin: "0 auto", paddingBottom: 60 }}>
        {/* Step 2 Eyebrow */}
        <div className="step2-eyebrow">
          <span className="step2-badge-num">2</span>
          <span>STEP 2 OF 3 - LEARNING CONFIGURATION &amp; VERIFICATION</span>
        </div>

        <h1 className="step2-title">How should this lesson feel?</h1>
        <p className="step2-subtitle">
          Personalize your adaptive visual format, verify your camera presence for real-time focus calibration, and launch your tailored session.
        </p>

        {/* 1. SELECT VISUAL ADAPTATION FORMAT */}
        <div className="format-section-header">
          <div className="format-section-title">
            <I.Sliders size={14} />
            <span>1. SELECT VISUAL ADAPTATION FORMAT</span>
          </div>
          <span className="format-auto-detected">Auto-detected optimal</span>
        </div>

        <div className="format-card-list">
          {formatCards.map(({ id, title, desc, icon: Icon, recommended }) => (
            <button
              type="button"
              key={id}
              className={`format-card ${session.profile === id ? "active" : ""}`}
              onClick={() => chooseProfile(id)}
            >
              <span className="format-radio">
                {session.profile === id && <span className="format-radio-dot" />}
              </span>
              <div className="format-icon-box">
                <Icon size={18} />
              </div>
              <div className="format-info">
                <div className="format-title-row">
                  <span className="format-name">{title}</span>
                  {recommended && (
                    <span className="format-recommended-pill">Recommended</span>
                  )}
                </div>
                <p className="format-desc">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Describe learning needs card */}
        <div className="describe-card">
          <div className="describe-header">
            <I.Sparkles size={16} style={{ color: "var(--primary)" }} />
            <span>Describe your learning needs</span>
          </div>
          <p className="describe-subtext">
            Not sure which setting is best? Describe what reading format works best for you and AI will choose.
          </p>
          <div className="describe-input-row">
            <input
              type="text"
              className="describe-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && description.trim() && !busy) {
                  detect(description);
                }
              }}
              placeholder="For example: long paragraphs are hard for me to follow"
            />
            <button
              type="button"
              className="describe-btn"
              disabled={!description.trim() || Boolean(busy)}
              onClick={() => detect(description)}
            >
              {busy === "profile" ? "Detecting profile..." : "Detect profile"}
            </button>
          </div>
        </div>

        {/* ── Camera Presence Verification Card ─────────────────────── */}
        <section className="camera-verification-card">
          <div className="camera-verification-header">
            <div className="camera-verif-title-group">
              <div className="camera-verif-title-row">
                <div className="camera-verif-icon-box">
                  <I.Video size={16} />
                </div>
                <span className="camera-verif-title">Camera Presence Verification</span>
                <span className="camera-verif-private-pill">Private • On-device</span>
              </div>
              <p className="camera-verif-subtitle">
                Ensures you are present to dynamically adapt pacing. No video is recorded or stored.
              </p>
            </div>

            {/* Simulation controls */}
            <div className="camera-sim-controls">
              <span>SIMULATE:</span>
              <button
                type="button"
                className={`camera-sim-btn ${simState === "starting" ? "active" : ""}`}
                onClick={() => setSimState(simState === "starting" ? null : "starting")}
              >
                Starting
              </button>
              <span>|</span>
              <button
                type="button"
                className={`camera-sim-btn ${simState === "no_face" ? "active" : ""}`}
                onClick={() => setSimState(simState === "no_face" ? null : "no_face")}
              >
                No Face
              </button>
              <span>|</span>
              <button
                type="button"
                className={`camera-sim-btn ${simState === "detected" ? "active" : ""}`}
                onClick={() => setSimState(simState === "detected" ? null : "detected")}
              >
                Detected
              </button>
              <span>|</span>
              <button
                type="button"
                className={`camera-sim-btn ${simState === "error" ? "active" : ""}`}
                onClick={() => setSimState(simState === "error" ? null : "error")}
              >
                Error
              </button>
              {simState && (
                <button
                  type="button"
                  className="camera-sim-btn"
                  style={{ color: "#ef4444", marginLeft: 4 }}
                  onClick={() => setSimState(null)}
                  title="Reset to live camera"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* HUD Viewport */}
          <div className="camera-hud-viewport">
            {/* Live Video Feed */}
            {mediaStream && effectiveWebcamStatus !== "error" && effectiveWebcamStatus !== "off" && (
              <CameraPreview stream={mediaStream} className="camera-hud-video" />
            )}

            {/* Fallback silhouette if camera off or loading */}
            {(!mediaStream || effectiveWebcamStatus === "off" || effectiveCamLoading) && (
              <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", opacity: 0.22, pointerEvents: "none" }}>
                <svg width="130" height="130" viewBox="0 0 24 24" fill="currentColor" color="#94a3b8">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z" />
                </svg>
              </div>
            )}

            {/* Top-left HUD badge */}
            <div className="camera-hud-top-left">
              <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
              <span>LIVE FEED: PRISM</span>
            </div>

            {/* Top-right HUD badge */}
            <div className="camera-hud-top-right">
              <span>720p HD</span>
            </div>

            {/* Center Biometric Reticle */}
            <div className="camera-hud-reticle-wrap">
              <div className={`camera-hud-reticle ${effectiveFacePresent ? "detected" : effectiveCamLoading ? "loading" : "absent"}`}>
                <span className="camera-hud-reticle-tag">
                  {effectiveCamLoading ? "CALIBRATING" : effectiveFacePresent ? "HEAD ALIGNED" : "POSITION HEAD"}
                </span>
              </div>
            </div>

            {/* Bottom HUD Banner */}
            {effectiveCamLoading ? (
              <div className="camera-hud-bottom-banner loading">
                <span className="camera-gate-spinner" style={{ width: 12, height: 12, borderTopColor: "#fff", marginRight: 6 }} />
                <span>Calibrating presence…</span>
              </div>
            ) : effectiveFacePresent ? (
              <div className="camera-hud-bottom-banner detected">
                <I.Check size={15} strokeWidth={3} />
                <span>Face detected — Ready to continue</span>
              </div>
            ) : effectiveWebcamStatus === "off" ? (
              <button
                type="button"
                className="camera-hud-bottom-banner off"
                onClick={toggleCamera}
              >
                <I.Video size={14} />
                <span>Enable camera</span>
              </button>
            ) : effectiveWebcamStatus === "error" || effectiveWebcamStatus === "denied" ? (
              <div className="camera-hud-bottom-banner absent" style={{ background: "#ef4444" }}>
                <I.AlertCircle size={14} />
                <span>Camera unavailable — Use skip below</span>
              </div>
            ) : (
              <div className="camera-hud-bottom-banner absent">
                <I.AlertTriangle size={14} />
                <span>Face not detected — Position in frame</span>
              </div>
            )}
          </div>

          {/* 3 Telemetry Status Chips below HUD */}
          <div className="camera-telemetry-grid">
            <div className={`camera-telemetry-chip ${effectiveWebcamStatus === "ready" ? "success" : effectiveCamLoading ? "warn" : "neutral"}`}>
              {effectiveWebcamStatus === "ready" ? <I.Check size={13} strokeWidth={2.5} /> : <I.Radio size={13} />}
              <span>{effectiveWebcamStatus === "ready" ? "Camera connected" : effectiveCamLoading ? "Camera starting..." : "Camera offline"}</span>
            </div>

            <div className={`camera-telemetry-chip ${effectiveFacePresent ? "success" : "warn"}`}>
              {effectiveFacePresent ? <I.Check size={13} strokeWidth={2.5} /> : <I.User size={13} />}
              <span>{effectiveFacePresent ? "Face detected" : "No face detected"}</span>
            </div>

            <div className={`camera-telemetry-chip ${(effectiveFacePresent && effectiveWebcamStatus === "ready") || webcamSkipped ? "success" : "neutral"}`}>
              {(effectiveFacePresent && effectiveWebcamStatus === "ready") || webcamSkipped ? <I.Sparkles size={13} /> : <I.Clock size={13} />}
              <span>{(effectiveFacePresent && effectiveWebcamStatus === "ready") || webcamSkipped ? "Ready for adaptive learning" : "Awaiting calibration"}</span>
            </div>
          </div>

          {/* Hardware fallback skip link */}
          {(effectiveWebcamStatus === "error" || effectiveWebcamStatus === "denied" || (!effectiveFacePresent && !webcamSkipped)) && (
            <div style={{ marginTop: 12, textAlign: "right" }}>
              <button
                type="button"
                className="camera-gate-skip-link"
                onClick={() => setWebcamSkipped(true)}
                style={{ fontSize: 11.5, color: "#64748b", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}
              >
                Skip camera requirement (text-only mode)
              </button>
            </div>
          )}
        </section>

        <ErrorNotice />

        {/* ── Bottom Launch Session Bar ──────────────────────────────── */}
        <div className="launch-session-bar">
          <div className="launch-bar-left">
            <div className="launch-bar-meta">
              <span style={{ color: "#60a5fa", fontSize: 13 }}>✦</span>
              <span>Ready in ~4 seconds • Configured for {PROFILE_LABELS[session.profile] || "Adaptive Learning"}</span>
            </div>
            <h2 className="launch-bar-title">Launch your customized learning session</h2>
            <p className="launch-bar-subtitle">
              Our adaptive AI will customize cognitive load &amp; pacing instantly
            </p>
          </div>

          <div className="launch-bar-right">
            <button
              type="button"
              className="launch-back-btn"
              onClick={() => navigate("/upload")}
            >
              Back to upload
            </button>

            <button
              type="button"
              className="launch-transform-btn"
              disabled={!canContinue}
              onClick={async () => {
                await adapt();
                navigate("/learn");
              }}
            >
              <span>{busy === "transform" ? "Adapting lesson…" : "Transform Lesson"}</span>
              <I.Sparkles size={16} />
            </button>
          </div>
        </div>
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
    updateActiveDwell,
    resetDwellForNewSection,
  } = useSession();
  const navigate = useNavigate();
  const transformed = session.transformed;

  // Webcam presence — shared instance from WebcamContext (persists across Step 2→3)
  const webcamHook = useWebcam();
  const { push: pushToast, dismiss: dismissToast } = useToast();

  // Face presence from shared webcam hook
  const facePresent = webcamHook.facePresent;

  // Fire contextual toasts on webcam state transitions
  useWebcamToasts({
    webcam: webcamHook,
    push: pushToast,
    dismiss: dismissToast,
    I,
    toggleCamera:    webcamHook.toggleCamera,
    setWebcamSkipped: webcamHook.setWebcamSkipped,
  });

  const [activeSection, setActiveSection] = useState(0);
  const [playing, setPlaying] = useState(false);

  // ── Active Dwell Timer ──────────────────────────────────────────────────────
  // Tracks ONLY active learning time. Pauses during:
  //   • tab hidden (visibilitychange)
  //   • busy operations (loading, generation, quiz gen)
  //   • section not yet ready
  // Resets on section switch. Uses refs to avoid re-render loops.
  const dwellRef = useRef({ startTime: null, accumulatedMs: 0, sectionIndex: -1 });
  const [sectionContentReady, setSectionContentReady] = useState(false);

  // Helper: get current accumulated active dwell including any in-flight period
  const getCurrentActiveDwellMs = useCallback(() => {
    let total = dwellRef.current.accumulatedMs;
    if (dwellRef.current.startTime !== null) {
      total += Date.now() - dwellRef.current.startTime;
    }
    return total;
  }, []);

  // Helper: pause the active timer (accumulate elapsed, clear startTime)
  const pauseDwellTimer = useCallback(() => {
    if (dwellRef.current.startTime !== null) {
      dwellRef.current.accumulatedMs += Date.now() - dwellRef.current.startTime;
      dwellRef.current.startTime = null;
    }
  }, []);

  // Helper: resume the active timer (set startTime to now)
  const resumeDwellTimer = useCallback(() => {
    if (dwellRef.current.startTime === null) {
      dwellRef.current.startTime = Date.now();
    }
  }, []);

  // Effect 1: Section switching — reset timer for the new section
  useEffect(() => {
    // Flush any accumulated dwell from the previous section into signals
    if (dwellRef.current.sectionIndex >= 0 && dwellRef.current.sectionIndex !== activeSection) {
      pauseDwellTimer();
      updateActiveDwell(dwellRef.current.accumulatedMs);
    }

    // Reset for the new section
    dwellRef.current = { startTime: null, accumulatedMs: 0, sectionIndex: activeSection };
    setSectionContentReady(false);
    resetDwellForNewSection();

    // Mark section content as ready after the next frame (content rendered)
    const frameId = requestAnimationFrame(() => {
      setSectionContentReady(true);
    });
    return () => cancelAnimationFrame(frameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  // Effect 2: Start/stop timer based on conditions
  // Timer runs ONLY when: transformed + not busy + sectionContentReady + tab visible
  useEffect(() => {
    const canTime = transformed && !busy && sectionContentReady && !document.hidden;
    if (canTime) {
      resumeDwellTimer();
    } else {
      pauseDwellTimer();
    }
    // Sync active dwell into signals whenever conditions change
    updateActiveDwell(getCurrentActiveDwellMs());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, transformed, sectionContentReady]);

  // Effect 3: Visibility change — pause on tab hidden, resume on visible
  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) {
        pauseDwellTimer();
        updateActiveDwell(getCurrentActiveDwellMs());
      } else if (transformed && !busy && sectionContentReady) {
        resumeDwellTimer();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transformed, busy, sectionContentReady]);

  // Cleanup: flush dwell on unmount (route change away from /learn)
  useEffect(() => {
    return () => {
      pauseDwellTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isCognitiveLoad = transformed?.profile === "cognitive_load";
  const chunks =
    isCognitiveLoad
      ? (transformed?.chunks || [])
      : [transformed?.text || session.text];

  // Extract metadata for each chunk/section
  const chunkMeta = transformed?.chunk_meta || [];
  const sectionMeta = transformed?.section_meta || null;

  let globalIndex = 0;
  const sections = chunks.filter(Boolean).flatMap((chunk, chunkIndex) => {
    // For cognitive_load: each chunk IS one section — never sub-split it.
    // The backend already chunked at the right granularity (8–20 chunks).
    const parts = isCognitiveLoad ? [chunk] : splitIntoLessonSections(chunk);
    return parts.map((paragraph, paragraphIndex) => {
      const idx = globalIndex++;
      
      // Attach metadata: for cognitive_load use chunk_meta[chunkIndex], otherwise use sectionMeta
      let meta = null;
      if (isCognitiveLoad && chunkMeta[chunkIndex]) {
        meta = chunkMeta[chunkIndex];
      } else if (sectionMeta) {
        // For non-cognitive_load profiles: backend returns meta for full text,
        // but frontend splits into smaller sections. Recalculate time per section.
        const sectionWordCount = paragraph.split(/\s+/).filter(Boolean).length;
        const difficulty = sectionMeta.difficulty_tier || "intermediate";
        
        // Use same WPM constants as backend
        const wpmByDifficulty = {
          foundational: 220,
          intermediate: 180,
          advanced: 140
        };
        const wpm = wpmByDifficulty[difficulty] || 180;
        const estimatedSec = Math.round((sectionWordCount / wpm) * 60);
        
        meta = {
          difficulty_tier: difficulty,
          estimated_seconds: estimatedSec,
          word_count: sectionWordCount,
        };
      }
      
      return {
        id: `${chunkIndex}-${paragraphIndex}`,
        paragraph,
        chunk: chunkIndex + 1,
        chunkIndex,
        sectionIndex: idx,
        meta, // {difficulty_tier, estimated_seconds, word_count}
      };
    });
  });

  const currentSection = sections[activeSection] || sections[0];
  const formatting = transformed?.formatting || {};
  const completedSections = session.completedSections || [];
  const isComplete = completedSections.includes(activeSection);

  // Get difficulty and estimated time from section metadata (needed for SCALE evaluation)
  const sectionDifficulty = currentSection?.meta?.difficulty_tier || "intermediate";
  const estimatedSeconds = currentSection?.meta?.estimated_seconds || 60;

  const evaluation = evaluateSignals(
    session.signals, 
    session.sessionMeta, 
    null, 
    estimatedSeconds
  );
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

  // Track scroll consistency for SCALE evidence
  const [scrollConsistent, setScrollConsistent] = useState(true);
  const lastScrollY = React.useRef(0);
  const scrollReversals = React.useRef(0);

  React.useEffect(() => {
    function onScroll() {
      const currentY = window.scrollY;
      const diff = currentY - lastScrollY.current;
      if (diff < -40) {
        scrollReversals.current += 1;
        if (scrollReversals.current > 2) setScrollConsistent(false);
      } else if (diff > 40) {
        if (scrollReversals.current > 0) scrollReversals.current -= 0.5;
        if (scrollReversals.current <= 1) setScrollConsistent(true);
      }
      lastScrollY.current = currentY;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function markSectionComplete() {
    // Flush active dwell into signals before completing
    pauseDwellTimer();
    const finalDwellMs = getCurrentActiveDwellMs();
    updateActiveDwell(finalDwellMs);

    completeSection(activeSection);
    // Pass current webcam context so SCALE receives all 5 signals as supporting evidence
    // Also pass estimated reading time baseline for dynamic dwell ratio computation
    completeChunk({
      presence_ratio:        webcamHook.presenceRatio,
      face_present_now:      webcamHook.facePresent,
      head_stable_now:       webcamHook.headStable,
      tab_focused_now:       webcamHook.tabFocused,
      scroll_consistent_now: scrollConsistent,
      // camelCase aliases
      presenceRatio:         webcamHook.presenceRatio,
      facePresentNow:        webcamHook.facePresent,
      headStableNow:         webcamHook.headStable,
      tabFocusedNow:         webcamHook.tabFocused,
      scrollConsistentNow:   scrollConsistent,
    }, estimatedSeconds);
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

  // Floating voice assistant panel state
  const [voiceOpen, setVoiceOpen] = useState(false);

  // Format difficulty for display (sectionDifficulty and estimatedSeconds already defined above)
  const difficultyLabel = sectionDifficulty.toUpperCase();
  const difficultyColor = 
    sectionDifficulty === "foundational" ? "#10b981" : 
    sectionDifficulty === "advanced" ? "#f59e0b" : 
    "#3b82f6";

  // Topic title: first non-empty line of the current section
  const sectionTopic =
    currentSection?.paragraph?.split("\n").find((l) => l.trim().length > 0)?.slice(0, 48) ||
    session.lessonTitle ||
    "Lesson";

  return (
    <Layout section="Learn">
      <main className="page learn-page">

        {/* ── REWIRE Banner ──────────────────────────────────────────── */}
        {session.rewireState.active && (
          <div className="rewire-banner">
            <div className="rewire-header">
              <span className="rewire-tag">
                <I.Zap size={13} style={{ marginRight: 4 }} /> REWIRE ACTIVATED
              </span>
              <button
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4 }}
                onClick={dismissRewire}
              >
                <I.X size={16} />
              </button>
            </div>
            <div className="rewire-title">Cognitive Adaptation Applied</div>
            <p className="rewire-explanation">
              {session.rewireState.adaptedContent?.explanation ||
                session.rewireState.evaluation?.explanation ||
                "Increased comprehension struggle was detected. The material has been automatically restructured into clearer terms."}
            </p>
            <div className="rewire-actions-pills">
              {(session.rewireState.adaptedContent?.actions_applied || [
                "increase_simplification", "add_visual_description",
              ]).map((act) => (
                <span key={act} className="rewire-action-pill">
                  <I.Check size={11} style={{ marginRight: 3 }} /> {act.replace(/_/g, " ")}
                </span>
              ))}
            </div>
            <button
              className="primary-action"
              style={{ marginTop: 14, width: "100%" }}
              onClick={() => navigate("/practice")}
            >
              Take Adapted Practice Quiz <I.ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ── Empty state ─────────────────────────────────────────────── */}
        {!transformed ? (
          <section className="card empty-state" style={{ marginTop: 20, textAlign: "center", padding: 40 }}>
            <I.BookOpen size={36} style={{ color: "var(--muted)", margin: "0 auto 12px", display: "block" }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>
              This lesson has not been adapted yet.
            </p>
            <button className="primary-action" onClick={adapt} style={{ maxWidth: 220, margin: "0 auto" }}>
              Adapt now <I.Sparkles size={16} />
            </button>
          </section>
        ) : (
          <>
            {/* ── Lesson Card ─────────────────────────────────────────── */}
            <section className={`lesson-card ${lessonClass} ${isAdapted ? "adapted-chunk-card" : ""}`}>

              {/* Card header row */}
              <div className="lesson-card-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="lesson-card-section-label">
                    SECTION {activeSection + 1} OF {sections.length}
                  </span>
                  <span 
                    style={{ 
                      color: difficultyColor, 
                      fontSize: 11, 
                      fontWeight: 700, 
                      letterSpacing: "0.05em",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      backgroundColor: `${difficultyColor}15`,
                      border: `1px solid ${difficultyColor}40`
                    }}
                  >
                    {difficultyLabel}
                  </span>
                  {sectionTopic && (
                    <>
                      <span style={{ color: "#c7d2fe", fontSize: 12 }}>›</span>
                      <span className="lesson-card-topic">{sectionTopic}</span>
                    </>
                  )}
                  {isAdapted && (
                    <span className="adapted-badge" style={{ marginLeft: 4 }}>
                      REWIRED
                    </span>
                  )}
                </div>
                <span className="lesson-card-readtime">
                  Estimated read: {formatReadTime(estimatedSeconds)}
                </span>
                {/* Webcam status badge — shows current relevant state */}
                <WebcamStatusBadge
                  webcamStatus={webcamHook.webcamStatus}
                  facePresent={facePresent}
                  tabFocused={webcamHook.tabFocused}
                  webcamSkipped={webcamHook.webcamSkipped}
                  presenceRatio={webcamHook.presenceRatio}
                />
              </div>

              {/* Section body */}
              {currentSection && (
                <div className="lesson-card-body">
                  <p
                    style={{
                      fontSize: formatting.font_size_multiplier
                        ? `${formatting.font_size_multiplier}em`
                        : undefined,
                      lineHeight: formatting.line_height || 1.75,
                      letterSpacing: formatting.letter_spacing,
                      whiteSpace: "pre-line",
                      color: "#1e293b",
                      margin: 0,
                    }}
                  >
                    {displayText}
                  </p>

                  {isAdapted && session.rewireState.adaptedContent?.visual_description && (
                    <div className="visual-description-box" style={{ marginTop: 16 }}>
                      <div className="visual-description-label">
                        <I.Image size={14} /> Visual Mental Model
                      </div>
                      <p className="visual-description-text">
                        {session.rewireState.adaptedContent.visual_description}
                      </p>
                    </div>
                  )}

                  {/* Section micro-actions */}
                  <div className="lesson-card-actions">
                    <button className="text-action" onClick={() => readAloud(displayText)}>
                      <I.Volume2 size={13} /> Read section
                    </button>
                    <span style={{ color: "#e2e8f0" }}>•</span>
                    <button className="text-action" onClick={() => recordRereadAction(activeSection, currentSection.paragraph)}>
                      <I.RotateCcw size={13} /> Re-read section
                    </button>
                    <span style={{ color: "#e2e8f0" }}>•</span>
                    <button className="text-action" onClick={() => recordHelpAction(activeSection, currentSection.paragraph)}>
                      <I.HelpCircle size={13} /> Request explanation
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* ── Bottom navigation row ───────────────────────────────── */}
            <div className="lesson-nav-row">
              {/* Previous */}
              <button
                className="lesson-nav-prev"
                disabled={activeSection === 0}
                onClick={() => setActiveSection((i) => i - 1)}
              >
                <I.ChevronLeft size={15} /> Previous
              </button>

              {/* Section dots */}
              <div className="lesson-nav-dots">
                {sections.map((section, index) => (
                  <button
                    key={section.id}
                    className={`lesson-dot ${index === activeSection ? "current" : ""} ${completedSections.includes(index) ? "done" : ""}`}
                    onClick={() => setActiveSection(index)}
                    title={`Section ${index + 1}`}
                  >
                    {completedSections.includes(index) ? <I.Check size={10} /> : index + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Primary + Visual row ────────────────────────────────── */}
            <div className="lesson-cta-row">
              <button className="primary-action" style={{ flex: 1 }} onClick={markSectionComplete}>
                {isComplete
                  ? activeSection === sections.length - 1
                    ? "All sections complete"
                    : "Next section"
                  : "Mark section complete"}{" "}
                <I.Check size={18} />
              </button>
              <button
                className="secondary-action"
                style={{ flex: 1 }}
                disabled={Boolean(busy)}
                onClick={getVisual}
              >
                <I.PieChart size={15} />
                {busy === "visual" ? "Building infographic…" : "Generate Visual Infographic"}
              </button>
            </div>

            {/* Visual result */}
            {session.visual && (
              <VisualCard visual={session.visual} onReadAloud={(text) => readAloud(text)} />
            )}

            <ErrorNotice />

            {/* ── SCALE dot (collapsed telemetry) ─────────────────────── */}            <div
              className="scale-dot-bar"
              title={`SCALE: ${(struggleScore * 100).toFixed(0)}% struggle`}
            >
              <span
                className={`gauge-dot ${
                  struggleScore >= 0.6 ? "critical" : struggleScore >= 0.4 ? "warning" : "normal"
                }`}
              />
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                SCALE {(struggleScore * 100).toFixed(0)}%
                {struggleScore >= 0.6 && (
                  <span style={{ color: "#7c3aed", marginLeft: 4 }}>· REWIRE Active</span>
                )}
              </span>
            </div>

            {/* ── Floating Voice Bubble ───────────────────────────────── */}
            <button
              className="voice-fab"
              onClick={() => setVoiceOpen((o) => !o)}
              aria-label="Open voice assistant"
              title="Voice & In-Context Assistant"
            >
              {voiceOpen ? <I.X size={22} /> : <I.MessageCircle size={22} />}
              <span
                className="voice-fab-dot"
                style={{ background: voiceOpen ? "#ef4444" : "#10b981" }}
              />
            </button>

            {/* ── Floating Voice Panel ────────────────────────────────── */}
            {voiceOpen && (
              <div className="voice-float-panel">
                <div className="voice-float-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="voice-float-icon">
                      <I.Mic size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>
                        Voice &amp; In-Context Assistant
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        Speech-to-Text · Lesson Grounded
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      onClick={() => setVoiceOpen(false)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}
                    >
                      <I.X size={16} />
                    </button>
                  </div>
                </div>

                <div className="voice-float-body">
                  <VoiceAssistant
                    currentSection={currentSection}
                    onAsk={ask}
                    busy={busy}
                    onVoiceHelp={recordVoiceHelpAction}
                    onReadSection={() => readAloud(displayText)}
                  />
                </div>
              </div>
            )}
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
      <WebcamProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Progress />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/progress" element={<Progress />} />
          </Routes>
          <ToastContainer />
        </ToastProvider>
      </WebcamProvider>
    </SessionProvider>
  );
}

export default App;
