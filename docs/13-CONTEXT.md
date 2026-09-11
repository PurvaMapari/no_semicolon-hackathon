# PRISM — Context (Quick Reference)

> **Read this file first for fast orientation. Then read the relevant spec doc for your task.**

---

## Product

**PRISM** — Personalized Reader for Intelligent Study Methods
*"The lesson that reshapes itself to how you actually learn."*

Adaptive educational accessibility system with a closed behavioral feedback loop.

---

## Core Problem

Educational content is static. Learners are not. Existing tools offer static formatting or AI chatbots, but none create a feedback loop that detects struggle, adapts content, explains the adaptation, and measures the outcome.

---

## Architecture (Cache-First)

```
Upload → Extract → LLM Structure → Cache variants → Serve to reader
Reader → Signal capture → SCALE engine → REWIRE → Measure outcome → Loop
```

**Critical rule:** No LLM calls in the live adaptation path. All AI work is cached at upload time.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React 18 + Vite + Tailwind |
| Backend | Node.js 20 + Express |
| Database | SQLite (better-sqlite3) |
| AI/LLM | GPT-4o-mini (upload-time only) |
| PDF | PDF.js + Tesseract.js (OCR) |
| STT | Web Speech Recognition API |
| TTS | Web Speech Synthesis API |
| Testing | Vitest + Playwright + Supertest |

---

## SCALE — The Adaptive Engine

**S**ignal → **C**alibrate → **A**dapt → **L**et learner engage → **E**valuate

- **Signals:** dwell time, reread count, scroll-back, help requests, question accuracy, answer latency, retries, voice help
- **Calibrate:** Normalize signals (0–1) against baselines
- **Adapt:** Struggle score > 0.6 threshold → select adaptation strategy
- **Let engage:** Present adapted content via REWIRE
- **Evaluate:** Compare pre/post accuracy → outcome measurement

Deterministic rules. No ML. No LLM. See `07-ADAPTIVE-ENGINE-LOGIC.md`.

---

## REWIRE — The Signature Feature

When SCALE detects struggle:
1. Content visibly restructures (cached variant swap)
2. "Why I adapted" explanation appears
3. Next question adapts
4. Outcome measured

See `09-DESIGN-SYSTEM.md` §12 for visual behavior.

---

## Voice (Day-1)

Intents: "Read this", "Explain this", "Explain it simply", "Give me an example", "Repeat that", "Answer [option]"

Voice help requests generate SCALE signals. Text fallbacks for all voice actions.

See `15-VOICE-INTERACTION.md`.

---

## Team

| Member | Focus |
|--------|-------|
| M1 | AI + Content Intelligence (extraction, structuring, caching) |
| M2 | SCALE + Adaptive Intelligence (signals, struggle score, adaptation) |
| M3 | Frontend + Accessibility + REWIRE (UI, reader, transitions) |
| M4 | Assessment + Voice + Integration + QA (questions, voice, testing) |

See `10-TEAM-PLAN.md`.

---

## Critical Rules

1. Structured content representation is the source of truth (not learner profile)
2. No LLM in live adaptation hot path
3. Cache all AI outputs at upload time
4. Voice is Day-1, not a stretch goal
5. REWIRE must be visible and explainable
6. Deterministic SCALE engine (rules, not ML)
7. No clinical/diagnostic claims — use "learning signals", "struggle estimate"
8. No chatbot, gamification, mobile, LMS, custom model
9. Update `00-PHASE-STATUS.md` after completing any phase
10. Read `04-API-CONTRACT.md` before changing APIs

---

## Document References

| Doc | Purpose | Read When |
|-----|---------|-----------|
| [00-PHASE-STATUS.md](file:///c:/Users/Acer/Downloads/prism-hakathon/no_semicolon-hackathon/docs/00-PHASE-STATUS.md) | Implementation progress | **Always read first** |
| [01-PRD.md](file:///c:/Users/Acer/Downloads/prism-hakathon/no_semicolon-hackathon/docs/01-PRD.md) | Product requirements | Understanding scope |
| [02-ARCHITECTURE.md](file:///c:/Users/Acer/Downloads/prism-hakathon/no_semicolon-hackathon/docs/02-ARCHITECTURE.md) | System architecture | Design decisions |
| [03-TECH-STACK.md](file:///c:/Users/Acer/Downloads/prism-hakathon/no_semicolon-hackathon/docs/03-TECH-STACK.md) | Technology choices | Setup/dependencies |
| [04-API-CONTRACT.md](file:///c:/Users/Acer/Downloads/prism-hakathon/no_semicolon-hackathon/docs/04-API-CONTRACT.md) | API endpoints | Changing APIs |
| [05-DATA-MODEL.md](file:///c:/Users/Acer/Downloads/prism-hakathon/no_semicolon-hackathon/docs/05-DATA-MODEL.md) | Database schemas | Changing data |
| [06-AI-RULES-AND-SYSTEM-PROMPTS.md](file:///c:/Users/Acer/Downloads/prism-hakathon/no_semicolon-hackathon/docs/06-AI-RULES-AND-SYSTEM-PROMPTS.md) | LLM prompts | AI work |
| [07-ADAPTIVE-ENGINE-LOGIC.md](file:///c:/Users/Acer/Downloads/prism-hakathon/no_semicolon-hackathon/docs/07-ADAPTIVE-ENGINE-LOGIC.md) | SCALE engine | Adaptation logic |
| [15-VOICE-INTERACTION.md](file:///c:/Users/Acer/Downloads/prism-hakathon/no_semicolon-hackathon/docs/15-VOICE-INTERACTION.md) | Voice architecture | Voice features |
| [18-GOLDEN-PATH-FIXTURE.md](file:///c:/Users/Acer/Downloads/prism-hakathon/no_semicolon-hackathon/docs/18-GOLDEN-PATH-FIXTURE.md) | Demo fixture | Testing/demo |
