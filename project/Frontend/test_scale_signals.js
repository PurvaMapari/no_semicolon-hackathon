import { scaleEvaluate, measureOutcome, computeStruggleScore, normalizeSignals } from "./src/engine/scale.js";
import {
  createSignalState,
  createSessionMeta,
  recordReread,
  recordHelpRequest,
  recordQuizAnswer,
  evaluateSignals,
  applyAdaptation,
  recordAdaptationOutcome,
  injectGoldenPathStruggle,
} from "./src/engine/signals.js";

console.log("=== PRISM SCALE & SIGNALS VERIFICATION ===");

// 1. Test Golden Path struggle signals from docs/18-GOLDEN-PATH-FIXTURE.md
const signals = injectGoldenPathStruggle(createSignalState());
const meta = createSessionMeta();

const evalResult = evaluateSignals(signals, meta);
console.log("Struggle Score:", evalResult.struggleScore.toFixed(3));
console.log("Should Adapt:", evalResult.shouldAdapt);
console.log("Variant Level:", evalResult.adaptationStrategy?.newVariantLevel);
console.log("Explanation:", evalResult.explanation);

if (!evalResult.shouldAdapt) {
  throw new Error("FAIL: Golden Path should trigger adaptation (score >= 0.6)");
}
if (evalResult.adaptationStrategy?.newVariantLevel !== 2) {
  throw new Error("FAIL: Variant level should be 2");
}
console.log("✓ SCALE evaluation passed!");

// 2. Test applyAdaptation
const updatedMeta = applyAdaptation(meta, evalResult);
console.log("Total Adaptations:", updatedMeta.totalAdaptations);
console.log("Current Variant Level:", updatedMeta.currentVariantLevel);
if (updatedMeta.totalAdaptations !== 1 || updatedMeta.currentVariantLevel !== 2) {
  throw new Error("FAIL: applyAdaptation state incorrect");
}
console.log("✓ applyAdaptation passed!");

// 3. Test recordAdaptationOutcome
const outcomeMeta = recordAdaptationOutcome(updatedMeta, 1.0);
const lastRecord = outcomeMeta.adaptationHistory[outcomeMeta.adaptationHistory.length - 1];
console.log("Post-Adaptation Accuracy:", lastRecord.postAccuracy);
console.log("Outcome Delta:", lastRecord.outcomeDelta);
console.log("Improved:", lastRecord.outcome?.improved);
if (!lastRecord.outcome?.improved || lastRecord.outcomeDelta !== 1.0) {
  throw new Error("FAIL: measureOutcome calculation failed");
}
console.log("✓ recordAdaptationOutcome passed!");

// 4. Test computeSessionStruggleScore (Unified Session Struggle Score)
import { computeSessionStruggleScore } from "./src/engine/signals.js";

// 4a. Initial fresh session -> 0 struggle
const freshSession = {
  signals: createSignalState(),
  sessionMeta: createSessionMeta(),
  practiceReport: { answered: [], failed: [], masteredSections: [] },
  completedSections: [],
  rewireState: { active: false },
};
const freshScore = computeSessionStruggleScore(freshSession);
console.log("Fresh Session Struggle Score:", freshScore);
if (freshScore !== 0) throw new Error("FAIL: Fresh session struggle score should be 0");

// 4b. Help requests and voice help increase score proportionally
const helpSession = {
  ...freshSession,
  signals: { ...freshSession.signals, helpRequests: 2, voiceHelpRequests: 1 },
};
const helpScore = computeSessionStruggleScore(helpSession);
console.log("Help Session Struggle Score:", helpScore);
if (helpScore <= 0 || helpScore !== 0.45) throw new Error("FAIL: Help requests should increase score proportionally");

// 4c. Clean completions decrease score
const cleanCompletedSession = {
  ...freshSession,
  completedSections: [0, 1, 2, 3],
  practiceReport: {
    answered: [{ is_correct: true }, { is_correct: true }, { is_correct: true }],
    failed: [],
    masteredSections: [0, 1, 2],
  },
};
const cleanScore = computeSessionStruggleScore(cleanCompletedSession);
console.log("Clean Completed Session Struggle Score:", cleanScore);
if (cleanScore > 0.05) throw new Error("FAIL: Clean completions should decay struggle score near 0");

// 4d. Active REWIRE maintains floor >= 0.60
const rewireSession = {
  ...freshSession,
  rewireState: { active: true },
};
const rewireScore = computeSessionStruggleScore(rewireSession);
console.log("Rewire Session Struggle Score:", rewireScore);
if (rewireScore < 0.6) throw new Error("FAIL: Active REWIRE must have struggle score >= 0.60");

console.log("✓ computeSessionStruggleScore verification passed!");

console.log("ALL SCALE & SIGNALS TESTS PASSED! 🎉");

