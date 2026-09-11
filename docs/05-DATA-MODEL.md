# PRISM Data Model

**Owner:** Member 4 (Assessment, Data & Integration)

**Scope:** MVP-only fields. This is the minimal schema needed to support Stages 3–12 of the architecture. No user accounts, no cloud persistence — all data lives in localStorage.

---

## 1. Learner Profile

**Storage:** `localStorage['prism_profile_{deviceId}']`

**Lifecycle:** Created at Stage 3, persisted across sessions, updated when learner edits profile settings.

**Schema:**

```json
{
  "profileId": "profile_device_12345",
  "profileType": "dyslexia",
  "createdAt": "2025-09-11T14:00:00.000Z",
  "lastModifiedAt": "2025-09-11T14:15:00.000Z",
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
  }
}
```

**Fields:**

- `profileId` (string): Unique profile identifier (e.g., hashed device ID).
- `profileType` (string, enum): `"dyslexia"`, `"low_vision"`, `"cognitive_load"`, or `"custom"`.
- `createdAt` (ISO 8601): When profile was first created.
- `lastModifiedAt` (ISO 8601): When profile was last edited.
- `typography` (object): Font and spacing settings.
  - `fontFamily` (string): CSS font-family value.
  - `fontSize` (number): Pixels.
  - `lineHeight` (number): Unitless multiplier (1.0–2.0).
  - `letterSpacing` (number): Em units (0–0.2).
  - `wordSpacing` (number): Em units (0–0.2).
  - `textAlign` (string): `"left"`, `"center"`, or `"justify"`.
- `colorScheme` (string): CSS class or color name (e.g., `"cream-on-dark"`, `"high-contrast"`).
- `adaptationSettings` (object):
  - `simplificationLevel` (number, 1–3): How much to simplify content (1=minimum, 3=maximum).
  - `chunkSize` (number, 1–5): Paragraphs per chunk.
  - `readAloudRate` (number, 0.5–2.0): Speech rate multiplier.
  - `readAloudPitch` (number, 0.5–2.0): Speech pitch multiplier.

---

## 2. Content Session

**Storage:** `localStorage['prism_session_{sessionId}']`

**Lifecycle:** Created when learner uploads content (Stage 1–2). Persists until session ends or is cleared.

**Schema:**

```json
{
  "sessionId": "session_uuid_12345",
  "createdAt": "2025-09-11T14:00:00.000Z",
  "updatedAt": "2025-09-11T14:30:00.000Z",
  "contentSource": {
    "type": "text",
    "sourceLength": 3450,
    "sourceChecksum": "sha256_abc123"
  },
  "chunks": [
    {
      "chunkId": "chunk_001",
      "originalText": "The Industrial Revolution was a period of human history marked by...",
      "sectionHeader": "Historical Context",
      "sequenceNumber": 1
    },
    {
      "chunkId": "chunk_002",
      "originalText": "Mechanization of agriculture and textile production resulted in...",
      "sectionHeader": "Economic Impact",
      "sequenceNumber": 2
    }
  ],
  "totalChunks": 5,
  "currentChunkIndex": 0
}
```

**Fields:**

- `sessionId` (string): Unique session ID (UUID v4).
- `createdAt` (ISO 8601): Session start time.
- `updatedAt` (ISO 8601): Last activity time.
- `contentSource` (object): Metadata about source material.
  - `type` (string, enum): `"text"`, `"pdf"`, or `"url"`.
  - `sourceLength` (number): Character count of original content.
  - `sourceChecksum` (string): SHA-256 hash of source (for detecting duplicates across sessions).
- `chunks` (array): Structured content chunks.
  - `chunkId` (string): Unique chunk ID (e.g., `chunk_001`).
  - `originalText` (string): Raw, unadapted text.
  - `sectionHeader` (string, optional): Section title if detected.
  - `sequenceNumber` (number): Position in content (1-based).
- `totalChunks` (number): Total chunks in session.
- `currentChunkIndex` (number): Currently displayed chunk (0-based).

---

## 3. Adaptation History

**Storage:** `localStorage['prism_adaptations_{sessionId}']`

**Lifecycle:** Created in Stage 4, updated in Stage 8 each time content is re-adapted.

**Schema:**

```json
{
  "sessionId": "session_uuid_12345",
  "adaptations": [
    {
      "adaptationId": "adapt_001",
      "chunkId": "chunk_001",
      "timestamp": "2025-09-11T14:02:00.000Z",
      "adaptationType": "initial",
      "appliedProfile": {
        "simplificationLevel": 1,
        "chunkSize": 3
      },
      "result": {
        "simplifiedText": "The Industrial Revolution was a major time period. During this time, humans moved away from farming...",
        "conceptExplanations": [
          {
            "term": "mechanization",
            "explanation": "Using machines to do work instead of people or animals."
          }
        ],
        "confidenceScore": 0.92
      },
      "strategy": "vocabulary_replacement + sentence_shortening"
    },
    {
      "adaptationId": "adapt_002",
      "chunkId": "chunk_002",
      "timestamp": "2025-09-11T14:08:00.000Z",
      "adaptationType": "further",
      "appliedProfile": {
        "simplificationLevel": 2,
        "chunkSize": 2
      },
      "result": {
        "simplifiedText": "Machines made farming much faster. This made more food. More food meant people could do other jobs.",
        "conceptExplanations": [
          {
            "term": "production",
            "explanation": "Making or creating something."
          }
        ],
        "confidenceScore": 0.85
      },
      "strategy": "aggressive_vocabulary_replacement",
      "triggeringSignals": {
        "questionAccuracy": 0.4,
        "avgTimePerChunk": 35000,
        "reason": "Low accuracy + excessive time"
      }
    }
  ]
}
```

**Fields:**

- `sessionId` (string): Session ID.
- `adaptations` (array): History of all adaptations applied to chunks in this session.
  - `adaptationId` (string): Unique adaptation ID.
  - `chunkId` (string): Which chunk was adapted.
  - `timestamp` (ISO 8601): When adaptation occurred.
  - `adaptationType` (string, enum): `"initial"` (Stage 4) or `"further"` (Stage 8).
  - `appliedProfile` (object): Profile settings used for this adaptation.
  - `result` (object): Output from `/api/adapt` endpoint.
    - `simplifiedText` (string): The adapted content.
    - `conceptExplanations` (array): Vocabulary explanations.
    - `confidenceScore` (number): 0–1 confidence in adaptation quality.
  - `strategy` (string): Description of adaptation strategy applied.
  - `triggeringSignals` (object, optional): Only for `adaptationType="further"`. Signals that triggered re-adaptation.

---

## 4. Learner Signal Log

**Storage:** `localStorage['prism_signals_{sessionId}']`

**Lifecycle:** Updated during Stage 6 (Learner Interacts) and Stage 7 (Analyze Signals).

**Schema:**

```json
{
  "sessionId": "session_uuid_12345",
  "signals": [
    {
      "signalId": "sig_chunk_001",
      "chunkId": "chunk_001",
      "timestamp": "2025-09-11T14:02:00.000Z",
      "readingBehavior": {
        "timeOnTask": 28000,
        "reReadEvents": 2,
        "scrollSpeed": "normal",
        "pauseResume": false,
        "navigationEvent": "next"
      },
      "assessment": {
        "questionsAnswered": 3,
        "questionsCorrect": 2,
        "accuracy": 0.667,
        "answerIds": ["q_001_a:opt_1", "q_001_b:opt_true", "q_001_c:opt_3"],
        "answerTimes": [2000, 1500, 3000]
      }
    },
    {
      "signalId": "sig_chunk_002",
      "chunkId": "chunk_002",
      "timestamp": "2025-09-11T14:03:30.000Z",
      "readingBehavior": {
        "timeOnTask": 35000,
        "reReadEvents": 4,
        "scrollSpeed": "slow",
        "pauseResume": true,
        "navigationEvent": "next"
      },
      "assessment": {
        "questionsAnswered": 3,
        "questionsCorrect": 1,
        "accuracy": 0.333,
        "answerIds": ["q_002_a:opt_2", "q_002_b:opt_false", "q_002_c:opt_1"],
        "answerTimes": [5000, 4000, 2500]
      }
    }
  ],
  "aggregateSignals": {
    "slidingWindow": 2,
    "questionAccuracy": 0.5,
    "avgTimePerChunk": 31500,
    "avgReReadEventsPerChunk": 3,
    "navigationBacktracks": 0
  }
}
```

**Fields:**

- `sessionId` (string): Session ID.
- `signals` (array): Per-chunk signal log.
  - `signalId` (string): Unique signal ID (typically `sig_chunk_{chunkId}`).
  - `chunkId` (string): Which chunk generated these signals.
  - `timestamp` (ISO 8601): When chunk interaction ended.
  - `readingBehavior` (object):
    - `timeOnTask` (number): Milliseconds spent reading chunk.
    - `reReadEvents` (number): How many times learner selected and re-selected text.
    - `scrollSpeed` (string, enum): `"fast"`, `"normal"`, or `"slow"`.
    - `pauseResume` (boolean): Whether learner paused/resumed read-aloud.
    - `navigationEvent` (string, enum): `"next"`, `"previous"`, `"first"`, `"last"`, or `"none"`.
  - `assessment` (object):
    - `questionsAnswered` (number): Total questions answered.
    - `questionsCorrect` (number): Correct answers.
    - `accuracy` (number): Decimal 0–1.
    - `answerIds` (array): Selected option IDs (format: `q_id:option_id`).
    - `answerTimes` (array): Milliseconds to answer each question.
- `aggregateSignals` (object): Rolling aggregate for Stage 7 analysis.
  - `slidingWindow` (number): Number of chunks in current window (typically 2–3).
  - `questionAccuracy` (number): Decimal 0–1 across recent chunks.
  - `avgTimePerChunk` (number): Average milliseconds per chunk in window.
  - `avgReReadEventsPerChunk` (number): Average re-reads per chunk in window.
  - `navigationBacktracks` (number): Count of "previous" clicks in recent chunks.

---

## 5. Question Bank

**Storage:** `localStorage['prism_questions_{sessionId}']`

**Lifecycle:** Created in Stage 6 when questions are generated for each chunk.

**Schema:**

```json
{
  "sessionId": "session_uuid_12345",
  "questions": {
    "chunk_001": [
      {
        "questionId": "q_001_a",
        "chunkId": "chunk_001",
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
        "explanation": "The Industrial Revolution was a big change from farm work to factory and machine work.",
        "generatedAt": "2025-09-11T14:02:00.000Z",
        "source": "ai_generated"
      },
      {
        "questionId": "q_001_b",
        "chunkId": "chunk_001",
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
        "explanation": "The Industrial Revolution took a long time to spread across different countries and industries.",
        "generatedAt": "2025-09-11T14:02:00.000Z",
        "source": "ai_generated"
      },
      {
        "questionId": "q_001_c",
        "chunkId": "chunk_001",
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
        "explanation": "Factories and machines became the main way people worked during this time.",
        "generatedAt": "2025-09-11T14:02:00.000Z",
        "source": "ai_generated"
      }
    ],
    "chunk_002": [
      {
        "questionId": "q_002_a",
        "chunkId": "chunk_002",
        "text": "What was mechanized during the Industrial Revolution?",
        "type": "multiple_choice",
        "options": [
          { "id": "opt_1", "text": "Farming" },
          { "id": "opt_2", "text": "Making clothes" },
          { "id": "opt_3", "text": "Both farming and making clothes" },
          { "id": "opt_4", "text": "Nothing" }
        ],
        "correctOptionId": "opt_3",
        "explanation": "Both farming and textile (clothes) production were mechanized.",
        "generatedAt": "2025-09-11T14:03:00.000Z",
        "source": "ai_generated"
      }
    ]
  }
}
```

**Fields:**

- `sessionId` (string): Session ID.
- `questions` (object): Map of chunk ID → array of questions.
  - `questionId` (string): Unique question ID (format: `q_{chunkId}_{a|b|c}`).
  - `chunkId` (string): Which chunk this question addresses.
  - `text` (string): Question text.
  - `type` (string, enum): `"multiple_choice"` or `"true_false"`.
  - `options` (array): Answer options with `id` and `text`.
  - `correctOptionId` (string): ID of correct option.
  - `explanation` (string): Explanation shown if learner answers incorrectly.
  - `generatedAt` (ISO 8601): When question was generated.
  - `source` (string, enum): `"ai_generated"` or `"fallback"`.

---

## 6. Progress Record

**Storage:** `localStorage['prism_progress_{sessionId}']`

**Lifecycle:** Created at Stage 9, updated at Stage 12 after each chunk.

**Schema:**

```json
{
  "sessionId": "session_uuid_12345",
  "startTime": "2025-09-11T14:00:00.000Z",
  "lastUpdated": "2025-09-11T14:30:00.000Z",
  "chunkProgress": [
    {
      "chunkId": "chunk_001",
      "completed": true,
      "timeOnTask": 28000,
      "reReadEvents": 2,
      "questionsAnswered": 3,
      "questionsCorrect": 2,
      "adaptationApplied": false,
      "adaptationReason": null,
      "completedAt": "2025-09-11T14:02:00.000Z"
    },
    {
      "chunkId": "chunk_002",
      "completed": true,
      "timeOnTask": 35000,
      "reReadEvents": 4,
      "questionsAnswered": 3,
      "questionsCorrect": 1,
      "adaptationApplied": true,
      "adaptationReason": "Low question accuracy (40%) + excessive time per chunk (35s > 30s threshold)",
      "completedAt": "2025-09-11T14:03:45.000Z"
    },
    {
      "chunkId": "chunk_003",
      "completed": false,
      "timeOnTask": 0,
      "reReadEvents": 0,
      "questionsAnswered": 0,
      "questionsCorrect": 0,
      "adaptationApplied": false,
      "adaptationReason": null,
      "completedAt": null
    }
  ],
  "sessionSummary": {
    "chunksCompleted": 2,
    "chunksTotal": 5,
    "totalTimeSpent": 63000,
    "questionsAnswered": 6,
    "questionsCorrect": 3,
    "overallAccuracy": 0.5,
    "adaptationsTriggered": 1,
    "avgTimePerChunk": 31500,
    "completionPercentage": 40
  }
}
```

**Fields:**

- `sessionId` (string): Session ID.
- `startTime` (ISO 8601): Session start.
- `lastUpdated` (ISO 8601): Most recent progress update.
- `chunkProgress` (array): Per-chunk progress tracking.
  - `chunkId` (string): Chunk ID.
  - `completed` (boolean): Whether chunk was fully read and assessed.
  - `timeOnTask` (number): Milliseconds spent.
  - `reReadEvents` (number): Re-read count.
  - `questionsAnswered` (number): Count of questions answered.
  - `questionsCorrect` (number): Count correct.
  - `adaptationApplied` (boolean): Whether re-adaptation triggered after this chunk.
  - `adaptationReason` (string, optional): Human-readable reason for adaptation (from Stage 10).
  - `completedAt` (ISO 8601, optional): When chunk was completed.
- `sessionSummary` (object): Aggregate session metrics.
  - `chunksCompleted` (number): Total chunks finished.
  - `chunksTotal` (number): Total chunks in content.
  - `totalTimeSpent` (number): Total milliseconds in session.
  - `questionsAnswered` (number): Total questions answered across all chunks.
  - `questionsCorrect` (number): Total correct answers.
  - `overallAccuracy` (number): Decimal 0–1.
  - `adaptationsTriggered` (number): Total re-adaptations in session.
  - `avgTimePerChunk` (number): Average milliseconds per chunk.
  - `completionPercentage` (number): Decimal 0–100 (chunksCompleted / chunksTotal * 100).

---

## Storage Strategy

**localStorage Keys Pattern:**

```
prism_profile_{deviceId}          → Learner Profile
prism_session_{sessionId}         → Content Session
prism_adaptations_{sessionId}     → Adaptation History
prism_signals_{sessionId}         → Learner Signal Log
prism_questions_{sessionId}       → Question Bank
prism_progress_{sessionId}        → Progress Record
prism_metadata                    → (Optional) Map of all active session IDs
```

**Storage Limits:**

- Each browser's localStorage has ~5-10 MB capacity.
- MVP estimated usage per session: ~500 KB (3-5 chunks, questions, signals, adaptations).
- Supports ~10–15 active sessions before cleanup needed.

**Cleanup Strategy:**

- Learner can manually clear session history.
- Sessions expire after 7 days (optional for MVP, implement if localStorage fills up).
- Metadata object tracks sessionIds and createdAt for cleanup decisions.

---

## Data Flow Across Stages

| Stage | Reads From | Writes To |
|-------|-----------|----------|
| 1–2: Input/Extract | — | Content Session |
| 3: Profile | Learner Profile | — |
| 4: Initial Adaptation | Content Session, Learner Profile | Adaptation History |
| 5: View Content | Content Session, Adaptation History | — |
| 6: Interact & Answer | Question Bank | Learner Signal Log |
| 7: Analyze Signals | Learner Signal Log | — |
| 8: Adapt Further | Learner Signal Log | Adaptation History |
| 9–12: Progress | Adaptation History, Learner Signal Log | Progress Record |
| Resume Session | All (all tables) | — |

---

## MVP Constraints

**What is NOT in this schema (future work):**

- User authentication (no user IDs, no accounts)
- Cloud persistence (localStorage only)
- Shared sessions or collaboration
- Long-term analytics (no database)
- Full audit trail (only current state + recent history)
- Multi-device sync (device-local only)