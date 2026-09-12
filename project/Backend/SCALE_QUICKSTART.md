# SCALE Quick Start Guide

## 5-Minute Setup

### 1. Verify Installation

```bash
cd project/Backend

# Check all files compile
python -m py_compile app/services/scale.py
python -m py_compile app/schemas.py
python -m py_compile app/main.py

# Run unit tests
python test_struggle_score.py
```

**Expected:** All checks pass ✓

---

### 2. Test Difficulty Tagging

```bash
python demo_difficulty_tagging.py
```

**Expected:** Sample lesson tagged with difficulty tiers

---

### 3. Start Backend

```bash
uvicorn app.main:app --reload
```

**Expected:** Server starts on http://127.0.0.1:8000

---

### 4. Test New Endpoints

#### Tag Difficulty
```bash
curl -X POST http://localhost:8000/api/tag-difficulty \
  -H "Content-Type: application/json" \
  -d '{"text": "Photosynthesis is the process by which plants make food using sunlight."}'
```

#### Compute Struggle Score
```bash
curl -X POST http://localhost:8000/api/struggle-score \
  -H "Content-Type: application/json" \
  -d '{
    "actual_dwell_seconds": 180,
    "expected_baseline_seconds": 60,
    "expected_time_multiplier": 1.0,
    "reread_count": 0,
    "help_requested": false,
    "quiz_incorrect": false
  }'
```

**Expected:** JSON responses with difficulty metadata and struggle scores

---

### 5. Test with Frontend (Optional)

```bash
# Terminal 1: Backend
cd project/Backend
uvicorn app.main:app --reload

# Terminal 2: Frontend
cd project/Frontend
npm run dev
```

Open http://localhost:5173 and:
1. Upload a document
2. Complete a section
3. Check browser console for struggle score logs (if implemented)

---

## Key Files

| File | Purpose |
|------|---------|
| `app/services/scale.py` | Core SCALE logic |
| `test_struggle_score.py` | Unit tests |
| `demo_difficulty_tagging.py` | Integration demo |
| `SCALE_README.md` | Full documentation |
| `SCALE_IMPLEMENTATION_SUMMARY.md` | Executive summary |

---

## Configuration

Edit `app/services/scale.py` (lines 15-37):

```python
# Adjust difficulty multipliers
DIFFICULTY_MULTIPLIERS = {
    "foundational": 1.0,
    "intermediate": 1.6,
    "advanced": 2.5,
}

# Adjust struggle score weights
WEIGHT_DWELL = 0.35
WEIGHT_REREAD = 0.25
WEIGHT_HELP = 0.15
WEIGHT_QUIZ_WRONG = 0.15
WEIGHT_QUIZ_LATENCY = 0.10

# Adjust REWIRE threshold
REWIRE_THRESHOLD = 0.6
```

---

## Troubleshooting

### Backend won't start

```bash
# Check Python version (requires 3.9+)
python --version

# Install dependencies
pip install -r requirements.txt

# Check for syntax errors
python -m py_compile app/services/scale.py
```

### Tests fail

```bash
# Check imports
python -c "from app.services.scale import compute_struggle_score; print('OK')"

# Check environment
python -c "import sys; print(sys.path)"
```

### LLM tagging not working

Check `.env` file has:
```
GROQ_KEY=...
# OR
VISUAL_GROQ_API_KEY=...
```

**Note:** Fallback still works without LLM keys (tags everything "intermediate")

---

## Next Steps

1. ✅ **Done:** Core SCALE implementation
2. 🔄 **Optional:** Frontend integration (compute struggle scores client-side)
3. 🔄 **Optional:** Caching layer (Redis/memory cache for difficulty sections)
4. 🔄 **Optional:** Analytics dashboard (track struggle scores over time)
5. 🔄 **Optional:** ML-based difficulty prediction (train on learner outcomes)

---

## Support

- **Technical docs:** See `SCALE_README.md`
- **Architecture:** See `SCALE_IMPLEMENTATION_SUMMARY.md`
- **Code comments:** Inline in Python files
- **Tests:** Run `python test_struggle_score.py`

---

## Quick Reference

### Endpoints

- `POST /api/tag-difficulty` — Tag lesson sections (one-time)
- `POST /api/struggle-score` — Compute normalized score (real-time)
- `POST /api/pipeline` — Extended with `tag_difficulty` parameter

### Key Functions

- `tag_section_difficulty(text)` — LLM-based tagging with fallback
- `compute_struggle_score(...)` — Normalized score computation
- `should_trigger_rewire(score)` — Threshold check

### Constants

- `DIFFICULTY_MULTIPLIERS` — Time adjustments per tier
- `WEIGHT_*` — Struggle score component weights
- `REWIRE_THRESHOLD` — Intervention trigger (0.6)

---

That's it! SCALE is ready to use. 🚀
