# PRISM — Team Plan

---

## Team Structure

| Member | Role | Focus Area |
|--------|------|------------|
| **M1** | AI + Content Intelligence | Extraction, LLM structuring, caching, content variants |
| **M2** | SCALE + Adaptive Intelligence | Signal processing, struggle score, adaptation rules, SCALE engine |
| **M3** | Frontend + Accessibility + REWIRE | UI components, accessible reader, REWIRE visual behavior |
| **M4** | Assessment + Voice + Integration + QA | Questions, voice STT/TTS, session progress, end-to-end integration |

---

## M1 — AI + Content Intelligence

### Responsibilities
- PDF text extraction (PDF.js + Tesseract.js OCR fallback)
- Text cleaning and normalization
- LLM content structuring (raw text → sections → concepts)
- LLM simplification (3 levels per concept)
- LLM visual description generation (per concept)
- Fact-preservation validation
- SQLite caching of all LLM outputs
- System prompt engineering and iteration

### Deliverables
1. `POST /api/upload` endpoint (extraction + structuring + caching)
2. `GET /api/content/:documentId` endpoint (serve cached content graph)
3. `GET /api/content/:documentId/variant` endpoint (serve cached variant)
4. All system prompts (see `06-AI-RULES-AND-SYSTEM-PROMPTS.md`)
5. SQLite schema initialization (documents, sections, concepts, content_variants tables)
6. Extraction skill module
7. Cleaning skill module
8. Structuring skill module
9. Simplification skill module
10. Fact-preservation skill module

### Owned Folders
```
server/
  routes/upload.js
  routes/content.js
  skills/extraction/
  skills/cleaning/
  skills/structuring/
  skills/simplification/
  skills/fact-preservation/
  prompts/
  db/schema.sql (documents, sections, concepts, content_variants tables)
```

### Dependencies
- **Needs from M4:** SQLite database initialization helper
- **Needs from M2:** None (M1 is upstream of M2)
- **Needs from M3:** None (M1 is upstream of M3)

### Handoffs
- **To M3 (Hour 6):** Content graph JSON structure (so frontend can render)
- **To M4 (Hour 6):** Question generation endpoint available
- **To M2 (Hour 4):** Content variant structure documented (so SCALE can reference levels)

---

## M2 — SCALE + Adaptive Intelligence

### Responsibilities
- Signal normalization pipeline
- Struggle score computation
- Threshold-based adaptation rules
- Cooldown mechanism
- Adaptation loop prevention
- Adaptation history tracking
- Adaptation explanation generation (template-based)
- SCALE evaluation endpoint
- Outcome measurement logic

### Deliverables
1. `POST /api/scale/evaluate` endpoint
2. Signal processing skill module
3. Adaptation reasoning skill module
4. SCALE configuration constants
5. Normalization functions
6. Struggle score computation
7. Adaptation strategy selection
8. Cooldown and loop prevention
9. Outcome measurement function

### Owned Folders
```
server/
  routes/scale.js
  skills/signal-processing/
  skills/adaptation-reasoning/
  config/scale-config.js

client/
  hooks/useScale.js          (optional: client-side SCALE)
  skills/signal-processing/  (client-side copy)
  skills/adaptation-reasoning/
```

### Dependencies
- **Needs from M1:** Content variant level structure (to know what levels exist)
- **Needs from M4:** Signal data shape (learner_signals schema)
- **Needs from M3:** Raw signal capture events (dwell time, rereads, etc.)

### Handoffs
- **To M3 (Hour 8):** SCALE evaluate API contract finalized, can be called from frontend
- **To M4 (Hour 10):** Outcome measurement function available for integration

---

## M3 — Frontend + Accessibility + REWIRE

### Responsibilities
- Upload/paste UI
- Learner profile selector and editor
- Accessible reader component
- Typography and color scheme application
- Chunk navigation (prev/next, progress bar)
- Read-aloud controls (play/pause/stop via TTS)
- Signal capture (dwell time, rereads, scroll-backs)
- REWIRE visual transition (fade-out, banner, fade-in)
- Keyboard navigation
- Focus management
- ARIA labels
- Reduced-motion support
- Responsive layout

### Deliverables
1. Upload page component
2. Profile selector component
3. Reader component (renders adapted content)
4. Chunk navigation component
5. Read-aloud controls component
6. REWIRE banner component
7. REWIRE transition animation
8. Question display component
9. Answer feedback component
10. Progress bar component
11. Keyboard navigation handler
12. Signal capture hooks (useSignalCapture)
13. Design tokens (CSS variables)
14. Accessible component library

### Owned Folders
```
client/
  src/
    components/
      Upload/
      ProfileSelector/
      Reader/
      ChunkNavigation/
      ReadAloud/
      RewireBanner/
      QuestionDisplay/
      AnswerFeedback/
      ProgressBar/
      VoiceButton/    (shared with M4)
    hooks/
      useSignalCapture.js
      useKeyboardNav.js
      useReadAloud.js
    styles/
      design-tokens.css
      reader.css
      rewire.css
      accessibility.css
    pages/
      UploadPage.jsx
      ReaderPage.jsx
```

### Dependencies
- **Needs from M1 (Hour 6):** Content graph JSON structure
- **Needs from M2 (Hour 8):** SCALE evaluate API response shape
- **Needs from M4 (Hour 6):** Question JSON structure
- **Needs from M4 (Hour 8):** Voice button and TTS/STT integration

### Handoffs
- **To M2 (Hour 8):** Raw signal events emitted from frontend (dwell time, rereads)
- **To M4 (Hour 10):** UI components ready for integration testing

---

## M4 — Assessment + Voice + Integration + QA

### Responsibilities
- Question generation endpoint (calls M1's LLM, caches results)
- Answer verification and scoring
- Voice STT integration (Web Speech Recognition API)
- Voice TTS integration (Web Speech Synthesis API)
- Voice intent routing
- Session progress tracking
- Learner profile CRUD endpoints
- End-to-end integration
- Golden-path testing
- Demo smoke test

### Deliverables
1. `POST /api/voice/intent` endpoint
2. `POST /api/session/progress` endpoint
3. `POST /api/profile` endpoint
4. `GET /api/profile/:profileId` endpoint
5. `GET /api/health` endpoint
6. Voice intent router module
7. STT integration hook (useVoiceInput)
8. TTS integration hook (useVoiceOutput)
9. Session progress tracking module
10. Answer verification module
11. SQLite schema for sessions, signals, answers, progress tables
12. Integration tests
13. Golden-path fixture test
14. Demo smoke test

### Owned Folders
```
server/
  routes/voice.js
  routes/session.js
  routes/profile.js
  routes/health.js
  skills/questions/
  skills/voice-intent/
  db/schema.sql (sessions, signals, answers, progress tables)

client/
  src/
    hooks/
      useVoiceInput.js
      useVoiceOutput.js
    components/
      VoiceButton/
```

### Dependencies
- **Needs from M1 (Hour 6):** LLM question generation function
- **Needs from M2 (Hour 8):** SCALE evaluate API contract
- **Needs from M3 (Hour 8):** UI components ready for voice button integration

### Handoffs
- **To M3 (Hour 6):** Question JSON structure available
- **To All (Hour 14):** Integration checkpoint — all endpoints connected

---

## Shared JSON Contracts

To unblock parallel work, these contracts are agreed upon before coding starts:

### Content Graph Shape (M1 → M3)
```json
{
  "documentId": "string",
  "title": "string",
  "sections": [{
    "sectionId": "string",
    "title": "string",
    "concepts": [{
      "conceptId": "string",
      "originalText": "string",
      "variants": [{ "level": 1, "simplifiedText": "string", "visualDescription": "string" }],
      "questions": [{ "questionId": "string", "text": "string", "type": "string", "options": [], "correctOptionId": "string" }]
    }]
  }]
}
```

### Signal Shape (M3 → M2)
```json
{
  "dwellTime": "number (ms)",
  "rereadCount": "number",
  "scrollBack": "number",
  "helpRequests": "number",
  "questionAccuracy": "number (0–1)",
  "answerLatency": "number (ms)",
  "retryCount": "number",
  "voiceHelpRequests": "number"
}
```

### SCALE Response Shape (M2 → M3)
```json
{
  "shouldAdapt": "boolean",
  "struggleScore": "number (0–1)",
  "adaptationStrategy": {
    "newVariantLevel": "number",
    "additionalActions": ["string"]
  },
  "explanation": "string"
}
```

These contracts are frozen at Hour 2. Changes require updating `04-API-CONTRACT.md` and notifying all members.
