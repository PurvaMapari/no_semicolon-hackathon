# PRISM Architecture Document

## Overview

PRISM implements a **persistent, behavior-driven adaptation loop**—not a one-shot personalization pipeline. The system adapts once based on initial profile selection, but continues to analyze learner behavior and decide whether to re-adapt content throughout the reading session. This feedback loop is the core technical differentiator.

## Full Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    PRISM ADAPTIVE PIPELINE                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

1. INPUT → 2. EXTRACT & STRUCTURE → 3. SET UP LEARNER PROFILE → 4. GENERATE INITIAL ADAPTATION
                                                        ↓
                                                5. VIEW PERSONALIZED CONTENT
                                                        ↓
                                            6. LEARNER INTERACTS & ANSWERS
                                                        ↓
                                        7. ANALYZE LEARNER SIGNALS
                                                        ↓
                                              ┌─────────┴─────────┐
                                              │                   │
                                              ▼                   ▼
                                      ANALYZE SIGNALS?        ANALYZE SIGNALS?
                                      (Threshold met?)        (Threshold met?)
                                              │                   │
                                         YES │                   │ NO
                                              ▼                   ▼
                                    8. ADAPT FURTHER        9. MEASURE PROGRESS
                                              │
                                              ▼
                                   10. EXPLAIN ADAPTATION
                                              │
                                              ▼
                                    ┌─────────┴─────────┐
                                    │                   │
                                    ▼                   ▼
                           11. UPDATE                12. STORE
                         ADAPTATION              PROGRESS DATA
                                    │                   │
                                    └─────────┬─────────┘
                                              ▼
                                    LOOP BACK TO STEP 5
                                   (View Personalized Content)
```

## Stage-by-Stage Breakdown

### Stage 1: Input

**What it does:** Accepts content from user via text paste or PDF upload

**Client-side vs Server-side:** 100% client-side

**Why:** Minimal latency. Text pasting is instant. PDF upload simply sends the file to the client for processing.

**Technical details:**
- Text paste: Direct DOM input
- PDF upload: Uses PDF.js (Mozilla's PDF parser) to extract text on client side
- No backend required for initial content ingestion

---

### Stage 2: Extract & Structure

**What it does:** Parses raw text into structured chunks suitable for adaptation

**Client-side vs Server-side:** 100% client-side

**Why:** Deterministic text processing can run instantly on the client. No network round-trips needed.

**Technical details:**
- Sentence splitting using Intl.Segmenter or regular expressions
- Paragraph detection and preservation
- Header identification (if present in source)
- Chunk size configuration (e.g., 1-3 paragraphs per chunk)
- Output: Array of structured content chunks with metadata (id, original text, section header)

---

### Stage 3: Set Up Learner Profile

**What it does:** Loads or creates learner profile, merges with profile selection

**Client-side vs Server-side:** 100% client-side

**Why:** Profile data is lightweight (configuration JSON) and needs instant availability. localStorage provides persistence across sessions without backend.

**Technical details:**
- Load from localStorage: `prism_profile_{hash(userId or deviceID)}`
- If no profile exists, create default from selected profile type (dyslexia, low-vision, etc.)
- Merge user preferences (e.g., "I want larger font than default for dyslexia profile")
- Output: Learner profile object containing:
  ```json
  {
    "profileType": "dyslexia",
    "fontFamily": "'OpenDyslexic', 'Arial', sans-serif",
    "fontSize": 18,
    "lineHeight": 1.6,
    "letterSpacing": 0.12,
    "textAlign": "left",
    "colorScheme": "cream-on-dark",
    "simplificationLevel": 1,
    "chunkSize": 3,
    "readAloudRate": 0.9,
    "readAloudPitch": 1.0
  }
  ```

---

### Stage 4: Generate Initial Adaptation

**What it does:** Applies deterministic formatting + AI-powered content adaptation to create personalized version

**Client-side vs Server-side:** Hybrid (deterministic = client, AI = server)

**Why:**
- Deterministic formatting (fonts, spacing) runs instantly on client
- Content-level adaptation (simplification, explanation generation) requires LLM inference
- We can cache deterministic transformations; AI outputs must be generated or fetched

**Technical details:**

#### 4a. Deterministic Formatting (Client)
- Apply typography settings from learner profile
- Apply color scheme (CSS variables)
- Reformat HTML with optimized layout (margin, padding, max-width)
- Add ARIA labels for accessibility

#### 4b. AI Adaptation (Server)
- Send each chunk + learner profile to AI endpoint
- Prompt: "Given this text and learner profile [dyslexia], provide simplified version with: (1) simpler vocabulary, (2) shorter sentences, (3) clear section breaks, (4) optional concept explanations"
- LLM returns adapted chunk with:
  - Simplified text
  - Original text (for reference/hover)
  - Concept explanations (if applicable)
  - Confidence score
- If confidence < threshold OR LLM timeout: fallback to deterministic only

**API Endpoint (minimal):**
```
POST /api/adapt
{
  "chunks": [...],
  "profile": {...},
  " adaptationType": "initial"
}
Response: {
  "adaptedChunks": [...],
  "adaptationMetadata": {
    "appliedSimplificationLevel": 1,
    "strategyUsed": "vocabulary_replacement",
    "explanationsGenerated": true
  }
}
```

---

### Stage 5: View Personalized Content

**What it does:** Renders adapted content for learner

**Client-side vs Server-side:** 100% client-side

**Why:** Rendering is pure DOM manipulation. The adapted content is already fully available from Stage 4.

**Technical details:**
- Render each chunk in scrollable container
- Enable read-aloud on click of "play" button
- Sync TTS highlighting with audio playback
- Track reading time per chunk (start time on render, end time on navigation)
- Track navigation events (next/previous chunk)

**UX Elements:**
- "Read Aloud" button with play/pause/stop
- Progress indicator (chunk X of Y)
- Chunk navigation (previous/next buttons)
- Optional: "Explain this" button for concept explanations
- Optional: Highlighter tool (stores highlights in localStorage)

---

### Stage 6: Learner Interacts & Answers

**What it does:** Captures learner behavior and assessment responses

**Client-side vs Server-side:** 100% client-side

**Why:** Interaction data is lightweight and needs real-time collection. Assessment questions are static (pre-generated).

**Technical details:**
- **Reading behavior tracking:**
  - Time on chunk (from render to navigation away)
  - Re-read events (select text and re-select within same chunk)
  - Skipped sections (fast scroll through)
  - Navigation events (next/previous/first/last)
  - Pause/resume events (for read-aloud)

- **Assessment:**
  - 3 comprehension questions per chunk (pre-written or generated once per session)
  - Answer storage: `localStorage.setItem('prism_answers_{chunkId}', selectedOptionId)`
  - Answer verification: compare against correct answer ID

- **Question types:**
  - Multiple choice (4 options)
  - True/False
  - Optional: short answer (stored as text)

---

### Stage 7: Analyze Learner Signals

**What it does:** Evaluate whether behavioral signals indicate struggle requiring further adaptation

**Client-side vs Server-side:** 100% client-side

**Why:** Simple threshold-based analysis requires only local data. No network call needed.

**Technical details:**

#### Signals Tracked:
1. **Question accuracy:** % correct on recent chunks (sliding window of last 3 chunks)
2. **Time-on-task:** Average time per chunk vs baseline (what's "normal" for this content)
3. **Re-reading frequency:** Number of re-read events per chunk
4. **Navigation patterns:** Backtracking (frequent previous/next switching)

#### Threshold Logic (MVP):
```javascript
function shouldReAdapt(signals) {
  // Criterion 1: Low question accuracy
  if (signals.questionAccuracy < 0.5) return true;
  
  // Criterion 2: Excessive time on task
  if (signals.avgTimePerChunk > 30000) return true; // 30 seconds
  
  // Criterion 3: High re-reading rate
  if (signals.reReadEventsPerChunk > 3) return true;
  
  return false;
}
```

**Output:** Boolean + rationale for decision (for explanation step)

---

### Stage 8: Adapt Further (If Needed)

**What it does:** Apply additional adaptation based on struggle analysis

**Client-side vs Server-side:** Hybrid (deterministic = client, AI = server, optional)

**Why:** More aggressive adaptation may require additional AI processing, but simpler adjustments (like reducing chunk size) can be done locally.

**Technical details:**

#### 8a. Deterministic Adaptation (Client, Immediate)
- Increase simplification level (if available)
- Reduce chunk size (fewer paragraphs per chunk)
- Increase line height further
- Reduce font size slightly (more whitespace)
- Apply more contrasting color scheme

#### 8b. AI Adaptation (Server, Optional)
- Only if further content simplification needed beyond deterministic limits
- Send chunks + updated profile (higher simplification level) to AI endpoint
- Request: "Apply additional simplification to this already-adapted content"
- Fallback if LLM unavailable: use deterministic-only adjustments

**Updated profile example:**
```json
{
  "profileType": "dyslexia",
  "simplificationLevel": 2,  // Increased from 1
  "chunkSize": 2,           // Reduced from 3
  "fontSize": 20,
  "lineHeight": 1.8
}
```

---

### Stage 9: Measure Progress (If No Adaptation Needed)

**What it does:** Store progress, provide summary, prepare next content segment

**Client-side vs Server-side:** 100% client-side

**Why:** Progress tracking is local data aggregation.

**Technical details:**
- Store session metrics in localStorage:
  ```json
  {
    "sessionId": "uuid",
    "chunksRead": 5,
    "totalTime": 450000,
    "questionsAnswered": 15,
    "questionsCorrect": 12,
    "adaptationsTriggered": 0
  }
  ```
- Calculate progress percentage
- Display completion status
- Option to export progress summary (download JSON)
- Store for potential future resume (if same device/browser)

---

### Stage 10: Explain Adaptation

**What it does:** Communicate to learner why content changed and what changed

**Client-side vs Server-side:** 100% client-side

**Why:** Explanation is static text based on local analysis results.

**Technical details:**

#### Explanation Template:
```
We've adjusted the next chunk based on how you did with the previous one.

What changed:
• Shorter paragraphs (fewer sentences per chunk)
• Simpler vocabulary
• More white space between lines

Why:
You scored 40% on the last chunk's questions, which suggests the content may have been too dense. We've simplified it to help you better understand the material.

You can always go back and re-read the previous chunk if you'd like.
```

**Display:** Modal or inline banner that can be dismissed

**Options:**
- "Go to next chunk" (accepts adaptation)
- "Re-read previous chunk" (revert to original adaptation)
- "Customize settings" (open profile editor)

---

### Stage 11: Update Adaptation

**What it does:** Apply newly adapted content to the reader

**Client-side vs Server-side:** 100% client-side

**Why:** Content is already available from Stage 8.

**Technical details:**
- Replace chunk DOM with new adapted content
- Reset reading time for new chunk
- Reset question state (questions are re-displayed)
- Update progress indicator
- Log adaptation event for session analytics

---

### Stage 12: Store Progress Data

**What it does:** Persist session data for continuity

**Client-side vs Server-side:** 100% client-side

**Why:** localStorage provides persistence without backend.

**Technical details:**
- Update session object with new metrics
- Store chunk-level data: adaptation applied, question results, time on task
- Optional: Send anonymized analytics to telemetry endpoint (opt-in, POST /api/analytics)