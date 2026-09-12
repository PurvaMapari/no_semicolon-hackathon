/**
 * PRISM — SCALE Adaptive Engine
 *
 * Signal → Calibrate → Adapt → Let engage → Evaluate
 *
 * Entirely deterministic, client-side. No ML classifier. No LLM calls.
 * Authoritative Spec: docs/07-ADAPTIVE-ENGINE-LOGIC.md
 */

// ─── Named Weights (Must Sum Exactly to 1.00) ─────────────────────────────────

export const DWELL_WEIGHT          = 0.30; // normalized active dwell ratio
export const QUIZ_ACCURACY_WEIGHT  = 0.30; // normalized quiz accuracy (inverted)
export const HELP_REQUEST_WEIGHT   = 0.15; // normalized combined help requests (text + voice)
export const QUIZ_LATENCY_WEIGHT   = 0.10; // normalized quiz response latency
export const SCROLL_BACK_WEIGHT    = 0.05; // normalized scroll-back / backtracking
export const AUDIO_REPLAY_WEIGHT   = 0.05; // normalized audio / TTS replay
export const WEBCAM_CONTEXT_WEIGHT = 0.05; // normalized webcam attention context

// ─── Named Baseline & Critical Constants ─────────────────────────────────────

// Dwell time: section-specific ratio normalization
export const MIN_MEANINGFUL_DWELL_SECONDS    = 3;     // guard against noisy / accidental clicks
export const DWELL_CRITICAL_RATIO            = 3.0;   // dwell_ratio at which normalized dwell reaches 1.0
export const DEFAULT_BASELINE_DWELL_SECONDS  = 30;    // fallback when section metadata is unavailable

// Assessment accuracy (inverted: lower accuracy = higher struggle contribution)
export const ACCURACY_NORMAL_BASELINE        = 0.80;  // >= 80% accuracy -> 0 struggle
export const ACCURACY_CRITICAL               = 0.20;  // <= 20% accuracy -> 1.0 struggle

// Assessment latency (ms)
export const LATENCY_NORMAL_BASELINE         = 5000;  // <= 5s -> 0 struggle
export const LATENCY_CRITICAL                = 20000; // >= 20s -> 1.0 struggle

// Help requests (unified: text explanation + voice help)
export const HELP_NORMAL_BASELINE            = 0;     // 0 requests -> 0 struggle
export const HELP_CRITICAL                   = 3;     // >= 3 requests -> 1.0 struggle

// Scroll-back / backtracking
export const SCROLL_BACK_NORMAL_BASELINE     = 0;     // 0 reversals -> 0 struggle
export const SCROLL_BACK_CRITICAL            = 3;     // >= 3 reversals -> 1.0 struggle

// Audio / TTS replay (formerly rereadCount; audio control, not comprehension failure)
export const AUDIO_REPLAY_NORMAL_BASELINE    = 0;     // 0 replays -> 0 struggle
export const AUDIO_REPLAY_CRITICAL           = 4;     // >= 4 replays -> 1.0 struggle

// Thresholds for intervention
export const STRUGGLE_THRESHOLD              = 0.6;   // REWIRE trigger threshold
export const CRITICAL_THRESHOLD              = 0.8;   // Critical adaptation threshold

// ─── SCALE Configuration Object ──────────────────────────────────────────────

export const SCALE_CONFIG = {
  STRUGGLE_THRESHOLD,
  CRITICAL_THRESHOLD,

  COOLDOWN_CHUNKS: 2,
  MAX_ADAPTATIONS_PER_SESSION: 5,
  MAX_CONSECUTIVE_ADAPTATIONS: 3,

  MIN_MEANINGFUL_DWELL_SECONDS,
  DWELL_CRITICAL_RATIO,
  DEFAULT_BASELINE_DWELL_SECONDS,

  ACCURACY_NORMAL_BASELINE,
  ACCURACY_CRITICAL,

  LATENCY_NORMAL_BASELINE,
  LATENCY_CRITICAL,

  HELP_NORMAL_BASELINE,
  HELP_CRITICAL,

  SCROLL_BACK_NORMAL_BASELINE,
  SCROLL_BACK_CRITICAL,

  AUDIO_REPLAY_NORMAL_BASELINE,
  AUDIO_REPLAY_CRITICAL,

  WEIGHTS: {
    dwellTime:        DWELL_WEIGHT,
    questionAccuracy: QUIZ_ACCURACY_WEIGHT,
    helpRequests:     HELP_REQUEST_WEIGHT,
    answerLatency:    QUIZ_LATENCY_WEIGHT,
    scrollBack:       SCROLL_BACK_WEIGHT,
    audioReplay:      AUDIO_REPLAY_WEIGHT,
    webcamContext:    WEBCAM_CONTEXT_WEIGHT,
  },
};

// ─── Normalization Helpers ───────────────────────────────────────────────────

export function normalize(value, baseline, criticalThreshold) {
  if (value <= baseline) return 0.0;
  if (value >= criticalThreshold) return 1.0;
  return (value - baseline) / (criticalThreshold - baseline);
}

export function normalizeInverted(value, baseline, criticalThreshold) {
  if (value >= baseline) return 0.0;
  if (value <= criticalThreshold) return 1.0;
  return (baseline - value) / (baseline - criticalThreshold);
}

// ─── Signal Normalization ────────────────────────────────────────────────────

/**
 * Normalizes raw signals against section-specific baselines and named thresholds.
 *
 * All returned values are bounded in [0.0, 1.0].
 */
export function normalizeSignals(rawSignals, baselineDwellSeconds = null, webcamContext = null) {
  const normalized = {};

  // 1. Active Dwell Time (Section-Specific Ratio)
  const activeDwellMs = rawSignals.dwellTime ?? rawSignals.activeDwellMs ?? 0;
  const activeDwellSec = activeDwellMs / 1000;
  const baselineSec = (baselineDwellSeconds && baselineDwellSeconds > 0)
    ? baselineDwellSeconds
    : SCALE_CONFIG.DEFAULT_BASELINE_DWELL_SECONDS;

  if (activeDwellSec < SCALE_CONFIG.MIN_MEANINGFUL_DWELL_SECONDS) {
    normalized.dwellTime = 0.0;
  } else {
    const dwellRatio = activeDwellSec / baselineSec;
    if (dwellRatio <= 1.0) {
      normalized.dwellTime = 0.0;
    } else if (dwellRatio >= SCALE_CONFIG.DWELL_CRITICAL_RATIO) {
      normalized.dwellTime = 1.0;
    } else {
      normalized.dwellTime = (dwellRatio - 1.0) / (SCALE_CONFIG.DWELL_CRITICAL_RATIO - 1.0);
    }
  }

  // 2. Question Accuracy (Inverted: accuracy >= 0.80 -> 0; <= 0.20 -> 1.0)
  // E.g. accuracy 0.60 -> (0.80 - 0.60) / (0.80 - 0.20) = 0.20 / 0.60 = 0.3333...
  const accuracy = rawSignals.questionAccuracy;
  if (accuracy === null || accuracy === undefined) {
    normalized.questionAccuracy = 0.0;
  } else if (accuracy >= SCALE_CONFIG.ACCURACY_NORMAL_BASELINE) {
    normalized.questionAccuracy = 0.0;
  } else if (accuracy <= SCALE_CONFIG.ACCURACY_CRITICAL) {
    normalized.questionAccuracy = 1.0;
  } else {
    normalized.questionAccuracy =
      (SCALE_CONFIG.ACCURACY_NORMAL_BASELINE - accuracy) /
      (SCALE_CONFIG.ACCURACY_NORMAL_BASELINE - SCALE_CONFIG.ACCURACY_CRITICAL);
  }

  // 3. Help Requests (Unified: Text Help + Voice Help)
  const totalHelp = (rawSignals.helpRequests ?? 0) + (rawSignals.voiceHelpRequests ?? 0);
  if (totalHelp <= SCALE_CONFIG.HELP_NORMAL_BASELINE) {
    normalized.helpRequests = 0.0;
  } else if (totalHelp >= SCALE_CONFIG.HELP_CRITICAL) {
    normalized.helpRequests = 1.0;
  } else {
    normalized.helpRequests =
      (totalHelp - SCALE_CONFIG.HELP_NORMAL_BASELINE) /
      (SCALE_CONFIG.HELP_CRITICAL - SCALE_CONFIG.HELP_NORMAL_BASELINE);
  }

  // 4. Question Response Latency
  const latency = rawSignals.answerLatency ?? 0;
  if (latency <= SCALE_CONFIG.LATENCY_NORMAL_BASELINE) {
    normalized.answerLatency = 0.0;
  } else if (latency >= SCALE_CONFIG.LATENCY_CRITICAL) {
    normalized.answerLatency = 1.0;
  } else {
    normalized.answerLatency =
      (latency - SCALE_CONFIG.LATENCY_NORMAL_BASELINE) /
      (SCALE_CONFIG.LATENCY_CRITICAL - SCALE_CONFIG.LATENCY_NORMAL_BASELINE);
  }

  // 5. Scroll-Back / Backtracking
  const scroll = rawSignals.scrollBack ?? 0;
  if (scroll <= SCALE_CONFIG.SCROLL_BACK_NORMAL_BASELINE) {
    normalized.scrollBack = 0.0;
  } else if (scroll >= SCALE_CONFIG.SCROLL_BACK_CRITICAL) {
    normalized.scrollBack = 1.0;
  } else {
    normalized.scrollBack =
      (scroll - SCALE_CONFIG.SCROLL_BACK_NORMAL_BASELINE) /
      (SCALE_CONFIG.SCROLL_BACK_CRITICAL - SCALE_CONFIG.SCROLL_BACK_NORMAL_BASELINE);
  }

  // 6. Audio / TTS Replay (formerly rereadCount)
  const audioReplay =
    rawSignals.audioReplayCount ??
    rawSignals.audio_replay_count ??
    rawSignals.rereadCount ??
    0;
  if (audioReplay <= SCALE_CONFIG.AUDIO_REPLAY_NORMAL_BASELINE) {
    normalized.audioReplay = 0.0;
  } else if (audioReplay >= SCALE_CONFIG.AUDIO_REPLAY_CRITICAL) {
    normalized.audioReplay = 1.0;
  } else {
    normalized.audioReplay =
      (audioReplay - SCALE_CONFIG.AUDIO_REPLAY_NORMAL_BASELINE) /
      (SCALE_CONFIG.AUDIO_REPLAY_CRITICAL - SCALE_CONFIG.AUDIO_REPLAY_NORMAL_BASELINE);
  }
  // Backward compatibility alias for legacy readers
  normalized.rereadCount = normalized.audioReplay;

  // 7. Webcam Attention Context (Supporting Evidence)
  const wc = webcamContext ?? rawSignals.webcamContext ?? null;
  if (!wc) {
    normalized.webcamContext = 0.0;
  } else {
    const presenceRatio = wc.presence_ratio ?? wc.presenceRatio ?? 1;
    const facePresent = wc.face_present_now ?? wc.facePresentNow ?? wc.facePresent ?? true;
    const tabFocused = wc.tab_focused_now ?? wc.tabFocusedNow ?? wc.tabFocused ?? true;
    const headStable = wc.head_stable_now ?? wc.headStableNow ?? wc.headStable ?? true;
    const scrollConsistent = wc.scroll_consistent_now ?? wc.scrollConsistentNow ?? wc.scrollConsistent ?? true;

    const presenceScore = (!facePresent || presenceRatio < 0.5) ? Math.min(1.0, (1.0 - presenceRatio)) : 0.0;
    const tabScore = !tabFocused ? 1.0 : 0.0;
    const headScore = !headStable ? 1.0 : 0.0;
    const scrollScore = !scrollConsistent ? 1.0 : 0.0;

    normalized.webcamContext = Math.min(
      1.0,
      presenceScore * 0.4 + tabScore * 0.3 + headScore * 0.15 + scrollScore * 0.15
    );
  }

  return normalized;
}

// ─── Authoritative Struggle Score Computation ────────────────────────────────

/**
 * Computes the unified struggle score as a weighted sum of all normalized signals.
 *
 * Clamped strictly to [0.0, 1.0].
 */
export function computeStruggleScore(normalizedSignals) {
  let score = 0;
  score += (normalizedSignals.dwellTime ?? 0)        * SCALE_CONFIG.WEIGHTS.dwellTime;
  score += (normalizedSignals.questionAccuracy ?? 0) * SCALE_CONFIG.WEIGHTS.questionAccuracy;
  score += (normalizedSignals.helpRequests ?? 0)     * SCALE_CONFIG.WEIGHTS.helpRequests;
  score += (normalizedSignals.answerLatency ?? 0)    * SCALE_CONFIG.WEIGHTS.answerLatency;
  score += (normalizedSignals.scrollBack ?? 0)       * SCALE_CONFIG.WEIGHTS.scrollBack;
  score += (normalizedSignals.audioReplay ?? 0)      * SCALE_CONFIG.WEIGHTS.audioReplay;
  score += (normalizedSignals.webcamContext ?? 0)    * SCALE_CONFIG.WEIGHTS.webcamContext;

  return Math.min(1.0, Math.max(0.0, score));
}

// ─── Adaptation Rules ────────────────────────────────────────────────────────

export function selectAdaptation(struggleScore, currentLevel, maxLevel = 3) {
  if (struggleScore < SCALE_CONFIG.STRUGGLE_THRESHOLD) return null;

  const levelIncrease = struggleScore >= SCALE_CONFIG.CRITICAL_THRESHOLD ? 2 : 1;
  const newLevel = Math.min(currentLevel + levelIncrease, maxLevel);

  if (newLevel === currentLevel) {
    return {
      action: "at_maximum",
      newVariantLevel: currentLevel,
      additionalActions: ["reduce_chunk_size"],
      explanation:
        "Content is already at maximum simplification. We reduced the section size.",
    };
  }

  const actions = ["increase_simplification"];
  if (struggleScore >= 0.7) actions.push("reduce_chunk_size");
  if (struggleScore >= SCALE_CONFIG.CRITICAL_THRESHOLD) actions.push("add_visual_description");

  return {
    action: "increase_simplification",
    newVariantLevel: newLevel,
    additionalActions: actions,
  };
}

// ─── Cooldown & Limits ───────────────────────────────────────────────────────

function isCooldownActive(lastAdaptationChunksAgo) {
  if (lastAdaptationChunksAgo === null || lastAdaptationChunksAgo === undefined)
    return false;
  return lastAdaptationChunksAgo < SCALE_CONFIG.COOLDOWN_CHUNKS;
}

function canAdapt(sessionMeta) {
  if (sessionMeta.totalAdaptations >= SCALE_CONFIG.MAX_ADAPTATIONS_PER_SESSION) {
    return { allowed: false, reason: "Session adaptation limit reached (5)" };
  }
  if (sessionMeta.consecutiveAdaptations >= SCALE_CONFIG.MAX_CONSECUTIVE_ADAPTATIONS) {
    return { allowed: false, reason: "Consecutive adaptation limit reached (3)" };
  }
  return { allowed: true };
}

// ─── Learner-Friendly Explanation Generation ─────────────────────────────────

/**
 * Generates clear, supportive, educational explanation for why REWIRE activated.
 *
 * Avoids clinical diagnosis, raw numbers, and misrepresenting audio replay as struggle.
 */
export function generateExplanation(rawSignals, struggleScore, adaptation, normalizedSignals = {}) {
  const dwellNorm    = normalizedSignals.dwellTime ?? 0;
  const accuracyNorm = normalizedSignals.questionAccuracy ?? 0;
  const helpNorm     = normalizedSignals.helpRequests ?? 0;
  const latencyNorm  = normalizedSignals.answerLatency ?? 0;
  const webcamNorm   = normalizedSignals.webcamContext ?? 0;

  const parts = [];

  if (dwellNorm >= 0.25) {
    parts.push("active reading time was higher than expected");
  }
  if (accuracyNorm >= 0.3) {
    parts.push("quiz responses suggest this concept needs reinforcement");
  }
  if (helpNorm >= 0.3) {
    parts.push("help requests indicate this concept was challenging");
  }
  if (latencyNorm >= 0.5) {
    parts.push("extended time was needed on the check questions");
  }

  // Action descriptions
  const actionDescriptions = [];
  if (adaptation?.additionalActions?.includes("increase_simplification") || adaptation?.action === "increase_simplification") {
    actionDescriptions.push("simpler language");
  }
  if (adaptation?.additionalActions?.includes("reduce_chunk_size")) {
    actionDescriptions.push("shorter sections");
  }
  if (adaptation?.additionalActions?.includes("add_visual_description")) {
    actionDescriptions.push("a visual description");
  }

  let baseExplanation = "";
  if (parts.length >= 2) {
    baseExplanation = `Your ${parts.join(" and your ")}`;
  } else if (parts.length === 1) {
    baseExplanation = `We noticed your ${parts[0]}`;
  } else {
    baseExplanation = "Your recent learning interactions indicate this concept may be difficult";
  }

  const actionPart = actionDescriptions.length > 0
    ? `, so PRISM switched to ${actionDescriptions.join(", ")}.`
    : ", so PRISM adapted the explanation.";

  let explanation = baseExplanation + actionPart;

  if (webcamNorm >= 0.4) {
    explanation += " PRISM combined your recent learning interactions with optional attention signals.";
  }

  return explanation;
}

// ─── Full SCALE Evaluation ──────────────────────────────────────────────────

export function scaleEvaluate(
  rawSignals,
  currentVariantLevel,
  sessionMeta,
  baselineDwellSeconds = null,
  webcamContext = null
) {
  // Step 1: SIGNAL & CALIBRATE — normalize against section-specific baselines
  const normalized = normalizeSignals(rawSignals, baselineDwellSeconds, webcamContext);
  const struggleScore = computeStruggleScore(normalized);

  // Check cooldown
  if (isCooldownActive(sessionMeta?.lastAdaptationChunksAgo)) {
    return {
      shouldAdapt: false,
      struggleScore,
      normalized,
      reason: "Cooldown active",
      cooldownActive: true,
      cooldownRemainingChunks:
        SCALE_CONFIG.COOLDOWN_CHUNKS - (sessionMeta?.lastAdaptationChunksAgo ?? 0),
    };
  }

  // Check limits
  const adaptResult = canAdapt(sessionMeta || {});
  if (!adaptResult.allowed) {
    return {
      shouldAdapt: false,
      struggleScore,
      normalized,
      reason: adaptResult.reason,
      cooldownActive: false,
    };
  }

  // Step 3: ADAPT — below threshold?
  if (struggleScore < SCALE_CONFIG.STRUGGLE_THRESHOLD) {
    return {
      shouldAdapt: false,
      struggleScore,
      normalized,
      threshold: SCALE_CONFIG.STRUGGLE_THRESHOLD,
      reason: "Signals within normal range",
      cooldownActive: false,
    };
  }

  // Above threshold → REWIRE
  const adaptation = selectAdaptation(struggleScore, currentVariantLevel);
  const explanation = generateExplanation(rawSignals, struggleScore, adaptation, normalized);

  return {
    shouldAdapt: true,
    struggleScore,
    normalized,
    threshold: SCALE_CONFIG.STRUGGLE_THRESHOLD,
    reason: `Struggle score ${struggleScore.toFixed(2)} exceeds threshold ${SCALE_CONFIG.STRUGGLE_THRESHOLD}`,
    adaptationStrategy: adaptation,
    explanation,
    cooldownActive: false,
  };
}

// ─── Outcome Measurement ─────────────────────────────────────────────────────

export function measureOutcome(preAccuracy, postAccuracy) {
  const delta = postAccuracy - preAccuracy;
  return {
    preAccuracy,
    postAccuracy,
    outcomeDelta: delta,
    improved: delta > 0,
    significantImprovement: delta > 0.2,
    noChange: Math.abs(delta) <= 0.1,
    declined: delta < -0.1,
  };
}
