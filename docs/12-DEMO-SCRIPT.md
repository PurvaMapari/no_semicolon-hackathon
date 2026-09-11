# PRISM — Demo Script

**Duration:** 2–3 minutes maximum
**Presenter:** Any team member
**Golden-path document:** See `18-GOLDEN-PATH-FIXTURE.md`

---

## Demo Flow

### 1. THE PROBLEM (15 seconds)

> "Meet Maya, a 10th-grader with dyslexia. Her teacher assigns a chapter on the Industrial Revolution — 12 pages of dense text, small font, complex vocabulary. After 10 minutes, Maya has absorbed one paragraph and closes the document in frustration. The content hasn't changed, but her ability to access it has failed her."

> "Current tools offer static formatting or chatbots. None create a feedback loop that detects when she's struggling and adapts in real time."

---

### 2. UPLOAD (15 seconds)

**Action:** Upload the golden-path fixture PDF (or paste text)

> "PRISM starts here. Maya uploads her chapter."

**On screen:** Upload page → file selected → processing spinner

> "PRISM extracts the text, uses AI to structure it into a concept graph, and pre-generates simplified versions at 3 levels — all cached. No AI calls happen during reading."

**On screen:** Upload completes, content ready

---

### 3. LEARNER PREFERENCES (15 seconds)

**Action:** Select "Dyslexia" profile

> "Maya selects her learning profile. PRISM applies dyslexia-optimized typography — OpenDyslexic font, increased line spacing, cream-on-dark contrast."

**On screen:** Profile selector → Dyslexia selected → reader view applies typography

> "She can customize every setting, but the defaults are research-informed."

---

### 4. PERSONALIZED LESSON (20 seconds)

**Action:** Show reader view, click Read Aloud

> "Her lesson is immediately personalized — simplified vocabulary, shorter sentences, visual descriptions alongside text."

**On screen:** Accessible reader with adapted content, progress bar

**Action:** Click Play → TTS reads content with word highlighting

> "Read-aloud with synchronized highlighting. She can also use voice commands."

**Action:** Say "Explain this" → show explanation variant

> "Voice is built in from Day 1 — not a stretch feature."

---

### 5. LEARNER STRUGGLES (15 seconds)

**Action:** Simulate struggle — re-read the same concept, answer a question incorrectly, take a long time

> "Now watch what happens when Maya struggles. She re-reads this section... answers a question wrong... takes longer than expected."

**On screen:** Signal capture happening (can show a subtle indicator if desired)

> "PRISM is tracking these behavioral signals — re-reads, answer accuracy, dwell time."

---

### 6. SCALE — SIGNAL DETECTION (10 seconds)

> "These signals feed into our SCALE engine — Signal, Calibrate, Adapt, Let engage, Evaluate."

> "The struggle score crosses the threshold."

**On screen:** (Optional: brief technical indicator showing struggle score)

---

### 7. REWIRE — THE SIGNATURE MOMENT (30 seconds)

**Action:** REWIRE activates — content visibly restructures

> "And now — REWIRE."

**On screen:**
1. Current content fades out
2. REWIRE banner slides in: *"We noticed you re-read this section 3 times and your accuracy was 33%, so we switched to shorter chunks and a visual description."*
3. New simplified content fades in — noticeably different (shorter sentences, visual description added)

> "The content just restructured itself. Not a new page — the same lesson, explained differently. And PRISM tells Maya exactly why."

**Pause for effect.**

> "This is visible, explainable adaptation."

---

### 8. ADAPTIVE QUESTION (15 seconds)

**Action:** Show the new question (adapted for the struggled concept)

> "The next question adapts too — testing the specific concept Maya struggled with, at a simpler level."

**On screen:** New question appears → Maya answers correctly

> "She gets it right this time."

---

### 9. OUTCOME IMPROVEMENT (10 seconds)

> "PRISM measures the outcome — accuracy improved from 33% to 67% after adaptation. The SCALE loop closes: we know the adaptation worked."

**On screen:** Outcome indicator showing improvement

> "This isn't just personalization. It's a closed behavioral feedback loop that continuously optimizes for how this student actually learns."

---

### 10. TECHNICAL CREDIBILITY (15 seconds)

> "Under the hood:
> - Content structured into a concept graph with cached alternatives
> - AI runs once at upload — the live path is entirely deterministic
> - SCALE uses weighted behavioral signals and threshold rules — no ML classifier needed
> - Voice interaction is browser-native — zero cost
> - Everything is accessible: keyboard-navigable, screen-reader compatible, reduced-motion aware
> - Built in 24 hours with React, Express, SQLite, and GPT-4o-mini."

---

## Backup Plan

If live demo fails:

1. **Pre-recorded video** of the golden-path flow (60 seconds)
2. **Screenshots** of REWIRE transition (before/after)
3. **Code walkthrough** of SCALE engine logic

---

## Key Talking Points (if judges ask)

| Question | Answer |
|----------|--------|
| "How is this different from ChatGPT?" | "ChatGPT requires you to prompt it. PRISM detects struggle automatically, restructures content, explains why, and measures if it worked — a closed loop." |
| "Does it use AI?" | "AI structures content at upload time and pre-generates alternatives. The live adaptation path is deterministic — no LLM calls during reading." |
| "Is this a medical tool?" | "No. We measure learning signals — behavioral patterns like re-reads and answer accuracy. We estimate interaction difficulty, not clinical conditions." |
| "What about voice?" | "Voice is Day-1. Built on browser-native Speech APIs. Students can say 'Read this', 'Explain this', 'Simplify' — and voice help requests feed into the SCALE engine as signals." |
| "How do you know it works?" | "SCALE measures outcomes: we compare question accuracy before and after REWIRE. If accuracy improved, the adaptation helped." |
