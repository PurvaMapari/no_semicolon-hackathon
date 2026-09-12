import React, { createContext, useContext, useState } from "react";
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
} from "../../api/client";
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
} from "../../engine/signals";
import { measureOutcome } from "../../engine/scale";

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
    try { return await fn(); }
    catch (error) {
      setSession((current) => ({ ...current, error: error.message || "An unexpected error occurred." }));
      return null;
    } finally { setBusy(""); }
  }

  async function upload(file) {
    if (!file) return null;
    return run("extract", async () => {
      const result = await extractDocument(file);
      setSession((current) => ({
        ...current, fileName: file.name, text: result.text || "", wordCount: result.word_count || 0,
        tables: result.tables || [], transformed: null, quizzes: [], visual: null, completed: 0,
        completedSections: [], practiceReport: { answered: [], failed: [], masteredSections: [] }, wholeTest: null,
        signals: createSignalState(), sessionMeta: createSessionMeta(),
        rewireState: { active: false, adaptedContent: null, evaluation: null, chunkIndex: 0 }, latestOutcome: null,
      }));
      return result;
    });
  }

  function setText(text) {
    setSession((current) => ({
      ...current, fileName: "Pasted lesson", text, wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
      transformed: null, quizzes: [], visual: null, completed: 0, completedSections: [],
      practiceReport: { answered: [], failed: [], masteredSections: [] }, wholeTest: null,
      signals: createSignalState(), sessionMeta: createSessionMeta(),
      rewireState: { active: false, adaptedContent: null, evaluation: null, chunkIndex: 0 }, latestOutcome: null,
    }));
  }

  function removeDocument() {
    setSession((current) => ({
      ...current, fileName: "", text: "", wordCount: 0, tables: [], transformed: null, quizzes: [], visual: null,
      completed: 0, completedSections: [], practiceReport: { answered: [], failed: [], masteredSections: [] },
      wholeTest: null, error: null, signals: createSignalState(), sessionMeta: createSessionMeta(),
      rewireState: { active: false, adaptedContent: null, evaluation: null, chunkIndex: 0 }, latestOutcome: null,
    }));
  }

  async function chooseProfile(profile) { setSession((current) => ({ ...current, profile, transformed: null, quizzes: [], visual: null })); }
  async function detect(text) {
    return run("profile", async () => {
      const result = await detectProfile(text);
      if (result?.profile) setSession((current) => ({ ...current, profile: result.profile }));
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
  async function evaluateAnswer(payload) {
    return run("evaluate", async () => {
      const result = await evaluateQuizAnswer(payload);
      setSession((current) => {
        const answered = [...current.practiceReport.answered, result];
        const failed = answered.filter((item) => !item.is_correct);
        const masteredSections = result.is_correct ? [...new Set([...current.practiceReport.masteredSections, result.section_index])] : current.practiceReport.masteredSections;
        return { ...current, signals: recordQuizAnswer(current.signals, result.is_correct, 4000), practiceReport: { answered, failed, masteredSections } };
      });
      return result;
    });
  }
  async function getWholeTest() { return run("test", async () => { const result = await generateLessonTest(session.text, session.profile, 5); setSession((current) => ({ ...current, wholeTest: result.questions })); return result.questions; }); }
  async function getVisual() { return run("visual", async () => { const result = await generateVisual(session.text, session.profile); setSession((current) => ({ ...current, visual: result })); return result; }); }
  async function ask(question, sectionText) {
    recordVoiceHelpAction();
    return run("voice", () => askLessonQuestion(question, session.text, sectionText || session.text, session.profile));
  }
  function completeChunk() { setSession((current) => ({ ...current, completed: current.completed + 1 })); }
  function completeSection(sectionIndex) {
    setSession((current) => {
      const completedSections = current.completedSections || [];
      if (completedSections.includes(sectionIndex)) return current;
      return { ...current, completed: current.completed + 1, completedSections: [...completedSections, sectionIndex] };
    });
  }
  async function triggerRewireForChunk(chunkIndex, chunkText, struggleExplanation = "Detected difficulty during reading and comprehension checks.") {
    return run("rewire", async () => {
      const evaluation = evaluateSignals(session.signals, session.sessionMeta);
      const targetLevel = evaluation.adaptationStrategy?.newVariantLevel ?? 2;
      const actions = evaluation.adaptationStrategy?.additionalActions ?? ["increase_simplification", "add_visual_description"];
      let adaptedData;
      try { adaptedData = await rewireContent({ chunkText: chunkText || session.text, profile: session.profile, variantLevel: targetLevel, actions, struggleExplanation }); }
      catch { adaptedData = { adapted_text: chunkText, variant_level: targetLevel, explanation: struggleExplanation, actions_applied: actions }; }
      const updatedMeta = applyAdaptation(session.sessionMeta, evaluation);
      updatedMeta.preAccuracy = 0.0;
      setSession((current) => ({ ...current, sessionMeta: updatedMeta, rewireState: { active: true, adaptedContent: adaptedData, evaluation, chunkIndex }, latestOutcome: null }));
      return adaptedData;
    });
  }
  function recordRereadAction(chunkIndex, chunkText) {
    setSession((current) => {
      const updatedSignals = recordReread(current.signals);
      const evalState = evaluateSignals(updatedSignals, current.sessionMeta);
      if (evalState.struggleScore >= 0.5 && !current.rewireState.active) setTimeout(() => triggerRewireForChunk(chunkIndex, chunkText, evalState.explanation), 100);
      return { ...current, signals: updatedSignals };
    });
  }
  function recordHelpAction(chunkIndex, chunkText) {
    setSession((current) => {
      const updatedSignals = recordHelpRequest(current.signals);
      const evalState = evaluateSignals(updatedSignals, current.sessionMeta);
      if (evalState.struggleScore >= 0.5 && !current.rewireState.active) setTimeout(() => triggerRewireForChunk(chunkIndex, chunkText, evalState.explanation), 100);
      return { ...current, signals: updatedSignals };
    });
  }
  function recordVoiceHelpAction() { setSession((current) => ({ ...current, signals: recordVoiceHelp(current.signals) })); }
  async function getAdaptiveQuizAction(chunk) {
    return run("quiz", async () => {
      let quizData;
      try { quizData = await generateAdaptiveQuiz({ chunkText: chunk, profile: session.profile, difficulty: "easier", struggleScore: session.rewireState.evaluation?.struggleScore || 0.7 }); }
      catch { quizData = await generateQuiz(chunk, session.profile); }
      setSession((current) => ({ ...current, quizzes: [...current.quizzes, quizData] }));
      return quizData;
    });
  }
  function recordQuizAnswerAction(isCorrect) {
    setSession((current) => {
      const updatedSignals = recordQuizAnswer(current.signals, isCorrect, 4000);
      let updatedMeta = current.sessionMeta;
      let outcome = current.latestOutcome;
      if (current.rewireState.active) { const postAcc = isCorrect ? 1.0 : 0.0; updatedMeta = recordAdaptationOutcome(current.sessionMeta, postAcc); outcome = measureOutcome(updatedMeta.preAccuracy ?? 0.0, postAcc); }
      return { ...current, signals: updatedSignals, sessionMeta: updatedMeta, latestOutcome: outcome };
    });
  }
  function dismissRewire() { setSession((current) => ({ ...current, rewireState: { ...current.rewireState, active: false } })); }

  return <SessionContext.Provider value={{ session, busy, upload, setText, removeDocument, chooseProfile, detect, adapt, getQuiz, evaluateAnswer, getWholeTest, getVisual, ask, completeChunk, completeSection, triggerRewireForChunk, recordRereadAction, recordHelpAction, recordVoiceHelpAction, recordQuizAnswerAction, getAdaptiveQuizAction, dismissRewire }}>{children}</SessionContext.Provider>;
}