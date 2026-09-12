# SCALE Struggle Reason Codes

## Overview

The `/api/struggle-score` endpoint now returns a `reason` field that explains **why** a learner is (or isn't) struggling. This enables the frontend to choose between different intervention strategies.

---

## Reason Codes Reference

### 🟢 Normal Engagement (No REWIRE)

| Code | Meaning | Frontend Action |
|------|---------|-----------------|
| `normal_engagement` | Learner appropriately engaged, dwell time within expected range | Continue normally, no intervention |
| `quick_completion` | Learner completed quickly (< 80% expected time) | Optional: offer challenge mode / skip ahead |

---

### 🟡 Elevated But Not Triggering (score < 0.6)

| Code | Meaning | Frontend Action |
|------|---------|-----------------|
| `elevated_dwell` | Slightly over expected time but not concerning | Monitor, no intervention yet |
| `rereading` | 1-2 rereads, but manageable | Normal behavior, no action |

---

### 🔴 Struggling (REWIRE Triggered, score >= 0.6)

#### Primary Signal: Dwell Time

| Code | Meaning | Intervention Strategy |
|------|---------|----------------------|
| `excessive_dwell_on_foundational` | **Critical:** Spending 3x+ time on basic/easy content | **Confusion** → Simplify heavily, add examples, break into smaller steps |
| `excessive_dwell` | Spending 2.5x+ expected time on any difficulty | **Confusion** → REWIRE with simplification level 2-3 |

#### Primary Signal: Multiple Indicators

| Code | Meaning | Intervention Strategy |
|------|---------|----------------------|
| `multiple_signals` | 3+ high signals (dwell + reread + help + quiz) | **Confusion** → Full REWIRE with visual aid, break into micro-chunks |

#### Primary Signal: Quiz Performance

| Code | Meaning | Intervention Strategy |
|------|---------|----------------------|
| `quiz_failure` | Answered quiz incorrectly | **Confusion** → Re-explain concept, generate easier follow-up quiz |
| `quiz_latency` | Took 2x+ expected time to answer | **Confusion** → Concept not clear, REWIRE with examples |

#### Primary Signal: Help Seeking

| Code | Meaning | Intervention Strategy |
|------|---------|----------------------|
| `help_requested` | Explicitly asked for help | **Confusion** → Respond to specific question, then REWIRE if needed |

#### Primary Signal: Rereading

| Code | Meaning | Intervention Strategy |
|------|---------|----------------------|
| `excessive_rereads` | Re-visited section 3+ times | **Possible distraction** → Could be confusion OR focus issues. Check webcam if available |

---

## Decision Tree for Frontend

```javascript
const { struggle_score, should_rewire, reason } = await fetchStruggleScore(...);

if (!should_rewire) {
  // Normal flow
  if (reason === "quick_completion") {
    showOptionalChallenge();
  }
  continueToNextSection();
  
} else {
  // REWIRE triggered
  switch (reason) {
    case "excessive_dwell_on_foundational":
      // CRITICAL: Basic content taking too long
      await triggerRewire({
        variant_level: 3,  // Maximum simplification
        actions: ["increase_simplification", "add_visual_description", "reduce_chunk_size"],
        struggle_explanation: "Struggling with fundamental concepts"
      });
      break;
      
    case "multiple_signals":
      // Confusion across multiple dimensions
      await triggerRewire({
        variant_level: 2,
        actions: ["increase_simplification", "add_visual_description"],
        struggle_explanation: "Multiple indicators of confusion"
      });
      break;
      
    case "quiz_failure":
      // Didn't understand the material
      await triggerRewire({
        variant_level: 2,
        actions: ["increase_simplification"],
        struggle_explanation: "Concept not understood (quiz failed)"
      });
      // Then generate an easier follow-up quiz
      await generateAdaptiveQuiz({ difficulty: "easier" });
      break;
      
    case "excessive_rereads":
      // Possible distraction vs confusion
      if (webcamAvailable) {
        // Check for distraction signals (looking away, etc.)
        const distracted = await checkWebcamDistraction();
        if (distracted) {
          showDistractionPrompt("Focus on the lesson");
        } else {
          await triggerRewire({ variant_level: 2 });
        }
      } else {
        // No webcam, assume confusion
        await triggerRewire({ variant_level: 2 });
      }
      break;
      
    case "help_requested":
      // Already answered question, but still struggling
      await triggerRewire({
        variant_level: 2,
        struggle_explanation: "Still confused after help request"
      });
      break;
      
    default:
      // Generic elevated struggle
      await triggerRewire({ variant_level: 2 });
  }
}
```

---

## Reason Code Distribution (Expected)

Based on typical learner behavior:

- **50%** — `normal_engagement` (most sections)
- **20%** — `quick_completion` (easy sections for strong learners)
- **15%** — `excessive_dwell` or `elevated_dwell` (normal variation)
- **10%** — `multiple_signals` (genuine confusion)
- **3%** — `excessive_dwell_on_foundational` (critical)
- **2%** — `quiz_failure`, `quiz_latency`, `help_requested`, `excessive_rereads`

If you see > 30% REWIRE triggers, consider:
1. Difficulty tagging may be inaccurate (all tagged "foundational")
2. Content is genuinely too hard for target audience
3. Threshold (0.6) may need adjustment

---

## Example API Response

```json
{
  "struggle_score": 1.05,
  "should_rewire": true,
  "components": {
    "dwell": 1.05,
    "reread": 0.0,
    "help": 0.0,
    "quiz_wrong": 0.0,
    "quiz_latency": 0.0
  },
  "threshold": 0.6,
  "reason": "excessive_dwell_on_foundational"
}
```

**Frontend interpretation:**
- Score is **1.05** (well above 0.6 threshold)
- Primary component is **dwell** (1.05 weighted contribution)
- Reason is **excessive_dwell_on_foundational** → learner struggling with basic content
- Action: Trigger maximum simplification (variant_level=3)

---

## Special Cases

### Distraction vs Confusion

The system cannot definitively distinguish between:
- **Distraction:** Learner looking away, doing other tasks (high dwell, low engagement)
- **Confusion:** Learner actively reading but not understanding (high dwell, high engagement)

**Recommendation:** If `reason === "excessive_rereads"`, use webcam data (if available) to detect:
- Looking away → distraction → prompt to focus
- Looking at screen → confusion → REWIRE

### False Positives

Reasons that might trigger incorrectly:
- **quick_completion** on advanced material → learner may have skipped/rushed
- **excessive_dwell** when learner paused to take notes → normal behavior, not struggle

**Mitigation:** Combine with quiz performance. If `quick_completion` but quiz is correct, learner genuinely understood. If `quiz_failure` follows `quick_completion`, learner rushed.

---

## Testing Your Integration

```javascript
// Test 1: Normal engagement
const test1 = await fetch('/api/struggle-score', {
  method: 'POST',
  body: JSON.stringify({
    actual_dwell_seconds: 80,
    expected_baseline_seconds: 60,
    expected_time_multiplier: 1.6,
    reread_count: 1,
    help_requested: false,
    quiz_incorrect: false,
    quiz_response_seconds: 25
  })
});
// Expected: should_rewire: false, reason: "normal_engagement"

// Test 2: Critical struggle on foundational
const test2 = await fetch('/api/struggle-score', {
  method: 'POST',
  body: JSON.stringify({
    actual_dwell_seconds: 180,
    expected_baseline_seconds: 60,
    expected_time_multiplier: 1.0,  // Foundational
    reread_count: 0,
    help_requested: false,
    quiz_incorrect: false
  })
});
// Expected: should_rewire: true, reason: "excessive_dwell_on_foundational"

// Test 3: Multiple signals
const test3 = await fetch('/api/struggle-score', {
  method: 'POST',
  body: JSON.stringify({
    actual_dwell_seconds: 150,
    expected_baseline_seconds: 60,
    expected_time_multiplier: 1.6,
    reread_count: 2,
    help_requested: true,
    quiz_incorrect: true,
    quiz_response_seconds: 45
  })
});
// Expected: should_rewire: true, reason: "multiple_signals"
```

---

## Future Enhancements

1. **Sub-reasons:** `"excessive_dwell_on_foundational_with_help"` (more specific)
2. **Confidence scores:** `{ reason: "quiz_failure", confidence: 0.95 }`
3. **Historical context:** `reason: "repeated_struggle_same_concept"` (across sessions)
4. **Learner-specific baselines:** Adjust for known slow/fast readers

---

## Support

- **Full docs:** See `SCALE_README.md`
- **Code:** `app/services/scale.py::_determine_struggle_reason()`
- **Tests:** `test_struggle_score.py`
- **Questions:** Check inline comments in `scale.py`
