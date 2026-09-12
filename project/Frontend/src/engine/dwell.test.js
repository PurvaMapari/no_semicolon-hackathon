/**
 * PRISM — Comprehensive Active Dwell & SCALE Struggle-Score Test Suite
 *
 * Implements and validates all 12 required test cases from Section 16 of the
 * current product specification:
 *
 * 1.  Normal section: expected=120s, active=100s -> no dwell struggle (normalized = 0)
 * 2.  Mild dwell: expected=120s, active=180s -> ratio=1.5, normalized dwell = 0.25
 * 3.  Critical dwell: expected=120s, active=360s -> ratio=3.0, normalized dwell = 1.0
 * 4.  Loading isolation: expected=120s, loading=30s, active=120s -> dwell uses 120s, not 150s
 * 5.  Tab-hidden isolation: active 40s, hidden 30s, active 20s -> total active = 60s
 * 6.  Audio replay alone: 4 replays -> contribution = 0.05 -> should NOT trigger REWIRE
 * 7.  Webcam alone: worst-case webcam -> contribution = 0.05 -> should NOT trigger REWIRE
 * 8.  High dwell + poor quiz: normalized dwell (0.30) + poor accuracy (0.30) = 0.60 -> triggers REWIRE
 * 9.  Normal learner: clean signals -> should NOT trigger REWIRE (score = 0.0)
 * 10. Mathematical accuracy: 60% accuracy normalizes to 0.3333...
 * 11. Weight sum: all 7 weights sum exactly to 1.000
 * 12. Existing golden path: produces score >= 0.6 and triggers REWIRE
 */

import assert from "node:assert/strict";
import {
  SCALE_CONFIG,
  DWELL_WEIGHT,
  QUIZ_ACCURACY_WEIGHT,
  HELP_REQUEST_WEIGHT,
  QUIZ_LATENCY_WEIGHT,
  SCROLL_BACK_WEIGHT,
  AUDIO_REPLAY_WEIGHT,
  WEBCAM_CONTEXT_WEIGHT,
  MIN_MEANINGFUL_DWELL_SECONDS,
  DWELL_CRITICAL_RATIO,
  ACCURACY_NORMAL_BASELINE,
  ACCURACY_CRITICAL,
  normalizeSignals,
  computeStruggleScore,
  scaleEvaluate,
} from "./scale.js";
import {
  createSignalState,
  createSessionMeta,
  sectionLoading,
  sectionReady,
  sectionActive,
  sectionPaused,
  sectionCompleted,
  resetSectionDwell,
  getActiveDwellSeconds,
  evaluateSignals,
  recordAudioReplay,
  recordReread,
  injectGoldenPathStruggle,
} from "./signals.js";

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  PASS [${total}]: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL [${total}]: ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

console.log("\n=================================================================");
console.log("PRISM SCALE STRUGGLE-SCORE AUTHORITATIVE TEST SUITE (12 CASES)");
console.log("=================================================================\n");

// ─── 1. Normal Section ───────────────────────────────────────────────────────
test("1. Normal section: expected = 120s, active = 100s -> no dwell struggle", () => {
  const expectedBaselineSeconds = 120;
  const activeDwellMs = 100 * 1000;

  const rawSignals = { dwellTime: activeDwellMs, questionAccuracy: 0.85 };
  const normalized = normalizeSignals(rawSignals, expectedBaselineSeconds);

  // ratio = 100 / 120 = 0.833 <= 1.0 -> normalized dwell MUST be 0
  assert.equal(normalized.dwellTime, 0.0, "Dwell ratio <= 1.0 must produce 0 normalized struggle");
});

// ─── 2. Mild Dwell ───────────────────────────────────────────────────────────
test("2. Mild dwell: expected = 120s, active = 180s -> ratio = 1.5, normalized = 0.25", () => {
  const expectedBaselineSeconds = 120;
  const activeDwellMs = 180 * 1000;

  const rawSignals = { dwellTime: activeDwellMs };
  const normalized = normalizeSignals(rawSignals, expectedBaselineSeconds);

  // ratio = 180 / 120 = 1.5
  // normalized = (1.5 - 1.0) / (3.0 - 1.0) = 0.5 / 2.0 = 0.25
  const expected = (1.5 - 1.0) / (DWELL_CRITICAL_RATIO - 1.0);
  assert.ok(
    Math.abs(normalized.dwellTime - 0.25) < 1e-6,
    `Normalized dwell should be 0.25, got ${normalized.dwellTime}`
  );
  assert.ok(
    Math.abs(normalized.dwellTime - expected) < 1e-6,
    `Should match formula: (1.5 - 1.0)/(3.0 - 1.0) = 0.25`
  );
});

// ─── 3. Critical Dwell ───────────────────────────────────────────────────────
test("3. Critical dwell: expected = 120s, active = 360s -> ratio = 3.0, normalized = 1.0", () => {
  const expectedBaselineSeconds = 120;
  const activeDwellMs = 360 * 1000;

  const rawSignals = { dwellTime: activeDwellMs };
  const normalized = normalizeSignals(rawSignals, expectedBaselineSeconds);

  // ratio = 360 / 120 = 3.0 >= DWELL_CRITICAL_RATIO -> 1.0
  assert.equal(normalized.dwellTime, 1.0, "Dwell ratio >= 3.0 must normalize to exactly 1.0");
});

// ─── 4. Loading Isolation ────────────────────────────────────────────────────
test("4. Loading isolation: expected = 120s, loading = 30s, active = 120s -> uses 120s (not 150s)", () => {
  let signals = createSignalState();

  // 30 seconds of loading / API latency (timer does not run)
  signals = sectionLoading(signals);
  assert.equal(signals._sectionState, "SECTION_LOADING");
  assert.equal(signals._dwellTimerStart, null);

  // Section becomes ready
  signals = sectionReady(signals);
  assert.equal(signals._sectionState, "SECTION_READY");
  assert.equal(signals._dwellTimerStart, null);

  // Learner actively reads for 120 seconds
  signals = sectionActive(signals);
  signals._dwellTimerStart = Date.now() - 120000;
  signals = sectionCompleted(signals);

  const activeSeconds = signals.activeDwellMs / 1000;
  assert.ok(
    Math.abs(activeSeconds - 120) < 0.2,
    `Recorded active dwell should be 120s, got ${activeSeconds}`
  );

  const normalized = normalizeSignals(signals, 120);
  assert.equal(
    normalized.dwellTime,
    0.0,
    "Ratio is 120/120 = 1.0 -> dwell struggle should be 0.0 (loading strictly excluded)"
  );
});

// ─── 5. Tab-Hidden Isolation ─────────────────────────────────────────────────
test("5. Tab-hidden isolation: active 40s, hidden 30s, active 20s -> total active = 60s (not 90s)", () => {
  let signals = createSignalState();

  // Read for 40 seconds
  signals = sectionActive(signals);
  signals._dwellTimerStart = Date.now() - 40000;

  // Switch tab (hidden) for 30s
  signals = sectionPaused(signals);
  assert.equal(signals._dwellTimerStart, null);
  assert.ok(Math.abs(signals.activeDwellMs - 40000) < 100);

  // Return to tab and read for 20 more seconds
  signals = sectionActive(signals);
  signals._dwellTimerStart = Date.now() - 20000;
  signals = sectionCompleted(signals);

  const activeSeconds = signals.activeDwellMs / 1000;
  assert.ok(
    Math.abs(activeSeconds - 60) < 0.2,
    `Total active dwell should be 60s, got ${activeSeconds}`
  );
});

// ─── 6. Audio Replay Alone ───────────────────────────────────────────────────
test("6. Audio replay alone: 4 replays -> contribution = 0.05 -> should NOT trigger REWIRE", () => {
  let signals = createSignalState();
  const sessionMeta = createSessionMeta();

  // Re-read clicked 4 times (maximum audio replay struggle)
  for (let i = 0; i < 4; i++) {
    signals = recordAudioReplay(signals);
  }
  assert.equal(signals.audioReplayCount, 4);
  assert.equal(signals.rereadCount, 4); // backward compat alias

  const evaluation = evaluateSignals(signals, sessionMeta, null, 60);

  // Audio replay weight is 0.05, max contribution is 0.05
  assert.ok(
    evaluation.struggleScore <= 0.06,
    `Struggle score (${evaluation.struggleScore}) must not exceed 0.06 on audio replays alone`
  );
  assert.equal(
    evaluation.shouldAdapt,
    false,
    "Audio replays alone must never trigger REWIRE (0.05 << 0.60)"
  );
});

// ─── 7. Webcam Alone ─────────────────────────────────────────────────────────
test("7. Webcam alone: worst-case webcam context -> contribution = 0.05 -> should NOT trigger REWIRE", () => {
  const signals = createSignalState();
  const sessionMeta = createSessionMeta();

  // Completely disengaged / missing webcam context
  const worstWebcam = {
    presence_ratio: 0.0,
    face_present_now: false,
    tab_focused_now: false,
    head_stable_now: false,
    scroll_consistent_now: false,
  };

  const evaluation = evaluateSignals(signals, sessionMeta, worstWebcam, 60);

  // Webcam context weight is 0.05, max contribution is 0.05
  assert.ok(
    evaluation.struggleScore <= 0.06,
    `Struggle score (${evaluation.struggleScore}) must be <= 0.06 from webcam alone`
  );
  assert.equal(
    evaluation.shouldAdapt,
    false,
    "Webcam disengagement alone must never trigger REWIRE"
  );
});

// ─── 8. High Dwell + Poor Quiz ───────────────────────────────────────────────
test("8. High dwell + poor quiz: dwell ratio >= 3.0 (0.30) + accuracy <= 0.20 (0.30) = 0.60 -> triggers REWIRE", () => {
  const expectedBaselineSeconds = 60;
  const activeDwellMs = 180 * 1000; // ratio = 3.0 -> normalized dwell = 1.0 (weight 0.30)
  const accuracy = 0.10;            // <= 0.20 -> normalized accuracy = 1.0 (weight 0.30)

  const rawSignals = {
    dwellTime: activeDwellMs,
    questionAccuracy: accuracy,
  };

  const normalized = normalizeSignals(rawSignals, expectedBaselineSeconds);
  assert.equal(normalized.dwellTime, 1.0);
  assert.equal(normalized.questionAccuracy, 1.0);

  const score = computeStruggleScore(normalized);
  // score = 1.0 * 0.30 + 1.0 * 0.30 = 0.60
  assert.ok(
    Math.abs(score - 0.60) < 1e-4,
    `Struggle score should be exactly 0.60, got ${score}`
  );
  assert.ok(score >= SCALE_CONFIG.STRUGGLE_THRESHOLD, "Must reach STRUGGLE_THRESHOLD (0.60)");

  const evalResult = scaleEvaluate(rawSignals, 1, createSessionMeta(), expectedBaselineSeconds);
  assert.equal(evalResult.shouldAdapt, true, "Should trigger REWIRE");
});

// ─── 9. Normal Learner ───────────────────────────────────────────────────────
test("9. Normal learner: clean signals -> should NOT trigger REWIRE (score = 0.0)", () => {
  const rawSignals = {
    dwellTime: 45000,           // 45s on 60s baseline (ratio = 0.75 <= 1.0 -> 0)
    questionAccuracy: 0.90,     // 90% accuracy (>= 0.80 -> 0)
    helpRequests: 0,
    voiceHelpRequests: 0,
    answerLatency: 4000,        // 4s (<= 5s -> 0)
    scrollBack: 0,
    audioReplayCount: 0,
  };

  const normalized = normalizeSignals(rawSignals, 60);
  const score = computeStruggleScore(normalized);

  assert.equal(score, 0.0, `Normal learner score should be 0.0, got ${score}`);
  const evalResult = scaleEvaluate(rawSignals, 1, createSessionMeta(), 60);
  assert.equal(evalResult.shouldAdapt, false, "Normal learner must not trigger REWIRE");
});

// ─── 10. Mathematical Accuracy: 60% Quiz Accuracy ───────────────────────────
test("10. Mathematical accuracy: 60% accuracy normalizes to 0.3333...", () => {
  const accuracy = 0.60;
  const rawSignals = { questionAccuracy: accuracy };
  const normalized = normalizeSignals(rawSignals, 60);

  // (0.80 - 0.60) / (0.80 - 0.20) = 0.20 / 0.60 = 1/3 ≈ 0.333333...
  const expected = (ACCURACY_NORMAL_BASELINE - accuracy) / (ACCURACY_NORMAL_BASELINE - ACCURACY_CRITICAL);
  assert.ok(
    Math.abs(normalized.questionAccuracy - (1 / 3)) < 1e-6,
    `Expected 1/3 (0.3333...), got ${normalized.questionAccuracy}`
  );
  assert.ok(
    Math.abs(normalized.questionAccuracy - 0.3333) < 1e-3,
    `Expected ~0.3333, got ${normalized.questionAccuracy}`
  );
});

// ─── 11. Weight Sum Exactly 1.000 ────────────────────────────────────────────
test("11. Weight sum: all 7 weights sum exactly to 1.000", () => {
  const sum =
    DWELL_WEIGHT +
    QUIZ_ACCURACY_WEIGHT +
    HELP_REQUEST_WEIGHT +
    QUIZ_LATENCY_WEIGHT +
    SCROLL_BACK_WEIGHT +
    AUDIO_REPLAY_WEIGHT +
    WEBCAM_CONTEXT_WEIGHT;

  assert.ok(
    Math.abs(sum - 1.0) < 1e-9,
    `Weight sum must equal exactly 1.000, got ${sum}`
  );

  const configSum = Object.values(SCALE_CONFIG.WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(
    Math.abs(configSum - 1.0) < 1e-9,
    `SCALE_CONFIG.WEIGHTS sum must equal exactly 1.000, got ${configSum}`
  );
});

// ─── 12. Golden-Path Regression ──────────────────────────────────────────────
test("12. Existing golden path: produces score >= 0.6 and triggers REWIRE", () => {
  let signals = createSignalState();
  const sessionMeta = createSessionMeta();

  signals = injectGoldenPathStruggle(signals);

  // In the golden path, Concept 3 has ~70 words (expected read ~25-30s).
  // With 50s active dwell, 0.0 accuracy, 2 text + 1 voice help, 12s latency, 2 scrollbacks, 4 replays:
  const evaluation = evaluateSignals(signals, sessionMeta, null, 30);

  assert.ok(
    evaluation.struggleScore >= SCALE_CONFIG.STRUGGLE_THRESHOLD,
    `Golden path score (${evaluation.struggleScore.toFixed(3)}) must be >= 0.60`
  );
  assert.equal(evaluation.shouldAdapt, true, "Golden path must trigger REWIRE");
  assert.equal(
    evaluation.adaptationStrategy?.newVariantLevel,
    2,
    "Should adapt to variant level 2"
  );
  assert.ok(
    !evaluation.explanation.includes("re-read"),
    "Explanation should NOT claim 're-read' indicates struggle"
  );
  assert.ok(
    evaluation.explanation.length > 0,
    "Explanation must be learner-friendly and non-empty"
  );
});

console.log(`\n=================================================================`);
console.log(`ALL 12 TESTS PASSED: ${passed} / ${total} ✓`);
console.log(`=================================================================\n`);
