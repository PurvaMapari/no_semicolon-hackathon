# PRISM — Product Requirements Document

## Product Name

**PRISM** — Personalized Reader for Intelligent Study Methods

## Tagline

_"The lesson that reshapes itself to how you actually learn."_

## One-Line Pitch

PRISM is an adaptive educational accessibility system that detects when a learner is struggling, visibly restructures the lesson to match how they learn, explains why it adapted, and measures whether the change actually helped.

## 30-Second Pitch

> Imagine a student reading a dense textbook chapter. She re-reads the same paragraph three times. A normal tool doesn't notice. PRISM does.
>
> PRISM captures that signal — the re-reads, the slow pace, the wrong answers — and runs it through our SCALE engine: Signal, Calibrate, Adapt, Let learner engage, Evaluate.
>
> When struggle is detected, PRISM triggers REWIRE: the content visibly restructures itself — shorter sentences, a visual explanation, different chunking — and a message appears: *"We noticed repeated re-reads, so we switched to shorter chunks and a visual explanation."*
>
> Then the next question adapts too. And we measure: did comprehension improve?
>
> This isn't a chatbot. This isn't "make the text bigger." This is a closed behavioral adaptation loop that continuously optimizes for how this student actually learns.

---

## Problem Statement

### The Core Problem

Educational content is static. Learners are not. When a student struggles with dense material, existing tools offer only:

- **Static formatting** (larger fonts, different colors) — doesn't simplify or restructure content
- **AI chatbots** — require the student to prompt, remember context, and reconstruct documents manually
- **One-shot personalization** — adapt once, never re-evaluate whether it worked
- **No behavioral feedback loop** — the tool doesn't know if the student is actually struggling

None of these create a **closed adaptation loop** that detects struggle, adapts, explains the adaptation, and measures the outcome.

### Realistic Scenario

Maya is a 10th-grade student with dyslexia. Her history class assigns a 12-page chapter on the Industrial Revolution. The textbook uses small font, narrow spacing, and complex vocabulary. Maya starts reading but loses her place, skips lines, and misreads words. After 10 minutes she's absorbed one paragraph and feels overwhelmed.

**With PRISM:**
1. Maya uploads the chapter
2. PRISM extracts and structures the content into a concept graph
3. Based on her dyslexia profile, PRISM renders an initial personalized version
4. As Maya reads, PRISM tracks her behavior — she re-reads paragraph 3 twice
5. SCALE detects elevated struggle: reread_count=2, dwell_time exceeds baseline
6. REWIRE activates: the content visibly restructures into shorter chunks with a visual explanation
7. A message appears: *"We noticed you re-read this section, so we broke it into smaller pieces and added a diagram description."*
8. The next comprehension question is adapted to test the specific concept she struggled with
9. Maya answers correctly — PRISM records the outcome and continues with the adapted approach

---

## Target Users

### Primary
Students in grades 6–12 with identified learning differences (dyslexia, visual impairments, ADHD, processing speed differences) or undiagnosed struggles with reading comprehension.

### Secondary
Educators (teachers, tutors, special education staff) who need to quickly adapt materials for multiple students with varying needs.

### Tertiary
Parents supporting at-home learning, homeschooling co-ops, and learning specialists.

---

## User Personas

### Persona 1: Maya (Primary User — Student with Dyslexia)
- **Age:** 15, 10th grade
- **Learning difference:** Dyslexia
- **Pain points:** Dense paragraphs, small fonts, complex vocabulary, loses her place when reading
- **Goals:** Understand history content without feeling overwhelmed, pass comprehension checks
- **Tech comfort:** Uses Chrome daily, familiar with TTS tools
- **PRISM usage:** Uploads textbook chapters, uses voice commands ("Read this", "Explain it simply"), relies on REWIRE to restructure content when she struggles

### Persona 2: Raj (Primary User — Student with Low Vision)
- **Age:** 13, 8th grade
- **Learning difference:** Low vision (legally blind)
- **Pain points:** Standard font sizes unreadable, images without descriptions, poor contrast
- **Goals:** Access science content independently with high-contrast, large-text, and audio
- **Tech comfort:** Screen reader user, keyboard navigator
- **PRISM usage:** High-contrast profile, voice-first interaction, listens to content via TTS, answers questions by voice

### Persona 3: Ms. Chen (Secondary User — Special Education Teacher)
- **Age:** 34
- **Role:** Special education teacher, serves 18 students with varying needs
- **Pain points:** Manually adapting materials for each student takes hours, no way to know what works
- **Goals:** Quickly generate accessible versions of curriculum materials, see which adaptations improve comprehension
- **PRISM usage:** Uploads lesson materials, reviews adaptation outcomes per student profile

### Persona 4: David (Primary User — Student with ADHD)
- **Age:** 16, 11th grade
- **Learning difference:** ADHD
- **Pain points:** Loses focus on long texts, skips sections, rushes through questions
- **Goals:** Stay engaged through a full chapter, retain key concepts
- **Tech comfort:** Heavy mobile/desktop user
- **PRISM usage:** Cognitive-load profile with smaller chunks, benefits from REWIRE when skip-signals detected

---

## Why Existing Tools Are Insufficient

| Tool Type | What It Does | What It Misses |
|-----------|-------------|----------------|
| **Font/display adjusters** (e.g., browser extensions) | Change font size, spacing, colors | Don't simplify content, don't detect struggle, don't adapt |
| **AI chatbots** (e.g., ChatGPT) | Answer questions about content | Require user to prompt, no persistent profile, no behavioral tracking, no structured lesson flow |
| **Text-to-speech readers** | Read text aloud | Don't restructure content, don't detect comprehension failure |
| **Readability tools** (e.g., Rewordify) | Replace complex words | One-shot transformation, no feedback loop, no personalization |
| **LMS accessibility features** | Basic font/contrast settings | Static settings, no behavioral adaptation, no outcome measurement |

**PRISM's differentiator:** A closed **SCALE** behavioral loop where the system continuously **detects struggle → adapts content → explains the adaptation → measures the outcome → refines further**.

---

## Why This Is Adaptive Educational Technology

PRISM is NOT:
- A PDF reformatter
- An AI chatbot
- A text-to-speech reader
- A static accessibility settings panel

PRISM IS:
- A **behavioral adaptive system** with a closed feedback loop
- Built on a **structured content representation** (not raw text transformation)
- Using **deterministic signal processing** and **rule-based adaptation** in the live path
- Using **cached AI outputs** (not live LLM calls) for content alternatives
- Providing **visible, explainable adaptation** (REWIRE)
- **Measuring outcomes** to validate whether adaptation helped

---

## Non-Clinical / Non-Diagnostic Positioning

PRISM does NOT:
- Diagnose learning disabilities or medical conditions
- Measure cognitive load clinically
- Provide medical or psychological assessments
- Store diagnostic information
- Claim therapeutic outcomes

PRISM DOES:
- Detect **learning signals** (behavioral patterns during reading)
- Estimate **interaction difficulty** (based on observable behaviors)
- Compute **struggle estimates** (normalized scores from signals)
- Measure **comprehension outcomes** (question accuracy before/after adaptation)
- Use behavioral terminology throughout

---

## Core Innovation: SCALE + REWIRE

### SCALE — The Adaptive Engine

**S**ignal → **C**alibrate → **A**dapt → **L**et learner engage → **E**valuate

1. **Signal:** Capture learner behavioral signals (dwell time, rereads, scroll-backs, help requests, question accuracy, answer latency, retries, voice help requests)
2. **Calibrate:** Normalize signals against baselines, compute struggle score
3. **Adapt:** When struggle threshold is met, select adaptation strategy and retrieve cached content variant
4. **Let learner engage:** Present adapted content, let learner interact
5. **Evaluate:** Measure outcome (did comprehension improve?), update learner state, loop continues

### REWIRE — The Signature Feature

When SCALE detects meaningful struggle, REWIRE activates:
1. Current content visibly restructures (animation/transition)
2. "Why I adapted" explanation appears
3. Next interaction/question changes appropriately
4. Outcome is measured

---

## MVP Scope (24-Hour Hackathon)

### MUST BUILD

#### Input Layer
- PDF upload with text extraction (PDF.js)
- Text paste (max 5000 words)
- OCR fallback for image-based PDFs (Tesseract.js, best-effort)

#### Content Intelligence (AI — Pre-generation)
- LLM-powered content structuring: document → sections → concepts
- Pre-generate alternate explanations per concept (levels 1–3)
- Pre-generate visual descriptions for concepts
- Pre-generate comprehension questions per concept
- Cache all LLM outputs (SQLite)
- Fact-preservation guardrails

#### Learner Profile
- Four pre-configured profiles: Dyslexia, Low Vision, Cognitive Load, Custom
- Profile persistence (SQLite)
- Profile editing (font, spacing, color, simplification level, voice preferences)

#### Accessible Reader
- Clean, focused reader interface
- Deterministic typography/spacing based on profile
- Chunk navigation (prev/next, progress indicator)
- Read-aloud with synced word highlighting (Web Speech Synthesis API)
- Keyboard-navigable
- Proper ARIA labels and focus management

#### SCALE Adaptive Engine
- Signal capture: dwell time, reread count, scroll-back, help requests, question accuracy, answer latency, retry count, voice help requests
- Deterministic signal normalization
- Struggle score computation
- Threshold-based adaptation rules
- Cooldown mechanism (prevent adaptation loops)
- Adaptation history tracking

#### REWIRE
- Visible content restructuring with transition animation
- "Why I adapted" explanation banner
- Adaptive question selection post-REWIRE
- Outcome measurement (pre/post accuracy comparison)
- Learner choice: accept adaptation, revert, or customize

#### Voice Interaction (Day-1)
- Speech-to-text for voice commands (Web Speech Recognition API)
- Text-to-speech for content reading (Web Speech Synthesis API)
- Intent routing: "Read this", "Explain this", "Explain it simply", "Give me an example", "Repeat that", "Answer"
- Voice quiz answering
- Voice signals fed into SCALE engine
- Text fallbacks when voice fails

#### Assessment
- 3 comprehension questions per concept (pre-generated)
- Multiple choice and true/false
- Answer verification with explanations
- Adaptive question after REWIRE

### NICE TO HAVE (If Time Permits)
- Concept explanation popups (hover/click)
- Bookmarking and note-taking
- Dark/light mode toggle
- Progress dashboard with visualizations
- Answer explanations for incorrect responses
- Synced word highlighting during TTS playback
- Playback speed control for TTS

### FUTURE SCOPE
- Full backend with user accounts and cloud persistence
- Curriculum-aligned adaptation suggestions from educators
- Mobile-responsive design
- LMS integration (Canvas, Google Classroom, Moodle)
- Parent portal with progress summaries
- Multilingual support
- Long-term learner modeling across sessions
- Advanced analytics dashboard

### EXPLICITLY OUT OF SCOPE
- **No chatbot or avatar** — PRISM is not a conversational agent
- **No gamification** — no points, badges, leaderboards
- **No native mobile app** — web-only for MVP
- **No LMS integration** — standalone application
- **No custom model training** — use existing LLM with prompt engineering
- **No medical/diagnostic claims** — behavioral terminology only
- **No microservices** — monolithic backend for MVP
- **No payment/monetization** — no subscriptions or billing
- **No real-time collaboration** — single-user sessions
- **No video/audio content** — text and PDF only
- **No live LLM in adaptation hot path** — cached alternatives only