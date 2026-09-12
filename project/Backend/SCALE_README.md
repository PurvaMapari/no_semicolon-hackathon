# SCALE — Struggle-aware Content Adaptation Logic Engine

## Overview

SCALE is PRISM's difficulty-aware struggle detection system that normalizes learner behavior signals against section difficulty to accurately identify when adaptive intervention (REWIRE) is needed.

**Problem solved:** The previous flat dwell-time threshold couldn't distinguish "learner struggling with easy material" from "learner spending appropriate time on hard material."

**Solution:** Tag content with difficulty tiers at ingestion, then normalize all learner signals against difficulty-adjusted baselines.

---

## Architecture

### 1. Difficulty Tagging (One-time, cached)

**When:** At document ingestion time, before transformation  
**Where:** `app/services/scale.py::tag_section_difficulty()`  
**Triggered by:** `/api/pipeline` with `tag_difficulty=true` (default)

Each section receives:
- `difficulty_tier`: "foundational" | "intermediate" | "advanced"
- `expected_time_multiplier`: 1.0 / 1.6 / 2.5
- `expected_baseline_seconds`: Based on word count ÷ 200 WPM
- `rationale`: 1-sentence explanation (for debugging/tooltips)
- `word_count`: Integer

**LLM Prompt:** Analyzes lesson structure and assigns tiers based on:
- Foundational: Basic concepts, definitions, simple examples
- Intermediate: Builds on foundations, requires applying knowledge
- Advanced: Complex reasoning, abstract concepts, integrated ideas

**Fallback:** If LLM unavailable/fails → all sections tagged "intermediate" (graceful degradation)

**Caching:** Results stored per document ID — never re-runs per learner

---

### 2. Struggle Score Computation (Real-time)

**When:** After learner completes a section  
**Where:** `app/services/scale.py::compute_struggle_score()`  
**Triggered by:** Frontend sends signals to `/api/struggle-score`

**Normalized Formula:**

```
dwell_ratio = actual_seconds / (baseline_seconds * difficulty_multiplier)

struggle_score = 
    0.35 × dwell_ratio
  + 0.25 × normalized_reread_count
  + 0.15 × help_request_flag
  + 0.15 × quiz_incorrect_flag
  + 0.10 × quiz_latency_ratio
```

**Weights** (configurable in `scale.py`):
- `WEIGHT_DWELL = 0.35` — Time spent vs. expected
- `WEIGHT_REREAD = 0.25` — Re-visiting behavior
- `WEIGHT_HELP = 0.15` — Help/question requests
- `WEIGHT_QUIZ_WRONG = 0.15` — Quiz performance
- `WEIGHT_QUIZ_LATENCY = 0.10` — Quiz response speed

**Threshold:**
- `REWIRE_THRESHOLD = 0.6` — Trigger adaptive intervention

**Key insight:** A learner spending 3x time on FOUNDATIONAL content scores **higher** than spending 1.2x time on ADVANCED content, correctly prioritizing intervention.

---

## API Endpoints

### POST `/api/tag-difficulty`

Tag a lesson with difficulty metadata (one-time operation).

**Request:**
```json
{
  "text": "full lesson text..."
}
```

**Response:**
```json
{
  "sections": [
    {
      "text": "section text preview...",
      "difficulty_tier": "foundational",
      "expected_time_multiplier": 1.0,
      "expected_baseline_seconds": 45.0,
      "rationale": "Introduces basic definitions with simple examples",
      "word_count": 150
    },
    {
      "text": "next section...",
      "difficulty_tier": "advanced",
      "expected_time_multiplier": 2.5,
      "expected_baseline_seconds": 60.0,
      "rationale": "Requires integrating multiple abstract concepts",
      "word_count": 200
    }
  ]
}
```

---

### POST `/api/struggle-score`

Compute normalized struggle score for a learner on a section.

**Request:**
```json
{
  "actual_dwell_seconds": 120.0,
  "expected_baseline_seconds": 60.0,
  "expected_time_multiplier": 1.6,
  "reread_count": 2,
  "help_requested": true,
  "quiz_incorrect": false,
  "quiz_response_seconds": 45.0,
  "expected_quiz_seconds": 30.0
}
```

**Response:**
```json
{
  "struggle_score": 0.847,
  "should_rewire": true,
  "components": {
    "dwell": 0.438,
    "reread": 0.167,
    "help": 0.150,
    "quiz_wrong": 0.000,
    "quiz_latency": 0.150
  },
  "threshold": 0.6
}
```

---

### POST `/api/pipeline` (Extended)

Now includes difficulty tagging by default.

**Request:**
```json
{
  "text": "lesson content...",
  "profiles": ["cognitive_load", "dyslexia"],
  "quiz_limit": 3,
  "tag_difficulty": true
}
```

**Response:**
```json
{
  "cognitive_load": {
    "transformed": { /* ... */ },
    "quiz_count": 3,
    "quizzes": [ /* ... */ ]
  },
  "dyslexia": { /* ... */ },
  "difficulty_sections": [
    {
      "text": "...",
      "difficulty_tier": "intermediate",
      "expected_time_multiplier": 1.6,
      "expected_baseline_seconds": 48.0,
      "rationale": "...",
      "word_count": 160
    }
  ]
}
```

---

## Configuration Constants

All configurable in `app/services/scale.py`:

```python
# Difficulty time multipliers
DIFFICULTY_MULTIPLIERS = {
    "foundational": 1.0,
    "intermediate": 1.6,
    "advanced": 2.5,
}

# Reading speed for baseline calculation
AVERAGE_READING_SPEED_WPM = 200

# Struggle score weights (must sum to 1.0)
WEIGHT_DWELL = 0.35
WEIGHT_REREAD = 0.25
WEIGHT_HELP = 0.15
WEIGHT_QUIZ_WRONG = 0.15
WEIGHT_QUIZ_LATENCY = 0.10

# REWIRE trigger threshold
REWIRE_THRESHOLD = 0.6
```

---

## Testing

### Run Unit Tests

```bash
cd project/Backend
python test_struggle_score.py
```

**Expected output:** All 4 validation checks pass ✓

### Run Difficulty Tagging Demo

```bash
cd project/Backend
python demo_difficulty_tagging.py
```

**Expected output:** Sample lesson tagged with difficulty tiers, struggle scores computed

---

## Integration with Existing Endpoints

### No Breaking Changes

- `/api/rewire` — unchanged request/response contracts
- `/api/adaptive-quiz` — unchanged contracts
- Struggle score computation is **internal** — frontend can optionally call `/api/struggle-score` or compute client-side

### Frontend Integration Pattern

```javascript
// 1. On document upload, get difficulty metadata
const pipelineResponse = await fetch('/api/pipeline', {
  method: 'POST',
  body: JSON.stringify({
    text: lessonText,
    profiles: [selectedProfile],
    tag_difficulty: true
  })
});

const data = await pipelineResponse.json();
const difficultySections = data.difficulty_sections;

// Store per document (one-time)
sessionStorage.setItem(`difficulty_${docId}`, JSON.stringify(difficultySections));

// 2. When learner completes a section, compute struggle score
const section = difficultySections[currentSectionIndex];

const scoreResponse = await fetch('/api/struggle-score', {
  method: 'POST',
  body: JSON.stringify({
    actual_dwell_seconds: timeSpentOnSection,
    expected_baseline_seconds: section.expected_baseline_seconds,
    expected_time_multiplier: section.expected_time_multiplier,
    reread_count: numRereads,
    help_requested: didAskQuestion,
    quiz_incorrect: quizWasWrong,
    quiz_response_seconds: quizResponseTime
  })
});

const scoreData = await scoreResponse.json();

// 3. Trigger REWIRE if needed
if (scoreData.should_rewire) {
  await fetch('/api/rewire', {
    method: 'POST',
    body: JSON.stringify({
      chunk_text: currentSectionText,
      profile: selectedProfile,
      variant_level: 2,
      struggle_explanation: `Struggled with ${section.difficulty_tier} section`
    })
  });
}
```

---

## Acceptance Criteria ✓

### ✓ 1. Different sections get different multipliers

Upload a lesson with simple and complex sections → different `expected_time_multiplier` values.

**Validation:** See `demo_difficulty_tagging.py` output

### ✓ 2. Normalization works correctly

Spending 3x time on FOUNDATIONAL produces **higher** struggle score than 1.2x on ADVANCED.

**Validation:**
- `test_struggle_score.py` — CHECK 1: PASS ✓
- Score: 1.050 (foundational) > 0.420 (advanced)

### ✓ 3. LLM failure doesn't break pipeline

If tagging call fails → all sections default to "intermediate", pipeline continues.

**Validation:**
- `scale.py::tag_section_difficulty()` has try/except fallback
- `demo_difficulty_tagging.py` demonstrates fallback behavior

### ✓ 4. Test script demonstrates normalization

Synthetic signal sets show correct behavior.

**Validation:** Run `python test_struggle_score.py` → All checks pass ✓

---

## Files Modified

### New Files

- `app/services/scale.py` — Core SCALE logic (320 lines)
- `test_struggle_score.py` — Unit tests (220 lines)
- `demo_difficulty_tagging.py` — Integration demo (100 lines)
- `SCALE_README.md` — This documentation

### Modified Files

- `app/schemas.py` — Added `DifficultySection`, `StruggleScoreRequest/Response`
- `app/services/learning.py` — Extended `run_pipeline()` to call difficulty tagging
- `app/main.py` — Added `/api/struggle-score` and `/api/tag-difficulty` endpoints

### No Breaking Changes

- All existing endpoints preserve their contracts
- Difficulty tagging is opt-in via `tag_difficulty` parameter
- Frontend can ignore new fields for backwards compatibility

---

## Performance Considerations

### LLM Calls

- **Difficulty tagging:** 1 call per document (cached)
- **Struggle score:** 0 calls (pure computation)

### Caching Strategy

```python
# Pseudo-code for production caching
@cache(key=lambda text: hash(text), ttl=86400)  # 24h
def tag_section_difficulty(text: str):
    # ... tagging logic
```

Recommend caching by `hash(text)` or document ID in production.

---

## Troubleshooting

### Issue: All sections tagged "intermediate"

**Cause:** LLM tagging unavailable or failed  
**Solution:** This is expected fallback behavior. Check:
1. `GROQ_API_KEY` is set in `.env`
2. LLM service is reachable
3. Check logs for tagging errors

### Issue: Struggle scores seem too high/low

**Cause:** Weights may need tuning for your learner population  
**Solution:** Adjust constants in `scale.py`:
```python
WEIGHT_DWELL = 0.35  # Increase if dwell time is most important
WEIGHT_REREAD = 0.25  # Increase if re-reading is key signal
# etc.
```

### Issue: REWIRE triggering too frequently

**Cause:** Threshold too low  
**Solution:** Increase `REWIRE_THRESHOLD` in `scale.py`:
```python
REWIRE_THRESHOLD = 0.7  # Was 0.6
```

---

## Future Enhancements

1. **Learner-specific baselines:** Adjust WPM based on historical learner speed
2. **Time-of-day factors:** Account for fatigue (evening → higher expected time)
3. **Section interdependencies:** Tag prerequisite relationships
4. **Confidence scores:** Return LLM confidence in difficulty tagging
5. **A/B test framework:** Test different weight combinations

---

## References

- Original REWIRE implementation: `app/services/learning.py::rewire_content()`
- Adaptive quiz logic: `app/services/learning.py::generate_adaptive_quiz()`
- SCALE constants: `app/services/scale.py` lines 15-37
