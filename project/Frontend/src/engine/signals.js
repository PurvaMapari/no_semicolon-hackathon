/**
 * PRISM — Signal Capture & Learner State
 *
 * Tracks behavioral signals per concept/chunk and feeds them into SCALE.
 * Used by the SessionProvider to maintain learner interaction state.
 *
 * ACTIVE DWELL TIME
 * -----------------
 * Only time spent in SECTION_ACTIVE state contributes to dwell.
 * Loading, tab-hidden, generation, and navigation delays are excluded.
 *
 * Section lifecycle states:
 *   SECTION_LOADING    — content being fetched / generated
 *   SECTION_READY      — content rendered, not yet interactive
 *   SECTION_ACTIVE     — learner is actively reading (timer runs)
 *   SECTION_PAUSED     — tab hidden, busy operation, or section not focused
 *   SECTION_COMPLETED  — learner marked section done
 */

import { scaleEvaluate, measureOutcome, SCALE_CONFIG } from "./scale.js";

// ─── Section Lifecycle States ────────────────────────────────────────────────

export const SECTION_STATES = {
  LOADING:   'SECTION_LOADING',
  READY:     'SECTION_READY',
  ACTIVE:    'SECTION_ACTIVE',
  PAUSED:    'SECTION_PAUSED',
  COMPLETED: 'SECTION_COMPLETED',
};

// ─── Default Signal State ────────────────────────────────────────────────────

export function createSignalState() {
  return {
    // --- Active dwell (the ONLY dwell signal fed to SCALE) ---
    activeDwellMs: 0,            // total active learning time in milliseconds
    dwellTime: 0,                // backward-compat alias (kept in sync with activeDwellMs)

    // --- Learning behavior signals ---
    audioReplayCount: 0,         // audio / TTS replay count (replaces rereadCount semantics)
    rereadCount: 0,              // backward-compat alias
    scrollBack: 0,
    helpRequests: 0,
    questionAccuracy: null,      // null = no quiz taken yet
    answerLatency: 0,
    retryCount: 0,
    voiceHelpRequests: 0,

    // --- Internal quiz tracking ---
    _questionsCorrect: 0,
    _questionsTotal: 0,
    _answerLatencies: [],

    // --- Section lifecycle & timing internals ---
    _sectionState: SECTION_STATES.LOADING,
    _dwellTimerStart: null,      // Date.now() when SECTION_ACTIVE began (null = not active)
    _sectionOpenedAt: null,      // when the section was first navigated to
    _sectionReadyAt: null,       // when section content became ready
    _sectionCompletedAt: null,   // when learner marked section done
    _pausedMs: 0,                // total paused time (diagnostic only)
    _loadingMs: 0,               // total loading time (diagnostic only)
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

// ─── Section Lifecycle Functions ─────────────────────────────────────────────

/**
 * Accumulate any in-flight active dwell into activeDwellMs and clear the timer.
 * Safe to call when timer is not running (no-op).
 */
function _flushActiveDwell(signals) {
  if (signals._dwellTimerStart === null) return signals;
  const elapsed = Date.now() - signals._dwellTimerStart;
  const newActiveDwell = signals.activeDwellMs + Math.max(0, elapsed);
  return {
    ...signals,
    activeDwellMs: newActiveDwell,
    dwellTime: newActiveDwell, // keep backward compat
    _dwellTimerStart: null,
  };
}

/**
 * Transition to SECTION_LOADING. Pauses any active timer.
 * Called when a blocking operation (content fetch, generation) starts.
 */
export function sectionLoading(signals) {
  const flushed = _flushActiveDwell(signals);
  return {
    ...flushed,
    _sectionState: SECTION_STATES.LOADING,
  };
}

/**
 * Transition to SECTION_READY. Records when section content became available.
 * Does NOT start the active timer — call sectionActive() for that.
 */
export function sectionReady(signals) {
  const flushed = _flushActiveDwell(signals);
  return {
    ...flushed,
    _sectionState: SECTION_STATES.READY,
    _sectionReadyAt: Date.now(),
  };
}

/**
 * Transition to SECTION_ACTIVE. Starts the active dwell timer.
 * Only this state contributes to active_dwell_seconds.
 */
export function sectionActive(signals) {
  // Don't restart if already active
  if (signals._sectionState === SECTION_STATES.ACTIVE && signals._dwellTimerStart !== null) {
    return signals;
  }
  return {
    ...signals,
    _sectionState: SECTION_STATES.ACTIVE,
    _dwellTimerStart: Date.now(),
  };
}

/**
 * Transition to SECTION_PAUSED. Accumulates elapsed active dwell.
 * Called when tab becomes hidden, busy operation starts, or section loses focus.
 */
export function sectionPaused(signals) {
  const flushed = _flushActiveDwell(signals);
  return {
    ...flushed,
    _sectionState: SECTION_STATES.PAUSED,
  };
}

/**
 * Transition to SECTION_COMPLETED. Finalizes active dwell.
 */
export function sectionCompleted(signals) {
  const flushed = _flushActiveDwell(signals);
  return {
    ...flushed,
    _sectionState: SECTION_STATES.COMPLETED,
    _sectionCompletedAt: Date.now(),
  };
}

/**
 * Reset per-section timing for a new section.
 * Preserves cumulative signals (quiz, help, reread) — only resets dwell tracking.
 */
export function resetSectionDwell(signals) {
  return {
    ...signals,
    activeDwellMs: 0,
    dwellTime: 0,
    _sectionState: SECTION_STATES.LOADING,
    _dwellTimerStart: null,
    _sectionOpenedAt: Date.now(),
    _sectionReadyAt: null,
    _sectionCompletedAt: null,
    _pausedMs: 0,
    _loadingMs: 0,
  };
}

/**
 * Get the current active dwell in SECONDS, including any in-flight active period.
 * This is the value that should be passed to SCALE as `active_dwell_seconds`.
 */
export function getActiveDwellSeconds(signals) {
  let totalMs = signals.activeDwellMs;
  if (signals._dwellTimerStart !== null) {
    totalMs += Date.now() - signals._dwellTimerStart;
  }
  return totalMs / 1000;
}

// ─── Legacy Dwell Timer Functions (backward compat) ──────────────────────────
// These are kept so any existing code calling them doesn't break,
// but the Learn component should use the section lifecycle functions above.

export function startDwellTimer(signals) {
  return sectionActive(signals);
}

export function stopDwellTimer(signals) {
  return sectionPaused(signals);
}

// ─── Signal Recording Functions ──────────────────────────────────────────────

export function recordAudioReplay(signals) {
  const newCount = (signals.audioReplayCount ?? signals.rereadCount ?? 0) + 1;
  return {
    ...signals,
    audioReplayCount: newCount,
    rereadCount: newCount, // keep backward compat
  };
}

export const recordReread = recordAudioReplay;

export function recordScrollBack(signals) {
  return { ...signals, scrollBack: signals.scrollBack + 1 };
}

export function recordHelpRequest(signals) {
  return { ...signals, helpRequests: signals.helpRequests + 1 };
}

export function recordVoiceHelp(signals) {
  return { ...signals, voiceHelpRequests: signals.voiceHelpRequests + 1 };
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
 *
 * Optional baselineDwellSeconds parameter sets the expected reading time for
 * this section (from backend metadata). Used to compute dwell ratio dynamically.
 */
export function evaluateSignals(signals, sessionMeta, webcamContext = null, baselineDwellSeconds = null) {
  // Use active dwell (including any in-flight period) for the SCALE evaluation
  const currentActiveDwellMs = signals.activeDwellMs +
    (signals._dwellTimerStart !== null ? Date.now() - signals._dwellTimerStart : 0);

  const rawSignals = {
    dwellTime: currentActiveDwellMs,  // ACTIVE dwell only, in ms
    activeDwellMs: currentActiveDwellMs,
    audioReplayCount: signals.audioReplayCount ?? signals.rereadCount ?? 0,
    rereadCount: signals.audioReplayCount ?? signals.rereadCount ?? 0,
    scrollBack: signals.scrollBack ?? 0,
    helpRequests: signals.helpRequests ?? 0,
    voiceHelpRequests: signals.voiceHelpRequests ?? 0,
    questionAccuracy: signals.questionAccuracy ?? 0.8, // default to "normal" if no quiz yet
    answerLatency: signals.answerLatency ?? 0,
    retryCount: signals.retryCount ?? 0,
  };

  const evalResult = scaleEvaluate(
    rawSignals,
    sessionMeta?.currentVariantLevel ?? 1,
    sessionMeta,
    baselineDwellSeconds,
    webcamContext
  );

  const webcamBoost = (evalResult.normalized?.webcamContext ?? 0) * (SCALE_CONFIG?.WEIGHTS?.webcamContext ?? 0.05);

  return {
    ...evalResult,
    webcamBoost,
    webcamContext: webcamContext ? {
      presence_ratio: webcamContext.presence_ratio ?? webcamContext.presenceRatio ?? 1,
      face_present_now: webcamContext.face_present_now ?? webcamContext.facePresentNow ?? true,
      head_stable_now: webcamContext.head_stable_now ?? webcamContext.headStableNow ?? true,
      tab_focused_now: webcamContext.tab_focused_now ?? webcamContext.tabFocusedNow ?? true,
      scroll_consistent_now: webcamContext.scroll_consistent_now ?? webcamContext.scrollConsistentNow ?? true,
    } : null,
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
    activeDwellMs: 50000,
    dwellTime: 50000,
    audioReplayCount: 4,
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

