# SCALE Reason Field Update

## What Changed

Added a `reason` field to the `/api/struggle-score` response that explains **why** a learner is (or isn't) struggling. This enables the frontend to choose appropriate intervention strategies.

---

## Updated API Response

### Before
```json
{
  "struggle_score": 1.05,
  "should_rewire": true,
  "components": { ... },
  "threshold": 0.6
}
```

### After ✓
```json
{
  "struggle_score": 1.05,
  "should_rewire": true,
  "components": { ... },
  "threshold": 0.6,
  "reason": "excessive_dwell_on_foundational"  // NEW
}
```

---

## Reason Codes

### When NOT Struggling
- `"normal_engagement"` — Appropriate engagement
- `"quick_completion"` — Completed quickly

### When Struggling (REWIRE Triggered)
- `"excessive_dwell_on_foundational"` — **Critical:** 3x time on basic content
- `"excessive_dwell"` — 2.5x+ time on any difficulty
- `"multiple_signals"` — 3+ high indicators (confusion)
- `"quiz_failure"` — Answered incorrectly
- `"quiz_latency"` — Slow quiz response
- `"help_requested"` — Explicitly asked for help
- `"excessive_rereads"` — 3+ re-visits (possible distraction)
- `"elevated_struggle"` — Generic elevated score

---

## Frontend Usage

```javascript
const { should_rewire, reason } = await fetchStruggleScore(...);

if (should_rewire) {
  if (reason === "excessive_dwell_on_foundational") {
    // CRITICAL: Basic concepts taking too long
    await triggerRewire({
      variant_level: 3,  // Max simplification
      actions: ["increase_simplification", "add_visual_description"]
    });
  } 
  else if (reason === "multiple_signals") {
    // Confusion across multiple dimensions
    await triggerRewire({
      variant_level: 2,
      actions: ["increase_simplification", "add_visual_description"]
    });
  }
  else if (reason === "excessive_rereads") {
    // Check webcam for distraction vs confusion
    const distracted = await checkWebcam();
    if (distracted) {
      showFocusPrompt();
    } else {
      await triggerRewire({ variant_level: 2 });
    }
  }
  else {
    // Generic REWIRE
    await triggerRewire({ variant_level: 2 });
  }
}
```

---

## Key Decisions Enabled

### Confusion vs Distraction
- **`excessive_dwell_on_foundational`** → Definitely confusion (basic content)
- **`multiple_signals`** → Definitely confusion (3+ indicators)
- **`excessive_rereads`** → Could be either (check webcam)

### Simplification Level
- **`excessive_dwell_on_foundational`** → variant_level=3 (maximum)
- **`multiple_signals`** → variant_level=2 (strong)
- **Others** → variant_level=2 (moderate)

### Visual Aids
- **`multiple_signals`** → Always add visual description
- **`quiz_failure`** → Optional visual
- **Others** → Text simplification only

---

## Files Modified

| File | Change |
|------|--------|
| `app/schemas.py` | Added `reason: str` to `StruggleScoreResponse` |
| `app/services/scale.py` | Added `_determine_struggle_reason()` function (70 lines) |
| `app/services/scale.py` | Updated `compute_struggle_score()` to return reason |
| `app/main.py` | Updated endpoint to return reason |
| `test_struggle_score.py` | Updated to validate reason field |
| `demo_difficulty_tagging.py` | Updated to display reason |

---

## Test Results

```
✓ Foundational 3x → reason: "excessive_dwell_on_foundational"
✓ Advanced 1.2x → reason: "normal_engagement"  
✓ Multiple signals → reason: "multiple_signals"
✓ Normal engagement → reason: "normal_engagement"
```

All tests pass ✓

---

## Backwards Compatibility

✅ **100% backwards compatible**
- New field is additive
- Old clients can ignore the `reason` field
- No breaking changes

---

## Documentation

- **Reason code reference:** `REASON_CODES.md` (detailed guide for frontend)
- **Technical implementation:** `app/services/scale.py` lines 180-250
- **Test cases:** `test_struggle_score.py`

---

## Summary

The struggle score response now includes **explicit reasoning** that enables the frontend to:
1. Distinguish confusion from distraction
2. Choose appropriate simplification levels
3. Decide when to add visual aids
4. Make informed intervention decisions

**Status:** ✅ Complete and tested
