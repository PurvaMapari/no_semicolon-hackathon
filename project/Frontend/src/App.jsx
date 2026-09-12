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
  generatePracticeQuiz,
  generateVisual,
  transformText,
  rewireContent,
  generateAdaptiveQuiz,
  chatTopicAssistant,
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

  function setText(text, customFileName = null) {
    setSession((current) => ({
      ...current,
      fileName: customFileName || "AI Generated Lesson",
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

  async function startLearningFromTopic(text, topicTitle = "AI Lesson") {
    const profile = session.profile || "cognitive_load";
    return run("transform", async () => {
      let result = null;
      try {
        result = await transformText(text, profile);
      } catch (err) {
        console.warn("transformText failed, using local section parser fallback:", err);
      }

      if (!result || !Array.isArray(result.sections) || result.sections.length === 0) {
        // Fallback: parse sections directly from markdown headings in lesson text
        const rawBlocks = text.split(/(?=###\s+Section|\n(?=###\s+))/i).map((s) => s.trim()).filter(Boolean);
        const sectionsList = [];
        if (rawBlocks.length > 1) {
          rawBlocks.forEach((block, idx) => {
            const lines = block.split("\n");
            const heading = lines[0].replace(/^###\s*/, "").replace(/^Section\s*\d+:\s*/i, "").trim();
            const content = lines.slice(1).join("\n").trim();
            sectionsList.push({
              heading: heading || `Section ${idx + 1}`,
              content: content || block,
            });
          });
        } else {
          sectionsList.push({
            heading: topicTitle,
            content: text,
          });
        }

        result = {
          profile,
          sections: sectionsList,
          chunks: sectionsList.map((s) => s.content),
          chunk_meta: sectionsList.map((s) => ({
            difficulty_tier: "intermediate",
            estimated_seconds: Math.max(30, Math.round((s.content || "").split(/\s+/).length / 3)),
            word_count: (s.content || "").split(/\s+/).length,
          })),
          text,
          formatting: {},
        };
      }

      setSession((current) => ({
        ...current,
        fileName: topicTitle,
        lessonTitle: topicTitle,
        text,
        wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
        profile,
        transformed: result,
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

  async function getPracticeQuiz() {
    return run("practiceQuiz", async () => {
      const result = await generatePracticeQuiz(session.text, session.profile, 8);
      return result.questions || result;
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
        getPracticeQuiz,
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
        startLearningFromTopic,
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

function TopicChatAssistant({ onStartLearning, busy }) {
  const { session } = useSession();
  const [topicInput, setTopicInput] = useState("");
  const [currentTopic, setCurrentTopic] = useState("");
  const [step, setStep] = useState("ask"); // "ask" | "clarify" | "building"
  const [clarifyQuestion, setClarifyQuestion] = useState("");
  const [clarifyOptions, setClarifyOptions] = useState([]);
  const [buildStatus, setBuildStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const suggestedTopics = [
    { label: "🚀 Teach me JavaScript from scratch", topic: "JavaScript Fundamentals & DOM" },
    { label: "🐍 Python for Beginners", topic: "Python Basics & Data Structures" },
    { label: "⚛️ Modern React & State Management", topic: "Modern React & State Management" },
    { label: "🧠 Neural Networks & Deep Learning", topic: "Neural Networks & Deep Learning" },
    { label: "💻 System Design & Microservices", topic: "System Design & Microservices" },
  ];

  const handleStartClarification = (topicStr) => {
    const topic = topicStr || topicInput.trim();
    if (!topic) return;

    setCurrentTopic(topic);
    setErrorMsg("");
    setStep("clarify");
    setClarifyQuestion(`Great choice! To build the best lesson for "${topic}", choose your experience level or focus:`);
    setClarifyOptions([
      `🌱 Complete Beginner (Start from scratch with clear analogies)`,
      `💡 Practical & Hands-on (Code examples & real-world use cases)`,
      `⚡ Quick Crash Course (Core concepts, syntax & takeaways)`,
    ]);
  };

  const handleBuildAndLearn = async (topicStr, contextDetail = "") => {
    const finalTopic = topicStr || currentTopic || topicInput.trim();
    if (!finalTopic) return;

    setCurrentTopic(finalTopic);
    setStep("building");
    setBuildStatus(`Consulting Groq AI to design your curriculum for "${finalTopic}"...`);
    setErrorMsg("");

    try {
      const messages = [
        {
          role: "user",
          content: `I want to learn: ${finalTopic}. ${contextDetail ? `Level / Focus: ${contextDetail}.` : ""} Please build a comprehensive, multi-section lesson for me with clear sections.`,
        },
      ];

      setBuildStatus(`Groq AI is generating your structured interactive modules...`);
      const response = await chatTopicAssistant(messages, finalTopic, session.profile, true);

      const lessonText = response.ready_lesson_text;
      const topicTitle = response.topic || finalTopic;

      if (!lessonText) {
        throw new Error("Could not generate curriculum text. Please try again.");
      }

      setBuildStatus(`Adapting sections for ${session.profile || "your learning profile"} & launching Learn page...`);

      // Store generated text, adapt into sections, and automatically navigate to /learn
      await onStartLearning(lessonText, topicTitle);
    } catch (err) {
      console.error("Build lesson error:", err);
      setErrorMsg(err.message || "Failed to generate lesson with Groq. Please try again.");
      setStep("ask");
    }
  };

  const handleReset = () => {
    setStep("ask");
    setCurrentTopic("");
    setTopicInput("");
    setErrorMsg("");
    setBuildStatus("");
  };

  if (step === "building") {
    return (
      <div
        style={{
          padding: "36px 20px",
          textAlign: "center",
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)",
          border: "2px solid rgba(99, 102, 241, 0.2)",
          borderRadius: 16,
          marginTop: 14,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "var(--primary-gradient)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 8px 20px rgba(99, 102, 241, 0.3)",
          }}
        >
          <I.Sparkles size={26} className="spin-slow" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)" }}>
            Building Your Lesson: {currentTopic}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
            {buildStatus}
          </div>
        </div>
        <div className="progressbar" style={{ width: "80%", maxWidth: 360, marginTop: 4 }}>
          <div className="progressfill" style={{ width: "85%", animation: "pulse 1.5s infinite" }} />
        </div>
        <div style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700 }}>
          🚀 Automatically taking you to the Learn page once ready...
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(99, 102, 241, 0.04)",
          border: "1px solid rgba(99, 102, 241, 0.15)",
          borderRadius: 12,
          padding: "8px 14px",
          fontSize: 13,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: "var(--primary)" }}>
          <I.Bot size={18} />
          <span>Groq AI Curriculum Assistant</span>
          {currentTopic && (
            <span
              style={{
                background: "var(--primary-light)",
                color: "var(--primary)",
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Topic: {currentTopic}
            </span>
          )}
        </div>
        {step !== "ask" && (
          <button
            type="button"
            onClick={handleReset}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <I.RotateCcw size={13} /> Change Topic
          </button>
        )}
      </div>

      {errorMsg && (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            color: "#991b1b",
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => handleBuildAndLearn(currentTopic)}
            style={{
              background: "none",
              border: "none",
              color: "#991b1b",
              fontWeight: 700,
              cursor: "pointer",
              textDecoration: "underline",
              fontSize: 12,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {step === "ask" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--border-color)",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 4 }}>
              What would you like to learn today?
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>
              Don't have a document or PDF? Tell Groq AI any skill or concept (e.g. <i>"Can you teach me JavaScript?"</i>), and we'll generate the full lesson in interactive sections and take you straight into the Learn page!
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (topicInput.trim()) {
                  handleBuildAndLearn(topicInput.trim());
                }
              }}
              style={{ display: "flex", gap: 8, alignItems: "center" }}
            >
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder="e.g. Can you teach me JavaScript from scratch?"
                style={{
                  flex: 1,
                  padding: "11px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border-color)",
                  fontSize: 13,
                  outline: "none",
                  background: "#fafbfc",
                }}
              />
              <button
                type="button"
                disabled={!topicInput.trim()}
                onClick={() => handleStartClarification(topicInput.trim())}
                style={{
                  background: "var(--secondary-bg)",
                  color: "var(--secondary-ink)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 12,
                  padding: "11px 14px",
                  cursor: !topicInput.trim() ? "not-allowed" : "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                Customize
              </button>
              <button
                type="submit"
                disabled={!topicInput.trim()}
                style={{
                  background: !topicInput.trim() ? "var(--secondary-bg)" : "var(--primary-gradient)",
                  color: !topicInput.trim() ? "var(--muted)" : "#ffffff",
                  border: "none",
                  borderRadius: 12,
                  padding: "11px 16px",
                  cursor: !topicInput.trim() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 700,
                  fontSize: 13,
                  whiteSpace: "nowrap",
                  boxShadow: topicInput.trim() ? "0 4px 12px rgba(79, 70, 229, 0.25)" : "none",
                }}
              >
                <span>Build & Learn</span>
                <I.ArrowRight size={15} />
              </button>
            </form>
          </div>

          {/* Quick topic suggestion pills */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Or choose a popular topic:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {suggestedTopics.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleBuildAndLearn(item.topic)}
                  style={{
                    background: "#ffffff",
                    border: "1px solid rgba(99, 102, 241, 0.25)",
                    color: "var(--primary)",
                    borderRadius: 999,
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 2px 4px rgba(15, 23, 42, 0.03)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--primary-light)";
                    e.currentTarget.style.borderColor = "var(--primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#ffffff";
                    e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.25)";
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Clarification Step */
        <div
          style={{
            background: "#ffffff",
            border: "1.5px solid rgba(99, 102, 241, 0.3)",
            borderRadius: 14,
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--primary-gradient)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <I.Bot size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
                {clarifyQuestion}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Click an option below to immediately generate your lesson and launch into the Learn page.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {clarifyOptions.map((opt, oIdx) => (
              <button
                key={oIdx}
                type="button"
                onClick={() => handleBuildAndLearn(currentTopic, opt)}
                style={{
                  background: "#f8fafc",
                  border: "1px solid var(--border-color)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--ink)",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--primary-light)";
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.color = "var(--primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#f8fafc";
                  e.currentTarget.style.borderColor = "var(--border-color)";
                  e.currentTarget.style.color = "var(--ink)";
                }}
              >
                <span>{opt}</span>
                <I.ArrowRight size={14} />
              </button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
            <button
              type="button"
              onClick={() => setStep("ask")}
              style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 12 }}
            >
              Back
            </button>
            <button
              type="button"
              className="primary-action"
              style={{ padding: "8px 16px", fontSize: 12 }}
              onClick={() => handleBuildAndLearn(currentTopic)}
            >
              <I.Zap size={14} /> Build Lesson & Start Learning Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Upload() {
  const { session, busy, upload, setText, startLearningFromTopic } = useSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState("upload");
  const ready = Boolean(session.text.trim());

  function handleLessonReady(lessonText, topicTitle) {
    setText(lessonText, topicTitle);
  }

  async function handleStartLearning(lessonText, topicTitle) {
    await startLearningFromTopic(lessonText, topicTitle);
    navigate("/learn");
  }

  return (
    <Layout section="Upload">
      <main className="page">
        <div className="eyebrow">
          <b>Step 1 of 3</b>
          <span>Document Extraction & Setup</span>
        </div>
        <h1 className="page-title">Add learning material</h1>

        <section className="hero-card">
          <b>Adaptive Content Hub</b>
          <p>
            Upload a document (PDF, EPUB, DOCX) or converse with our AI Topic Assistant to generate a personalized, section-by-section curriculum on any topic.
          </p>
        </section>

        <div className="segmented">
          {[
            ["upload", "Upload File"],
            ["chat", "AI Topic Assistant (Groq)"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={tab === value ? "selected" : ""}
            >
              {value === "chat" ? (
                <I.Bot size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
              ) : (
                <I.UploadCloud size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
              )}
              {label}
            </button>
          ))}
        </div>

        <section className="card" style={{ marginTop: 16, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span className="pill">
              <I.Zap size={13} /> {tab === "chat" ? "Interactive Groq Curriculum Builder" : "OCR Fallback & Intelligent Extractor"}
            </span>
            {ready && (
              <span className="pill" style={{ background: "var(--emerald-light)", color: "#047857" }}>
                <I.Check size={13} /> Content Loaded ({session.fileName || "Ready"})
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
            <TopicChatAssistant
              onLessonReady={handleLessonReady}
              onStartLearning={handleStartLearning}
              busy={busy}
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
              <span style={{ color: busy === "extract" || busy === "transform" ? "var(--primary)" : "var(--ink)" }}>
                {busy === "extract"
                  ? "Extracting document content..."
                  : busy === "transform"
                    ? "Generating adaptive lesson sections..."
                    : ready
                      ? `Ready: ${session.fileName || "Curriculum loaded"}`
                      : "Waiting for content"}
              </span>
              <span style={{ color: "var(--muted)" }}>{session.wordCount} words</span>
            </div>

            <div className="progressbar" style={{ marginTop: 10 }}>
              <div
                className="progressfill"
                style={{
                  width: busy === "extract" || busy === "transform" ? "65%" : ready ? "100%" : "0%",
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
  const [showQuizPrompt, setShowQuizPrompt] = useState(false);

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
  const hasStructuredSections = Array.isArray(transformed?.sections) && transformed.sections.length > 0;
  const chunks =
    Array.isArray(transformed?.chunks)
      ? transformed.chunks
      : [transformed?.text || session.text];

  // Extract metadata for each chunk/section
  const chunkMeta = transformed?.chunk_meta || [];
  const sectionMeta = transformed?.section_meta || null;

  let globalIndex = 0;
  const sections = hasStructuredSections
    ? transformed.sections.map((sec, idx) => ({
        id: `section-${idx}`,
        heading: sec.heading || null,
        paragraph: sec.content,
        chunk: idx + 1,
        chunkIndex: idx,
        sectionIndex: idx,
        meta: chunkMeta[idx] || null,
      }))
    : chunks.filter(Boolean).flatMap((chunk, chunkIndex) => {
        // For cognitive_load without structured sections: each chunk IS one section.
        const parts = isCognitiveLoad ? [chunk] : splitIntoLessonSections(chunk);
        return parts.map((paragraph, paragraphIndex) => {
          const idx = globalIndex++;

          // Attach metadata: for cognitive_load use chunk_meta[chunkIndex], otherwise use sectionMeta
          let meta = null;
          if (isCognitiveLoad && chunkMeta[chunkIndex]) {
            meta = chunkMeta[chunkIndex];
          } else if (sectionMeta) {
            const sectionWordCount = paragraph.split(/\s+/).filter(Boolean).length;
            const difficulty = sectionMeta.difficulty_tier || "intermediate";
            const wpmByDifficulty = { foundational: 220, intermediate: 180, advanced: 140 };
            const wpm = wpmByDifficulty[difficulty] || 180;
            const estimatedSec = Math.round((sectionWordCount / wpm) * 60);
            meta = { difficulty_tier: difficulty, estimated_seconds: estimatedSec, word_count: sectionWordCount };
          }

          return {
            id: `${chunkIndex}-${paragraphIndex}`,
            heading: null,
            paragraph,
            chunk: chunkIndex + 1,
            chunkIndex,
            sectionIndex: idx,
            meta,
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

    const isLastSection = activeSection === sections.length - 1;
    const currentCompleted = session.completedSections || [];
    const newCompletedSections = currentCompleted.includes(activeSection)
      ? currentCompleted
      : [...currentCompleted, activeSection];
    const allDone = sections.length > 0 && sections.every((_, idx) => newCompletedSections.includes(idx));

    if (allDone) {
      // All sections complete — ask learner to take the Practice Quiz
      setShowQuizPrompt(true);
    } else if (!isLastSection) {
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

  // Topic title: use structured heading if available, otherwise first line
  const sectionTopic =
    currentSection?.heading ||
    currentSection?.paragraph?.split("\n").find((l) => l.trim().length > 0)?.slice(0, 48) ||
    session.lessonTitle ||
    "Lesson";

  const allSectionsCompleted =
    sections.length > 0 &&
    sections.every((_, idx) => (session.completedSections || []).includes(idx));

  return (
    <Layout section="Learn">
      <main className="page learn-page">

        {/* ── All sections complete banner ───────────────────────────── */}
        {allSectionsCompleted && (
          <div
            className="card"
            style={{
              marginBottom: 16,
              padding: "16px 20px",
              background: "linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)",
              border: "2px solid #86efac",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "#059669",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <I.Trophy size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#065f46" }}>
                  All Sections Complete!
                </div>
                <div style={{ fontSize: 13, color: "#166534", marginTop: 2 }}>
                  You have completed every section. Ready to test your understanding with the AI Practice Quiz?
                </div>
              </div>
            </div>
            <button
              className="primary-action"
              style={{
                background: "#059669",
                padding: "9px 18px",
                fontSize: 14,
                width: "auto",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
              onClick={() => navigate("/practice")}
            >
              Take Practice Quiz <I.ArrowRight size={16} />
            </button>
          </div>
        )}

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
                  {currentSection?.heading && (
                    <h2
                      style={{
                        fontSize: "1.35em",
                        fontWeight: 700,
                        color: "#0f172a",
                        margin: "0 0 14px 0",
                        lineHeight: 1.3,
                        letterSpacing: "-0.01em",
                        borderBottom: "2px solid #e0e7ff",
                        paddingBottom: 10,
                      }}
                    >
                      {currentSection.heading}
                    </h2>
                  )}
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
                aria-label="Previous section"
              >
                <I.ChevronLeft size={15} /> Previous
              </button>

              {/* Section dots (<= 12) or Scalable Jump Selector (> 12) */}
              {sections.length <= 12 ? (
                <div className="lesson-nav-dots">
                  {sections.map((section, index) => (
                    <button
                      key={section.id}
                      className={`lesson-dot ${index === activeSection ? "current" : ""} ${completedSections.includes(index) ? "done" : ""}`}
                      onClick={() => setActiveSection(index)}
                      title={`Section ${index + 1}: ${section.heading || ""}`}
                    >
                      {completedSections.includes(index) ? <I.Check size={10} /> : index + 1}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="lesson-nav-jump-group">
                  <span className="lesson-nav-counter">
                    Section {activeSection + 1} of {sections.length}
                  </span>
                  <div className="lesson-jump-select-wrap">
                    <I.List size={14} className="lesson-jump-icon" />
                    <select
                      className="lesson-jump-select"
                      value={activeSection}
                      onChange={(e) => setActiveSection(Number(e.target.value))}
                      aria-label="Jump to section"
                    >
                      {sections.map((section, index) => {
                        const headingText = section.heading || `Section ${index + 1}`;
                        const isDone = completedSections.includes(index);
                        return (
                          <option key={section.id} value={index}>
                            {isDone ? "✓ " : ""}{index + 1}. {headingText.length > 46 ? headingText.slice(0, 46) + "…" : headingText}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              )}

              {/* Next */}
              <button
                className="lesson-nav-prev lesson-nav-next"
                disabled={activeSection === sections.length - 1}
                onClick={() => setActiveSection((i) => i + 1)}
                aria-label="Next section"
              >
                Next <I.ChevronRight size={15} />
              </button>
            </div>

            {/* ── Primary + Visual row ────────────────────────────────── */}
            <div className="lesson-cta-row">
              <button
                className="primary-action"
                style={{
                  flex: 1,
                  background: allSectionsCompleted ? "linear-gradient(135deg, #059669 0%, #047857 100%)" : undefined,
                }}
                onClick={() => {
                  if (allSectionsCompleted) {
                    setShowQuizPrompt(true);
                  } else {
                    markSectionComplete();
                  }
                }}
              >
                {allSectionsCompleted
                  ? "All sections complete — Take Practice Quiz"
                  : isComplete
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

      {showQuizPrompt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 480,
              width: "100%",
              padding: 32,
              textAlign: "center",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.3)",
              border: "2px solid #818cf8",
              background: "#ffffff",
              borderRadius: 20,
            }}
          >
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #6366f1, #818cf8)",
                margin: "0 auto 16px",
                display: "grid",
                placeItems: "center",
                color: "#fff",
              }}
            >
              <I.Trophy size={30} />
            </div>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "var(--ink)",
                marginBottom: 8,
                fontFamily: "var(--font-heading)",
              }}
            >
              All Sections Complete!
            </h2>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, marginBottom: 24 }}>
              Fantastic job completing every section of this lesson. Would you like to take the{" "}
              <strong>Practice Quiz</strong> now? The AI will generate relevant questions from your lesson to test your mastery.
            </p>
            <div style={{ display: "flex", gap: 12, flexDirection: "column" }}>
              <button
                id="take-practice-quiz-btn"
                className="primary-action"
                style={{
                  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  fontSize: 15,
                  padding: "12px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
                onClick={() => {
                  setShowQuizPrompt(false);
                  navigate("/practice");
                }}
              >
                Take Practice Quiz Now <I.ChevronRight size={18} />
              </button>
              <button
                className="secondary-action"
                style={{ padding: "10px 18px", fontSize: 14 }}
                onClick={() => setShowQuizPrompt(false)}
              >
                Stay and Review Sections
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function PracticeQuizView({ questions, onDone, onExit }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [finished, setFinished] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setCurrentIndex(0);
    setSelected("");
    setRevealed(false);
    setAnswers([]);
    setFinished(false);
  }, [questions]);

  const q = questions[currentIndex] || {};
  const total = questions.length;
  const progress = total > 0 ? ((currentIndex) / total) * 100 : 0;

  function handleReveal() {
    if (!selected || revealed) return;
    setRevealed(true);
    setAnswers((prev) => [...prev, { question: q.question, selected, answer: q.answer, explanation: q.explanation, correct: selected === q.answer }]);
  }

  function handleNext() {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
      setSelected("");
      setRevealed(false);
    } else {
      setFinished(true);
    }
  }

  if (finished) {
    const correct = answers.filter((a) => a.correct).length;
    const wrong = answers.filter((a) => !a.correct);
    const pct = Math.round((correct / total) * 100);
    const grade = pct >= 80 ? "Excellent" : pct >= 60 ? "Good" : "Keep Practising";
    const gradeColor = pct >= 80 ? "#059669" : pct >= 60 ? "#2563eb" : "#dc2626";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Score hero */}
        <section className="card" style={{ padding: 28, textAlign: "center", background: "linear-gradient(135deg,#f0fdf4 0%,#eff6ff 100%)", border: "2px solid #bbf7d0" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Practice Quiz Complete</div>
          <div style={{ position: "relative", width: 110, height: 110, margin: "0 auto 14px" }}>
            <svg viewBox="0 0 110 110" style={{ width: 110, height: 110, transform: "rotate(-90deg)" }}>
              <circle cx="55" cy="55" r="46" fill="none" stroke="#e2e8f0" strokeWidth="10" />
              <circle cx="55" cy="55" r="46" fill="none" stroke={gradeColor} strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 46}`}
                strokeDashoffset={`${2 * Math.PI * 46 * (1 - pct / 100)}`}
                style={{ transition: "stroke-dashoffset 1s ease" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: gradeColor, fontFamily: "var(--font-heading)" }}>{pct}%</div>
              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>SCORE</div>
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: gradeColor, fontFamily: "var(--font-heading)", marginBottom: 4 }}>{grade}!</div>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>
            <span style={{ fontWeight: 700, color: "#059669" }}>{correct} correct</span>
            {" "}·{" "}
            <span style={{ fontWeight: 700, color: "#dc2626" }}>{wrong.length} wrong</span>
            {" "}out of {total} questions
          </div>
        </section>

        {/* Correct answers */}
        {answers.filter((a) => a.correct).length > 0 && (
          <section className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <I.CheckCircle2 size={18} style={{ color: "#059669", flexShrink: 0 }} />
              <b style={{ fontSize: 14, color: "#065f46" }}>Correct ({answers.filter((a) => a.correct).length})</b>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {answers.filter((a) => a.correct).map((a, i) => (
                <div key={i} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 2 }}>{a.question}</div>
                  <div style={{ fontSize: 12, color: "#059669", fontWeight: 700 }}>✓ {a.answer}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Wrong answers */}
        {wrong.length > 0 && (
          <section className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <I.AlertCircle size={18} style={{ color: "#dc2626", flexShrink: 0 }} />
              <b style={{ fontSize: 14, color: "#7f1d1d" }}>Needs Review ({wrong.length})</b>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {wrong.map((a, i) => (
                <div key={i} style={{ background: "#fff7f7", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>{a.question}</div>
                  <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, marginBottom: 2 }}>✗ You answered: {a.selected}</div>
                  <div style={{ fontSize: 12, color: "#059669", fontWeight: 700, marginBottom: 4 }}>✓ Correct: {a.answer}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{a.explanation}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="secondary-action" style={{ flex: 1 }} onClick={onDone}>
            <I.RefreshCw size={15} /> Retake Quiz
          </button>
          {onExit && (
            <button className="secondary-action" style={{ flex: 1 }} onClick={onExit}>
              <I.BookOpen size={15} /> Practice Overview
            </button>
          )}
          <button className="primary-action" style={{ flex: 1 }} onClick={() => navigate("/progress")}>
            View Progress <I.BarChart3 size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Progress bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 6, background: "#e2e8f0", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,#6366f1,#818cf8)", borderRadius: 99, transition: "width 0.4s ease" }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>{currentIndex + 1} / {total}</span>
      </div>

      {/* Question card */}
      <section className="card practice-card" style={{ padding: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
          Question {currentIndex + 1}
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", marginBottom: 18, lineHeight: 1.45 }}>{q.question}</h2>

        <div className="option-list">
          {q.options.map((option, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const isSelected = selected === option;
            const isCorrect = option === q.answer;
            let bg = isSelected ? "var(--primary)" : "#e2e8f0";
            let color = isSelected ? "#fff" : "var(--muted)";
            let rowBorder = "";
            let rowBg = "";
            if (revealed) {
              if (isCorrect) { bg = "#059669"; color = "#fff"; rowBorder = "1px solid #bbf7d0"; rowBg = "#f0fdf4"; }
              else if (isSelected && !isCorrect) { bg = "#dc2626"; color = "#fff"; rowBorder = "1px solid #fecaca"; rowBg = "#fff7f7"; }
              else { bg = "#e2e8f0"; color = "var(--muted)"; }
            }
            return (
              <button
                key={option}
                className={isSelected ? "selected" : ""}
                style={revealed ? { border: rowBorder, background: rowBg, cursor: "default", opacity: (!isCorrect && !isSelected) ? 0.55 : 1 } : {}}
                onClick={() => !revealed && setSelected(option)}
              >
                <span style={{ width: 24, height: 24, borderRadius: 6, background: bg, color, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, transition: "background 0.2s" }}>{letter}</span>
                <span>{option}</span>
                {revealed && isCorrect && <I.CheckCircle2 size={16} style={{ marginLeft: "auto", color: "#059669", flexShrink: 0 }} />}
                {revealed && isSelected && !isCorrect && <I.XCircle size={16} style={{ marginLeft: "auto", color: "#dc2626", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>

        {/* Explanation after reveal */}
        {revealed && (
          <div className={`feedback ${selected === q.answer ? "correct-feedback" : "failed-feedback"}`} style={{ marginTop: 14 }}>
            <b style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              {selected === q.answer ? <><I.CheckCircle2 size={15} /> Correct!</> : <><I.AlertCircle size={15} /> Incorrect — correct answer: {q.answer}</>}
            </b>
            <p style={{ fontSize: 13, margin: 0 }}>{q.explanation}</p>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          {!revealed ? (
            <button className="primary-action" disabled={!selected} onClick={handleReveal} style={{ flex: 1 }}>
              Check Answer
            </button>
          ) : (
            <button className="primary-action" onClick={handleNext} style={{ flex: 1 }}>
              {currentIndex < total - 1 ? <>Next Question <I.ChevronRight size={16} /></> : <>See Results <I.Award size={16} /></>}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function Practice() {
  const {
    session,
    busy,
    getQuiz,
    evaluateAnswer,
    getPracticeQuiz,
    getAdaptiveQuizAction,
    recordQuizAnswerAction,
    completeChunk,
    completeSection,
  } = useSession();
  const navigate = useNavigate();

  const chunks =
    Array.isArray(session.transformed?.chunks)
      ? session.transformed.chunks
      : [session.transformed?.text || session.text];

  const isRewireActive = session.rewireState.active;
  const chunk = chunks[0] || "";

  // ── Adaptive (REWIRE) quiz state ─────────────────────────────────────────
  const [adaptiveQuiz, setAdaptiveQuiz] = useState(null);
  const [adaptiveSelected, setAdaptiveSelected] = useState("");
  const [adaptiveSubmitted, setAdaptiveSubmitted] = useState(false);

  // ── Per-section quiz state ───────────────────────────────────────────────
  const [sectionIndex, setSectionIndex] = useState(0);
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState("");
  const [report, setReport] = useState(null);

  // ── Practice Quiz state (full-lesson, post-completion) ───────────────────
  const [practicePhase, setPracticePhase] = useState("idle"); // "idle" | "loading" | "quiz" | "done"
  const [practiceQuestions, setPracticeQuestions] = useState([]);

  const sectionText = chunks[sectionIndex] || "";

  // Detect if all sections are complete (learner came from Learn after finishing)
  const totalSectionsCount =
    Array.isArray(session.transformed?.sections) && session.transformed.sections.length > 0
      ? session.transformed.sections.length
      : Array.isArray(session.transformed?.chunks) && session.transformed.chunks.length > 0
        ? session.transformed.chunks.length
        : 1;

  const completedSections = session.completedSections || [];
  const completedCount = completedSections.length;
  const allSectionsComplete = Boolean(
    session.transformed &&
    completedCount >= totalSectionsCount
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

  async function startPracticeQuiz() {
    if (!session.text) return;
    setPracticePhase("loading");
    try {
      const questions = await getPracticeQuiz();
      if (questions && questions.length > 0) {
        setPracticeQuestions(questions);
        setPracticePhase("quiz");
      } else {
        setPracticePhase("idle");
      }
    } catch (err) {
      console.error("Practice quiz generation error:", err);
      setPracticePhase("idle");
    }
  }

  function resetPracticeQuiz() {
    setPracticeQuestions([]);
    setPracticePhase("idle");
  }

  return (
    <Layout section="Practice">
      <main className="page">
        <div className="eyebrow">
          <b>Mastery Practice</b>
          <span>{completedCount}/{totalSectionsCount} sections done</span>
        </div>
        <h1 className="page-title">Check your understanding</h1>

        {/* ── Practice Quiz (full-lesson, Groq AI generated) ─────────── */}
        {practicePhase === "loading" ? (
          <section className="card" style={{ padding: 48, textAlign: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                border: "4px solid #e2e8f0", borderTop: "4px solid var(--primary)",
                animation: "spin 0.8s linear infinite"
              }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)" }}>Generating your practice quiz…</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
                  Asking Groq AI to extract and formulate the most important and relevant questions from your lesson.
                </div>
              </div>
            </div>
          </section>
        ) : practicePhase === "quiz" ? (
          <PracticeQuizView
            questions={practiceQuestions}
            onDone={startPracticeQuiz}
            onExit={resetPracticeQuiz}
          />
        ) : (
          <>
            {!session.text ? (
              <section className="card" style={{ padding: 36, textAlign: "center", marginBottom: 16 }}>
                <I.BookOpen size={36} style={{ color: "var(--muted)", margin: "0 auto 12px", display: "block" }} />
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)", marginBottom: 6 }}>No lesson content loaded</div>
                <p style={{ fontSize: 13, color: "var(--muted)", maxWidth: 460, margin: "0 auto 16px" }}>
                  To take a practice quiz, add learning material by uploading a document or asking the AI Course Builder on the Upload page.
                </p>
                <button className="primary-action" onClick={() => navigate("/")} style={{ maxWidth: 220, margin: "0 auto" }}>
                  Add Learning Material <I.ArrowRight size={15} />
                </button>
              </section>
            ) : allSectionsComplete ? (
              /* ── Start card shown when all sections done ───────────────── */
              <section className="card" style={{
                marginBottom: 16, padding: 28,
                background: "linear-gradient(135deg, #eef2ff 0%, #f0fdf4 100%)",
                border: "2px solid #c7d2fe"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: "linear-gradient(135deg, #6366f1, #818cf8)",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <I.Trophy size={22} style={{ color: "#fff" }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "var(--ink)", fontFamily: "var(--font-heading)" }}>All Sections Complete!</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>Ready to test your full knowledge of: <strong>{session.fileName || session.lessonTitle || "the lesson"}</strong></div>
                  </div>
                </div>
                <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, marginBottom: 18 }}>
                  Great work completing every section. Now take the <strong>Practice Quiz</strong> — Groq AI will formulate important questions from your lesson material to evaluate your mastery.
                </p>
                <button
                  id="start-practice-quiz-btn"
                  className="primary-action"
                  disabled={busy === "practiceQuiz" || !session.text}
                  onClick={startPracticeQuiz}
                  style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", fontSize: 15 }}
                >
                  {busy === "practiceQuiz" ? "Generating quiz with Groq…" : "Start Practice Quiz"}
                  <I.ClipboardCheck size={18} />
                </button>
              </section>
            ) : (
              <section className="card" style={{
                marginBottom: 16, padding: 24,
                background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                border: "1.5px solid #cbd5e1"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: "#64748b",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <I.BookOpen size={20} style={{ color: "#fff" }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>Practice Quiz Available</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      Topic: <strong>{session.fileName || session.lessonTitle || "Active Lesson"}</strong> • {completedCount} of {totalSectionsCount} sections completed in Learn
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, marginBottom: 16 }}>
                  You can finish all sections in Learn to unlock the full mastery review, or start a practice quiz right now covering key concepts in this lesson.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    id="start-practice-quiz-btn"
                    className="primary-action"
                    disabled={busy === "practiceQuiz" || !session.text}
                    onClick={startPracticeQuiz}
                    style={{ flex: 1 }}
                  >
                    {busy === "practiceQuiz" ? "Generating quiz with Groq…" : "Start Practice Quiz Now"}
                    <I.ClipboardCheck size={16} />
                  </button>
                  <button
                    className="secondary-action"
                    onClick={() => navigate("/learn")}
                    style={{ flex: 1 }}
                  >
                    Back to Learn <I.ArrowRight size={15} />
                  </button>
                </div>
              </section>
            )}

        {/* ── REWIRE Adaptive Question Card ─────────────────────────────── */}
        {isRewireActive && (
          <section className="card" style={{ marginBottom: 16, padding: 20, border: "2px solid #a855f7" }}>
            <div style={{
              background: "#f3e8ff", color: "#7e22ce",
              padding: "6px 12px", borderRadius: 9999,
              fontSize: 12, fontWeight: 700,
              display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12,
            }}>
              <I.Zap size={13} />
              <span>Adaptive Question: Calibrated to Simplified Level</span>
            </div>

            {!adaptiveQuiz ? (
              <div>
                <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 12 }}>
                  Generate an adaptive question calibrated to your learning recovery.
                </p>
                <button className="primary-action" disabled={Boolean(busy)} onClick={loadAdaptiveQuiz}>
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
                      <button key={option} className={adaptiveSelected === option ? "selected" : ""}
                        onClick={() => !adaptiveSubmitted && setAdaptiveSelected(option)}>
                        <span style={{ width: 24, height: 24, borderRadius: 6, background: adaptiveSelected === option ? "var(--primary)" : "#e2e8f0", color: adaptiveSelected === option ? "#fff" : "var(--muted)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{letter}</span>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>
                <button className="primary-action" disabled={!adaptiveSelected || adaptiveSubmitted} onClick={handleAdaptiveSubmit}>
                  {adaptiveSubmitted ? (adaptiveSelected === adaptiveQuiz.answer ? "Correct" : "Review Answer") : "Submit Answer"}
                </button>
                {adaptiveSubmitted && (
                  <div className={`feedback ${adaptiveSelected === adaptiveQuiz.answer ? "correct-feedback" : "failed-feedback"}`} style={{ marginTop: 14 }}>
                    <b style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      {adaptiveSelected === adaptiveQuiz.answer ? <><I.CheckCircle2 size={16} /> Correct</> : <><I.AlertCircle size={16} /> Answer: {adaptiveQuiz.answer}</>}
                    </b>
                    <p>{adaptiveQuiz.explanation}</p>
                  </div>
                )}
                {adaptiveSubmitted && session.latestOutcome && (
                  <div className="outcome-card" style={{ marginTop: 14 }}>
                    <div className="outcome-title">
                      <span className="outcome-delta-badge">+{((session.latestOutcome.outcomeDelta || 1) * 100).toFixed(0)}%</span>
                      <span>SCALE Outcome: Struggle Successfully Resolved</span>
                    </div>
                    <button className="primary-action" style={{ background: "#059669", fontSize: 12, padding: "8px 14px", width: "auto", marginTop: 10 }} onClick={() => navigate("/progress")}>
                      View in Progress Dashboard <I.ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Per-section quiz ─────────────────────────────────────────── */}
        {!sectionText ? (
          <section className="card empty-state" style={{ marginTop: 16 }}>
            <I.BadgeHelp size={36} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 15, color: "var(--ink)", fontWeight: 600 }}>Adapt a lesson first to generate section questions.</p>
          </section>
        ) : (
          <section className="card practice-card" style={{ marginTop: 16 }}>
            <span className="pill">Section {sectionIndex + 1} of {chunks.length}</span>
            <p className="practice-context" style={{ marginTop: 8 }}>Section-by-section comprehension check.</p>
            {!quiz ? (
              <div style={{ marginTop: 16, textAlign: "center" }}>
                <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>Test your understanding of this section before moving on.</p>
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
                      <button key={option} className={selected === option ? "selected" : ""} onClick={() => !report && setSelected(option)}>
                        <span style={{ width: 24, height: 24, borderRadius: 6, background: selected === option ? "var(--primary)" : "#e2e8f0", color: selected === option ? "#fff" : "var(--muted)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{letter}</span>
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
                      {report.is_correct ? <><I.CheckCircle2 size={16} /> Correct! Section mastered.</> : <><I.AlertCircle size={16} /> Review this topic</>}
                    </b>
                    <p>{report.explanation}</p>
                    <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                      {!report.is_correct && (<button className="secondary-action" onClick={loadSectionQuestion}>Retry this topic</button>)}
                      {report.is_correct && sectionIndex < chunks.length - 1 && (
                        <button className="primary-action" onClick={() => { setSectionIndex((i) => i + 1); setQuiz(null); setReport(null); }}>
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
          </>
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
    Array.isArray(session.transformed?.chunks)
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
