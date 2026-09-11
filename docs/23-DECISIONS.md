# PRISM — Decision Log

---

## Format

Each decision records **what** was decided, **why**, **alternatives considered**, and **date**.

---

## Decision 1: Deterministic Content Extraction

**Decision:** Use deterministic extraction (PDF.js + Tesseract.js) rather than LLM-based extraction.

**Why:** Text extraction is a solved problem. PDF.js handles text-based PDFs reliably. Tesseract.js handles image-based PDFs as fallback. No need for LLM at this stage — it adds latency and cost without benefit.

**Alternatives considered:**
- LLM-based extraction (send PDF pages as images to GPT-4V) — too slow, too expensive
- Third-party extraction API (Adobe PDF Services) — paid, adds dependency

**Date:** 2026-09-11

---

## Decision 2: Structured Content Representation as Source of Truth

**Decision:** The content graph (document → sections → concepts → variants) is the authoritative data structure. The learner profile provides preferences, but the content graph drives what can be adapted.

**Why:** Separating content structure from learner state enables deterministic adaptation. SCALE selects from pre-existing variants rather than generating new content on the fly.

**Alternatives considered:**
- Learner profile as source of truth (profile determines content) — conflates preferences with content, makes adaptation unpredictable
- Raw text as source of truth — no structure to navigate or adapt

**Date:** 2026-09-11

---

## Decision 3: Cache-First AI Architecture

**Decision:** All LLM work (structuring, simplification, visual descriptions, questions) happens at upload time. Outputs are cached in SQLite. The live adaptation path retrieves cached alternatives.

**Why:** LLM calls are slow (1–5s) and unreliable (rate limits, timeouts). The live path must be instant and deterministic. Caching ensures the learner never waits for AI during reading.

**Alternatives considered:**
- Live LLM calls during adaptation — too slow, unreliable, poor UX
- Pre-generated static files — inflexible, can't adapt to document content

**Date:** 2026-09-11

---

## Decision 4: Deterministic Adaptive Engine (No ML)

**Decision:** SCALE uses weighted signal normalization, threshold rules, and deterministic strategy selection. No trained ML classifier.

**Why:** An ML classifier would require training data we don't have. Rule-based adaptation is transparent, debuggable, and sufficient for MVP. Thresholds can be tuned manually.

**Alternatives considered:**
- Trained ML classifier (predict struggle from signals) — no training data, black box
- LLM-based adaptation decisions (ask GPT whether to adapt) — too slow, non-deterministic
- No adaptation (static personalization only) — misses the core innovation

**Date:** 2026-09-11

---

## Decision 5: No LLM in Live Adaptation Hot Path

**Decision:** REWIRE retrieves pre-cached content variants. No new LLM request is made when adaptation triggers.

**Why:** The adaptation moment is time-critical — the learner is already struggling. Any latency worsens the experience. Cached variants are served in <100ms.

**Alternatives considered:**
- Generate new simplification on-the-fly — 2–5s delay during the exact moment the learner needs help
- Hybrid (try cache, fall back to LLM) — adds complexity, still risks latency

**Date:** 2026-09-11

---

## Decision 6: SQLite for MVP Database

**Decision:** Use SQLite (better-sqlite3) as the single database for all persistence needs.

**Why:** Embedded, zero-config, single file. No separate database server to manage. Sufficient for single-server MVP. better-sqlite3 is synchronous and fast for read-heavy workloads.

**Alternatives considered:**
- localStorage only — insufficient for structured content graph, no server-side access
- PostgreSQL (via Supabase) — overkill for MVP, adds external dependency
- MongoDB — schema-less doesn't match our well-defined data model

**Date:** 2026-09-11

---

## Decision 7: Browser-Native TTS/STT

**Decision:** Use Web Speech Synthesis API (TTS) and Web Speech Recognition API (STT) rather than paid voice services.

**Why:** Zero cost, zero setup, instant availability. Browser APIs are sufficient for MVP quality. Chrome/Edge support is reliable.

**Alternatives considered:**
- Google Cloud Text-to-Speech — higher quality but adds cost and API key dependency
- Eleven Labs — premium voices but paid
- Custom voice cloning — explicitly prohibited by spec

**Date:** 2026-09-11

---

## Decision 8: Voice as Day-1 Core Feature

**Decision:** Voice interaction is available from the beginning. Not treated as a "nice-to-have" or stretch goal.

**Why:** Voice is a primary accessibility channel for users who cannot or prefer not to interact via mouse/keyboard. It's also a signal source for SCALE (voice help requests).

**Alternatives considered:**
- Voice as stretch goal — reduces accessibility, loses signal data
- Voice as post-MVP — contradicts spec requirement

**Date:** 2026-09-11

---

## Decision 9: No Clinical or Diagnostic Claims

**Decision:** PRISM uses behavioral terminology exclusively. No claims about measuring medical conditions or cognitive load clinically.

**Why:** PRISM is an educational tool, not a medical device. Clinical claims would require regulatory compliance (FDA, HIPAA), clinical validation, and professional oversight.

**Terminology:**
- ✅ "learning signals", "interaction difficulty", "struggle estimate", "comprehension outcome"
- ❌ "cognitive load measurement", "dyslexia detection", "ADHD diagnosis", "learning disability classification"

**Date:** 2026-09-11

---

## Decision 10: No Custom Model Training

**Decision:** Use existing LLM (GPT-4o-mini) with prompt engineering. No fine-tuning or custom model training during hackathon.

**Why:** Training requires data, compute, and time — none of which are available in a 24-hour hackathon. Prompt engineering with a strong base model is faster and more flexible.

**Alternatives considered:**
- Fine-tune on educational text — no training data prepared, takes hours
- Use a pre-trained educational model — none available with sufficient quality

**Date:** 2026-09-11

---

## Decision 11: React + Vite Frontend

**Decision:** React 18 with Vite as build tool.

**Why:** Component architecture enables parallel development (each member builds independent components). Vite provides instant HMR. Largest ecosystem for accessibility libraries and tooling.

**Alternatives considered:**
- Next.js — SSR not needed for MVP, adds complexity
- Svelte — smaller ecosystem, less familiar to team
- Vanilla JS — slower development, no component reuse

**Date:** 2026-09-11

---

## Decision 12: Express.js Backend

**Decision:** Express 4.x as the backend framework.

**Why:** Minimal, mature, well-documented. Simple to set up REST endpoints. Team familiarity. No learning curve.

**Alternatives considered:**
- Fastify — faster but more setup
- Hono — modern but less ecosystem
- Python/FastAPI — different language from frontend, context switching cost

**Date:** 2026-09-11

---

## Decision 13: No Chatbot or Avatar

**Decision:** PRISM does not include a conversational chatbot or visual avatar.

**Why:** Chatbots require users to prompt and formulate questions. PRISM's core innovation is automatic, zero-prompt adaptation. Adding a chatbot would dilute the message and confuse the value proposition.

**Date:** 2026-09-11

---

## Decision 14: No Gamification

**Decision:** No points, badges, leaderboards, or reward systems.

**Why:** Gamification is orthogonal to the core SCALE/REWIRE loop. It adds development time without strengthening the demo narrative. Risk of appearing gimmicky rather than serious accessibility tech.

**Date:** 2026-09-11

---

## Decision 15: No Native Mobile

**Decision:** Web-only application. No iOS/Android native app.

**Why:** Web provides universal access. Native mobile development doubles the workload. Web Speech APIs work on mobile Chrome. Responsive design can be added post-MVP.

**Date:** 2026-09-11

---

## Decision 16: Monolithic Backend

**Decision:** Single Express.js server with all endpoints. No microservices.

**Why:** Microservices add deployment complexity, inter-service communication, and debugging overhead. A monolithic server is simpler to develop, deploy, and debug in a 24-hour hackathon.

**Date:** 2026-09-11

---

## Decision 17: Tailwind CSS for Styling

**Decision:** Use Tailwind CSS v3 (via CDN for rapid setup).

**Why:** Utility-first approach enables fast iteration. No CSS file management. Consistent spacing/color system. CDN setup requires zero build configuration.

**Alternatives considered:**
- Plain CSS — slower development, inconsistent patterns
- Styled-components — adds dependency, runtime CSS-in-JS overhead
- CSS Modules — good but slower for rapid prototyping

**Date:** 2026-09-11

---

## Decision 18: Zod for Validation

**Decision:** Use Zod for runtime schema validation on all API inputs and LLM outputs.

**Why:** TypeScript-first, composable, great error messages. Validates that LLM JSON output matches expected schema before storage.

**Alternatives considered:**
- Joi — mature but less TypeScript integration
- Manual validation — error-prone, no schema reuse
- Ajv (JSON Schema) — verbose, harder to read

**Date:** 2026-09-11
