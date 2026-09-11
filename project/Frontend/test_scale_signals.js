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

console.log("ALL SCALE & SIGNALS TESTS PASSED! 🎉");
