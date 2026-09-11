# PRISM — Adaptive Engine Logic

**Owner:** M2 (SCALE + Adaptive Intelligence)
**Architecture:** Deterministic, rule-based. No ML classifier. No LLM calls.

---

## SCALE Overview

**S**ignal → **C**alibrate → **A**dapt → **L**et learner engage → **E**valuate

The SCALE engine runs entirely client-side. It processes behavioral signals, computes a struggle score, applies threshold rules, and determines whether REWIRE should activate.

---

## 1. Signal Definitions

| Signal | Type | Source | Range | Description |
|--------|------|--------|-------|-------------|
| `dwellTime` | integer | Timer on chunk render/navigate | 0–∞ ms | Time spent on current concept |
| `rereadCount` | integer | Scroll-back-to-top or text re-selection | 0–∞ | Times learner re-read the same concept |
| `scrollBack` | integer | "Previous" navigation events | 0–∞ | Times learner navigated backward |
| `helpRequests` | integer | "Explain" button clicks | 0–∞ | Explicit help requests via UI |
| `questionAccuracy` | float | Answer correctness ratio | 0.0–1.0 | Correct answers / total answers |
| `answerLatency` | integer | Timer from question display to answer | 0–∞ ms | Average time per question |
| `retryCount` | integer | Re-answers after incorrect | 0–∞ | Answer retry attempts |
| `voiceHelpRequests` | integer | STT intents: "explain", "simplify", "repeat" | 0–∞ | Voice-based help requests |

---

## 2. Normalization

Each signal is normalized to a 0–1 scale using per-signal baselines.

### Baseline Defaults (MVP)

| Signal | Baseline (Normal) | Concern Threshold | Critical Threshold |
|--------|-------------------|-------------------|--------------------|
| `dwellTime` | 15,000 ms | 30,000 ms | 60,000 ms |
| `rereadCount` | 0 | 2 | 5 |
| `scrollBack` | 0 | 1 | 3 |
| `helpRequests` | 0 | 1 | 3 |
| `questionAccuracy` | 0.8 (inverted) | 0.5 | 0.2 |
| `answerLatency` | 5,000 ms | 10,000 ms | 20,000 ms |
| `retryCount` | 0 | 1 | 3 |
| `voiceHelpRequests` | 0 | 1 | 2 |

### Normalization Formula

```javascript
function normalize(value, baseline, criticalThreshold) {
  if (value <= baseline) return 0.0;
  if (value >= criticalThreshold) return 1.0;
  return (value - baseline) / (criticalThreshold - baseline);
}

// For inverted signals (questionAccuracy — lower is worse)
function normalizeInverted(value, baseline, criticalThreshold) {
  if (value >= baseline) return 0.0;
  if (value <= criticalThreshold) return 1.0;
  return (baseline - value) / (baseline - criticalThreshold);
}
```

### Example

```javascript
// dwellTime = 45,000ms
normalize(45000, 15000, 60000)
// = (45000 - 15000) / (60000 - 15000) = 0.667

// questionAccuracy = 0.33
normalizeInverted(0.33, 0.8, 0.2)
// = (0.8 - 0.33) / (0.8 - 0.2) = 0.783
```

---

## 3. Struggle Score Calculation

The struggle score is a weighted sum of normalized signals.

### Signal Weights (MVP)

| Signal | Weight | Rationale |
|--------|--------|-----------|
| `dwellTime` | 0.10 | Mild indicator — could mean deep reading, not struggle |
| `rereadCount` | 0.20 | Strong indicator — repeated re-reads signal confusion |
| `scrollBack` | 0.10 | Moderate — could be review, not struggle |
| `helpRequests` | 0.15 | Strong — explicit cry for help |
| `questionAccuracy` | 0.25 | Strongest — direct comprehension measurement |
| `answerLatency` | 0.05 | Weak — varies by learner speed |
| `retryCount` | 0.05 | Moderate — retries indicate initial misunderstanding |
| `voiceHelpRequests` | 0.10 | Strong — voice help is an explicit signal |
| **Total** | **1.00** | |

### Formula

```javascript
function computeStruggleScore(normalizedSignals) {
  const weights = {
    dwellTime: 0.10,
    rereadCount: 0.20,
    scrollBack: 0.10,
    helpRequests: 0.15,
    questionAccuracy: 0.25,
    answerLatency: 0.05,
    retryCount: 0.05,
    voiceHelpRequests: 0.10
  };

  let score = 0;
  for (const [signal, weight] of Object.entries(weights)) {
    const value = normalizedSignals[signal] ?? 0;
    score += value * weight;
  }

  return Math.min(1.0, Math.max(0.0, score));
}
```

---

## 4. Adaptation Threshold

```javascript
const STRUGGLE_THRESHOLD = 0.6; // Score above this triggers REWIRE
```

| Score Range | Interpretation | Action |
|-------------|---------------|--------|
| 0.0–0.3 | Low struggle | Continue normally |
| 0.3–0.6 | Moderate struggle | Continue, but monitor closely |
| 0.6–0.8 | High struggle | **REWIRE — increase simplification by 1 level** |
| 0.8–1.0 | Critical struggle | **REWIRE — increase simplification by 2 levels (or max)** |

---

## 5. Adaptation Rules

```javascript
function selectAdaptation(struggleScore, currentLevel, maxLevel = 3) {
  if (struggleScore < 0.6) {
    return null; // No adaptation needed
  }

  const levelIncrease = struggleScore >= 0.8 ? 2 : 1;
  const newLevel = Math.min(currentLevel + levelIncrease, maxLevel);

  if (newLevel === currentLevel) {
    // Already at max simplification
    return {
      action: 'at_maximum',
      newVariantLevel: currentLevel,
      additionalActions: ['reduce_chunk_size'],
      explanation: 'Content is already at maximum simplification. We reduced the section size.'
    };
  }

  const actions = ['increase_simplification'];
  if (struggleScore >= 0.7) actions.push('reduce_chunk_size');
  if (struggleScore >= 0.8) actions.push('add_visual_description');

  return {
    action: 'increase_simplification',
    newVariantLevel: newLevel,
    additionalActions: actions
  };
}
```

---

## 6. Cooldown Mechanism

Prevents adaptation loops (adapting too frequently annoys learners and prevents meaningful measurement).

```javascript
const COOLDOWN_CHUNKS = 2; // Minimum chunks between adaptations

function isCooldownActive(lastAdaptationChunksAgo) {
  if (lastAdaptationChunksAgo === null) return false; // Never adapted
  return lastAdaptationChunksAgo < COOLDOWN_CHUNKS;
}
```

**Rules:**
- After REWIRE fires, skip the next 2 concepts before allowing another adaptation
- If cooldown is active and struggle persists, log a warning but do NOT adapt
- Cooldown resets when an adaptation fires

---

## 7. Adaptation Loop Prevention

Beyond cooldown, prevent infinite escalation:

```javascript
const MAX_ADAPTATIONS_PER_SESSION = 5;
const MAX_CONSECUTIVE_ADAPTATIONS = 3;

function canAdapt(session) {
  if (session.totalAdaptations >= MAX_ADAPTATIONS_PER_SESSION) {
    return { allowed: false, reason: 'Session adaptation limit reached (5)' };
  }
  if (session.consecutiveAdaptations >= MAX_CONSECUTIVE_ADAPTATIONS) {
    return { allowed: false, reason: 'Consecutive adaptation limit reached (3)' };
  }
  return { allowed: true };
}
```

**Rules:**
- Maximum 5 adaptations per session
- Maximum 3 consecutive adaptations without a "normal" (non-adapted) concept
- If limits are reached, continue session without further adaptation

---

## 8. Adaptation History

Every SCALE evaluation and REWIRE event is recorded:

```javascript
const adaptationRecord = {
  adaptationId: 'adapt_001',
  sessionId: 'session_12345',
  conceptId: 'con_002',
  triggerSignalId: 'sig_session12345_con002',
  struggleScore: 0.78,
  threshold: 0.6,
  reason: 'High reread count + low question accuracy',
  thresholdsMet: ['rereadCount > 2', 'questionAccuracy < 0.5'],
  previousVariantLevel: 1,
  newVariantLevel: 2,
  strategy: 'increase_simplification + reduce_chunk_size',
  explanation: 'We noticed you re-read this section 3 times and your accuracy was 33%, so we switched to simpler language and shorter sections.',
  preAccuracy: 0.33,
  postAccuracy: null,  // Set after learner engages with adapted content
  outcomeDelta: null,   // Set after measurement
  adaptedAt: '2026-09-11T14:05:00.000Z'
};
```

---

## 9. Outcome Measurement

After REWIRE, the system measures whether the adaptation actually helped.

```javascript
function measureOutcome(preAccuracy, postAccuracy) {
  const delta = postAccuracy - preAccuracy;
  return {
    outcomeDelta: delta,
    improved: delta > 0,
    significantImprovement: delta > 0.2,  // >20% improvement
    noChange: Math.abs(delta) <= 0.1,     // <10% change
    declined: delta < -0.1                // >10% worse
  };
}
```

**Outcome is stored in `adaptation_history`** (see `05-DATA-MODEL.md`).

---

## 10. Complete SCALE Evaluation Function

```javascript
function scaleEvaluate(signals, currentVariantLevel, session) {
  // Step 1: SIGNAL — raw signals are input
  
  // Step 2: CALIBRATE — normalize signals
  const normalized = {
    dwellTime: normalize(signals.dwellTime, 15000, 60000),
    rereadCount: normalize(signals.rereadCount, 0, 5),
    scrollBack: normalize(signals.scrollBack, 0, 3),
    helpRequests: normalize(signals.helpRequests, 0, 3),
    questionAccuracy: normalizeInverted(signals.questionAccuracy, 0.8, 0.2),
    answerLatency: normalize(signals.answerLatency, 5000, 20000),
    retryCount: normalize(signals.retryCount, 0, 3),
    voiceHelpRequests: normalize(signals.voiceHelpRequests, 0, 2)
  };

  // Compute struggle score
  const struggleScore = computeStruggleScore(normalized);

  // Check cooldown
  if (isCooldownActive(session.lastAdaptationChunksAgo)) {
    return {
      shouldAdapt: false,
      struggleScore,
      reason: 'Cooldown active',
      cooldownActive: true,
      cooldownRemainingChunks: COOLDOWN_CHUNKS - session.lastAdaptationChunksAgo
    };
  }

  // Check adaptation limits
  const canAdaptResult = canAdapt(session);
  if (!canAdaptResult.allowed) {
    return {
      shouldAdapt: false,
      struggleScore,
      reason: canAdaptResult.reason,
      cooldownActive: false
    };
  }

  // Step 3: ADAPT — decide adaptation
  if (struggleScore < STRUGGLE_THRESHOLD) {
    return {
      shouldAdapt: false,
      struggleScore,
      threshold: STRUGGLE_THRESHOLD,
      reason: 'Signals within normal range',
      cooldownActive: false
    };
  }

  const adaptation = selectAdaptation(struggleScore, currentVariantLevel);

  return {
    shouldAdapt: true,
    struggleScore,
    threshold: STRUGGLE_THRESHOLD,
    reason: `Struggle score ${struggleScore.toFixed(2)} exceeds threshold ${STRUGGLE_THRESHOLD}`,
    adaptationStrategy: adaptation,
    cooldownActive: false
  };

  // Steps 4 & 5 (LET ENGAGE & EVALUATE) happen after the frontend
  // renders the adapted content and captures new signals
}
```

---

## 11. Configuration Constants

```javascript
const SCALE_CONFIG = {
  // Thresholds
  STRUGGLE_THRESHOLD: 0.6,
  CRITICAL_THRESHOLD: 0.8,

  // Cooldown
  COOLDOWN_CHUNKS: 2,

  // Limits
  MAX_ADAPTATIONS_PER_SESSION: 5,
  MAX_CONSECUTIVE_ADAPTATIONS: 3,

  // Signal baselines
  BASELINES: {
    dwellTime: { normal: 15000, critical: 60000 },
    rereadCount: { normal: 0, critical: 5 },
    scrollBack: { normal: 0, critical: 3 },
    helpRequests: { normal: 0, critical: 3 },
    questionAccuracy: { normal: 0.8, critical: 0.2, inverted: true },
    answerLatency: { normal: 5000, critical: 20000 },
    retryCount: { normal: 0, critical: 3 },
    voiceHelpRequests: { normal: 0, critical: 2 }
  },

  // Signal weights
  WEIGHTS: {
    dwellTime: 0.10,
    rereadCount: 0.20,
    scrollBack: 0.10,
    helpRequests: 0.15,
    questionAccuracy: 0.25,
    answerLatency: 0.05,
    retryCount: 0.05,
    voiceHelpRequests: 0.10
  }
};
```
