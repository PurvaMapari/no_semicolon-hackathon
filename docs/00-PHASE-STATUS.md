# PRISM — Phase Status

> **This file is the SINGLE SOURCE OF TRUTH for implementation progress.**
> Every coding agent MUST read this file before inspecting the codebase.
> Purpose: Prevent agents from wasting tokens rediscovering already-completed implementation.

---

## Current Phase

**Phase 0 — Documentation & Architecture**

## Overall Project Status

⬜ NOT STARTED (Documentation in progress)

## Last Updated

`2026-09-11T18:00:00+05:30`

---

## Phase Table

| # | Phase | Owner | Status | Completion | Notes |
|---|-------|-------|--------|------------|-------|
| 0 | Documentation & Architecture | All | 🟡 IN PROGRESS | 100% | All 24 docs created |
| 1 | Content Extraction & Structuring | M1 | ⬜ NOT STARTED | 0% | — |
| 2 | AI Content Intelligence (LLM Prompts, Caching) | M1 | ⬜ NOT STARTED | 0% | — |
| 3 | SCALE Adaptive Engine | M2 | ⬜ NOT STARTED | 0% | — |
| 4 | Signal Capture & Processing | M2 | ⬜ NOT STARTED | 0% | — |
| 5 | Frontend Foundation & Accessible Reader | M3 | ⬜ NOT STARTED | 0% | — |
| 6 | REWIRE Visual Behavior | M3 | ⬜ NOT STARTED | 0% | — |
| 7 | Assessment & Question Engine | M4 | ⬜ NOT STARTED | 0% | — |
| 8 | Voice Interaction (STT + TTS + Intents) | M4 | ⬜ NOT STARTED | 0% | — |
| 9 | Integration & End-to-End Flow | All | ⬜ NOT STARTED | 0% | — |
| 10 | Testing & QA | All | ⬜ NOT STARTED | 0% | — |
| 11 | Demo Preparation | All | ⬜ NOT STARTED | 0% | — |

---

## Completed Tasks

_None yet — documentation phase._

---

## Remaining Tasks

### Phase 1: Content Extraction & Structuring (M1)
- [ ] PDF text extraction with PDF.js
- [ ] OCR fallback with Tesseract.js
- [ ] Deterministic text segmentation (sentences, paragraphs, headers)
- [ ] Content structuring via LLM (document → sections → concepts)
- [ ] Cache structured content representation
- [ ] Pre-generate alternate explanations, visual descriptions, questions
- [ ] Store all LLM outputs in cache (SQLite)

### Phase 2: AI Content Intelligence (M1)
- [ ] System prompts for content structuring
- [ ] System prompts for simplification (levels 1–3)
- [ ] System prompts for alternate explanation generation
- [ ] System prompts for visual description generation
- [ ] System prompts for question generation
- [ ] System prompts for adaptation explanation
- [ ] Fact-preservation guardrails
- [ ] JSON schema validation for all LLM outputs

### Phase 3: SCALE Adaptive Engine (M2)
- [ ] Signal normalization pipeline
- [ ] Struggle score calculation
- [ ] Threshold-based adaptation rules
- [ ] Cooldown mechanism
- [ ] Adaptation loop prevention
- [ ] Adaptation history tracking
- [ ] Strategy selection (which cached variant to retrieve)

### Phase 4: Signal Capture & Processing (M2)
- [ ] Dwell time tracking
- [ ] Reread count detection
- [ ] Scroll-back detection
- [ ] Help request counting
- [ ] Question accuracy tracking
- [ ] Answer latency measurement
- [ ] Retry detection
- [ ] Voice help request signals

### Phase 5: Frontend Foundation & Accessible Reader (M3)
- [ ] Upload/paste UI
- [ ] Learner profile selector and editor
- [ ] Accessible reader component (typography, spacing, color)
- [ ] Chunk navigation (prev/next, progress indicator)
- [ ] Read-aloud controls (play/pause/stop, speed)
- [ ] Keyboard navigation
- [ ] Focus management
- [ ] Reduced-motion support
- [ ] ARIA labels and screen reader support
- [ ] Responsive layout

### Phase 6: REWIRE Visual Behavior (M3)
- [ ] Visible content restructuring animation
- [ ] "Why I adapted" explanation banner
- [ ] Adaptation transition (old content → new content)
- [ ] Adapted question display
- [ ] Outcome feedback display
- [ ] Learner choice (accept, revert, customize)

### Phase 7: Assessment & Question Engine (M4)
- [ ] Question display component (MC, T/F)
- [ ] Answer submission and verification
- [ ] Score calculation
- [ ] Answer explanation display
- [ ] Adaptive question selection post-REWIRE

### Phase 8: Voice Interaction (M4)
- [ ] STT integration (Web Speech Recognition API)
- [ ] TTS integration (Web Speech Synthesis API)
- [ ] Intent router ("Read this", "Explain this", "Simplify", etc.)
- [ ] Voice quiz answering
- [ ] Voice signals → SCALE engine
- [ ] Playback speed control
- [ ] Text fallbacks for voice failures
- [ ] Privacy handling

### Phase 9: Integration (All)
- [ ] End-to-end flow: Upload → Structure → Profile → Render → Signal → SCALE → REWIRE
- [ ] API endpoint wiring
- [ ] State management integration
- [ ] Error/fallback paths

### Phase 10: Testing & QA (All)
- [ ] Unit tests for adaptive engine
- [ ] API endpoint tests
- [ ] Accessibility acceptance tests
- [ ] Golden-path fixture test
- [ ] Demo smoke test

### Phase 11: Demo Preparation (All)
- [ ] Golden-path fixture loaded and verified
- [ ] Demo script rehearsed
- [ ] Recording/screenshot preparation

---

## Files Created/Modified

| File | Status | Owner | Phase |
|------|--------|-------|-------|
| `docs/00-PHASE-STATUS.md` | 🟢 Created | All | 0 |
| `docs/01-PRD.md` | 🟢 Revised | All | 0 |
| `docs/02-ARCHITECTURE.md` | 🟢 Revised | All | 0 |
| `docs/03-TECH-STACK.md` | 🟢 Revised | All | 0 |
| `docs/04-API-CONTRACT.md` | 🟢 Revised | All | 0 |
| `docs/05-DATA-MODEL.md` | 🟢 Revised | All | 0 |
| `docs/06-AI-RULES-AND-SYSTEM-PROMPTS.md` | 🟢 Created | M1 | 0 |
| `docs/07-ADAPTIVE-ENGINE-LOGIC.md` | 🟢 Created | M2 | 0 |
| `docs/08-SKILLS.md` | 🟢 Created | All | 0 |
| `docs/09-DESIGN-SYSTEM.md` | 🟢 Created | M3 | 0 |
| `docs/10-TEAM-PLAN.md` | 🟢 Created | All | 0 |
| `docs/11-BUILD-TIMELINE.md` | 🟢 Created | All | 0 |
| `docs/12-DEMO-SCRIPT.md` | 🟢 Created | All | 0 |
| `docs/13-CONTEXT.md` | 🟢 Created | All | 0 |
| `docs/14-AGENT-INSTRUCTIONS.md` | 🟢 Created | All | 0 |
| `docs/15-VOICE-INTERACTION.md` | 🟢 Created | M4 | 0 |
| `docs/16-ACCESSIBILITY-QA.md` | 🟢 Created | M3 | 0 |
| `docs/17-TESTING.md` | 🟢 Created | All | 0 |
| `docs/18-GOLDEN-PATH-FIXTURE.md` | 🟢 Created | All | 0 |
| `docs/19-ENVIRONMENT-AND-CONFIG.md` | 🟢 Created | All | 0 |
| `docs/20-SECURITY-PRIVACY.md` | 🟢 Created | All | 0 |
| `docs/21-DEPLOYMENT.md` | 🟢 Created | All | 0 |
| `docs/22-GIT-AND-CONTRIBUTION.md` | 🟢 Created | All | 0 |
| `docs/23-DECISIONS.md` | 🟢 Created | All | 0 |

---

## APIs Completed

_None yet — documentation phase._

---

## Schemas Completed

_None yet — documentation phase. Schemas defined in `05-DATA-MODEL.md`._

---

## Known Issues

| # | Issue | Severity | Owner | Status |
|---|-------|----------|-------|--------|
| — | _No known issues_ | — | — | — |

---

## Blockers

| # | Blocker | Impact | Owner | Status |
|---|---------|--------|-------|--------|
| — | _No blockers_ | — | — | — |

---

## Handoff Notes

- **Phase 0 → Phase 1 (M1):** All documentation is complete. Read `13-CONTEXT.md` for quick orientation, then read `06-AI-RULES-AND-SYSTEM-PROMPTS.md` for exact prompts. Build against the golden-path fixture in `18-GOLDEN-PATH-FIXTURE.md`.
- **Phase 0 → Phase 3 (M2):** Read `07-ADAPTIVE-ENGINE-LOGIC.md` for exact signal calculations, thresholds, and adaptation rules. Use the fixture in `18-GOLDEN-PATH-FIXTURE.md` for testing.
- **Phase 0 → Phase 5 (M3):** Read `09-DESIGN-SYSTEM.md` for typography, colors, and REWIRE visual behavior. Read `16-ACCESSIBILITY-QA.md` for acceptance criteria.
- **Phase 0 → Phase 7 (M4):** Read `15-VOICE-INTERACTION.md` for voice architecture. Read `04-API-CONTRACT.md` for endpoint contracts.

---

## Important Architectural Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | Structured content representation is source of truth | Content graph (doc → sections → concepts → variants) enables deterministic adaptation without live LLM calls | 2026-09-11 |
| 2 | Cache-first AI architecture | Pre-generate all alternate explanations, visual descriptions, and questions during upload. Live path retrieves from cache. | 2026-09-11 |
| 3 | Deterministic SCALE engine (no ML) | Rule-based signal processing + threshold adaptation. No trained classifier for MVP. | 2026-09-11 |
| 4 | No LLM in live adaptation hot path | REWIRE retrieves cached alternatives. LLM only runs during content upload/structuring. | 2026-09-11 |
| 5 | SQLite for MVP persistence | Lightweight, embedded, no infrastructure. Replaces localStorage for structured data. | 2026-09-11 |
| 6 | Voice is Day-1 core feature | Web Speech API (STT + TTS) integrated from start. Not a stretch goal. | 2026-09-11 |
| 7 | Browser-native TTS/STT | Web Speech Synthesis + Recognition APIs. No paid voice services for MVP. | 2026-09-11 |
| 8 | No clinical/diagnostic claims | "Learning signals", "struggle estimate", "interaction difficulty". Never claim to measure medical conditions. | 2026-09-11 |
| 9 | No chatbot, gamification, or mobile app | Focus on SCALE + REWIRE adaptive loop as core demo. | 2026-09-11 |
| 10 | No custom model training | Use existing LLM (GPT-4o-mini) with prompt engineering. | 2026-09-11 |
