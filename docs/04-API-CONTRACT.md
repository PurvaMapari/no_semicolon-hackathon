# PRISM — API Contract

**Version:** 2.0 (SCALE/REWIRE Architecture)
**Status:** Authoritative contract between Frontend (M3) and Backend (M1, M2, M4).
**Rule:** Agents MUST read this file before changing any request/response structure.

---

## Endpoint Summary

| # | Method | Path | Purpose | Owner | Latency | Dependencies |
|---|--------|------|---------|-------|---------|-------------|
| 1 | POST | `/api/upload` | Upload document, extract text, structure content, cache | M1 | 5–15s | PDF.js, Tesseract.js, LLM, SQLite |
| 2 | GET | `/api/content/:documentId` | Retrieve structured content graph + variants | M1 | <100ms | SQLite |
| 3 | POST | `/api/profile` | Create or update learner profile | M4 | <50ms | SQLite |
| 4 | GET | `/api/profile/:profileId` | Retrieve learner profile | M4 | <50ms | SQLite |
| 5 | POST | `/api/scale/evaluate` | Submit signals, get adaptation decision | M2 | <50ms | Deterministic (no LLM) |
| 6 | GET | `/api/content/:documentId/variant` | Retrieve specific cached content variant | M1 | <100ms | SQLite |
| 7 | POST | `/api/voice/intent` | Process voice intent, return action | M4 | <100ms | Deterministic |
| 8 | POST | `/api/session/progress` | Save or retrieve session progress | M4 | <50ms | SQLite |
| 9 | GET | `/api/health` | Health check | All | <10ms | — |

---

## 1. POST /api/upload

**Owner:** M1 (AI + Content Intelligence)

**Purpose:** Accept a document (PDF file or raw text), extract text, structure into content graph via LLM, pre-generate all variants/questions, cache everything.

**Expected Latency:** 5–15 seconds (LLM processing + caching)

**Dependencies:** PDF.js, Tesseract.js (OCR fallback), OpenAI GPT-4o-mini, SQLite

### Request

**Content-Type:** `multipart/form-data` (for PDF) or `application/json` (for text)

#### PDF Upload
```
POST /api/upload
Content-Type: multipart/form-data

file: <PDF binary>
```

#### Text Paste
```json
POST /api/upload
Content-Type: application/json

{
  "text": "The Industrial Revolution was a period of human history...",
  "title": "The Industrial Revolution"
}
```

### Response (Success)

```json
{
  "success": true,
  "documentId": "doc_a1b2c3d4",
  "title": "The Industrial Revolution",
  "extraction": {
    "method": "pdfjs",
    "characterCount": 3450,
    "ocrFallback": false
  },
  "structure": {
    "sectionCount": 3,
    "conceptCount": 8,
    "variantsPerConcept": 3,
    "questionsPerConcept": 3
  },
  "timestamp": "2026-09-11T14:00:00.000Z"
}
```

### Response (Partial Failure — LLM failed, deterministic fallback used)

```json
{
  "success": true,
  "documentId": "doc_a1b2c3d4",
  "title": "Untitled Document",
  "extraction": {
    "method": "pdfjs",
    "characterCount": 3450,
    "ocrFallback": false
  },
  "structure": {
    "sectionCount": 1,
    "conceptCount": 1,
    "variantsPerConcept": 1,
    "questionsPerConcept": 1
  },
  "warnings": ["LLM structuring failed — using raw text as single concept with no variants"],
  "fallbackApplied": true,
  "timestamp": "2026-09-11T14:00:00.000Z"
}
```

### Errors

| Code | Condition | Response |
|------|-----------|----------|
| 400 | No file or text provided | `{ "success": false, "error": "No document provided. Upload a PDF or paste text." }` |
| 400 | PDF too large (>10MB) | `{ "success": false, "error": "File exceeds 10MB limit." }` |
| 400 | Text too long (>25000 chars) | `{ "success": false, "error": "Text exceeds 25,000 character limit." }` |
| 422 | PDF extraction failed entirely | `{ "success": false, "error": "Could not extract text from PDF. Try pasting text instead." }` |
| 500 | Server error | `{ "success": false, "error": "Internal server error." }` |

---

## 2. GET /api/content/:documentId

**Owner:** M1 (AI + Content Intelligence)

**Purpose:** Retrieve the full structured content graph for a document, including all cached variants and questions.

**Expected Latency:** <100ms (SQLite read)

**Dependencies:** SQLite

### Request

```
GET /api/content/doc_a1b2c3d4
```

### Response

```json
{
  "success": true,
  "documentId": "doc_a1b2c3d4",
  "title": "The Industrial Revolution",
  "sections": [
    {
      "sectionId": "sec_001",
      "title": "Historical Context",
      "sequenceNumber": 1,
      "concepts": [
        {
          "conceptId": "con_001",
          "originalText": "The Industrial Revolution was a period of human history marked by the transition from hand production methods to machines...",
          "sequenceNumber": 1,
          "variants": [
            {
              "level": 1,
              "simplifiedText": "The Industrial Revolution was a time when people stopped making things by hand and started using machines.",
              "visualDescription": "Picture a timeline: on the left, people making things by hand in small workshops. On the right, large factories with steam-powered machines. An arrow shows the change from hand-made to machine-made.",
              "strategy": "vocabulary_replacement + sentence_shortening"
            },
            {
              "level": 2,
              "simplifiedText": "Long ago, people made everything by hand. Then machines were invented. This big change is called the Industrial Revolution.",
              "visualDescription": "Two pictures side by side: 1) A person sewing clothes by hand. 2) A big machine in a factory making many clothes at once.",
              "strategy": "aggressive_simplification + chunking"
            },
            {
              "level": 3,
              "simplifiedText": "People used to make things by hand. Then machines came. This change was very important.",
              "visualDescription": "Hand → Machine. This was a big change.",
              "strategy": "maximum_simplification"
            }
          ],
          "questions": [
            {
              "questionId": "q_con001_a",
              "text": "What was the Industrial Revolution?",
              "type": "multiple_choice",
              "options": [
                { "id": "opt_1", "text": "A time when machines replaced hand-made work" },
                { "id": "opt_2", "text": "A war between countries" },
                { "id": "opt_3", "text": "The invention of computers" },
                { "id": "opt_4", "text": "A movement to stop factories" }
              ],
              "correctOptionId": "opt_1",
              "explanation": "The Industrial Revolution was when people started using machines instead of making things by hand."
            },
            {
              "questionId": "q_con001_b",
              "text": "The Industrial Revolution changed how people made things.",
              "type": "true_false",
              "options": [
                { "id": "opt_true", "text": "True" },
                { "id": "opt_false", "text": "False" }
              ],
              "correctOptionId": "opt_true",
              "explanation": "Yes — people went from hand production to machine production."
            },
            {
              "questionId": "q_con001_c",
              "text": "Before the Industrial Revolution, how were most things made?",
              "type": "multiple_choice",
              "options": [
                { "id": "opt_1", "text": "By machines" },
                { "id": "opt_2", "text": "By hand" },
                { "id": "opt_3", "text": "By robots" },
                { "id": "opt_4", "text": "They were not made" }
              ],
              "correctOptionId": "opt_2",
              "explanation": "Before the Industrial Revolution, most things were made by hand."
            }
          ]
        }
      ]
    }
  ],
  "timestamp": "2026-09-11T14:00:00.000Z"
}
```

### Errors

| Code | Condition | Response |
|------|-----------|----------|
| 404 | Document not found | `{ "success": false, "error": "Document not found." }` |

---

## 3. POST /api/profile

**Owner:** M4 (Assessment + Voice + Integration)

**Purpose:** Create or update a learner profile.

**Expected Latency:** <50ms

**Dependencies:** SQLite

### Request

```json
{
  "profileId": "profile_abc123",
  "profileType": "dyslexia",
  "typography": {
    "fontFamily": "'OpenDyslexic', 'Arial', sans-serif",
    "fontSize": 18,
    "lineHeight": 1.6,
    "letterSpacing": 0.12,
    "wordSpacing": 0.1,
    "textAlign": "left"
  },
  "colorScheme": "cream-on-dark",
  "adaptationSettings": {
    "simplificationLevel": 1,
    "chunkSize": 3,
    "readAloudRate": 0.9,
    "readAloudPitch": 1.0
  },
  "voiceSettings": {
    "voiceEnabled": true,
    "preferredVoice": null,
    "autoRead": false
  }
}
```

### Response

```json
{
  "success": true,
  "profileId": "profile_abc123",
  "created": false,
  "updated": true,
  "timestamp": "2026-09-11T14:00:00.000Z"
}
```

---

## 4. GET /api/profile/:profileId

**Owner:** M4

**Purpose:** Retrieve a learner profile.

**Expected Latency:** <50ms

### Response

```json
{
  "success": true,
  "profile": {
    "profileId": "profile_abc123",
    "profileType": "dyslexia",
    "createdAt": "2026-09-11T14:00:00.000Z",
    "lastModifiedAt": "2026-09-11T14:15:00.000Z",
    "typography": {
      "fontFamily": "'OpenDyslexic', 'Arial', sans-serif",
      "fontSize": 18,
      "lineHeight": 1.6,
      "letterSpacing": 0.12,
      "wordSpacing": 0.1,
      "textAlign": "left"
    },
    "colorScheme": "cream-on-dark",
    "adaptationSettings": {
      "simplificationLevel": 1,
      "chunkSize": 3,
      "readAloudRate": 0.9,
      "readAloudPitch": 1.0
    },
    "voiceSettings": {
      "voiceEnabled": true,
      "preferredVoice": null,
      "autoRead": false
    }
  }
}
```

### Errors

| Code | Condition | Response |
|------|-----------|----------|
| 404 | Profile not found | `{ "success": false, "error": "Profile not found." }` |

---

## 5. POST /api/scale/evaluate

**Owner:** M2 (SCALE + Adaptive Intelligence)

**Purpose:** Submit accumulated learner signals, receive adaptation decision from SCALE engine. This is the core adaptive intelligence endpoint.

**Expected Latency:** <50ms (deterministic — NO LLM call)

**Dependencies:** None (pure computation)

### Request

```json
{
  "sessionId": "session_12345",
  "documentId": "doc_a1b2c3d4",
  "currentConceptId": "con_002",
  "currentVariantLevel": 1,
  "signals": {
    "dwellTime": 35000,
    "rereadCount": 3,
    "scrollBack": 1,
    "helpRequests": 2,
    "questionAccuracy": 0.33,
    "answerLatency": 8000,
    "retryCount": 1,
    "voiceHelpRequests": 1
  },
  "recentHistory": [
    {
      "conceptId": "con_001",
      "variantLevel": 1,
      "accuracy": 0.67,
      "adapted": false
    }
  ],
  "adaptationCount": 0,
  "lastAdaptationChunksAgo": null
}
```

### Response (Adaptation Triggered)

```json
{
  "shouldAdapt": true,
  "struggleScore": 0.78,
  "threshold": 0.6,
  "reason": "Elevated struggle detected: high reread count (3), low question accuracy (33%), voice help request",
  "thresholdsMet": [
    "rereadCount (3) > threshold (2)",
    "questionAccuracy (0.33) < threshold (0.5)",
    "voiceHelpRequests (1) > threshold (0)"
  ],
  "adaptationStrategy": {
    "action": "increase_simplification",
    "newVariantLevel": 2,
    "additionalActions": [
      "reduce_chunk_size",
      "add_visual_description"
    ]
  },
  "explanation": "We noticed you re-read this section 3 times and asked for help. We're switching to shorter, simpler text with a visual description.",
  "cooldownActive": false,
  "timestamp": "2026-09-11T14:05:00.000Z"
}
```

### Response (No Adaptation Needed)

```json
{
  "shouldAdapt": false,
  "struggleScore": 0.25,
  "threshold": 0.6,
  "reason": "Learner signals within normal range",
  "thresholdsMet": [],
  "adaptationStrategy": null,
  "explanation": null,
  "cooldownActive": false,
  "timestamp": "2026-09-11T14:05:00.000Z"
}
```

### Response (Cooldown Active)

```json
{
  "shouldAdapt": false,
  "struggleScore": 0.72,
  "threshold": 0.6,
  "reason": "Struggle detected but cooldown is active (last adaptation was 1 chunk ago, minimum is 2)",
  "thresholdsMet": ["rereadCount (4) > threshold (2)"],
  "adaptationStrategy": null,
  "explanation": null,
  "cooldownActive": true,
  "cooldownRemainingChunks": 1,
  "timestamp": "2026-09-11T14:05:00.000Z"
}
```

---

## 6. GET /api/content/:documentId/variant

**Owner:** M1 (AI + Content Intelligence)

**Purpose:** Retrieve a specific cached content variant for a concept. Used by REWIRE to fetch alternate representations.

**Expected Latency:** <100ms (SQLite read)

### Request

```
GET /api/content/doc_a1b2c3d4/variant?conceptId=con_002&level=2
```

**Query Parameters:**
- `conceptId` (string, required): Which concept to retrieve
- `level` (number, required): Simplification level (1, 2, or 3)

### Response

```json
{
  "success": true,
  "conceptId": "con_002",
  "level": 2,
  "variant": {
    "simplifiedText": "Machines made farming much faster. More food was made. More food meant people could work in factories instead.",
    "visualDescription": "A farm with one person using a machine harvesting a huge field. Next to it, a factory with many workers.",
    "strategy": "aggressive_simplification + chunking"
  },
  "questions": [
    {
      "questionId": "q_con002_adapted_a",
      "text": "What did machines do to farming?",
      "type": "multiple_choice",
      "options": [
        { "id": "opt_1", "text": "Made it faster" },
        { "id": "opt_2", "text": "Made it slower" },
        { "id": "opt_3", "text": "Stopped farming" },
        { "id": "opt_4", "text": "Nothing changed" }
      ],
      "correctOptionId": "opt_1",
      "explanation": "Machines made farming much faster so more food could be produced."
    }
  ]
}
```

### Errors

| Code | Condition | Response |
|------|-----------|----------|
| 404 | Document/concept not found | `{ "success": false, "error": "Concept not found." }` |
| 404 | Variant level not available | `{ "success": false, "error": "No variant at level 3. Max available: 2." }` |

---

## 7. POST /api/voice/intent

**Owner:** M4 (Assessment + Voice + Integration)

**Purpose:** Process a recognized voice command and return the appropriate action for the frontend to execute.

**Expected Latency:** <100ms (deterministic routing, no LLM)

**Dependencies:** None (rule-based intent matching)

### Request

```json
{
  "sessionId": "session_12345",
  "transcript": "explain this simply",
  "currentConceptId": "con_002",
  "currentContext": "reading"
}
```

### Response

```json
{
  "success": true,
  "intent": "explain_simply",
  "action": {
    "type": "switch_variant",
    "targetLevel": 3,
    "conceptId": "con_002"
  },
  "spokenResponse": "Switching to a simpler explanation.",
  "generatesSignal": true,
  "signalType": "help_request",
  "timestamp": "2026-09-11T14:05:00.000Z"
}
```

**Supported Intents:**

| Voice Command | Intent | Action Type | Signal Generated |
|--------------|--------|-------------|-----------------|
| "Read this" | `read_aloud` | `start_tts` | No |
| "Explain this" | `explain` | `show_explanation` | Yes (`help_request`) |
| "Explain it simply" | `explain_simply` | `switch_variant` (level +1) | Yes (`help_request`) |
| "Give me an example" | `example` | `show_example` | Yes (`help_request`) |
| "Repeat that" | `repeat` | `restart_tts` | Yes (`help_request`) |
| "Answer [option]" | `answer` | `submit_answer` | No |
| "Next" | `navigate_next` | `next_chunk` | No |
| "Go back" | `navigate_back` | `prev_chunk` | No |

### Errors

| Code | Condition | Response |
|------|-----------|----------|
| 400 | Empty transcript | `{ "success": false, "error": "No transcript provided." }` |
| 422 | Unrecognized intent | `{ "success": false, "intent": "unknown", "spokenResponse": "I didn't understand that. Try saying 'read this', 'explain this', or 'next'." }` |

---

## 8. POST /api/session/progress

**Owner:** M4 (Assessment + Voice + Integration)

**Purpose:** Save session progress data or retrieve session state.

**Expected Latency:** <50ms

**Dependencies:** SQLite

### Request — Save

```json
{
  "action": "save",
  "sessionId": "session_12345",
  "documentId": "doc_a1b2c3d4",
  "profileId": "profile_abc123",
  "conceptProgress": {
    "conceptId": "con_002",
    "variantLevel": 1,
    "dwellTime": 28000,
    "rereadCount": 2,
    "questionsAnswered": 3,
    "questionsCorrect": 2,
    "adaptationApplied": false,
    "adaptationReason": null,
    "completedAt": "2026-09-11T14:02:00.000Z"
  }
}
```

### Response — Save

```json
{
  "success": true,
  "sessionId": "session_12345",
  "summary": {
    "conceptsCompleted": 4,
    "conceptsTotal": 8,
    "totalTime": 120000,
    "questionsAnswered": 12,
    "questionsCorrect": 9,
    "accuracy": 0.75,
    "adaptationsTriggered": 1,
    "completionPercentage": 50
  }
}
```

### Request — Retrieve

```json
{
  "action": "retrieve",
  "sessionId": "session_12345"
}
```

### Response — Retrieve

```json
{
  "success": true,
  "sessionId": "session_12345",
  "documentId": "doc_a1b2c3d4",
  "profileId": "profile_abc123",
  "startedAt": "2026-09-11T14:00:00.000Z",
  "lastActivity": "2026-09-11T14:30:00.000Z",
  "currentConceptIndex": 3,
  "concepts": [
    {
      "conceptId": "con_001",
      "completed": true,
      "variantLevel": 1,
      "dwellTime": 28000,
      "accuracy": 0.67,
      "adapted": false
    },
    {
      "conceptId": "con_002",
      "completed": true,
      "variantLevel": 2,
      "dwellTime": 35000,
      "accuracy": 0.33,
      "adapted": true,
      "postAdaptationAccuracy": 0.67
    }
  ],
  "summary": {
    "conceptsCompleted": 2,
    "conceptsTotal": 8,
    "totalTime": 63000,
    "questionsAnswered": 6,
    "questionsCorrect": 3,
    "accuracy": 0.5,
    "adaptationsTriggered": 1,
    "completionPercentage": 25
  }
}
```

---

## 9. GET /api/health

**Owner:** All

**Purpose:** Health check for deployment verification.

**Expected Latency:** <10ms

### Response

```json
{
  "status": "ok",
  "version": "1.0.0",
  "database": "connected",
  "timestamp": "2026-09-11T14:00:00.000Z"
}
```

---

## Error Handling Philosophy

1. **HTTP 200 for recoverable failures** — Return 200 with `success: false` and fallback data when the system can degrade gracefully
2. **HTTP 4xx for client errors** — Invalid input, missing resources
3. **HTTP 5xx for server errors** — Unexpected failures only
4. **Always include fallback data** — Never leave the frontend without something to render
5. **Log and continue** — Failures don't block the learner experience

**Standard Error Shape:**

```json
{
  "success": false,
  "error": "Descriptive error message",
  "fallbackApplied": true,
  "fallbackData": { }
}
```

---

## Version History

| Version | Date | Changes | Owner |
|---------|------|---------|-------|
| 1.0 | 2026-09-11 | Initial MVP contract (pre-SCALE) | All |
| 2.0 | 2026-09-11 | Rewritten for SCALE/REWIRE architecture, added upload/content/voice endpoints | All |