/**
 * PRISM — SCALE Adaptive Engine
 *
 * Signal → Calibrate → Adapt → Let engage → Evaluate
 *
 * Entirely deterministic, client-side. No LLM calls.
 * Spec: docs/07-ADAPTIVE-ENGINE-LOGIC.md
 */

// ─── Configuration ───────────────────────────────────────────────────────────

export const SCALE_CONFIG = {
  STRUGGLE_THRESHOLD: 0.6,
  CRITICAL_THRESHOLD: 0.8,

  COOLDOWN_CHUNKS: 2,
  MAX_ADAPTATIONS_PER_SESSION: 5,
  MAX_CONSECUTIVE_ADAPTATIONS: 3,

  BASELINES: {
    dwellTime:         { normal: 15000, critical: 60000, inverted: false },
    rereadCount:       { normal: 0,     critical: 5,     inverted: false },
    scrollBack:        { normal: 0,     critical: 3,     inverted: false },
    helpRequests:      { normal: 0,     critical: 3,     inverted: false },
    questionAccuracy:  { normal: 0.8,   critical: 0.2,   inverted: true  },
    answerLatency:     { normal: 5000,  critical: 20000, inverted: false },
    retryCount:        { normal: 0,     critical: 3,     inverted: false },
    voiceHelpRequests: { normal: 0,     critical: 2,     inverted: false },
  },

  WEIGHTS: {
    dwellTime:         0.10,
    rereadCount:       0.20,
    scrollBack:        0.10,
    helpRequests:      0.15,
    questionAccuracy:  0.25,
    answerLatency:     0.05,
    retryCount:        0.05,
    voiceHelpRequests: 0.10,
  },
};

// ─── Normalization ───────────────────────────────────────────────────────────

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

// ─── Struggle Score ──────────────────────────────────────────────────────────

export function normalizeSignals(rawSignals) {
  const normalized = {};
  for (const [key, config] of Object.entries(SCALE_CONFIG.BASELINES)) {
    const value = rawSignals[key] ?? (config.inverted ? config.normal : 0);
    normalized[key] = config.inverted
      ? normalizeInverted(value, config.normal, config.critical)
      : normalize(value, config.normal, config.critical);
  }
  return normalized;
}

export function computeStruggleScore(normalizedSignals) {
  let score = 0;
  for (const [signal, weight] of Object.entries(SCALE_CONFIG.WEIGHTS)) {
    score += (normalizedSignals[signal] ?? 0) * weight;
  }
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

// ─── Human-Readable Explanation ──────────────────────────────────────────────

export function generateExplanation(rawSignals, struggleScore, adaptation) {
  const parts = [];

  if ((rawSignals.rereadCount ?? 0) >= 2) {
    parts.push(`you re-read this section ${rawSignals.rereadCount} times`);
  }
  if ((rawSignals.helpRequests ?? 0) >= 1) {
    parts.push(
      `asked for help ${rawSignals.helpRequests} time${rawSignals.helpRequests > 1 ? "s" : ""}`
    );
  }
  if ((rawSignals.voiceHelpRequests ?? 0) >= 1) {
    parts.push("used voice help");
  }
  if (rawSignals.questionAccuracy !== undefined && rawSignals.questionAccuracy < 0.5) {
    const pct = Math.round(rawSignals.questionAccuracy * 100);
    parts.push(`your accuracy was ${pct}%`);
  }
  if ((rawSignals.retryCount ?? 0) >= 1) {
    parts.push(`retried ${rawSignals.retryCount} time${rawSignals.retryCount > 1 ? "s" : ""}`);
  }

  const actionDescriptions = [];
  if (adaptation?.additionalActions?.includes("increase_simplification")) {
    actionDescriptions.push("simpler language");
  }
  if (adaptation?.additionalActions?.includes("reduce_chunk_size")) {
    actionDescriptions.push("shorter sections");
  }
  if (adaptation?.additionalActions?.includes("add_visual_description")) {
    actionDescriptions.push("a visual description");
  }

  const signalPart =
    parts.length > 0
      ? `We noticed ${parts.join(" and ")}`
      : "You're taking longer on this concept";
  const actionPart =
    actionDescriptions.length > 0
      ? `, so Prism switched to ${actionDescriptions.join(", ")}.`
      : ", so Prism changed the explanation.";

  return signalPart + actionPart;
}

// ─── Full SCALE Evaluation ──────────────────────────────────────────────────

export function scaleEvaluate(rawSignals, currentVariantLevel, sessionMeta) {
  // Step 1: SIGNAL — raw signals are input

  // Step 2: CALIBRATE — normalize
  const normalized = normalizeSignals(rawSignals);
  const struggleScore = computeStruggleScore(normalized);

  // Check cooldown
  if (isCooldownActive(sessionMeta.lastAdaptationChunksAgo)) {
    return {
      shouldAdapt: false,
      struggleScore,
      normalized,
      reason: "Cooldown active",
      cooldownActive: true,
      cooldownRemainingChunks:
        SCALE_CONFIG.COOLDOWN_CHUNKS - (sessionMeta.lastAdaptationChunksAgo ?? 0),
    };
  }

  // Check limits
  const adaptResult = canAdapt(sessionMeta);
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
  const explanation = generateExplanation(rawSignals, struggleScore, adaptation);

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
