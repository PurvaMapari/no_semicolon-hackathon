import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from "react";
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
} from "../api/client";
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
} from "../engine/signals";
import { SCALE_CONFIG, measureOutcome } from "../engine/scale";

export const PROFILE_LABELS = {
  dyslexia: "Dyslexia support",
  cognitive_load: "Cognitive load support",
  low_vision: "Low vision and clarity",
};

const SessionContext = createContext(null);
export const useSession = () => {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
};

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
    hasStartedLearning: false,
    activeSectionIndex: 0,
  });

  const [busy, setBusy] = useState("");

  // Keep a ref to the latest session for async functions without busting callback stability
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const run = useCallback(async (name, fn) => {
    setBusy(name);
    setSession((current) => ({ ...current, error: null }));
    try {
      return await fn();
    } catch (error) {
      setSession((current) => ({
        ...current,
        error: error.message || "An unexpected error occurred.",
      }));
      return null;
    } finally {
      setBusy("");
    }
  }, []);

  const setHasStartedLearning = useCallback((val) => {
    const nextVal = Boolean(val);
    setSession((current) => {
      if (current.hasStartedLearning === nextVal) return current;
      return { ...current, hasStartedLearning: nextVal };
    });
  }, []);

  const setActiveSectionIndex = useCallback((index) => {
    const nextIndex = typeof index === "number" ? index : 0;
    setSession((current) => {
      if (current.activeSectionIndex === nextIndex) return current;
      return { ...current, activeSectionIndex: nextIndex };
    });
  }, []);

  const upload = useCallback(async (file) => {
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
        hasStartedLearning: false,
        activeSectionIndex: 0,
      }));
      return result;
    });
  }, [run]);

  const removeDocument = useCallback(() => {
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
      hasStartedLearning: false,
      activeSectionIndex: 0,
    }));
  }, []);

  const setText = useCallback((text, customFileName = null) => {
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
      hasStartedLearning: false,
      activeSectionIndex: 0,
    }));
  }, []);

  const startLearningFromTopic = useCallback(async (text, topicTitle = "AI Lesson") => {
    const profile = sessionRef.current.profile || "cognitive_load";
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
  }, [run]);

  const chooseProfile = useCallback((profile) => {
    setSession((current) => {
      if (current.profile === profile) return current;
      return {
        ...current,
        profile,
        transformed: null,
        quizzes: [],
        visual: null,
        visualClusters: [],
        clusterVisuals: {},
        selectedClusterId: null,
        hasStartedLearning: false,
        activeSectionIndex: 0,
      };
    });
  }, []);

  const detect = useCallback(async (text) => {
    return run("profile", async () => {
      const result = await detectProfile(text);
      if (result?.profile) {
        setSession((current) => ({ ...current, profile: result.profile }));
      }
      return result;
    });
  }, [run]);

  const adapt = useCallback(async () => {
    const s = sessionRef.current;
    const textToAdapt =
      s.text?.trim() ||
      "Photosynthesis is the fundamental biological process through which green plants, algae, and certain cyanobacteria convert light energy into chemical energy. This biochemical pathway captures photon energy from sunlight to synthesize organic molecules such as glucose from ambient carbon dioxide and water, concurrently producing diatomic oxygen as an essential metabolic byproduct for terrestrial life.";
    return run("transform", async () => {
      const result = await transformText(textToAdapt, s.profile);
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
  }, [run]);

  const getQuiz = useCallback(async (chunk) => {
    const profile = sessionRef.current.profile;
    return run("quiz", async () => {
      const result = await generateQuiz(chunk, profile);
      setSession((current) => ({
        ...current,
        quizzes: [...current.quizzes, result],
      }));
      return result;
    });
  }, [run]);

  const evaluateAnswer = useCallback(async (payload) => {
    return run("evaluate", async () => {
      let result = null;
      try {
        result = await evaluateQuizAnswer(payload);
      } catch (err) {
        console.warn("evaluateQuizAnswer request failed, fallback to local eval:", err);
        const isCorrect = payload.selected_answer === payload.correct_answer;
        result = {
          is_correct: isCorrect,
          correct: isCorrect,
          question: payload.question,
          selected_answer: payload.selected_answer,
          correct_answer: payload.correct_answer,
          explanation: payload.explanation || (isCorrect ? "Correct!" : `The correct answer is ${payload.correct_answer}.`),
          section_index: payload.section_index,
        };
      }
      setSession((current) => {
        const isCorrect = Boolean(result.is_correct ?? result.correct);
        const answered = [...current.practiceReport.answered, result];
        const failed = answered.filter((item) => !item.is_correct && !item.correct);
        const masteredSections = isCorrect && typeof result.section_index === "number"
          ? [...new Set([...current.practiceReport.masteredSections, result.section_index])]
          : current.practiceReport.masteredSections;

        const updatedSignals = recordQuizAnswer(current.signals, isCorrect, 4000);

        return {
          ...current,
          signals: updatedSignals,
          practiceReport: { answered, failed, masteredSections },
        };
      });
      return result;
    });
  }, [run]);

  const getWholeTest = useCallback(async () => {
    const s = sessionRef.current;
    return run("test", async () => {
      const result = await generateLessonTest(s.text, s.profile, 5);
      setSession((current) => ({ ...current, wholeTest: result.questions }));
      return result.questions;
    });
  }, [run]);

  const loadVisualClusters = useCallback(async (sectionsList) => {
    if (!sectionsList || sectionsList.length === 0) return [];
    const s = sessionRef.current;
    return run("clusters", async () => {
      const payload = sectionsList.map((sec, idx) => {
        const text = sec.paragraph || sec.content || "";
        return {
          index: idx,
          heading: sec.heading || `Section ${idx + 1}`,
          content: text,
          word_count: text.trim() ? text.trim().split(/\s+/).length : 0,
        };
      });
      const docId = s.fileName || "lesson";
      const res = await getVisualClusters(payload, s.profile, docId);
      const clusters = res?.clusters || [];
      setSession((current) => ({
        ...current,
        visualClusters: clusters,
      }));
      return clusters;
    });
  }, [run]);

  const loadClusterVisual = useCallback(async (cluster, sectionsList) => {
    if (!cluster) return null;
    const s = sessionRef.current;
    if (s.clusterVisuals?.[cluster.cluster_id]) {
      return s.clusterVisuals[cluster.cluster_id];
    }
    return run(`visual-${cluster.cluster_id}`, async () => {
      const payload = (sectionsList || []).map((sec, idx) => {
        const text = sec.paragraph || sec.content || "";
        return {
          index: idx,
          heading: sec.heading || `Section ${idx + 1}`,
          content: text,
          word_count: text.trim() ? text.trim().split(/\s+/).length : 0,
        };
      });
      const docId = s.fileName || "lesson";
      const card = await getClusterVisualCard(cluster, payload, s.profile, docId);
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
  }, [run]);

  const setSelectedClusterId = useCallback((clusterId) => {
    setSession((current) => {
      if (current.selectedClusterId === clusterId) return current;
      return {
        ...current,
        selectedClusterId: clusterId,
      };
    });
  }, []);

  const getPracticeQuiz = useCallback(async () => {
    const s = sessionRef.current;
    return run("practiceQuiz", async () => {
      const result = await generatePracticeQuiz(s.text, s.profile, 8);
      return result.questions || result;
    });
  }, [run]);

  const getVisual = useCallback(async (sectionsList = null, activeSecIndex = 0) => {
    const s = sessionRef.current;
    if (s.visualClusters && s.visualClusters.length > 0) {
      const secIdx = typeof activeSecIndex === "number" ? activeSecIndex : 0;
      const targetCluster =
        s.visualClusters.find(
          (c) => c.start_section_index <= secIdx && secIdx <= c.end_section_index
        ) || s.visualClusters[0];
      if (targetCluster) {
        return await loadClusterVisual(targetCluster, sectionsList);
      }
    }
    return run("visual", async () => {
      const result = await generateVisual(s.text, s.profile);
      setSession((current) => ({ ...current, visual: result }));
      return result;
    });
  }, [run, loadClusterVisual]);

  const recordVoiceHelpAction = useCallback(() => {
    setSession((current) => {
      const updatedSignals = recordVoiceHelp(current.signals);
      return { ...current, signals: updatedSignals };
    });
  }, []);

  const ask = useCallback(async (question, sectionText) => {
    recordVoiceHelpAction();
    const s = sessionRef.current;
    return run("voice", () => {
      if (sectionText) {
        return askLessonQuestion(question, s.text, sectionText, s.profile);
      }
      return askLessonQuestion(question, s.text, s.text, s.profile);
    });
  }, [run, recordVoiceHelpAction]);

  const completeChunk = useCallback((webcamContext = null, baselineDwellSeconds = null) => {
    setSession((current) => {
      const updatedMeta = {
        ...current.sessionMeta,
        consecutiveAdaptations: 0,
        lastAdaptationChunksAgo:
          current.sessionMeta.lastAdaptationChunksAgo !== null
            ? current.sessionMeta.lastAdaptationChunksAgo + 1
            : null,
      };

      const evalWithWebcam = webcamContext
        ? evaluateSignals(current.signals, updatedMeta, webcamContext, baselineDwellSeconds)
        : null;

      return {
        ...current,
        completed: current.completed + 1,
        sessionMeta: updatedMeta,
        _webcamStruggleBoost: evalWithWebcam?.webcamBoost ?? 0,
      };
    });
  }, []);

  const completeSection = useCallback((sectionIndex) => {
    setSession((current) => {
      const completedSections = current.completedSections || [];
      if (completedSections.includes(sectionIndex)) return current;
      return {
        ...current,
        completed: current.completed + 1,
        completedSections: [...completedSections, sectionIndex],
      };
    });
  }, []);

  const triggerRewireForChunk = useCallback(async (
    chunkIndex,
    chunkText,
    struggleExplanation = "Detected difficulty during reading and comprehension checks."
  ) => {
    return run("rewire", async () => {
      const s = sessionRef.current;
      const evaluation = evaluateSignals(s.signals, s.sessionMeta);
      const targetLevel = evaluation.adaptationStrategy?.newVariantLevel ?? 2;
      const actions = evaluation.adaptationStrategy?.additionalActions ?? [
        "increase_simplification",
        "add_visual_description",
      ];

      let adaptedData = null;
      try {
        adaptedData = await rewireContent({
          chunkText: chunkText || s.text,
          profile: s.profile,
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

      const updatedMeta = applyAdaptation(s.sessionMeta, evaluation);
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
  }, [run]);

  const recordRereadAction = useCallback((chunkIndex, chunkText) => {
    setSession((current) => {
      const updatedSignals = recordReread(current.signals);
      const evalState = evaluateSignals(updatedSignals, current.sessionMeta);

      if (evalState.struggleScore >= SCALE_CONFIG.STRUGGLE_THRESHOLD && !current.rewireState.active) {
        setTimeout(() => {
          triggerRewireForChunk(chunkIndex, chunkText, evalState.explanation);
        }, 100);
      }

      return { ...current, signals: updatedSignals };
    });
  }, [triggerRewireForChunk]);

  const recordHelpAction = useCallback((chunkIndex, chunkText) => {
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
  }, [triggerRewireForChunk]);

  const recordTimeStruggleAction = useCallback((sectionIndex, sectionText) => {
    setSession((current) => {
      const currentCount = current.signals?.timeStruggleCount || 0;
      const updatedSignals = {
        ...current.signals,
        timeStruggleCount: currentCount + 1,
      };
      return { ...current, signals: updatedSignals };
    });
  }, []);

  const getAdaptiveQuizAction = useCallback(async (chunk) => {
    return run("quiz", async () => {
      const s = sessionRef.current;
      let quizData = null;
      try {
        quizData = await generateAdaptiveQuiz({
          chunkText: chunk,
          profile: s.profile,
          difficulty: "easier",
          struggleScore: s.rewireState.evaluation?.struggleScore || 0.7,
        });
      } catch (err) {
        quizData = await generateQuiz(chunk, s.profile);
      }
      setSession((current) => ({
        ...current,
        quizzes: [...current.quizzes, quizData],
      }));
      return quizData;
    });
  }, [run]);

  const recordPracticeResult = useCallback((result) => {
    setSession((current) => {
      const isCorrect = Boolean(result.is_correct ?? result.correct ?? (result.selected && result.selected === result.answer));
      const entry = {
        question: result.question || "Practice Question",
        selected_answer: result.selected || result.selected_answer || "",
        correct_answer: result.answer || result.correct_answer || "",
        is_correct: isCorrect,
        correct: isCorrect,
        explanation: result.explanation || "",
        section_index: typeof result.section_index === "number" ? result.section_index : (current.activeSectionIndex || 0),
        latency_ms: result.latency_ms || 4000,
        timestamp: Date.now(),
      };

      const prevAnswered = current.practiceReport?.answered || [];
      const answered = [...prevAnswered, entry];
      const failed = answered.filter((item) => !item.is_correct && !item.correct);

      const prevMastered = current.practiceReport?.masteredSections || [];
      let masteredSections = [...prevMastered];
      if (isCorrect && typeof entry.section_index === "number" && !masteredSections.includes(entry.section_index)) {
        masteredSections.push(entry.section_index);
      }

      const updatedSignals = recordQuizAnswer(current.signals, isCorrect, entry.latency_ms || 4000);

      let updatedMeta = current.sessionMeta;
      let outcome = current.latestOutcome;
      if (current.rewireState?.active) {
        const postAcc = isCorrect ? 1.0 : 0.0;
        updatedMeta = recordAdaptationOutcome(current.sessionMeta, postAcc);
        outcome = measureOutcome(updatedMeta.preAccuracy ?? 0.0, postAcc);
      }

      return {
        ...current,
        signals: updatedSignals,
        sessionMeta: updatedMeta,
        latestOutcome: outcome,
        practiceReport: { answered, failed, masteredSections },
      };
    });
  }, []);

  const recordQuizAnswerAction = useCallback((isCorrect, answerMeta = null) => {
    setSession((current) => {
      const updatedSignals = recordQuizAnswer(current.signals, isCorrect, 4000);
      let updatedMeta = current.sessionMeta;
      let outcome = current.latestOutcome;

      if (current.rewireState.active) {
        const postAcc = isCorrect ? 1.0 : 0.0;
        updatedMeta = recordAdaptationOutcome(current.sessionMeta, postAcc);
        outcome = measureOutcome(updatedMeta.preAccuracy ?? 0.0, postAcc);
      }

      const prevAnswered = current.practiceReport?.answered || [];
      const entry = answerMeta || {
        question: "Adaptive Question",
        selected_answer: isCorrect ? "Correct" : "Incorrect",
        correct_answer: "Correct",
        is_correct: isCorrect,
        correct: isCorrect,
        section_index: current.activeSectionIndex || 0,
        latency_ms: 4000,
        timestamp: Date.now(),
      };
      const answered = [...prevAnswered, entry];
      const failed = answered.filter((item) => !item.is_correct && !item.correct);
      const prevMastered = current.practiceReport?.masteredSections || [];
      const masteredSections = isCorrect && typeof entry.section_index === "number" && !prevMastered.includes(entry.section_index)
        ? [...prevMastered, entry.section_index]
        : prevMastered;

      return {
        ...current,
        signals: updatedSignals,
        sessionMeta: updatedMeta,
        latestOutcome: outcome,
        practiceReport: { answered, failed, masteredSections },
      };
    });
  }, []);

  const dismissRewire = useCallback(() => {
    setSession((current) => ({
      ...current,
      rewireState: {
        active: false,
        trigger: null,
        adaptedContent: null,
        evaluation: null,
      },
    }));
  }, []);

  const updateActiveDwell = useCallback((activeDwellMs) => {
    setSession((current) => {
      if (current.signals.activeDwellMs === activeDwellMs) return current;
      return {
        ...current,
        signals: {
          ...current.signals,
          activeDwellMs,
          dwellTime: activeDwellMs,
        },
      };
    });
  }, []);

  const resetDwellForNewSection = useCallback(() => {
    setSession((current) => ({
      ...current,
      signals: resetSectionDwell(current.signals),
    }));
  }, []);

  const contextValue = useMemo(() => ({
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
    recordPracticeResult,
    getAdaptiveQuizAction,
    dismissRewire,
    updateActiveDwell,
    resetDwellForNewSection,
    startLearningFromTopic,
    removeDocument,
    setHasStartedLearning,
    setActiveSectionIndex,
  }), [
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
    recordPracticeResult,
    getAdaptiveQuizAction,
    dismissRewire,
    updateActiveDwell,
    resetDwellForNewSection,
    startLearningFromTopic,
    removeDocument,
    setHasStartedLearning,
    setActiveSectionIndex,
  ]);

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}
