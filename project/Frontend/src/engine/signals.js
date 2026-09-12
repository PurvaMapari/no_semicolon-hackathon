/**
 * PRISM — Signal Capture & Learner State
 *
 * Tracks behavioral signals per concept/chunk and feeds them into SCALE.
 * Used by the SessionProvider to maintain learner interaction state.
 */

import { scaleEvaluate, measureOutcome } from "./scale.js";

// ─── Default Signal State ────────────────────────────────────────────────────

export function createSignalState() {
  return {
    dwellTime: 0,
    rereadCount: 0,
    scrollBack: 0,
    helpRequests: 0,
    questionAccuracy: null,   // null = no quiz taken yet
    answerLatency: 0,
    retryCount: 0,
    voiceHelpRequests: 0,
    // Internal tracking
    _questionsCorrect: 0,
    _questionsTotal: 0,
    _dwellStart: null,
    _answerLatencies: [],
  };
}

// ─── Default Session Meta ────────────────────────────────────────────────────

export function createSessionMeta() {
  return {
    totalAdaptations: 0,
    consecutiveAdaptations: 0,
    lastAdaptationChunksAgo: null,
    currentVariantLevel: 1,
    adaptationHistory: [],
    // Per-chunk outcomes
    preAccuracy: null,
    postAccuracy: null,
  };
}

// ─── Signal Recording Functions ──────────────────────────────────────────────

export function recordReread(signals) {
  return { ...signals, rereadCount: signals.rereadCount + 1 };
}

export function recordScrollBack(signals) {
  return { ...signals, scrollBack: signals.scrollBack + 1 };
}

export function recordHelpRequest(signals) {
  return { ...signals, helpRequests: signals.helpRequests + 1 };
}

export function recordVoiceHelp(signals) {
  return { ...signals, voiceHelpRequests: signals.voiceHelpRequests + 1 };
}

export function startDwellTimer(signals) {
  return { ...signals, _dwellStart: Date.now() };
}

export function stopDwellTimer(signals) {
  if (!signals._dwellStart) return signals;
  const elapsed = Date.now() - signals._dwellStart;
  return {
    ...signals,
    dwellTime: signals.dwellTime + elapsed,
    _dwellStart: null,
  };
}

export function recordQuizAnswer(signals, isCorrect, latencyMs) {
  const correct = signals._questionsCorrect + (isCorrect ? 1 : 0);
  const total = signals._questionsTotal + 1;
  const latencies = [...signals._answerLatencies, latencyMs];
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  return {
    ...signals,
    _questionsCorrect: correct,
    _questionsTotal: total,
    questionAccuracy: total > 0 ? correct / total : null,
    retryCount: !isCorrect ? signals.retryCount + 1 : signals.retryCount,
    answerLatency: avgLatency,
    _answerLatencies: latencies,
  };
}

// ─── SCALE Integration ───────────────────────────────────────────────────────

/**
 * Evaluate current signals against SCALE engine.
 *
 * Optional webcamContext parameter blends webcam-derived signals as
 * supporting evidence — it modulates the final score but cannot independently
 * trigger REWIRE. Max webcam contribution is capped at +0.12 (12 points).
 *
 * webcamContext shape:
 *   { presenceRatio: 0–1, tabFocused: bool, headStable: bool }
 *   All fields are optional — missing fields contribute 0.
 */
export function evaluateSignals(signals, sessionMeta, webcamContext = null) {
  const rawSignals = {
    dwellTime: signals.dwellTime,
    rereadCount: signals.rereadCount,
    scrollBack: signals.scrollBack,
    helpRequests: signals.helpRequests,
    questionAccuracy: signals.questionAccuracy ?? 0.8, // default to "normal" if no quiz yet
    answerLatency: signals.answerLatency,
    retryCount: signals.retryCount,
    voiceHelpRequests: signals.voiceHelpRequests,
  };

  const baseResult = scaleEvaluate(rawSignals, sessionMeta.currentVariantLevel, sessionMeta);

  // ── Webcam signal boost (supporting evidence only) ─────────────────────────
  if (!webcamContext) return baseResult;

  const presenceRatio = webcamContext.presence_ratio ?? webcamContext.presenceRatio ?? 1;
  const tabFocused = webcamContext.tab_focused_now ?? webcamContext.tabFocused ?? true;
  const headStable = webcamContext.head_stable_now ?? webcamContext.headStable ?? true;
  const facePresentNow = webcamContext.face_present_now ?? webcamContext.facePresentNow ?? true;
  const scrollConsistent = webcamContext.scroll_consistent_now ?? webcamContext.scrollConsistentNow ?? true;

  console.log('[SCALE] Evaluation with signals:', {
    learningSignals: rawSignals,
    webcamContext: {
      presence_ratio: presenceRatio,
      face_present_now: facePresentNow,
      head_stable_now: headStable,
      tab_focused_now: tabFocused,
      scroll_consistent_now: scrollConsistent,
    },
  });

  // Each signal contributes a small weight — total cap is 0.12
  // Low presence ratio or face absent = more likely to be disengaged
  const presenceBoost  = (!facePresentNow || presenceRatio < 0.5) ? (0.5 - Math.min(0.5, presenceRatio)) * 0.12 : 0;
  // Tab not focused = mild signal of disengagement
  const tabBoost       = !tabFocused ? 0.04 : 0;
  // Head unstable = learner moving around = mild distraction signal
  const stabilityBoost = !headStable ? 0.02 : 0;
  // Scroll inconsistent = jumping back and forth
  const scrollBoost    = !scrollConsistent ? 0.02 : 0;

  const webcamBoost = Math.min(0.12, presenceBoost + tabBoost + stabilityBoost + scrollBoost);

  if (webcamBoost === 0) return baseResult;

  const boostedScore = Math.min(1.0, baseResult.struggleScore + webcamBoost);

  return {
    ...baseResult,
    struggleScore: boostedScore,
    webcamBoost,
    webcamContext: {
      presence_ratio: presenceRatio,
      face_present_now: facePresentNow,
      head_stable_now: headStable,
      tab_focused_now: tabFocused,
      scroll_consistent_now: scrollConsistent,
    },
  };
}

/**
 * After REWIRE, update session meta to reflect the adaptation.
 */
export function applyAdaptation(sessionMeta, evaluation) {
  const newLevel = evaluation.adaptationStrategy?.newVariantLevel ?? sessionMeta.currentVariantLevel;
  const record = {
    id: `adapt_${Date.now()}`,
    timestamp: new Date().toISOString(),
    struggleScore: evaluation.struggleScore,
    explanation: evaluation.explanation,
    previousLevel: sessionMeta.currentVariantLevel,
    newLevel,
    strategy: evaluation.adaptationStrategy,
    preAccuracy: sessionMeta.preAccuracy,
    postAccuracy: null,
    outcomeDelta: null,
  };

  return {
    ...sessionMeta,
    totalAdaptations: sessionMeta.totalAdaptations + 1,
    consecutiveAdaptations: sessionMeta.consecutiveAdaptations + 1,
    lastAdaptationChunksAgo: 0,
    currentVariantLevel: newLevel,
    adaptationHistory: [...sessionMeta.adaptationHistory, record],
    preAccuracy: sessionMeta.preAccuracy, // preserve for outcome measurement
    postAccuracy: null,
  };
}

/**
 * After learner answers post-REWIRE question, record the outcome.
 */
export function recordAdaptationOutcome(sessionMeta, postAccuracy) {
  const history = [...sessionMeta.adaptationHistory];
  if (history.length === 0) return sessionMeta;

  const last = { ...history[history.length - 1] };
  const outcome = measureOutcome(last.preAccuracy ?? 0, postAccuracy);
  last.postAccuracy = postAccuracy;
  last.outcomeDelta = outcome.outcomeDelta;
  last.outcome = outcome;
  history[history.length - 1] = last;

  return {
    ...sessionMeta,
    adaptationHistory: history,
    postAccuracy,
  };
}

/**
 * Call when learner advances to next chunk (non-adapted).
 * Resets consecutive counter and increments cooldown tracker.
 */
export function advanceChunk(sessionMeta) {
  return {
    ...sessionMeta,
    consecutiveAdaptations: 0,
    lastAdaptationChunksAgo:
      sessionMeta.lastAdaptationChunksAgo !== null
        ? sessionMeta.lastAdaptationChunksAgo + 1
        : null,
  };
}

// ─── Golden Path Signal Injection ────────────────────────────────────────────

/**
 * For demo purposes: inject the golden-path struggle signals from
 * docs/18-GOLDEN-PATH-FIXTURE.md adjusted signals.
 */
export function injectGoldenPathStruggle(signals) {
  return {
    ...signals,
    dwellTime: 50000,
    rereadCount: 4,
    scrollBack: 2,
    helpRequests: 2,
    questionAccuracy: 0.0,
    answerLatency: 12000,
    retryCount: 2,
    voiceHelpRequests: 1,
    _questionsCorrect: 0,
    _questionsTotal: 1,
    _answerLatencies: [12000],
  };
}

// ─── Unified Session Struggle Score ──────────────────────────────────────────

/**
 * Computes the unified struggle score (0.0 to 1.0) from learner session activity.
 * Single source of truth used across Learn, Practice, and Progress.
 */
export function computeSessionStruggleScore(session) {
  if (!session) return 0;

  const signals = session.signals || {};
  const answeredList = session.practiceReport?.answered || [];
  const totalAnswered = answeredList.length;
  const correctCount = answeredList.filter((a) => a.is_correct || a.correct).length;
  const accuracy = totalAnswered > 0 ? correctCount / totalAnswered : null;

  const helpRequests = (signals.helpRequests || 0) + (signals.voiceHelpRequests || 0);
  const rereadCount = signals.rereadCount || 0;
  const retryCount = signals.retryCount || 0;
  const dwellTime = signals.dwellTime || 0;
  const totalAdaptations = session.sessionMeta?.totalAdaptations || 0;
  const isRewireActive = Boolean(session.rewireState?.active);
  const completedCount = session.completedSections?.length || session.completed || 0;

  // Friction accumulated from help, rereads, retries, dwell time, and adaptations
  // Proportional increments:
  // - Help/voice queries: +0.15 each
  // - Re-reads: +0.12 each
  // - Retries/wrong attempts: +0.10 each
  // - Excessive dwell time (>45s): +0.12
  // - Active REWIRE / prior adaptations: +0.25 base + 0.08 per adaptation
  const struggleSignals =
    (helpRequests * 0.15) +
    (rereadCount * 0.12) +
    (retryCount * 0.10) +
    (dwellTime > 45000 ? 0.12 : 0) +
    (isRewireActive ? 0.25 : 0) +
    (totalAdaptations * 0.08);

  let rawScore = 0;

  if (totalAnswered > 0) {
    // If practice/tests have been answered:
    // Weighted 65% quiz inaccuracy + 35% interaction struggle
    const errorRate = 1 - (accuracy ?? 1); // 0 (all correct) to 1 (all incorrect)
    const frictionClamped = Math.min(1.0, struggleSignals);
    rawScore = (errorRate * 0.65) + (frictionClamped * 0.35);

    // Clean performance relief: If accuracy is high (>= 70%) and no active rewire,
    // decay the struggle score smoothly
    if (accuracy >= 0.70 && !isRewireActive) {
      const decayStrength = Math.min(0.60, (accuracy - 0.70) * 1.5);
      rawScore = rawScore * (1 - decayStrength);
    }
  } else if (isRewireActive || session.rewireState?.evaluation) {
    rawScore = session.rewireState.evaluation?.struggleScore || Math.max(0.6, struggleSignals);
  } else {
    // Before quizzes: derived directly from interaction signals (help, rereads, dwell)
    rawScore = Math.min(1.0, struggleSignals);
  }

  // Clean section completion relief:
  // For cleanly completed sections (completed without assistance), gradually reduce struggle (-0.04 per clean section)
  const cleanSections = Math.max(0, completedCount - (helpRequests + retryCount));
  if (cleanSections > 0 && !isRewireActive) {
    rawScore = Math.max(0, rawScore - (cleanSections * 0.04));
  }

  // If REWIRE is active, floor at 0.60 so cognitive monitor stays consistent with REWIRE state
  if (isRewireActive && rawScore < 0.60) {
    rawScore = 0.60;
  }

  // Ensure bounded between 0 and 1
  const score = Math.min(1.0, Math.max(0.0, rawScore));

  return Number(score.toFixed(3));
}

