# PRISM API Contract

**Version:** 1.0 (24-hour MVP)

**Status:** Final — this is the contract between Frontend (Member 3) and Backend (Members 1, 2, 4). Changes must be explicit and versioned.

**Architecture Stages Using These Endpoints:** Stage 4b (Initial Adaptation), Stage 8b (Adapt Further)

---

## Endpoint Ownership Matrix

| Endpoint | Owned By | Stages Used | Purpose |
|----------|----------|-------------|---------|
| `POST /api/adapt` | Member 1 (Content/AI) | 4b, 8b | Simplify content, generate explanations |
| `POST /api/analyze-signals` | Member 2 (Adaptive Engine) | 7 | Analyze learner behavior, decide adaptation |
| `POST /api/questions` | Member 4 (Assessment/Data) | 6 | Generate or fetch comprehension questions |
| `POST /api/progress` | Member 4 (Assessment/Data) | 9, 12 | Store and retrieve session progress |

---

## 1. POST /api/adapt

**Owned By:** Member 1 (AI & Content Transform)

**Stages:** 4b (Initial Adaptation), 8b (Adapt Further)

**Purpose:** Simplify content chunks, generate concept explanations, and generate adaptation explanations based on learner profile and signals.

**Expected Latency:** 1–3 seconds per request (LLM inference + fallback logic)

### Request

```json
{
  "chunks": [
    {
      "id": "chunk_001",
      "originalText": "The Industrial Revolution was a period of human history marked by the transition of human and animal labor...",
      "sectionHeader": "Historical Context"
    },
    {
      "id": "chunk_002",
      "originalText": "Mechanization of agriculture and textile production resulted in unprecedented economic growth...",
      "sectionHeader": "Economic Impact"
    }
  ],
  "profile": {
    "profileType": "dyslexia",
    "fontFamily": "'OpenDyslexic', 'Arial', sans-serif",
    "fontSize": 18,
    "lineHeight": 1.6,
    "letterSpacing": 0.12,
    "colorScheme": "cream-on-dark",
    "simplificationLevel": 1,
    "chunkSize": 3,
    "readAloudRate": 0.9,
    "readAloudPitch": 1.0
  },
  "adaptationType": "initial",
  "signals": null
}
```

**Request Fields:**

- `chunks` (array, required): Content chunks to adapt. Each chunk must have `id`, `originalText`, and optional `sectionHeader`.
- `profile` (object, required): Learner profile from Stage 3 (see Data Model for full schema).
- `adaptationType` (string, required): Either `"initial"` (Stage 4b) or `"further"` (Stage 8b).
- `signals` (object, optional): Included only when `adaptationType` is `"further"`. See schema below.

**Signals (when adaptationType = "further"):**

```json
{
  "signals": {
    "questionAccuracy": 0.4,
    "avgTimePerChunk": 35000,
    "reReadEventsPerChunk": 4,
    "reason": "Low accuracy + excessive time"
  }
}
```

### Response

```json
{
  "success": true,
  "adaptedChunks": [
    {
      "id": "chunk_001",
      "simplifiedText": "The Industrial Revolution was a major time period. During this time, humans moved away from farming and animal power. Instead, they used machines and factories.",
      "originalText": "The Industrial Revolution was a period of human history marked by the transition of human and animal labor...",
      "conceptExplanations": [
        {
          "term": "mechanization",
          "explanation": "Using machines to do work instead of people or animals."
        }
      ],
      "confidenceScore": 0.92
    },
    {
      "id": "chunk_002",
      "simplifiedText": "Machines made farming and making clothes much faster. This meant more goods. More goods meant more money and jobs.",
      "originalText": "Mechanization of agriculture and textile production resulted in unprecedented economic growth...",
      "conceptExplanations": [
        {
          "term": "mechanization",
          "explanation": "Using machines to do work instead of people or animals."
        },
        {
          "term": "economic growth",
          "explanation": "When a country makes and sells more things, earning more money."
        }
      ],
      "confidenceScore": 0.88
    }
  ],
  "adaptationMetadata": {
    "appliedSimplificationLevel": 1,
    "strategyUsed": "vocabulary_replacement + sentence_shortening",
    "explanationsGenerated": true,
    "adaptationExplanation": null
  },
  "fallbackApplied": false,
  "timestamp": "2025-09-11T14:23:45.123Z"
}
```

**Response Fields:**

- `success` (boolean): True if adaptation succeeded, false if fallback applied.
- `adaptedChunks` (array): Array of adapted chunks with simplified text and concept explanations.
  - `id`: Matches input chunk id.
  - `simplifiedText`: AI-simplified version of original text.
  - `originalText`: Echo of input for reference.
  - `conceptExplanations`: Array of {term, explanation} pairs for difficult vocabulary.
  - `confidenceScore`: 0–1 confidence score for the adaptation quality.
- `adaptationMetadata` (object):
  - `appliedSimplificationLevel`: Actual simplification level applied.
  - `strategyUsed`: Description of adaptation strategy.
  - `explanationsGenerated`: Boolean indicating if concept explanations were generated.
  - `adaptationExplanation`: (only when `adaptationType="further"`) Explanation for why content was re-adapted (e.g., "Made sentences shorter because you answered 2 questions slowly"). Null if `adaptationType="initial"`.
- `fallbackApplied` (boolean): True if LLM failed and deterministic fallback was applied.
- `timestamp`: ISO 8601 timestamp of request processing.

### Error Handling

**HTTP 500 — LLM Error (Timeout, Rate Limit, API Error)**

```json
{
  "success": false,
  "error": "LLM request timed out after 5 seconds",
  "fallbackApplied": true,
  "adaptedChunks": [
    {
      "id": "chunk_001",
      "simplifiedText": "FALLBACK: Unable to simplify. Original text returned.",
      "originalText": "The Industrial Revolution was a period...",
      "conceptExplanations": [],
      "confidenceScore": 0.0
    }
  ]
}
```

When an error occurs:
- Return HTTP 200 (not 500) with `success: false`
- Include `fallbackApplied: true`
- Return original text in `simplifiedText` as fallback
- Frontend continues with unsimplified content

---

## 2. POST /api/analyze-signals

**Owned By:** Member 2 (Adaptive Engine)

**Stages:** 7 (Analyze Learner Signals)

**Purpose:** Evaluate learner behavior signals and return a decision: should the system re-adapt the next chunk?

**Expected Latency:** <100ms (deterministic logic only, no LLM)

**Frontend runs this entirely locally. This endpoint is provided for team clarity and future backend migration.**

### Request

```json
{
  "sessionId": "session_12345",
  "signals": {
    "questionAccuracy": 0.4,
    "avgTimePerChunk": 35000,
    "reReadEventsPerChunk": 4,
    "navigationBacktracks": 2
  },
  "currentProfile": {
    "simplificationLevel": 1,
    "chunkSize": 3
  },
  "chunksProcessed": 3
}
```

**Request Fields:**

- `sessionId` (string): Session identifier.
- `signals` (object): Aggregated behavior signals from recent chunks:
  - `questionAccuracy`: Decimal 0–1 (questions correct / questions answered).
  - `avgTimePerChunk`: Milliseconds spent on average per chunk.
  - `reReadEventsPerChunk`: Average number of re-read events per chunk.
  - `navigationBacktracks`: Number of times learner clicked "previous" in recent chunks.
- `currentProfile` (object): Current learner profile state.
- `chunksProcessed` (number): Total chunks read so far in session.

### Response

```json
{
  "shouldReAdapt": true,
  "reason": "Low question accuracy (40%) + excessive time per chunk (35s > 30s threshold)",
  "thresholdsMet": [
    "questionAccuracy < 0.5",
    "avgTimePerChunk > 30000"
  ],
  "suggestedAdaptation": {
    "newSimplificationLevel": 2,
    "newChunkSize": 2,
    "actions": [
      "reduce_paragraph_length",
      "increase_line_height",
      "simplify_vocabulary"
    ]
  },
  "confidence": 0.95
}
```

**Response Fields:**

- `shouldReAdapt` (boolean): True if one or more thresholds met.
- `reason` (string): Human-readable explanation of decision (for debugging and explanations).
- `thresholdsMet` (array): List of thresholds that triggered adaptation (e.g., "accuracy < 50%").
- `suggestedAdaptation` (object): What Member 1 should do if re-adapting:
  - `newSimplificationLevel`: Recommended increase in simplification (1–3).
  - `newChunkSize`: Recommended reduction in chunk size (paragraphs per chunk).
  - `actions`: Deterministic actions to apply client-side (reduce_paragraph_length, increase_line_height, etc.).
- `confidence` (number): 0–1 confidence in the decision.

### Decision Thresholds (Deterministic Logic)

```
shouldReAdapt = true if ANY of:
  1. questionAccuracy < 0.5 (less than 50% correct)
  2. avgTimePerChunk > 30000 (more than 30 seconds per chunk on average)
  3. reReadEventsPerChunk > 3 (more than 3 re-reads per chunk on average)
  4. navigationBacktracks > 2 (more than 2 "previous" clicks in recent chunks)

If shouldReAdapt = true:
  - Increase simplificationLevel by 1 (cap at 3)
  - Decrease chunkSize by 1 (min 1 paragraph per chunk)
  - Flag all actions for client-side + server-side application
```

---

## 3. POST /api/questions

**Owned By:** Member 4 (Assessment & Data)

**Stages:** 6 (Learner Interacts & Answers)

**Purpose:** Generate or retrieve 3 comprehension questions for a content chunk.

**Expected Latency:** 1–2 seconds (LLM generation on first call per chunk; cached thereafter in localStorage)

### Request

```json
{
  "chunkId": "chunk_001",
  "originalText": "The Industrial Revolution was a period of human history marked by the transition of human and animal labor...",
  "sectionHeader": "Historical Context",
  "simplificationLevel": 1,
  "generateNew": false
}
```

**Request Fields:**

- `chunkId` (string, required): Unique ID for the chunk.
- `originalText` (string, required): Original (not simplified) text to base questions on.
- `sectionHeader` (string, optional): Section title for context.
- `simplificationLevel` (number, optional): Learner's current simplification level (1–3). Used to adjust question difficulty.
- `generateNew` (boolean, optional): If true, always generate new questions. If false, return cached if available. Default: false.

### Response

```json
{
  "chunkId": "chunk_001",
  "questions": [
    {
      "questionId": "q_001_a",
      "text": "What was the Industrial Revolution?",
      "type": "multiple_choice",
      "options": [
        {
          "id": "opt_1",
          "text": "A period of time when machines replaced people and animal work"
        },
        {
          "id": "opt_2",
          "text": "A war between Europe and Asia"
        },
        {
          "id": "opt_3",
          "text": "The invention of the computer"
        },
        {
          "id": "opt_4",
          "text": "A movement to stop using factories"
        }
      ],
      "correctOptionId": "opt_1",
      "explanation": "The Industrial Revolution was a big change from farm work to factory and machine work."
    },
    {
      "questionId": "q_001_b",
      "text": "Did the Industrial Revolution happen quickly or slowly?",
      "type": "true_false",
      "options": [
        {
          "id": "opt_true",
          "text": "True — it happened over many years"
        },
        {
          "id": "opt_false",
          "text": "False — it happened very fast"
        }
      ],
      "correctOptionId": "opt_true",
      "explanation": "The Industrial Revolution took a long time to spread across different countries and industries."
    },
    {
      "questionId": "q_001_c",
      "text": "What kind of work became more common during the Industrial Revolution?",
      "type": "multiple_choice",
      "options": [
        {
          "id": "opt_1",
          "text": "Farm work"
        },
        {
          "id": "opt_2",
          "text": "Factory and machine work"
        },
        {
          "id": "opt_3",
          "text": "Hand crafts"
        },
        {
          "id": "opt_4",
          "text": "Hunting and fishing"
        }
      ],
      "correctOptionId": "opt_2",
      "explanation": "Factories and machines became the main way people worked during this time."
    }
  ],
  "generated": true,
  "timestamp": "2025-09-11T14:23:45.123Z"
}
```

**Response Fields:**

- `chunkId` (string): Echo of input chunk ID.
- `questions` (array): 3 comprehension questions for the chunk.
  - `questionId` (string): Unique ID for the question (format: `q_{chunkId}_{a|b|c}`).
  - `text` (string): The question text.
  - `type` (string): Either `"multiple_choice"` or `"true_false"`.
  - `options` (array): Answer options with `id` and `text`.
  - `correctOptionId` (string): ID of the correct option.
  - `explanation` (string): Brief explanation of why the correct answer is right (shown to learner if they get it wrong).
- `generated` (boolean): True if questions were newly generated, false if retrieved from cache.
- `timestamp` (ISO 8601): When questions were generated/retrieved.

### Error Handling

If LLM generation fails, return HTTP 200 with fallback generic questions:

```json
{
  "chunkId": "chunk_001",
  "questions": [
    {
      "questionId": "q_001_a",
      "text": "What is the main topic of this section?",
      "type": "multiple_choice",
      "options": [
        {
          "id": "opt_1",
          "text": "I understood it"
        },
        {
          "id": "opt_2",
          "text": "I'm not sure"
        }
      ],
      "correctOptionId": "opt_1",
      "explanation": "Fallback question. No LLM available."
    }
  ],
  "generated": false,
  "fallbackApplied": true
}
```

---

## 4. POST /api/progress

**Owned By:** Member 4 (Assessment & Data)

**Stages:** 9 (Measure Progress), 12 (Store Progress Data)

**Purpose:** Store session progress data (chunks read, questions answered, adaptations triggered) and retrieve progress summary for resume/analytics.

**Expected Latency:** <50ms (localStorage operation equivalent)

### Request — Save Progress

```json
{
  "method": "save",
  "sessionId": "session_12345",
  "chunkData": {
    "chunkId": "chunk_001",
    "timeOnTask": 28000,
    "reReadEvents": 2,
    "questionsAnswered": 3,
    "questionsCorrect": 2,
    "answerIds": ["q_001_a:opt_1", "q_001_b:opt_true", "q_001_c:opt_3"],
    "adaptationApplied": false,
    "timestamp": "2025-09-11T14:23:45.123Z"
  }
}
```

**Request Fields (Save):**

- `method` (string): `"save"` to store chunk data.
- `sessionId` (string): Session identifier.
- `chunkData` (object): Data from a single chunk interaction.
  - `chunkId` (string): Chunk ID.
  - `timeOnTask` (number): Milliseconds spent on chunk.
  - `reReadEvents` (number): Number of re-read events (select+reselect).
  - `questionsAnswered` (number): How many questions were answered.
  - `questionsCorrect` (number): How many answers were correct.
  - `answerIds` (array): Array of answered question IDs (format: `q_id:option_id`).
  - `adaptationApplied` (boolean): Whether re-adaptation occurred after this chunk.
  - `timestamp` (ISO 8601): When chunk was completed.

### Response — Save Progress

```json
{
  "success": true,
  "sessionId": "session_12345",
  "progressSummary": {
    "chunksCompleted": 4,
    "totalTimeSpent": 120000,
    "questionsAnswered": 12,
    "questionsCorrect": 10,
    "accuracy": 0.833,
    "adaptationsTriggered": 1,
    "avgTimePerChunk": 30000
  }
}
```

**Response Fields (Save):**

- `success` (boolean): True if data was saved.
- `sessionId` (string): Echo of session ID.
- `progressSummary` (object): Aggregated session metrics.
  - `chunksCompleted` (number): Total chunks read.
  - `totalTimeSpent` (number): Total milliseconds in session.
  - `questionsAnswered` (number): Total questions answered.
  - `questionsCorrect` (number): Total correct answers.
  - `accuracy` (number): Decimal 0–1 (questionsCorrect / questionsAnswered).
  - `adaptationsTriggered` (number): Number of times re-adaptation occurred.
  - `avgTimePerChunk` (number): Average milliseconds per chunk.

### Request — Retrieve Progress

```json
{
  "method": "retrieve",
  "sessionId": "session_12345"
}
```

### Response — Retrieve Progress

```json
{
  "success": true,
  "sessionId": "session_12345",
  "session": {
    "sessionId": "session_12345",
    "createdAt": "2025-09-11T14:00:00.000Z",
    "updatedAt": "2025-09-11T14:30:00.000Z",
    "chunks": [
      {
        "chunkId": "chunk_001",
        "timeOnTask": 28000,
        "reReadEvents": 2,
        "questionsCorrect": 2,
        "questionsAnswered": 3,
        "adaptationApplied": false
      },
      {
        "chunkId": "chunk_002",
        "timeOnTask": 32000,
        "reReadEvents": 3,
        "questionsCorrect": 1,
        "questionsAnswered": 3,
        "adaptationApplied": true
      }
    ],
    "progressSummary": {
      "chunksCompleted": 2,
      "totalTimeSpent": 60000,
      "questionsAnswered": 6,
      "questionsCorrect": 3,
      "accuracy": 0.5,
      "adaptationsTriggered": 1
    }
  }
}
```

**Response Fields (Retrieve):**

- `success` (boolean): True if session was found.
- `sessionId` (string): Echo of session ID.
- `session` (object): Full session object with chunk-level details and summary.

### Error Handling

If session not found:

```json
{
  "success": false,
  "sessionId": "session_12345",
  "error": "Session not found"
}
```

---

## API Summary for Team

| Endpoint | Member | Stage(s) | Purpose | Latency |
|----------|--------|----------|---------|---------|
| `POST /api/adapt` | 1 | 4b, 8b | Simplify + generate explanations | 1–3s |
| `POST /api/analyze-signals` | 2 | 7 | Decide re-adaptation | <100ms |
| `POST /api/questions` | 4 | 6 | Generate questions | 1–2s |
| `POST /api/progress` | 4 | 9, 12 | Store/retrieve progress | <50ms |

---

## Error Codes & Fallback Strategy

All endpoints follow this error pattern:

1. **HTTP 200 always** — Even on partial failures, return 200 with `success: false`.
2. **Include fallback data** — Never leave frontend without something to render.
3. **Log and continue** — Failures don't block the learner experience.

**General Error Response Template:**

```json
{
  "success": false,
  "error": "Descriptive error message",
  "fallbackApplied": true,
  "fallbackData": { ... }
}
```

---

## Version History

| Version | Date | Changes | Member |
|---------|------|---------|--------|
| 1.0 | 2025-09-11 | Initial MVP contract | All |