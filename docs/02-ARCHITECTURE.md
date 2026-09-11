# PRISM — Architecture Document

## Overview

PRISM implements a **closed behavioral adaptation loop** — not a one-shot personalization pipeline. The core innovation is the **SCALE** engine (Signal → Calibrate → Adapt → Let learner engage → Evaluate) paired with **REWIRE**, the visible content restructuring feature.

The **structured content representation** (content graph) is the source of truth — not the learner profile. The learner profile provides initial preferences. Observed learner behavior and outcomes refine the adaptation.

---

## Authoritative Architecture Flow

```
INPUT (PDF / TEXT)
        ↓
DETERMINISTIC EXTRACTION
        ↓
CONTENT STRUCTURING (LLM — cached)
        ↓
STRUCTURED CONTENT REPRESENTATION
  (Document → Sections → Concepts → Variants)
        ↓
LEARNER PROFILE + CONTENT STATE
        ↓
INITIAL ACCESSIBLE RENDER
        ↓
LEARNING SESSION
    ├── Text (adapted, chunked)
    ├── Visual (descriptions, diagrams)
    ├── Voice (TTS read-aloud, STT commands)
    └── Questions (comprehension checks)
        ↓
LEARNER SIGNAL CAPTURE
  (dwell time, rereads, scroll-back, help requests,
   question accuracy, answer latency, retries, voice help)
        ↓
SCALE ADAPTIVE ENGINE
  (Signal → Calibrate → Adapt → Let engage → Evaluate)
        ↓
STRUGGLE DETECTED?
    │
    ├── NO → Continue learning → Loop back to signal capture
    │
    └── YES → REWIRE
                ↓
          Select alternate cached representation
                ↓
          Change chunking / explanation / modality
                ↓
          Display "Why I adapted" explanation
                ↓
          Adapt next question
                ↓
          Learner engages again
                ↓
          Outcome measured (pre/post accuracy)
                ↓
          Learner state updated
                ↓
          SCALE LOOP CONTINUES
```

---

## AI Architecture — Cache-First

> **Critical rule:** The live adaptation hot path does NOT require a new LLM request.

```
Document Upload
      ↓
Extraction (deterministic — PDF.js / Tesseract.js)
      ↓
LLM Content Structuring (one-time)
      ↓
Cache structured representation (SQLite)
      ↓
Pre-generate alternate explanations (levels 1–3)
Pre-generate visual descriptions
Pre-generate comprehension questions
      ↓
Cache all LLM outputs (SQLite)
      ↓
Live learner interaction
      ↓
Deterministic signal processing (client-side)
      ↓
Deterministic/rule-based adaptation decision (SCALE)
      ↓
Retrieve cached alternative from content graph
      ↓
REWIRE — visible restructuring
```

**Why:** LLM calls are slow (1–5s) and unreliable. The live path must be instant and deterministic. All expensive AI work happens at upload time and is cached.

---

## Component Architecture

### 1. Input Layer

**What:** Accept content from user via PDF upload or text paste.

**Ownership:** Client → Server

| Step | Client/Server | Technology |
|------|--------------|------------|
| PDF file selection / text paste | Client | HTML input, drag-and-drop |
| PDF binary upload | Client → Server | HTTP POST multipart |
| Text extraction from PDF | Server | PDF.js (text-based) + Tesseract.js (OCR fallback) |
| Text validation & cleaning | Server | Deterministic string processing |

**Fallback:** If PDF extraction fails, return error with suggestion to paste text manually.

---

### 2. Content Structuring (LLM — One-Time)

**What:** Transform raw extracted text into a structured content graph.

**Ownership:** Server (LLM pipeline)

| Step | Client/Server | Technology |
|------|--------------|------------|
| Sentence/paragraph segmentation | Server | Deterministic (Intl.Segmenter, regex) |
| Content structuring (text → sections → concepts) | Server | LLM (GPT-4o-mini) |
| Alternate explanation generation (per concept, levels 1–3) | Server | LLM (GPT-4o-mini) |
| Visual description generation (per concept) | Server | LLM (GPT-4o-mini) |
| Question generation (per concept, 3 questions) | Server | LLM (GPT-4o-mini) |
| Cache all outputs | Server | SQLite |

**Output:** Content graph stored in SQLite:
```
Document
  └── Section[]
        └── Concept[]
              ├── original_text
              ├── variants[]: { level, simplified_text, visual_description }
              └── questions[]: { text, type, options, correct_answer, explanation }
```

**Fallback:** If LLM fails for any concept, use original text as the only variant. Questions fall back to generic self-assessment ("Did you understand this section?").

---

### 3. Learner Profile

**What:** Store and retrieve learner preferences. Provides initial adaptation settings — does NOT drive adaptation decisions (SCALE does).

**Ownership:** Client (creation/editing) + Server (persistence)

| Step | Client/Server | Technology |
|------|--------------|------------|
| Profile type selection (Dyslexia, Low Vision, Cognitive Load, Custom) | Client | React UI |
| Profile customization (font, spacing, color, voice) | Client | React UI |
| Profile persistence | Server | SQLite |

**Important:** The learner profile is NOT the adaptation engine. It provides starting preferences. The SCALE engine uses behavioral signals to make adaptation decisions.

---

### 4. Initial Accessible Render

**What:** Render content with profile-based formatting + select initial content variant.

**Ownership:** Client

| Step | Client/Server | Technology |
|------|--------------|------------|
| Apply typography (font family, size, line height, letter spacing) | Client | CSS variables |
| Apply color scheme | Client | CSS variables |
| Select initial content variant based on profile simplification level | Client | Deterministic lookup |
| Render first chunk | Client | React DOM |
| Initialize signal capture | Client | JavaScript event listeners |
| Initialize voice controls | Client | Web Speech API |

---

### 5. Learning Session — Interaction Modes

**What:** The learner interacts with adapted content through multiple modalities.

**Ownership:** Client

#### 5a. Text Interaction
- Learner reads adapted text chunks
- Chunk navigation (prev/next)
- Progress indicator (chunk X of Y)

#### 5b. Visual Interaction
- Visual descriptions rendered alongside text
- Concept explanations on hover/click (if available)

#### 5c. Voice Interaction (Day-1)
- **TTS Read-aloud:** Web Speech Synthesis API reads current chunk
- **STT Commands:** Web Speech Recognition API captures voice commands
- **Intent routing:** "Read this" → TTS, "Explain this" → show explanation variant, "Explain it simply" → show level-3 simplification, "Give me an example" → show example (if cached), "Repeat that" → re-read current chunk, "Answer" → submit voice answer to quiz
- **Voice signals:** Voice help requests ("Explain this", "Simplify") are captured as learner signals for SCALE

#### 5d. Assessment
- 3 comprehension questions per concept (pre-generated, cached)
- Multiple choice and true/false
- Answer submission, verification, and explanation display
- Answer latency tracked as signal

---

### 6. Learner Signal Capture

**What:** Capture observable behavioral signals during the learning session.

**Ownership:** Client (capture) → Client (processing)

| Signal | How Captured | Units |
|--------|-------------|-------|
| Dwell time | Timer: start on chunk render, stop on navigation | Milliseconds |
| Reread count | Scroll-back-to-top within same chunk, or re-selection of text | Count |
| Scroll-back | Navigation "previous" events | Count |
| Help request | Click "explain", "simplify", voice "explain this" | Count |
| Question accuracy | Correct answers / total answers per chunk | Ratio (0–1) |
| Answer latency | Time from question display to answer submission | Milliseconds |
| Retry | Re-answering after incorrect answer | Count |
| Voice help request | STT commands: "explain", "simplify", "repeat" | Count |

**All signals are captured client-side.** No network call needed for signal capture.

---

### 7. SCALE Adaptive Engine

**What:** The core behavioral adaptation loop.

**Ownership:** Client (signal processing is deterministic, runs entirely client-side)

```
SIGNAL CAPTURE
      ↓
NORMALIZE (against per-concept baselines)
      ↓
COMPUTE STRUGGLE SCORE (weighted sum of normalized signals)
      ↓
CHECK THRESHOLD (struggle_score > threshold?)
      ↓
CHECK COOLDOWN (last adaptation was > N chunks ago?)
      │
      ├── NO (below threshold or in cooldown) → Continue learning
      │
      └── YES → SELECT ADAPTATION STRATEGY
                      ↓
                RETRIEVE CACHED VARIANT from content graph
                      ↓
                TRIGGER REWIRE
```

**Critical:** SCALE uses **deterministic rules** and **threshold logic**. No ML classifier. No LLM call. Pure computation on client-side data.

See `07-ADAPTIVE-ENGINE-LOGIC.md` for exact calculations, thresholds, and rules.

---

### 8. REWIRE — Visible Adaptation

**What:** The signature demo feature. Content visibly restructures when SCALE detects struggle.

**Ownership:** Client (rendering) + cached content from server

**REWIRE Sequence:**

1. **Transition out:** Current content fades/slides (CSS animation, respects `prefers-reduced-motion`)
2. **Retrieve variant:** Fetch cached alternate representation from content graph (no LLM call)
3. **Restructure:** New content renders with different chunking, explanation, or modality
4. **Explain:** "Why I adapted" banner appears with human-readable explanation
   - Example: *"We noticed repeated re-reads here, so we switched to shorter chunks and a visual explanation."*
5. **Adapt question:** Next comprehension question changes to test the struggled concept
6. **Learner engages:** Learner interacts with adapted content
7. **Measure outcome:** Track accuracy on adapted question — compare to pre-adaptation accuracy
8. **Update state:** Record adaptation event, outcome, update learner state
9. **Loop:** SCALE continues monitoring from step 6

**Learner controls after REWIRE:**
- "Continue" — accept adaptation
- "Go back" — revert to previous version
- "Customize" — open profile editor

---

### 9. Outcome Measurement

**What:** Measure whether REWIRE actually helped.

**Ownership:** Client (tracking) + Server (persistence)

| Metric | How Measured |
|--------|-------------|
| Pre-adaptation accuracy | Question accuracy on chunk before REWIRE |
| Post-adaptation accuracy | Question accuracy on chunk after REWIRE |
| Outcome delta | post_accuracy - pre_accuracy |
| Dwell time change | Compare dwell time before/after adaptation |
| Help request reduction | Compare help request count before/after |

**Outcome is stored in adaptation history.** This closes the SCALE loop: the system knows whether its adaptation worked.

---

### 10. Caching Strategy

**What:** All expensive AI outputs are cached at upload time.

**Storage:** SQLite (server-side)

| Data | Cached At | Retrieved By |
|------|-----------|-------------|
| Structured content graph (sections, concepts) | Upload time | Initial render |
| Content variants (simplified levels 1–3) | Upload time | REWIRE |
| Visual descriptions | Upload time | REWIRE or initial render |
| Comprehension questions | Upload time | Assessment display |
| Adaptation explanations | REWIRE time | REWIRE banner |

**Cache invalidation:** Not needed for MVP (content is immutable once uploaded).

---

### 11. Failure & Fallback Paths

| Failure | Fallback |
|---------|----------|
| PDF extraction fails | Return error, suggest text paste |
| LLM content structuring fails | Use raw text as single concept, no variants |
| LLM variant generation fails | Use original text as only variant |
| LLM question generation fails | Use generic self-assessment questions |
| Voice STT fails | Show text input fallback |
| Voice TTS fails | Show text-only content |
| Signal capture fails | Continue without adaptation |
| SCALE threshold error | Log error, continue without adaptation |
| REWIRE cached variant missing | Continue with current content |
| SQLite write fails | Log error, continue session in memory |

**Philosophy:** Never block the learner. Always degrade gracefully. Log failures for debugging.

---

## Client/Server Ownership Summary

| Component | Client | Server |
|-----------|--------|--------|
| Input UI (upload/paste) | ✅ | — |
| PDF extraction | — | ✅ |
| Content structuring (LLM) | — | ✅ |
| Content caching | — | ✅ |
| Learner profile UI | ✅ | — |
| Learner profile persistence | — | ✅ |
| Initial render | ✅ | — |
| Signal capture | ✅ | — |
| SCALE engine (signal processing) | ✅ | — |
| REWIRE rendering | ✅ | — |
| Cached variant retrieval | ✅ (API call) | ✅ (serve from SQLite) |
| Voice STT/TTS | ✅ | — |
| Assessment UI | ✅ | — |
| Question serving | — | ✅ (from cache) |
| Outcome measurement | ✅ | — |
| Progress persistence | — | ✅ |

---

## End-to-End Data Flow

```
User uploads PDF
      ↓
[Server] PDF.js extracts text (or Tesseract.js OCR fallback)
      ↓
[Server] Deterministic segmentation (sentences, paragraphs)
      ↓
[Server] LLM structures content → sections → concepts
      ↓
[Server] LLM pre-generates variants (levels 1–3) per concept
[Server] LLM pre-generates visual descriptions per concept
[Server] LLM pre-generates questions (3) per concept
      ↓
[Server] Cache all outputs → SQLite
      ↓
[Server → Client] Return structured content graph + variants
      ↓
[Client] Load/create learner profile
[Client] Select initial variant based on profile.simplificationLevel
[Client] Apply typography/color from profile
      ↓
[Client] Render first chunk → start signal capture
      ↓
[Client] Learner reads / listens / answers / uses voice
      ↓
[Client] Signals accumulate per chunk
[Client] SCALE computes struggle score
      ↓
[Client] Struggle detected? → REWIRE
      ↓
[Client → Server] Request cached variant (if not already loaded)
      ↓
[Client] Render adapted content + explanation + adapted question
      ↓
[Client] Measure outcome → update learner state
      ↓
[Client] SCALE loop continues
```