/**
 * PRISM — SCALE Adaptive Engine
 *
 * Signal → Calibrate → Adapt → Let engage → Evaluate
 *
 * Entirely deterministic, client-side. No ML classifier. No LLM calls.
 * Authoritative Spec: docs/07-ADAPTIVE-ENGINE-LOGIC.md
 */

// ─── Named Weights (Must Sum Exactly to 1.00) ─────────────────────────────────

export const DWELL_CONTINUOUS_WEIGHT   = 0.20; // continuous active-dwell evidence (20%)
export const DWELL_EXCEEDED_WEIGHT     = 0.10; // difficulty-aware exceeded-time evidence (max 10%)
export const DWELL_WEIGHT              = 0.30; // total active reading / dwell behavior (30%)
export const QUIZ_ACCURACY_WEIGHT      = 0.35; // normalized quiz accuracy (inverted) (35%)
export const HELP_REQUEST_WEIGHT       = 0.15; // normalized combined help requests (text + voice) (15%)
export const QUIZ_LATENCY_WEIGHT       = 0.10; // normalized quiz response latency (10%)
export const SCROLL_BACK_WEIGHT        = 0.10; // normalized scroll-back / backtracking (10%)
export const AUDIO_REPLAY_WEIGHT       = 0.00; // audio control, not score input (0%)
export const WEBCAM_CONTEXT_WEIGHT     = 0.00; // webcam gates dwell only, not direct score (0%)

// Reading speeds by difficulty tier (WPM)
export const READING_SPEEDS_WPM = {
  foundational: 220,
  intermediate: 180,
  advanced:     140,
};

// Maximum difficulty-specific exceeded-time contribution (part of 10% exceeded component)
export const DIFFICULTY_EXCEEDED_MAX = {
  foundational: 0.10, // Easy: full 0.10 max
  intermediate: 0.07, // Medium: 0.07 max
  advanced:     0.05, // Hard: 0.05 max
};

export const DIFFICULTY_MULTIPLIERS = {
  foundational: 1.0,
  intermediate: 1.6,
  advanced:     2.5,
};

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
    dwellContinuous:  DWELL_CONTINUOUS_WEIGHT,
    dwellExceeded:    DWELL_EXCEEDED_WEIGHT,
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

// ─── Difficulty-Aware Exceeded Time Contribution ─────────────────────────────

/**
 * Computes the progressive difficulty-aware exceeded-time contribution (up to 10% max).
 * Derived from the SAME dwellRatio (activeDwellSec / baselineSec) to prevent double-counting.
 *
 * Difficulty caps:
 *   - foundational (Easy): 0.10 max
 *   - intermediate (Medium): 0.07 max
 *   - advanced (Hard): 0.05 max
 *
 * Progression:
 *   - ratio <= 1.00: 0.0
 *   - 1.00 < ratio <= 1.25: small contribution (up to 30% of max)
 *   - 1.25 < ratio < 1.50: moderate contribution (30% to 100% of max)
 *   - ratio >= 1.50: maximum difficulty contribution
 */
export function computeExceededTimeContribution(dwellRatio, difficultyTier = "intermediate") {
  const tier = (difficultyTier || "intermediate").toLowerCase();
  const maxExceeded = DIFFICULTY_EXCEEDED_MAX[tier] ?? 0.07;

  if (dwellRatio <= 1.00) {
    return 0.0;
  } else if (dwellRatio <= 1.25) {
    return 0.30 * maxExceeded * ((dwellRatio - 1.00) / 0.25);
  } else if (dwellRatio < 1.50) {
    return maxExceeded * (0.30 + 0.70 * ((dwellRatio - 1.25) / 0.25));
  } else {
    return maxExceeded;
  }
}

// ─── Signal Normalization ────────────────────────────────────────────────────

/**
 * Normalizes raw signals against section-specific baselines and named thresholds.
 *
 * All returned normalized components are bounded in [0.0, 1.0].
 */
export function normalizeSignals(
  rawSignals,
  baselineDwellSeconds = null,
  webcamContext = null,
  difficultyTier = "intermediate"
) {
  const normalized = {};

  // 1. Active Reading / Dwell Behavior (30% total weight)
  // Derived from the SAME active dwell ratio to avoid double counting
  const activeDwellMs = rawSignals.dwellTime ?? rawSignals.activeDwellMs ?? 0;
  const activeDwellSec = activeDwellMs / 1000;
  const baselineSec = (baselineDwellSeconds && baselineDwellSeconds > 0)
    ? baselineDwellSeconds
    : SCALE_CONFIG.DEFAULT_BASELINE_DWELL_SECONDS;

  let dwellRatio = 0.0;
  if (activeDwellSec >= SCALE_CONFIG.MIN_MEANINGFUL_DWELL_SECONDS) {
    dwellRatio = activeDwellSec / baselineSec;
  }

  // 1a. Continuous Active Dwell (20% max)
  if (dwellRatio <= 1.0) {
    normalized.dwellContinuous = 0.0;
  } else if (dwellRatio >= SCALE_CONFIG.DWELL_CRITICAL_RATIO) {
    normalized.dwellContinuous = 1.0;
  } else {
    normalized.dwellContinuous = (dwellRatio - 1.0) / (SCALE_CONFIG.DWELL_CRITICAL_RATIO - 1.0);
  }

  // 1b. Difficulty-Aware Exceeded-Time (Up to 10% max)
  normalized.dwellExceeded = computeExceededTimeContribution(dwellRatio, difficultyTier);
  normalized.dwellRatio = dwellRatio;
  normalized.dwellTime = normalized.dwellContinuous; // backward compat alias

  // 2. Question Accuracy (35% max, Inverted: accuracy >= 0.80 -> 0; <= 0.20 -> 1.0)
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

  // 3. Help Requests (15% max, Unified: Text Help + Voice Help, >=3 -> 1.0)
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

  // 4. Question Response Latency (10% max, <= 5s -> 0, >= 20s -> 1.0)
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

  // 5. Scroll-Back / Backtracking (10% max, >= 3 -> 1.0)
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

  // 6. Audio / TTS Replay (0% score weight, user convenience control)
  normalized.audioReplay = 0.0;
  normalized.rereadCount = 0.0;

  // 7. Webcam Attention Context (Gates active dwell accumulation only, 0% direct weight)
  normalized.webcamContext = 0.0;

  return normalized;
}

// ─── Authoritative Struggle Score Computation ────────────────────────────────

/**
 * Computes the authoritative unified struggle score as a weighted sum of normalized signals.
 *
 * Follows the PRISM SCALE Final Authoritative Scoring Model:
 * - Active Reading / Dwell Behavior: 30%
 *   - 20% continuous active-dwell evidence
 *   - up to 10% progressive difficulty-aware exceeded-time evidence (from the SAME dwellRatio)
 * - Quiz Accuracy: 35%
 * - Help Requests (text + voice): 15%
 * - Quiz Answer Latency: 10%
 * - Scroll / Backtracking: 10%
 * TOTAL = 100% (1.00)
 *
 * Clamped strictly to [0.0, 1.0].
 */
export function computeStruggleScore(normalizedSignals, difficultyTier = "intermediate") {
  let score = 0;

  // 1a. Continuous Active Dwell (20% max)
  const dwellContinuous = normalizedSignals.dwellContinuous ?? normalizedSignals.dwellTime ?? 0;
  score += dwellContinuous * SCALE_CONFIG.WEIGHTS.dwellContinuous;

  // 1b. Difficulty-Aware Exceeded-Time (Up to 10% max)
  const dwellExceeded = (normalizedSignals.dwellExceeded !== undefined)
    ? normalizedSignals.dwellExceeded
    : computeExceededTimeContribution(normalizedSignals.dwellRatio ?? 1.0, difficultyTier);
  score += dwellExceeded;

  // 2. Quiz Accuracy (35% max)
  score += (normalizedSignals.questionAccuracy ?? 0) * SCALE_CONFIG.WEIGHTS.questionAccuracy;

  // 3. Help Requests (15% max)
  score += (normalizedSignals.helpRequests ?? 0) * SCALE_CONFIG.WEIGHTS.helpRequests;

  // 4. Answer Latency (10% max)
  score += (normalizedSignals.answerLatency ?? 0) * SCALE_CONFIG.WEIGHTS.answerLatency;

  // 5. Scroll / Backtracking (10% max)
  score += (normalizedSignals.scrollBack ?? 0) * SCALE_CONFIG.WEIGHTS.scrollBack;

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
  webcamContext = null,
  difficultyTier = "intermediate"
) {
  // Step 1: SIGNAL & CALIBRATE — normalize against section-specific baselines
  const normalized = normalizeSignals(rawSignals, baselineDwellSeconds, webcamContext, difficultyTier);
  const struggleScore = computeStruggleScore(normalized, difficultyTier);

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
