import {
  scaleEvaluate,
  measureOutcome,
  computeStruggleScore,
  normalizeSignals,
  computeExceededTimeContribution,
  DWELL_CONTINUOUS_WEIGHT,
  DWELL_EXCEEDED_WEIGHT,
  QUIZ_ACCURACY_WEIGHT,
  HELP_REQUEST_WEIGHT,
  QUIZ_LATENCY_WEIGHT,
  SCROLL_BACK_WEIGHT,
  AUDIO_REPLAY_WEIGHT,
  WEBCAM_CONTEXT_WEIGHT,
  DIFFICULTY_EXCEEDED_MAX,
} from "./src/engine/scale.js";
import {
  createSignalState,
  createSessionMeta,
  evaluateSignals,
  applyAdaptation,
  recordAdaptationOutcome,
  injectGoldenPathStruggle,
  computeSessionStruggleScore,
} from "./src/engine/signals.js";

console.log("\n======================================================================");
console.log("FRONTEND SCALE & SIGNALS TEST SUITE - FINAL MODEL");
console.log("======================================================================");

// ── CHECK 1: Weights sum exactly to 1.00 ─────────────────────────────────────
const totalWeight =
  DWELL_CONTINUOUS_WEIGHT +
  DWELL_EXCEEDED_WEIGHT +
  QUIZ_ACCURACY_WEIGHT +
  HELP_REQUEST_WEIGHT +
  QUIZ_LATENCY_WEIGHT +
  SCROLL_BACK_WEIGHT;

console.log(`\n1. Weight Sum Check: ${totalWeight.toFixed(4)}`);
if (Math.abs(totalWeight - 1.00) > 0.0001) {
  throw new Error(`FAIL: Weights must sum to 1.00, got ${totalWeight}`);
}
console.log("   [OK] Weights sum exactly to 1.00 (Dwell: 30%, Quiz: 35%, Help: 15%, Latency: 10%, Scroll: 10%)");

// ── CHECK 2: Difficulty-Aware Exceeded-Time Caps Check (at ratio 2.0x) ────────
console.log("\n2. Difficulty-Aware Exceeded-Time Caps Check (at ratio 2.0x):");
const easyMax = computeExceededTimeContribution(2.0, "foundational");
const interMax = computeExceededTimeContribution(2.0, "intermediate");
const advMax = computeExceededTimeContribution(2.0, "advanced");

console.log(`   - Foundational (Easy) Max:   ${easyMax.toFixed(3)} (expected: 0.100)`);
console.log(`   - Intermediate (Medium) Max: ${interMax.toFixed(3)} (expected: 0.070)`);
console.log(`   - Advanced (Hard) Max:       ${advMax.toFixed(3)} (expected: 0.050)`);

if (easyMax !== 0.10) throw new Error(`FAIL: Expected 0.10, got ${easyMax}`);
if (interMax !== 0.07) throw new Error(`FAIL: Expected 0.07, got ${interMax}`);
if (advMax !== 0.05) throw new Error(`FAIL: Expected 0.05, got ${advMax}`);
console.log("   [OK] Maximum exceeded-time contributions match difficulty tiers (0.10, 0.07, 0.05)");

// ── CHECK 3: Relative Overrun Comparison (1.35x dwell on expected time) ──────
console.log("\n3. Relative Overrun Comparison (1.35x dwell on expected time):");
const normEasy = normalizeSignals({ dwellTime: 135000 }, 100, null, "foundational");
const normAdv = normalizeSignals({ dwellTime: 135000 }, 100, null, "advanced");

const scoreEasy = computeStruggleScore(normEasy, "foundational");
const scoreAdv = computeStruggleScore(normAdv, "advanced");

console.log(`   - Easy (1.35x dwell) struggle score:     ${scoreEasy.toFixed(4)} (exceeded: ${normEasy.dwellExceeded.toFixed(4)})`);
console.log(`   - Advanced (1.35x dwell) struggle score: ${scoreAdv.toFixed(4)} (exceeded: ${normAdv.dwellExceeded.toFixed(4)})`);

if (scoreEasy <= scoreAdv) {
  throw new Error(`FAIL: Easy struggle score (${scoreEasy}) must be higher than Advanced (${scoreAdv})`);
}
if (normEasy.dwellExceeded <= normAdv.dwellExceeded) {
  throw new Error(`FAIL: Easy exceeded contribution must be higher than Advanced`);
}
console.log("   [OK] Same relative overrun produces lower struggle penalty on Advanced than Easy");

// ── CHECK 4: Progressive Exceeded-Time Curve ─────────────────────────────────
console.log("\n4. Progressive Exceeded-Time Curve Check (Easy):");
const p0 = computeExceededTimeContribution(0.90, "foundational");
const p1 = computeExceededTimeContribution(1.10, "foundational");
const p2 = computeExceededTimeContribution(1.35, "foundational");
const p3 = computeExceededTimeContribution(1.60, "foundational");

console.log(`   - ratio 0.90 (<= 1.0): ${p0.toFixed(4)} (expected: 0.0000)`);
console.log(`   - ratio 1.10 (small):  ${p1.toFixed(4)} (expected > 0 and <= 0.03)`);
console.log(`   - ratio 1.35 (mod):    ${p2.toFixed(4)} (expected > 0.03 and < 0.10)`);
console.log(`   - ratio 1.60 (max):    ${p3.toFixed(4)} (expected: 0.1000)`);

if (p0 !== 0.0) throw new Error("FAIL: ratio <= 1.0 must produce 0.0");
if (p1 <= 0.0 || p1 > 0.03) throw new Error("FAIL: ratio 1.10 must be between 0 and 0.03");
if (p2 <= 0.03 || p2 >= 0.10) throw new Error("FAIL: ratio 1.35 must be between 0.03 and 0.10");
if (p3 !== 0.10) throw new Error("FAIL: ratio >= 1.50 must produce 0.10");
console.log("   [OK] Progressive curve behaves correctly across all ratio thresholds");

// ── CHECK 5: Full Adaptation & Signals ───────────────────────────────────────
console.log("\n5. Running Realistic Scenarios:");

// 5a. Golden Path struggle
const goldenSignals = injectGoldenPathStruggle(createSignalState());
const meta = createSessionMeta();
const evalResult = evaluateSignals(goldenSignals, meta, null, 30, "intermediate");

console.log(`   - Golden Path Struggle Score: ${evalResult.struggleScore.toFixed(3)} (threshold: 0.60)`);
console.log(`   - Should Adapt: ${evalResult.shouldAdapt}`);
console.log(`   - New Variant Level: ${evalResult.adaptationStrategy?.newVariantLevel}`);

if (!evalResult.shouldAdapt) {
  throw new Error("FAIL: Golden Path should trigger adaptation (score >= 0.6)");
}
if (evalResult.adaptationStrategy?.newVariantLevel !== 2) {
  throw new Error("FAIL: Variant level should be 2");
}
console.log("   [OK] Golden Path evaluation triggers REWIRE");

// 5b. Fresh session -> 0 struggle
const freshSession = {
  signals: createSignalState(),
  sessionMeta: createSessionMeta(),
  practiceReport: { answered: [], failed: [], masteredSections: [] },
  completedSections: [],
  rewireState: { active: false },
};
const freshScore = computeSessionStruggleScore(freshSession);
console.log(`   - Fresh Session Struggle Score: ${freshScore}`);
if (freshScore !== 0) throw new Error("FAIL: Fresh session struggle score should be 0");
console.log("   [OK] Fresh session produces 0 struggle");

// 5c. Help requests (3 total requests = 100% of 15% weight = 0.15)
const helpSession = {
  ...freshSession,
  signals: { ...freshSession.signals, helpRequests: 2, voiceHelpRequests: 1 },
};
const helpScore = computeSessionStruggleScore(helpSession);
console.log(`   - 3 Help Requests Struggle Score: ${helpScore}`);
if (helpScore !== 0.15) throw new Error(`FAIL: Expected 0.15 for 3 help requests, got ${helpScore}`);
console.log("   [OK] Help requests correctly mapped to 15% weight");

// 5d. Zero audio contribution
const audioSession0 = {
  ...freshSession,
  signals: { ...freshSession.signals, dwellTime: 30000, audioReplayCount: 0 },
};
const audioSession5 = {
  ...freshSession,
  signals: { ...freshSession.signals, dwellTime: 30000, audioReplayCount: 5 },
};
const scoreAudio0 = computeSessionStruggleScore(audioSession0);
const scoreAudio5 = computeSessionStruggleScore(audioSession5);
console.log(`   - Struggle with 0 audio replays: ${scoreAudio0}`);
console.log(`   - Struggle with 5 audio replays: ${scoreAudio5}`);
if (scoreAudio0 !== scoreAudio5) throw new Error("FAIL: Audio replays must contribute 0% to struggle score");
console.log("   [OK] Audio replays contribute 0% to struggle score");

// 5e. Active REWIRE floor >= 0.60
const rewireSession = {
  ...freshSession,
  rewireState: { active: true },
};
const rewireScore = computeSessionStruggleScore(rewireSession);
console.log(`   - Active REWIRE Struggle Score: ${rewireScore}`);
if (rewireScore < 0.60) throw new Error("FAIL: Active REWIRE must have struggle score >= 0.60");
console.log("   [OK] Active REWIRE maintains floor >= 0.60");

console.log("\n======================================================================");
console.log("ALL FRONTEND SCALE & SIGNALS TESTS PASSED [OK]");
console.log("======================================================================\n");
