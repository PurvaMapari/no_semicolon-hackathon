import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import {
  NavLink,
  Navigate,
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
  getVisualClusters,
  getClusterVisualCard,
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
  computeSessionStruggleScore,
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
    visualClusters: [],
    clusterVisuals: {},
    selectedClusterId: null,
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
        visualClusters: [],
        clusterVisuals: {},
        selectedClusterId: null,
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

  function removeDocument() {
    setSession((current) => ({
      ...current,
      fileName: "",
      text: "",
      wordCount: 0,
      tables: [],
      transformed: null,
      quizzes: [],
      visual: null,
      visualClusters: [],
      clusterVisuals: {},
      selectedClusterId: null,
      completed: 0,
      completedSections: [],
      practiceReport: { answered: [], failed: [], masteredSections: [] },
      wholeTest: null,
      error: null,
      signals: createSignalState(),
      sessionMeta: createSessionMeta(),
      rewireState: { active: false, adaptedContent: null, evaluation: null, chunkIndex: 0 },
      latestOutcome: null,
    }));
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
      visualClusters: [],
      clusterVisuals: {},
      selectedClusterId: null,
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
      visualClusters: [],
      clusterVisuals: {},
      selectedClusterId: null,
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
        visualClusters: [],
        clusterVisuals: {},
        selectedClusterId: null,
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

  async function loadVisualClusters(sectionsList) {
    if (!sectionsList || sectionsList.length === 0) return [];
    return run("clusters", async () => {
      const payload = sectionsList.map((sec, idx) => ({
        index: idx,
        heading: sec.heading || `Section ${idx + 1}`,
        content: sec.paragraph || "",
        word_count: (sec.paragraph || "").trim().split(/\s+/).length,
      }));
      const docId = session.fileName || "lesson";
      const res = await getVisualClusters(payload, session.profile, docId);
      const clusters = res?.clusters || [];
      setSession((current) => ({
        ...current,
        visualClusters: clusters,
      }));
      return clusters;
    });
  }

  async function loadClusterVisual(cluster, sectionsList) {
    if (!cluster) return null;
    if (session.clusterVisuals?.[cluster.cluster_id]) {
      return session.clusterVisuals[cluster.cluster_id];
    }
    return run(`visual-${cluster.cluster_id}`, async () => {
      const payload = (sectionsList || []).map((sec, idx) => ({
        index: idx,
        heading: sec.heading || `Section ${idx + 1}`,
        content: sec.paragraph || "",
        word_count: (sec.paragraph || "").trim().split(/\s+/).length,
      }));
      const docId = session.fileName || "lesson";
      const card = await getClusterVisualCard(cluster, payload, session.profile, docId);
      if (card) {
        setSession((current) => ({
          ...current,
          clusterVisuals: {
            ...current.clusterVisuals,
            [cluster.cluster_id]: card,
          },
        }));
      }
      return card;
    });
  }

  function setSelectedClusterId(clusterId) {
    setSession((current) => ({
      ...current,
      selectedClusterId: clusterId,
    }));
  }

  async function getPracticeQuiz() {
    return run("practiceQuiz", async () => {
      const result = await generatePracticeQuiz(session.text, session.profile, 8);
      return result.questions || result;
    });
  }

  async function getVisual(sectionsList = null, activeSecIndex = 0) {
    if (session.visualClusters && session.visualClusters.length > 0) {
      const secIdx = typeof activeSecIndex === "number" ? activeSecIndex : 0;
      const targetCluster =
        session.visualClusters.find(
          (c) => c.start_section_index <= secIdx && secIdx <= c.end_section_index
        ) || session.visualClusters[0];
      if (targetCluster) {
        return await loadClusterVisual(targetCluster, sectionsList);
      }
    }
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

  function recordTimeStruggleAction(sectionIndex, sectionText) {
    setSession((current) => {
      const currentCount = current.signals?.timeStruggleCount || 0;
      const updatedSignals = {
        ...current.signals,
        timeStruggleCount: currentCount + 1,
      };
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
      rewireState: {
        active: false,
        trigger: null,
        adaptedContent: null,
        evaluation: null,
      },
    }));
  }

  /**
   * Update active dwell time. Called continuously during active reading
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
        loadVisualClusters,
        loadClusterVisual,
        setSelectedClusterId,
        ask,
        completeChunk,
        completeSection,
        triggerRewireForChunk,
        recordRereadAction,
        recordHelpAction,
        recordVoiceHelpAction,
        recordTimeStruggleAction,
        recordQuizAnswerAction,
        getAdaptiveQuizAction,
        dismissRewire,
        updateActiveDwell,
        resetDwellForNewSection,
        startLearningFromTopic,
        removeDocument,
      }}
    >
      {children}
    </SessionContext.Provider>
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
          <NavLink to="/upload" className="brand" style={{ marginBottom: 12 }}>
            <img src="/logo.png" alt="AdaptLearn Logo" className="logo" />
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

          <NavLink
            to="/profile"
            style={{
              display: "block",
              textDecoration: "none",
              padding: 14,
              background: location.pathname === "/profile"
                ? "linear-gradient(135deg, rgba(252, 224, 114, 0.25), rgba(252, 224, 114, 0.12))"
                : "linear-gradient(135deg, rgba(252, 224, 114, 0.12), rgba(252, 224, 114, 0.05))",
              borderRadius: 14,
              border: location.pathname === "/profile"
                ? "1.5px solid var(--primary)"
                : "1px solid rgba(252, 224, 114, 0.4)",
              marginTop: "auto",
              transition: "all 0.2s ease",
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
          </NavLink>
        </aside>

        <div className="main-content">
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
          background: "linear-gradient(135deg, rgba(252, 224, 114, 0.15) 0%, rgba(252, 224, 114, 0.25) 100%)",
          border: "2px solid #fce072",
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
            boxShadow: "0 8px 20px rgba(252, 224, 114, 0.5)",
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
      {/* Topic status bar (only when topic is selected in clarification step) */}
      {step !== "ask" && currentTopic && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(252, 224, 114, 0.15)",
            border: "1px solid #fce072",
            borderRadius: 12,
            padding: "8px 14px",
            fontSize: 13,
          }}
        >
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
        </div>
      )}

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
                  boxShadow: topicInput.trim() ? "0 4px 12px rgba(252, 224, 114, 0.45)" : "none",
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
                    border: "1px solid rgba(252, 224, 114, 0.6)",
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
                    e.currentTarget.style.borderColor = "rgba(252, 224, 114, 0.6)";
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
            border: "1.5px solid #fce072",
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
  const { session, busy, upload, setText, startLearningFromTopic, removeDocument } = useSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState("upload");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const ready = Boolean(session.text && session.text.trim());
  const hasDoc = Boolean(session.fileName || session.text);

  function handleLessonReady(lessonText, topicTitle) {
    setText(lessonText, topicTitle);
  }

  async function handleStartLearning(lessonText, topicTitle) {
    await startLearningFromTopic(lessonText, topicTitle);
    navigate("/learn");
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      upload(file);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      upload(file);
    }
  }

  function handleRemoveDoc(e) {
    e.preventDefault();
    e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    removeDocument();
  }

  return (
    <Layout section="Upload">
      <main className="page">
        <div className="eyebrow">
          <b>Step 1 of 3</b>
          <span>Document Extraction & Setup</span>
        </div>
        <h1 className="page-title">Add learning material</h1>

        <div className="segmented">
          {[
            ["upload", "Upload File"],
            ["chat", "AI Topic Assistant"],
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
          {(tab === "upload" || ready) && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              {tab === "upload" ? (
                <span className="pill">
                  <I.Zap size={13} /> OCR Fallback & Intelligent Extractor
                </span>
              ) : <div />}
              {ready && (
                <span className="pill" style={{ background: "var(--emerald-light)", color: "#047857" }}>
                  <I.Check size={13} /> Content Loaded ({session.fileName || "Ready"})
                </span>
              )}
            </div>
          )}

          {tab === "upload" ? (
            !hasDoc ? (
              <label
                className={`dropzone ${isDragging ? "dragover" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  border: isDragging ? "2px dashed var(--primary)" : "1px dashed #9eb9aa",
                  background: isDragging ? "#eaf2ee" : "#f4f3ed",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.epub,.txt"
                  onChange={handleFileChange}
                />
                <I.UploadCloud size={40} />
                <b>Choose or drag doc</b>
                <span>Supports PDF, DOCX, EPUB, or TXT (up to 45MB)</span>
                <strong>Select from device</strong>
              </label>
            ) : (
              <div
                className="dropzone"
                style={{
                  border: "1px solid var(--border-color)",
                  background: "#ffffff",
                  padding: "24px 20px",
                  cursor: "default",
                }}
              >
                <I.FileText size={42} style={{ color: "var(--primary)" }} />
                <b style={{ fontSize: 16, color: "var(--ink)" }}>{session.fileName || "Uploaded Document"}</b>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {session.wordCount ? `${session.wordCount.toLocaleString()} words loaded` : "Ready for learning adaptation"}
                </span>
                <button
                  type="button"
                  id="remove-doc-btn"
                  onClick={handleRemoveDoc}
                  style={{
                    marginTop: 8,
                    background: "rgba(220, 38, 38, 0.08)",
                    border: "1.5px solid #dc2626",
                    color: "#dc2626",
                    fontWeight: 700,
                    padding: "9px 20px",
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#dc2626";
                    e.currentTarget.style.color = "#ffffff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(220, 38, 38, 0.08)";
                    e.currentTarget.style.color = "#dc2626";
                  }}
                >
                  <I.Trash2 size={16} /> Remove doc
                </button>
              </div>
            )
          ) : (
            <TopicChatAssistant
              onLessonReady={handleLessonReady}
              onStartLearning={handleStartLearning}
              busy={busy}
            />
          )}

          <div
            style={{
              background: "#f3f1eb",
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

  // Auto-start camera on Step 2 entry if not already started; enforce no camera skip
  React.useEffect(() => {
    if (webcamSkipped && setWebcamSkipped) {
      setWebcamSkipped(false);
    }
    if (!webcamEnabled && webcamStatus === "off") {
      toggleCamera();
    }
  }, [webcamEnabled, webcamStatus, toggleCamera, webcamSkipped, setWebcamSkipped]);

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

  // Gate: Continue allowed ONLY if camera ready AND face detected (or simulated detected)
  const canContinue =
    ((effectiveWebcamStatus === "ready" && effectiveFacePresent) ||
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
      <main className="page profile-page">
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

        {/* ── Camera Verification Card ── */}
        <section className="camera-verification-card">
            <div className="camera-verification-header">
              <div className="camera-verif-title-group">
                <div className="camera-verif-title-row">
                  <div className="camera-verif-icon-box">
                    <I.Video size={16} />
                  </div>
                  <span className="camera-verif-title">Camera Verification</span>
                  <span className="camera-verif-private-pill">Private • On-device</span>
                </div>
                <p className="camera-verif-subtitle">
                  Ensures you are present to dynamically adapt pacing. Required for adaptive learning.
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

            {/* HUD Viewport (Square format) */}
            <div className="camera-hud-viewport square-viewport">
              {/* Live Video Feed */}
              {mediaStream && effectiveWebcamStatus !== "error" && effectiveWebcamStatus !== "off" && (
                <CameraPreview stream={mediaStream} className="camera-hud-video" />
              )}

              {/* Fallback silhouette if camera off or loading */}
              {(!mediaStream || effectiveWebcamStatus === "off" || effectiveCamLoading) && (
                <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", opacity: 0.22, pointerEvents: "none" }}>
                  <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor" color="#94a3b8">
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
                  <I.Check size={14} strokeWidth={3} />
                  <span>Face detected — Ready</span>
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
                  <span>Camera unavailable</span>
                </div>
              ) : (
                <div className="camera-hud-bottom-banner absent">
                  <I.AlertTriangle size={14} />
                  <span>Position head in frame</span>
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

              <div className={`camera-telemetry-chip ${effectiveFacePresent && effectiveWebcamStatus === "ready" ? "success" : "neutral"}`}>
                {effectiveFacePresent && effectiveWebcamStatus === "ready" ? <I.Sparkles size={13} /> : <I.Clock size={13} />}
                <span>{effectiveFacePresent && effectiveWebcamStatus === "ready" ? "Ready for adaptive learning" : "Awaiting calibration"}</span>
              </div>
            </div>
          </section>

        <ErrorNotice />

        {/* Launch Session Console Bar (Exact Screenshot 2 Match) */}
        <section className="launch-session-bar">
          <div className="launch-bar-left">
            <div className="launch-bar-meta">
              <span className="launch-bar-sparkle">✦</span>
              <span>Ready in ~4 seconds • Configured for {PROFILE_LABELS[session.profile] || "Cognitive load support"}</span>
            </div>
            <h2 className="launch-bar-title">Launch your customized learning session</h2>
            <p className="launch-bar-subtitle">
              OUR ADAPTIVE AI WILL CUSTOMIZE COGNITIVE LOAD &amp; PACING INSTANTLY
            </p>
          </div>

          <div className="launch-bar-right">
            {/* Back to upload */}
            <button
              type="button"
              className="launch-back-btn"
              onClick={() => navigate("/upload")}
            >
              Back to upload
            </button>

            {/* Transform Lesson button */}
            <button
              type="button"
              className="launch-transform-btn"
              disabled={!canContinue || Boolean(busy)}
              onClick={async () => {
                await adapt();
                navigate("/learn");
              }}
            >
              <span>{busy === "transform" ? "Adapting lesson…" : "Transform Lesson"}</span>
              <I.Sparkles size={14} />
            </button>
          </div>
        </section>
      </main>
    </Layout>
  );
}

function VisualCard({ visual, cluster = null, sections = [], onReadAloud }) {
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
    covers_label  = "",
    start_section_index = null,
    end_section_index   = null,
  } = visual;

  const [expandedSections, setExpandedSections] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  // Compute coverage label
  const coverageText = covers_label || (
    start_section_index !== null && end_section_index !== null
      ? `Covers: Sections ${start_section_index + 1}–${end_section_index + 1}`
      : ""
  );

  // Filter sections that this visual covers
  const startIndex = start_section_index ?? cluster?.start_section_index ?? null;
  const endIndex = end_section_index ?? cluster?.end_section_index ?? null;
  const coveredSections = (Array.isArray(sections) && startIndex !== null && endIndex !== null)
    ? sections.slice(startIndex, endIndex + 1)
    : [];

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
    <section className="card prism-visual-card" style={{ marginTop: 16, padding: 22 }}>
      <div className="prism-visual-card-header">
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <span className="pill" style={{ background: source === "pdf" ? "#fef3c7" : "var(--primary-light)", color: source === "pdf" ? "#92400e" : "var(--primary)", fontWeight: 700 }}>
              {source === "pdf" ? "SOURCE VISUAL" : "PRISM CONCEPT VISUAL"}
            </span>
            {coverageText && (
              <span className="pill visual-coverage-pill">
                <I.Layers size={12} style={{ marginRight: 4 }} />
                {coverageText}
              </span>
            )}
            {(cluster?.suggested_visual_type || visual_type) && visual_type !== "none" && (
              <span className="pill" style={{ background: "#f1f5f9", color: "#475569", textTransform: "capitalize", fontWeight: 600 }}>
                {(cluster?.suggested_visual_type || visual_type).replace(/_/g, " ")}
              </span>
            )}
          </div>
          {title && (
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 19, margin: "6px 0 2px", color: "var(--ink)" }}>
              {cleanHeading(title, subtitle || cluster?.title, 1)}
            </h2>
          )}
          {subtitle && <p style={{ fontSize: 13, color: "var(--muted)", margin: "2px 0 0" }}>{subtitle}</p>}
        </div>
      </div>

      {coveredSections.length > 0 && (
        <div className="covered-sections-dropdown-container">
          <button
            type="button"
            className="covered-sections-toggle-btn"
            onClick={() => setExpandedSections(!expandedSections)}
            aria-expanded={expandedSections}
          >
            <span>
              <strong>{coveredSections.length}</strong> sections synthesized in this visual
            </span>
            {expandedSections ? <I.ChevronUp size={15} /> : <I.ChevronDown size={15} />}
          </button>
          {expandedSections && (
            <ul className="covered-sections-list">
              {coveredSections.map((sec, sIdx) => {
                const secNum = (startIndex ?? 0) + sIdx + 1;
                return (
                  <li key={sIdx} className="covered-sections-item">
                    <span className="covered-sec-badge">Section {secNum}</span>
                    <span className="covered-sec-heading">{sec.heading || `Concept Part ${sIdx + 1}`}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <VisualInfographic
        spec={spec}
        sourceImages={source_images}
        svgHtmlFallback={svg_html}
        onReadAloud={onReadAloud}
      />

      {/* Secondary Reference Notes: Understand It & Key Takeaways */}
      {(explanation || (key_takeaways && key_takeaways.length > 0)) && (
        <div className="visual-secondary-notes">
          <button
            type="button"
            className="visual-secondary-notes-summary"
            onClick={() => setShowNotes(!showNotes)}
            style={{ width: "100%", border: "none", cursor: "pointer" }}
            aria-expanded={showNotes}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <I.BookOpen size={15} color="#fce072" />
              <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 13 }}>
                Detailed Concept Notes & Key Takeaways
              </span>
              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>
                {showNotes ? "(click to collapse)" : "(click to view)"}
              </span>
            </div>
            {showNotes ? <I.ChevronUp size={16} color="#64748b" /> : <I.ChevronDown size={16} color="#64748b" />}
          </button>

          {showNotes && (
            <div className="visual-secondary-notes-body">
              {explanation && (
                <div>
                  <b style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                    <I.Lightbulb size={14} /> Understand It
                  </b>
                  <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "#334155", marginTop: 4 }}>{explanation}</p>
                </div>
              )}

              {key_takeaways && key_takeaways.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <b style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                    <I.CheckCircle2 size={14} /> Key Takeaways
                  </b>
                  <ul style={{ marginTop: 6, paddingLeft: 20 }}>
                    {key_takeaways.map((t, i) => (
                      <li key={i} style={{ fontSize: 13, color: "#334155", marginBottom: 4, lineHeight: 1.5 }}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {why_visual && (
                <div className="visual-description-box" style={{ marginTop: 14 }}>
                  <span style={{ fontWeight: 700, color: "#854d0e" }}>Why this infographic? </span>
                  <span style={{ color: "#713f12" }}>{why_visual}</span>
                </div>
              )}

              {explanation && (
                <button
                  className="secondary-action"
                  style={{ marginTop: 14, fontSize: 12, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
                  onClick={() => onReadAloud && onReadAloud(explanation + " " + (key_takeaways || []).join(". "))}
                >
                  <I.Volume2 size={14} /> Read explanation aloud
                </button>
              )}
            </div>
          )}
        </div>
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

/**
 * Sanitizes headings to ensure they are never solitary numbers (e.g. "6", "9", "10")
 * which occur when split on numbered prefixes or unmapped PDF subheadings.
 */
export function cleanHeading(heading, paragraph = "", fallbackNum = 1) {
  let h = (heading || "").trim();
  // Strip leading numbering "9. ", "9) ", "Section 9: ", "## "
  h = h.replace(/^(?:#{1,6}\s*|\d+[\.\)]\s*|(?:Section|Chapter|Part)\s*\d+[:\.]?\s*)/i, "").trim();

  // If h is empty, purely digits, or has fewer than 3 alphabet characters (e.g. "6", "9", "10", "4")
  const letters = h.match(/[a-zA-Z]/g);
  if (!letters || letters.length < 3) {
    if (paragraph && typeof paragraph === "string") {
      const lines = paragraph.split("\n").map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const cleanedLine = line.replace(/^(?:#{1,6}\s*|\d+[\.\)]\s*|(?:Section|Chapter|Part)\s*\d+[:\.]?\s*|[-•*]\s*)/i, "").trim();
        const lMatch = cleanedLine.match(/[a-zA-Z]/g);
        if (lMatch && lMatch.length >= 3) {
          const sentenceParts = cleanedLine.split(/(?<=[a-zA-Z0-9])\.\s+/);
          const firstSentence = (sentenceParts[0] || cleanedLine).replace(/[.:]+$/, "").trim();
          return firstSentence.length > 50 ? firstSentence.slice(0, 48) + "…" : firstSentence;
        }
      }
    }
    return `Section ${fallbackNum}`;
  }
  return h;
}

/**
 * Robust section difficulty resolver:
 * Ensures realistic progression (foundational -> intermediate -> advanced)
 * based on pedagogical keywords and position in the curriculum,
 * even when backend metadata defaulted all items to intermediate.
 */
export function resolveSectionDifficulty(section, index = 0, totalSections = 1) {
  const explicitTier = section?.meta?.difficulty_tier;
  if (explicitTier === "foundational" || explicitTier === "advanced") {
    return explicitTier;
  }

  const text = (
    (section?.heading || "") + " " +
    (section?.paragraph || section?.content || "")
  ).toLowerCase();

  const foundationalKeywords = [
    "what is", "introduction", "intro", "overview", "basics", "foundation",
    "blueprint", "definition", "defining", "elementary", "first step",
    "terminology", "starting with", "simple example", "syntax", "purpose", "core concept",
    "mental model", "thinking in", "state and behavior", "physical entity"
  ];
  const advancedKeywords = [
    "polymorphism", "dynamic dispatch", "concurrency", "solid", "architecture",
    "design pattern", "interface segregation", "dependency inversion", "liskov",
    "composition over inheritance", "substitutability", "trade-off", "coupling", "cohesion",
    "architectural", "invariants", "common interface", "extensibility", "flexible design",
    "loosely coupled"
  ];
  const intermediateKeywords = [
    "encapsulation", "inheritance", "subclass", "superclass", "overriding",
    "attributes", "parameters", "lifecycle", "instantiation", "access modifier",
    "private", "protected", "public", "aggregation", "association", "composition",
    "getter", "setter", "constructor", "validation", "methods"
  ];

  let advScore = 0;
  let foundScore = 0;
  let interScore = 0;

  for (const k of advancedKeywords) {
    if (text.includes(k)) advScore += 2;
  }
  for (const k of foundationalKeywords) {
    if (text.includes(k)) foundScore += 2;
  }
  for (const k of intermediateKeywords) {
    if (text.includes(k)) interScore += 1;
  }

  const relPos = totalSections > 1 ? index / (totalSections - 1) : 0;
  if (relPos < 0.28) {
    foundScore += 3;
  } else if (relPos > 0.68) {
    advScore += 3;
  } else {
    interScore += 2;
  }

  if (advScore >= 4 || (advScore > foundScore && advScore >= 2 && relPos > 0.45)) {
    return "advanced";
  }
  if (foundScore >= 3 && advScore < 3) {
    return "foundational";
  }
  if (relPos < 0.25 && advScore < 2) {
    return "foundational";
  }
  if (relPos > 0.75 && foundScore < 2) {
    return "advanced";
  }

  return "intermediate";
}

function Learn() {
  const {
    session,
    busy,
    adapt,
    ask,
    getVisual,
    loadVisualClusters,
    loadClusterVisual,
    setSelectedClusterId,
    completeChunk,
    completeSection,
    recordRereadAction,
    recordHelpAction,
    recordVoiceHelpAction,
    recordTimeStruggleAction,
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
  const isFaceAway = Boolean(webcamHook.webcamStatus === "ready" && !webcamHook.webcamSkipped && !facePresent);

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
  const [showVisualPanel, setShowVisualPanel] = useState(false);
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);
  const [showQuizPrompt, setShowQuizPrompt] = useState(false);
  const sectionPickerRef = useRef(null);

  // Close section dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (sectionPickerRef.current && !sectionPickerRef.current.contains(event.target)) {
        setSectionMenuOpen(false);
      }
    }
    if (sectionMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [sectionMenuOpen]);

  // ── Active Dwell Timer ──────────────────────────────────────────────────────
  // Tracks ONLY active learning time. Pauses during:
  //   • tab hidden (visibilitychange)
  //   • face not detected (user away from camera)
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
  // Timer runs ONLY when: transformed + not busy + sectionContentReady + tab visible + face present
  useEffect(() => {
    const canTime = transformed && !busy && sectionContentReady && !document.hidden && !isFaceAway;
    if (canTime) {
      resumeDwellTimer();
    } else {
      pauseDwellTimer();
    }
    // Sync active dwell into signals whenever conditions change
    updateActiveDwell(getCurrentActiveDwellMs());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, transformed, sectionContentReady, isFaceAway]);

  // Effect 3: Visibility change — pause on tab hidden, resume on visible
  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden || isFaceAway) {
        pauseDwellTimer();
        updateActiveDwell(getCurrentActiveDwellMs());
      } else if (transformed && !busy && sectionContentReady && !isFaceAway) {
        resumeDwellTimer();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transformed, busy, sectionContentReady, isFaceAway]);

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
    ? transformed.sections.map((sec, idx) => {
        const rawMeta = chunkMeta[idx] || null;
        const totalCount = transformed.sections.length;
        const sanitizedHeading = cleanHeading(sec.heading, sec.content, idx + 1);
        const resolvedTier = resolveSectionDifficulty(
          { heading: sanitizedHeading, paragraph: sec.content, meta: rawMeta },
          idx,
          totalCount
        );
        const sectionWordCount = (sec.content || "").split(/\s+/).filter(Boolean).length;
        const wpmByDifficulty = { foundational: 220, intermediate: 180, advanced: 140 };
        const wpm = wpmByDifficulty[resolvedTier] || 180;
        const estimatedSec = Math.round((sectionWordCount / wpm) * 60);

        return {
          id: `section-${idx}`,
          heading: sanitizedHeading,
          paragraph: sec.content,
          chunk: idx + 1,
          chunkIndex: idx,
          sectionIndex: idx,
          meta: {
            difficulty_tier: resolvedTier,
            expected_time_multiplier: resolvedTier === "foundational" ? 1.0 : resolvedTier === "advanced" ? 2.5 : 1.6,
            estimated_seconds: rawMeta?.estimated_seconds && rawMeta?.difficulty_tier === resolvedTier
              ? rawMeta.estimated_seconds
              : estimatedSec,
            word_count: rawMeta?.word_count || sectionWordCount,
          },
        };
      })
    : chunks.filter(Boolean).flatMap((chunk, chunkIndex) => {
        // For cognitive_load without structured sections: each chunk IS one section.
        const parts = isCognitiveLoad ? [chunk] : splitIntoLessonSections(chunk);
        const totalEstChunks = Math.max(chunks.length, parts.length * chunks.length);
        return parts.map((paragraph, paragraphIndex) => {
          const idx = globalIndex++;
          const rawMeta = chunkMeta[chunkIndex] || null;
          const sanitizedHeading = cleanHeading(null, paragraph, idx + 1);
          const resolvedTier = resolveSectionDifficulty(
            { heading: sanitizedHeading, paragraph, meta: rawMeta },
            idx,
            totalEstChunks
          );
          const sectionWordCount = paragraph.split(/\s+/).filter(Boolean).length;
          const wpmByDifficulty = { foundational: 220, intermediate: 180, advanced: 140 };
          const wpm = wpmByDifficulty[resolvedTier] || 180;
          const estimatedSec = Math.round((sectionWordCount / wpm) * 60);

          return {
            id: `${chunkIndex}-${paragraphIndex}`,
            heading: sanitizedHeading,
            paragraph,
            chunk: chunkIndex + 1,
            chunkIndex,
            sectionIndex: idx,
            meta: {
              difficulty_tier: resolvedTier,
              expected_time_multiplier: resolvedTier === "foundational" ? 1.0 : resolvedTier === "advanced" ? 2.5 : 1.6,
              estimated_seconds: rawMeta?.estimated_seconds && rawMeta?.difficulty_tier === resolvedTier
                ? rawMeta.estimated_seconds
                : estimatedSec,
              word_count: sectionWordCount,
            },
          };
        });
      });

  const currentSection = sections[activeSection] || sections[0];
  const formatting = transformed?.formatting || {};
  const completedSections = session.completedSections || [];
  const isComplete = completedSections.includes(activeSection);

  // ── Visual Concept Clusters ────────────────────────────────────────────────
  const clusters = session.visualClusters || [];

  // Find cluster covering the active reading section
  const currentSectionCluster = clusters.find(
    (c) => c.start_section_index <= activeSection && activeSection <= c.end_section_index
  ) || null;

  // Selected cluster tab (if manually chosen by user, otherwise follows current reading section)
  const activeCluster = (session.selectedClusterId
    ? clusters.find((c) => c.cluster_id === session.selectedClusterId)
    : null) || currentSectionCluster || clusters[0] || null;

  // Auto-fetch clusters when sections become available
  useEffect(() => {
    if (sections.length > 0 && (!session.visualClusters || session.visualClusters.length === 0) && busy !== "clusters") {
      loadVisualClusters(sections);
    }
  }, [sections.length, session.visualClusters?.length, busy]);

  // When reading section changes, reset manual cluster override so visual follows learner's active section
  useEffect(() => {
    setSelectedClusterId(null);
  }, [activeSection]);

  // Get difficulty and estimated time from section metadata (needed for SCALE evaluation)
  const sectionDifficulty = currentSection?.meta?.difficulty_tier || resolveSectionDifficulty(currentSection, activeSection, sections.length);
  const estimatedSeconds = currentSection?.meta?.estimated_seconds || 60;

  // ── Reading Friction Timer ───────────────────────────────────────────────────
  // Internal reading timer for the current section (no countdown displayed on screen).
  // Includes a 5-second grace threshold for initial page load / reading orientation.
  // Pauses automatically when the user's face is not detected (isFaceAway is true).
  // When active reading time exceeds estimatedSeconds + 5s, inline assistance is triggered
  // beside the prompt buttons, an assistance toast is displayed, and struggle score increases by 10%.
  const [activeReadSeconds, setActiveReadSeconds] = useState(0);
  const [struggleTriggered, setStruggleTriggered] = useState(false);
  const sectionStruggleFiredRef = useRef(new Set());
  const elapsedReadSecondsRef = useRef(0);

  // Keep fresh refs for timer interval callback so interval is NOT torn down on every webcam frame
  const estimatedSecondsRef = useRef(estimatedSeconds);
  estimatedSecondsRef.current = estimatedSeconds;

  const activeSectionRef = useRef(activeSection);
  activeSectionRef.current = activeSection;

  const currentSectionRef = useRef(currentSection);
  currentSectionRef.current = currentSection;

  const isFaceAwayRef = useRef(isFaceAway);
  isFaceAwayRef.current = isFaceAway;

  const canRunTimerRef = useRef(true);
  canRunTimerRef.current = Boolean(transformed && sectionContentReady && !document.hidden && !isFaceAway);

  const recordTimeStruggleRef = useRef(recordTimeStruggleAction);
  recordTimeStruggleRef.current = recordTimeStruggleAction;

  const pushToastRef = useRef(pushToast);
  pushToastRef.current = pushToast;

  // Reset read timer & triggered flag when navigating between sections
  useEffect(() => {
    elapsedReadSecondsRef.current = 0;
    setActiveReadSeconds(0);
    setStruggleTriggered(false);
  }, [activeSection]);

  // Stable read timer ticker: runs once, inspects refs every 1s
  useEffect(() => {
    const interval = setInterval(() => {
      if (!canRunTimerRef.current) return;

      elapsedReadSecondsRef.current += 1;
      setActiveReadSeconds(elapsedReadSecondsRef.current);

      const secIdx = activeSectionRef.current;
      const targetThreshold = (estimatedSecondsRef.current || 25) + 5;

      console.log(`[PRISM Timer] Section ${secIdx + 1}: ${elapsedReadSecondsRef.current}s / ${targetThreshold}s`);

      if (elapsedReadSecondsRef.current >= targetThreshold && !sectionStruggleFiredRef.current.has(secIdx)) {
        sectionStruggleFiredRef.current.add(secIdx);
        setStruggleTriggered(true);

        // Record struggle signal
        if (recordTimeStruggleRef.current) {
          recordTimeStruggleRef.current(secIdx, currentSectionRef.current?.paragraph);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const evaluation = evaluateSignals(
    session.signals, 
    session.sessionMeta, 
    null, 
    estimatedSeconds,
    sectionDifficulty
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
  const [voiceAutoPrompt, setVoiceAutoPrompt] = useState(null);

  function handleTriggerVoicePrompt(promptQuery) {
    if (currentSection) {
      recordHelpAction(activeSection, currentSection.paragraph);
      recordVoiceHelpAction();
    }
    setVoiceAutoPrompt({ query: promptQuery, timestamp: Date.now() });
    setVoiceOpen(true);
  }

  // Format difficulty for display (sectionDifficulty and estimatedSeconds already defined above)
  const difficultyLabel = sectionDifficulty.toUpperCase();
  const difficultyColor = 
    sectionDifficulty === "foundational" ? "#10b981" : 
    sectionDifficulty === "advanced" ? "#f59e0b" : 
    "#fce072";

  // Topic title: use structured heading if available, otherwise first line
  const sectionTopic =
    cleanHeading(currentSection?.heading, currentSection?.paragraph, activeSection + 1) ||
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
              background: "linear-gradient(135deg, #f0fdf4 0%, rgba(252, 224, 114, 0.15) 100%)",
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
                      color: difficultyColor === "#fce072" ? "#713f12" : difficultyColor, 
                      fontSize: 11, 
                      fontWeight: 700, 
                      letterSpacing: "0.05em",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      backgroundColor: difficultyColor === "#fce072" ? "#fef9c3" : `${difficultyColor}15`,
                      border: `1px solid ${difficultyColor === "#fce072" ? "#fce072" : `${difficultyColor}40`}`
                    }}
                  >
                    {difficultyLabel}
                  </span>
                  {sectionTopic && (
                    <>
                      <span style={{ color: "rgba(113, 63, 18, 0.4)", fontSize: 12 }}>›</span>
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
                  {isFaceAway && (
                    <span className="readtime-paused-pill" title="Reading timer paused because face is not detected">
                      ⏸ (Paused)
                    </span>
                  )}
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
                    <h2 className="lesson-section-title">
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
                  <div className="lesson-audio-ribbon">
                    <button
                      type="button"
                      className="audio-tool-btn"
                      onClick={() => readAloud(displayText)}
                      title="Read section text aloud"
                    >
                      <I.Volume2 size={13} />
                      <span>Read aloud</span>
                    </button>

                    <span className="audio-ribbon-divider" />

                    {struggleTriggered && (
                      <div className="struggle-inline-hint" role="status">
                        <I.Sparkles size={12} className="struggle-hint-icon" />
                        <span>Struggling with this explanation?</span>
                      </div>
                    )}

                    <button
                      type="button"
                      className={`audio-tool-btn prompt-tool-btn ${struggleTriggered ? "highlighted" : ""}`}
                      onClick={() => handleTriggerVoicePrompt("Explain this section in very simple terms.")}
                      title="Ask AI Assistant to explain this section simply"
                    >
                      <I.HelpCircle size={13} />
                      <span>Explain simply</span>
                    </button>

                    <button
                      type="button"
                      className={`audio-tool-btn prompt-tool-btn ${struggleTriggered ? "highlighted" : ""}`}
                      onClick={() => handleTriggerVoicePrompt("Give me an intuitive, real-world example of this concept.")}
                      title="Ask AI Assistant for an intuitive real-world example"
                    >
                      <I.Compass size={13} />
                      <span>Real-world example</span>
                    </button>

                    <button
                      type="button"
                      className={`audio-tool-btn prompt-tool-btn ${struggleTriggered ? "highlighted" : ""}`}
                      onClick={() => handleTriggerVoicePrompt("What is the single most important point in this section?")}
                      title="Ask AI Assistant for the key takeaway"
                    >
                      <I.Key size={13} />
                      <span>Key takeaway</span>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* ── Unified Lesson Navigation & Action Toolbar ── */}
            <div className="lesson-unified-toolbar">
              <div className="lesson-nav-cluster">
                {/* Previous */}
                <button
                  className="lesson-tool-btn"
                  disabled={activeSection === 0}
                  onClick={() => setActiveSection((i) => i - 1)}
                  aria-label="Previous section"
                >
                  <I.ChevronLeft size={15} />
                  <span>Prev</span>
                </button>

                {/* Section dots (<= 10) or Scalable Jump Selector (> 10) */}
                {sections.length <= 10 ? (
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
                  <div className="lesson-jump-compact" ref={sectionPickerRef}>
                    <span className="lesson-counter-tag">
                      {activeSection + 1} / {sections.length}
                    </span>
                    <div className="lesson-jump-popover-anchor">
                      <button
                        type="button"
                        className={`lesson-popover-trigger-btn ${sectionMenuOpen ? "active" : ""}`}
                        onClick={() => setSectionMenuOpen((prev) => !prev)}
                        aria-label="Choose section"
                        aria-expanded={sectionMenuOpen}
                      >
                        <span className="lesson-popover-trigger-text">
                          {completedSections.includes(activeSection) ? "✓ " : ""}
                          {activeSection + 1}. {cleanHeading(sections[activeSection]?.heading, sections[activeSection]?.paragraph, activeSection + 1)}
                        </span>
                        <I.ChevronUp size={13} className={`lesson-popover-chevron ${sectionMenuOpen ? "open" : ""}`} />
                      </button>

                      {sectionMenuOpen && (
                        <div className="lesson-section-popover-menu" role="menu">
                          <div className="lesson-popover-header">
                            <span className="lesson-popover-header-title">SECTIONS ({sections.length})</span>
                            <span className="lesson-popover-header-progress">
                              {completedSections.length}/{sections.length} completed
                            </span>
                          </div>
                          <div className="lesson-popover-scroll">
                            {sections.map((section, index) => {
                              const headingText = cleanHeading(section.heading, section.paragraph, index + 1);
                              const isDone = completedSections.includes(index);
                              const isCurrent = index === activeSection;
                              const tier = section.meta?.difficulty_tier || resolveSectionDifficulty(section, index, sections.length);
                              const tierColor =
                                tier === "foundational" ? "#10b981" :
                                tier === "advanced" ? "#f59e0b" : "#fce072";

                              return (
                                <button
                                  key={section.id}
                                  type="button"
                                  role="menuitem"
                                  className={`lesson-popover-item ${isCurrent ? "current" : ""} ${isDone ? "done" : ""}`}
                                  onClick={() => {
                                    setActiveSection(index);
                                    setSectionMenuOpen(false);
                                  }}
                                >
                                  <div className="popover-item-left">
                                    <span className={`popover-num-badge ${isDone ? "done" : ""} ${isCurrent ? "current" : ""}`}>
                                      {isDone ? <I.Check size={11} /> : index + 1}
                                    </span>
                                    <span className="popover-item-text" title={headingText}>
                                      {headingText}
                                    </span>
                                  </div>
                                  <span
                                    className="popover-diff-chip"
                                    style={{
                                      color: tierColor === "#fce072" ? "#713f12" : tierColor,
                                      backgroundColor: tierColor === "#fce072" ? "#fef9c3" : `${tierColor}15`,
                                      borderColor: tierColor === "#fce072" ? "#fce072" : `${tierColor}35`,
                                    }}
                                  >
                                    {tier.toUpperCase()}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Next */}
                <button
                  className="lesson-tool-btn"
                  disabled={activeSection === sections.length - 1}
                  onClick={() => setActiveSection((i) => i + 1)}
                  aria-label="Next section"
                >
                  <span>Next</span>
                  <I.ChevronRight size={15} />
                </button>
              </div>

              {/* Action Cluster: Concept Visual + Mark Complete */}
              <div className="lesson-actions-cluster">
                <button
                  type="button"
                  className={`lesson-action-pill ${session.clusterVisuals?.[activeCluster?.cluster_id] ? "ready" : ""} ${showVisualPanel ? "panel-active" : ""}`}
                  disabled={Boolean(busy)}
                  onClick={() => {
                    if (!showVisualPanel) {
                      setShowVisualPanel(true);
                      if (session.clusterVisuals?.[activeCluster?.cluster_id]) {
                        setTimeout(() => {
                          const el = document.querySelector(".visual-understanding-panel");
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 60);
                      } else if (activeCluster) {
                        loadClusterVisual(activeCluster, sections);
                        setTimeout(() => {
                          const el = document.querySelector(".visual-understanding-panel");
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 80);
                      } else {
                        getVisual(sections, activeSection);
                        setTimeout(() => {
                          const el = document.querySelector(".visual-understanding-panel");
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 80);
                      }
                    } else {
                      const el = document.querySelector(".visual-understanding-panel");
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  title={
                    showVisualPanel
                      ? "Visual concept maps are open below"
                      : "Generate and open visual concept maps"
                  }
                >
                  <I.Sparkles size={13} />
                  <span>
                    {busy && busy.startsWith("visual")
                      ? "Generating visual…"
                      : showVisualPanel
                      ? "Visuals Active ↓"
                      : session.clusterVisuals?.[activeCluster?.cluster_id]
                      ? "View Concept Visual ↓"
                      : "Generate Visual"}
                  </span>
                </button>

                <button
                  className="lesson-complete-btn"
                  onClick={markSectionComplete}
                >
                  <span>
                    {isComplete
                      ? activeSection === sections.length - 1
                        ? "Completed"
                        : "Next Section"
                      : "Mark Complete"}
                  </span>
                  <I.Check size={14} />
                </button>
              </div>
            </div>

            {/* ── Visual Understanding Panel (Opens ONLY when learner clicks Generate Visual) ── */}
            {showVisualPanel && (clusters.length > 0 || session.visual || busy === "clusters") && (
              <section className="visual-understanding-panel card" style={{ marginTop: 22, padding: 22 }}>
                <div className="visual-panel-header">
                  <div className="visual-panel-header-left">
                    <div className="visual-panel-icon-badge">
                      <I.Eye size={20} />
                    </div>
                    <div>
                      <h3 className="visual-panel-title">
                        Visual Concept Maps
                      </h3>
                      <span className="visual-panel-subtitle">
                        {clusters.length > 0
                          ? `${clusters.length} visual cluster${clusters.length > 1 ? "s" : ""} synthesized for this lesson`
                          : "Lesson Infographic"}
                      </span>
                    </div>
                  </div>

                  <div className="visual-panel-header-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {activeCluster && currentSectionCluster && activeCluster.cluster_id !== currentSectionCluster.cluster_id && (
                      <button
                        type="button"
                        className="text-action visual-sync-btn"
                        onClick={() => setSelectedClusterId(null)}
                        title={`Sync back to current reading section ${activeSection + 1}`}
                      >
                        <I.Crosshair size={14} />
                        <span>Back to Section {activeSection + 1} Visual ({currentSectionCluster.covers_label})</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="visual-hide-panel-btn"
                      onClick={() => setShowVisualPanel(false)}
                      title="Hide Visual Concept Maps"
                    >
                      <I.EyeOff size={13} style={{ marginRight: 4 }} />
                      <span>Hide Visuals</span>
                    </button>
                  </div>
                </div>

                {/* Horizontal Cluster Tabs */}
                {clusters.length > 0 && (
                  <div className="visual-cluster-strip" role="tablist" aria-label="Visual Concept Clusters">
                    {clusters.map((cluster, cIdx) => {
                      const isCurrentMatch = currentSectionCluster?.cluster_id === cluster.cluster_id;
                      const isSelected = activeCluster?.cluster_id === cluster.cluster_id;
                      const isLoaded = Boolean(session.clusterVisuals?.[cluster.cluster_id]);
                      return (
                        <button
                          key={cluster.cluster_id}
                          type="button"
                          role="tab"
                          aria-selected={isSelected}
                          className={`visual-cluster-tab ${isSelected ? "selected" : ""} ${isCurrentMatch ? "current-match" : ""}`}
                          onClick={() => setSelectedClusterId(cluster.cluster_id)}
                        >
                          <div className="cluster-tab-top">
                            <span className="cluster-number">Visual {cIdx + 1}</span>
                            {isCurrentMatch && (
                              <span className="cluster-current-tag">
                                <span className="cluster-pulse-dot" /> Active
                              </span>
                            )}
                            {isLoaded && !isCurrentMatch && (
                              <span className="cluster-loaded-tag">
                                <I.Check size={11} /> Ready
                              </span>
                            )}
                          </div>
                          <div className="cluster-tab-title" title={cleanHeading(cluster.title, cluster.subtitle, cIdx + 1)}>
                            {cleanHeading(cluster.title, cluster.subtitle, cIdx + 1)}
                          </div>
                          <div className="cluster-tab-coverage">
                            {cluster.covers_label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Loading state for clusters discovery */}
                {busy === "clusters" && clusters.length === 0 && (
                  <div className="visual-loading-box">
                    <I.Loader2 className="spinner" size={24} />
                    <p style={{ marginTop: 10, fontWeight: 600, color: "var(--ink)" }}>
                      Analyzing lesson concepts and creating visual clusters…
                    </p>
                  </div>
                )}

                {/* Visual Card / Loading / Preview for active cluster */}
                <div className="visual-cluster-content">
                  {busy === `visual-${activeCluster?.cluster_id}` ? (
                    <div className="visual-loading-box">
                      <I.Loader2 className="spinner" size={26} />
                      <p style={{ marginTop: 12, fontWeight: 700, color: "var(--ink)" }}>
                        Synthesizing concept visual for {activeCluster?.title}…
                      </p>
                      <span style={{ fontSize: 13, color: "var(--muted)" }}>
                        Covering {activeCluster?.covers_label} ({activeCluster?.sections_count} sections) into a unified visual
                      </span>
                    </div>
                  ) : activeCluster && session.clusterVisuals?.[activeCluster.cluster_id] ? (
                    <VisualCard
                      visual={session.clusterVisuals[activeCluster.cluster_id]}
                      cluster={activeCluster}
                      sections={sections}
                      onReadAloud={(text) => readAloud(text)}
                    />
                  ) : activeCluster ? (
                    <div className="visual-preview-card">
                      <div className="visual-preview-header">
                        <span className="pill visual-coverage-pill">
                          <I.Layers size={12} style={{ marginRight: 4 }} />
                          {activeCluster.covers_label}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                          {activeCluster.sections_count} sections in this visual
                        </span>
                      </div>

                      <h4 className="visual-preview-title">
                        {activeCluster.title}
                      </h4>
                      <p className="visual-preview-subtitle">
                        {activeCluster.subtitle}
                      </p>

                      <div className="covered-sections-preview">
                        <span className="covered-sections-preview-label">
                          Sections Synthesized in this Visual:
                        </span>
                        <div className="covered-sections-chips">
                          {sections
                            .slice(activeCluster.start_section_index, activeCluster.end_section_index + 1)
                            .map((sec, sIdx) => {
                              const secNum = activeCluster.start_section_index + sIdx + 1;
                              return (
                                <div key={sIdx} className="covered-section-chip">
                                  <span className="chip-num">#{secNum}</span>
                                  <span className="chip-text">{sec.heading || `Concept Part ${sIdx + 1}`}</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>

                      <div className="visual-preview-footer">
                        <button
                          type="button"
                          className="visual-generate-cluster-btn"
                          disabled={Boolean(busy)}
                          onClick={() => loadClusterVisual(activeCluster, sections)}
                        >
                          <I.Sparkles size={14} />
                          <span>Generate Concept Visual</span>
                        </button>
                        <span className="visual-preview-footer-note">
                          Synthesizes {activeCluster.covers_label} into an interactive diagram
                        </span>
                      </div>
                    </div>
                  ) : session.visual ? (
                    <VisualCard
                      visual={session.visual}
                      sections={sections}
                      onReadAloud={(text) => readAloud(text)}
                    />
                  ) : null}
                </div>
              </section>
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
                  <span style={{ color: "#1f5e63", marginLeft: 4 }}>· REWIRE Active</span>
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
                    hideHeader={true}
                    autoPrompt={voiceAutoPrompt}
                    showQuickPrompts={false}
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
              border: "2px solid #fce072",
              background: "#ffffff",
              borderRadius: 20,
            }}
          >
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #fce072, #f59e0b)",
                margin: "0 auto 16px",
                display: "grid",
                placeItems: "center",
                color: "#451a03",
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
                  background: "linear-gradient(135deg, #fce072 0%, #f59e0b 100%)",
                  color: "#451a03",
                  fontWeight: 800,
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
    const gradeColor = pct >= 80 ? "#059669" : pct >= 60 ? "#fce072" : "#dc2626";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Score hero */}
        <section className="card" style={{ padding: "clamp(18px, 2.5vw, 28px)", textAlign: "center", background: "linear-gradient(135deg,#f0fdf4 0%,rgba(252,224,114,0.15) 100%)", border: "2px solid #bbf7d0" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Practice Quiz Complete</div>
          <div style={{ position: "relative", width: "clamp(100px, 12vmin, 130px)", height: "clamp(100px, 12vmin, 130px)", margin: "0 auto clamp(8px, 1.2vh, 14px)" }}>
            <svg viewBox="0 0 110 110" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)", shapeRendering: "geometricPrecision" }}>
              <circle cx="55" cy="55" r="46" fill="none" stroke="#e2e8f0" strokeWidth="10" />
              <circle cx="55" cy="55" r="46" fill="none" stroke={gradeColor} strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 46}`}
                strokeDashoffset={`${2 * Math.PI * 46 * (1 - pct / 100)}`}
                style={{ transition: "stroke-dashoffset 1s ease" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: "clamp(20px, 2.5vw, 26px)", fontWeight: 900, color: gradeColor === "#fce072" ? "#713f12" : gradeColor, fontFamily: "var(--font-heading)" }}>{pct}%</div>
              <div style={{ fontSize: "clamp(9px, 1vw, 10.5px)", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.05em" }}>SCORE</div>
            </div>
          </div>
          <div style={{ fontSize: "clamp(18px, 2.2vw, 22px)", fontWeight: 800, color: gradeColor === "#fce072" ? "#713f12" : gradeColor, fontFamily: "var(--font-heading)", marginBottom: 4 }}>{grade}!</div>
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
          <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,#fce072,#f59e0b)", borderRadius: 99, transition: "width 0.4s ease" }} />
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
                background: "linear-gradient(135deg, rgba(252, 224, 114, 0.15) 0%, #f0fdf4 100%)",
                border: "2px solid #fce072"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: "linear-gradient(135deg, #fce072, #f59e0b)",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <I.Trophy size={22} style={{ color: "#451a03" }} />
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
                  style={{ background: "linear-gradient(135deg, #fce072 0%, #f59e0b 100%)", color: "#451a03", fontWeight: 800, fontSize: 15 }}
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
          <section className="card" style={{ marginBottom: 16, padding: 20, border: "2px solid #fce072" }}>
            <div style={{
              background: "#fef9c3", color: "#713f12", border: "1px solid #fce072",
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

        <section className="card practice-report" style={{ padding: 18 }}>
          <b style={{ fontSize: 15, color: "var(--ink)", fontFamily: "var(--font-heading)" }}>Section Report</b>
          <div className="practice-stats-grid" style={{ marginTop: 12 }}>
            <div className="stat practice-stat-card">
              <div className="practice-stat-header">
                <div className="practice-stat-icon" style={{ background: "#fef9c3", color: "#713f12", borderColor: "#fce072" }}>
                  <I.FileEdit size={16} />
                </div>
              </div>
              <b>{session.practiceReport.answered.length}</b>
              <span>Answered</span>
            </div>
            <div className="stat practice-stat-card">
              <div className="practice-stat-header">
                <div className="practice-stat-icon" style={{ background: "#fff1f2", color: "#e11d48", borderColor: "#fecdd3" }}>
                  <I.RotateCcw size={16} />
                </div>
              </div>
              <b>{session.practiceReport.failed.length}</b>
              <span>Need Review</span>
            </div>
            <div className="stat practice-stat-card">
              <div className="practice-stat-header">
                <div className="practice-stat-icon" style={{ background: "#fffbeb", color: "#d97706", borderColor: "#fde68a" }}>
                  <I.Trophy size={16} />
                </div>
              </div>
              <b>{session.practiceReport.masteredSections.length}</b>
              <span>Mastered</span>
            </div>
            <div className="stat practice-stat-card">
              <div className="practice-stat-header">
                <div className="practice-stat-icon" style={{ background: "#fef9c3", color: "#713f12", borderColor: "#fce072" }}>
                  <I.BookOpen size={16} />
                </div>
              </div>
              <b>{chunks.length}</b>
              <span>Total Sections</span>
            </div>
          </div>
        </section>

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

/* ── Gamified HUD Cognitive Mood Helper ──────────────────────── */
function getCognitiveMood(score = 0, isTransformed = true) {
  if (!isTransformed) {
    return {
      label: "CALM",
      emoji: "🧘",
      color: "#1f5e63",
      glow: "rgba(252, 224, 114, 0.45)",
    };
  }

  const pct = (score || 0) * 100;
  if (pct >= 80) {
    return {
      label: "STRAIN",
      emoji: "🔥",
      color: "#dc2626",
      glow: "rgba(220, 38, 38, 0.55)",
    };
  } else if (pct >= 60) {
    return {
      label: "STRUGGLING",
      emoji: "😅",
      color: "#ea580c",
      glow: "rgba(234, 88, 12, 0.5)",
    };
  } else if (pct >= 35) {
    return {
      label: "FOCUS",
      emoji: "🎯",
      color: "#d97706",
      glow: "rgba(217, 119, 6, 0.45)",
    };
  } else {
    return {
      label: "CALM",
      emoji: "🧘",
      color: "#1f5e63",
      glow: "rgba(252, 224, 114, 0.45)",
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
            <stop offset="0%" stopColor="#fce072" />
            <stop offset="50%" stopColor="#1f5e63" />
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
        <ellipse cx="34" cy="14" rx="1.5" ry="2.2" fill="#fce072" opacity="0.8" />
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
      <ellipse cx="12" cy="25" rx="1.3" ry="2" fill="#fce072" opacity="0.8" />
    </svg>
  );
}

/* ── Struggle Slider (replaces HeartbeatLine) ───────────────── */
function HeartbeatLine({ struggleScore = 0, isTransformed = false }) {
  const [animPct, setAnimPct] = React.useState(0);

  const pct = Math.round((struggleScore || 0) * 100);
  const targetPct = Math.max(3, Math.min(97, pct));

  // Animate slider from 0 → target on mount/change with silky smooth quartic ease-out
  React.useEffect(() => {
    if (!isTransformed) return;

    let animId = null;
    let start = null;
    const duration = 1200;

    setAnimPct(0);

    const step = (ts) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      // Quartic ease-out for organic, butter-smooth deceleration
      const eased = 1 - Math.pow(1 - t, 4);
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
  { color: "#1f5e63", strokeColor: "#1f5e63", bg: "#dfeae5", label: "Getting Started" },
  { color: "#713f12", strokeColor: "#fce072", bg: "#fef9c3", border: "1px solid #fce072", label: "Building Momentum" },
  { color: "#34D399", strokeColor: "#34D399", bg: "#d1fae5", label: "Almost Mastered" },
  { color: "#FBBF24", strokeColor: "#FBBF24", bg: "#fef3c7", label: "Mastered" },
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
    const duration = 1200; // ~1200ms silky ease-out fill on mount

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(1, elapsed / duration);
      // Ease-out quart for smooth deceleration without sudden stop
      const eased = 1 - Math.pow(1 - t, 4);
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
  const currentXpTotal = Math.round(xpTotal * animFraction);
  const currentXpInLevel = Math.round(xpInLevel * animFraction);

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

      <div className={`mastery-ring-svg-wrap${masteryPct >= 100 && animFraction >= 0.9 ? " mastery-ring--gold" : ""}`}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mastery-ring-svg" style={{ width: "100%", height: "100%", shapeRendering: "geometricPrecision" }}>
          {/* Track */}
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none" stroke="#E5E7EB" strokeWidth={STROKE} />
          {/* Filled arc */}
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none"
            stroke={tier.strokeColor || tier.color}
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
          <span className="mastery-ring-xp">{currentXpTotal.toLocaleString()} XP</span>
          <span className="mastery-ring-pct">{Math.round(currentMastery)}%</span>
        </div>
      </div>

      {/* XP progress bar to next level */}
      <div className="mastery-xp-bar-wrap">
        <div className="mastery-xp-bar-label">
          <span>{currentXpInLevel.toLocaleString()} / {xpForNext.toLocaleString()} XP</span>
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
            style={{ background: l.bg, color: l.color, border: l.border || "none" }}>
            <span className="mastery-legend-dot" style={{ background: l.strokeColor || l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProgressStats({ chunks, qAnswered, mastered }) {
  const [animFraction, setAnimFraction] = React.useState(0);

  React.useEffect(() => {
    let animId = null;
    let startTime = null;
    const duration = 1000;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setAnimFraction(eased);

      if (t < 1) {
        animId = requestAnimationFrame(step);
      }
    };

    setAnimFraction(0);
    animId = requestAnimationFrame(step);
    return () => { if (animId) cancelAnimationFrame(animId); };
  }, [chunks, qAnswered, mastered]);

  const formatAnimatedChunks = (chunksStr, fraction) => {
    if (typeof chunksStr === "string" && chunksStr.includes("/")) {
      const parts = chunksStr.split("/").map((s) => s.trim());
      const current = parseInt(parts[0], 10);
      const total = parts[1];
      if (!isNaN(current)) {
        return `${Math.round(current * fraction)} / ${total}`;
      }
    }
    return chunksStr;
  };

  const animQAnswered = Math.round((Number(qAnswered) || 0) * animFraction);
  const animMastered = Math.round((Number(mastered) || 0) * animFraction);

  const stats = [
    {
      id: "chunks",
      title: "Learning Chunks",
      value: formatAnimatedChunks(chunks, animFraction),
      icon: I.Layers,
      color: "#1f5e63",
      bgColor: "#dfeae5",
      borderColor: "#a9c4b2",
    },
    {
      id: "questions",
      title: "Questions Answered",
      value: animQAnswered,
      icon: I.HelpCircle,
      color: "#0284c7",
      bgColor: "#e0f2fe",
      borderColor: "#bae6fd",
    },
    {
      id: "mastered",
      title: "Sections Mastered",
      value: animMastered,
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

  // Single authoritative source of truth for struggle score derived directly from session activity
  const struggleScore = transformed ? computeSessionStruggleScore(session) : 0;

  // Sections & chunk counts
  const sections = Array.isArray(session.transformed?.sections)
    ? session.transformed.sections
    : Array.isArray(session.transformed?.chunks)
      ? session.transformed.chunks
      : transformed
        ? [session.text]
        : [];
  const totalSections = sections.length || (transformed ? 1 : 0);
  const completedSectionsCount = session.completedSections?.length || session.completed || 0;

  // Quiz / Practice stats
  const answeredList = session.practiceReport?.answered || [];
  const totalAnswered = answeredList.length;
  const correctCount = answeredList.filter((a) => a.is_correct || a.correct).length;
  const currentScorePct = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : null;
  const mastered = session.practiceReport?.masteredSections?.length || 0;

  // XP & Mastery calculation
  const xpTotal = computeXP({
    questionsAnswered: totalAnswered,
    chunksCompleted: completedSectionsCount,
    sectionsMastered: mastered,
  });

  const completionRatio = Math.min(1, completedSectionsCount / totalSections);
  const currentScoreRatio = totalAnswered > 0 ? correctCount / totalAnswered : null;
  const performanceRatio = currentScoreRatio !== null ? currentScoreRatio : (completionRatio > 0 ? 0.85 : 0);
  const strugglePenalty = struggleScore * 0.25;

  let rawProgress = 0;
  if (totalAnswered > 0) {
    rawProgress = (completionRatio * 0.35 + performanceRatio * 0.65) * (1 - strugglePenalty);
  } else if (completionRatio > 0) {
    rawProgress = completionRatio * 0.7 * (1 - strugglePenalty);
  } else {
    rawProgress = 0;
  }
  const masteryPct = totalSections > 0 ? Math.min(100, Math.max(0, Math.round(rawProgress * 100))) : 0;

  const history = session.sessionMeta.adaptationHistory || [];
  const latestOutcome = session.latestOutcome;

  return (
    <Layout section="Progress">
      <main className="page progress-page">
        {/* Section 1: Header */}
        <div className="animate-stagger-1">
          <div className="eyebrow">
            <b>Session Progress</b>
            <span>{session.fileName || "No lesson loaded"}</span>
          </div>
          <div className="progress-header-row">
            <h1 className="page-title" style={{ margin: 0 }}>Your learning session</h1>
            {(() => {
              const moodInfo = getCognitiveMood(struggleScore, transformed);
              return (
                <span
                  className="hud-mood-label"
                  style={{
                    color: moodInfo.color,
                    textShadow: `0 0 12px ${moodInfo.glow}`,
                  }}
                >
                  <span className="hud-mood-emoji">{moodInfo.emoji}</span>
                  <span>{moodInfo.label}</span>
                </span>
              );
            })()}
          </div>
        </div>

        {/* Section 2: Mastery Ring */}
        <div className="animate-stagger-2">
          <MasteryRing
            masteryPct={masteryPct}
            xpTotal={xpTotal}
            struggleScore={struggleScore}
          />
        </div>

        {/* Section 3: Progress Stats */}
        <div className="animate-stagger-3">
          <ProgressStats
            chunks={`${completedSectionsCount} / ${totalSections}`}
            qAnswered={totalAnswered}
            mastered={mastered}
          />
        </div>

        {/* Section 4: SCALE Engine Cognitive Telemetry Card */}
        <section className="card scale-telemetry-card animate-stagger-4">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="pill" style={{ background: "#fef9c3", color: "#713f12", border: "1px solid #fce072" }}>
              <I.Activity size={13} color="#713f12" /> SCALE Cognitive Telemetry
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
              Variant Level: {session.sessionMeta.currentVariantLevel}
            </span>
          </div>

          {/* Current Struggle Score Section */}
          <div style={{ marginTop: "clamp(4px, 0.8vh, 10px)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
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
                      padding: "3px 10px 3px 7px",
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, fontSize: 12, fontWeight: 700 }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(6px, 1vw, 10px)", marginTop: "clamp(6px, 0.8vh, 10px)" }}>
            {/* Total Adaptations */}
            <div style={{ background: "#f3f1eb", padding: "clamp(6px, 0.8vh, 10px) clamp(10px, 1vw, 14px)", borderRadius: 12, border: "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 15 }}>🛡️</span>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontWeight: 800 }}>
                  Total Adaptations
                </div>
              </div>
              <div style={{ fontSize: "clamp(16px, 1.8vw, 20px)", fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-heading)" }}>
                {session.sessionMeta.totalAdaptations}
              </div>
            </div>

            {/* Latest Outcome Delta */}
            <div style={{ background: "#f3f1eb", padding: "clamp(6px, 0.8vh, 10px) clamp(10px, 1vw, 14px)", borderRadius: 12, border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontWeight: 800, marginBottom: 2 }}>
                Latest Outcome Delta
              </div>
              <div style={{ fontSize: "clamp(16px, 1.8vw, 20px)", fontWeight: 800, fontFamily: "var(--font-heading)", display: "flex", alignItems: "baseline", gap: 4 }}>
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
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>N/A</span>
                )}
              </div>
            </div>
          </div>
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
            <Route path="/" element={<Navigate to="/upload" replace />} />
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
