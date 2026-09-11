# PRISM — Accessibility QA

**Owner:** M3 (Frontend + Accessibility)

---

## Acceptance Criteria

Every item below must pass before a phase is marked complete.

---

### 1. Keyboard Navigation

| # | Test | Expected | Status |
|---|------|----------|--------|
| K1 | Tab through all interactive elements | Focus moves in logical reading order | ⬜ |
| K2 | Shift+Tab moves focus backward | Reverse tab order works | ⬜ |
| K3 | Enter/Space activates buttons and links | All buttons respond to keyboard | ⬜ |
| K4 | Arrow keys navigate chunks (Left/Up = prev, Right/Down = next) | Chunk navigation via arrows | ⬜ |
| K5 | Escape closes modals and banners | REWIRE banner, profile panel dismiss | ⬜ |
| K6 | Skip-to-content link exists at page top | Tab once → "Skip to content" visible | ⬜ |
| K7 | Focus never trapped in a component | Can always Tab out of any element | ⬜ |
| K8 | Focus visible on all interactive elements | 3px outline ring visible | ⬜ |
| K9 | `P` key toggles play/pause read-aloud | TTS play/pause via keyboard | ⬜ |
| K10 | `V` key toggles voice input | Voice button activates via keyboard | ⬜ |
| K11 | `1`–`4` keys select answer options | Quiz answers via keyboard | ⬜ |
| K12 | `?` key shows keyboard shortcut help | Help overlay appears | ⬜ |

---

### 2. Screen Reader

| # | Test | Expected | Status |
|---|------|----------|--------|
| SR1 | Page has single `<h1>` | Document/lesson title | ⬜ |
| SR2 | Heading hierarchy is logical (h1 → h2 → h3) | No skipped heading levels | ⬜ |
| SR3 | All images have `alt` text | Visual descriptions have alt text | ⬜ |
| SR4 | All buttons have accessible labels | `aria-label` or visible text | ⬜ |
| SR5 | Form inputs have associated labels | `<label for="">` or `aria-label` | ⬜ |
| SR6 | REWIRE banner announced on appearance | `role="alert"` + `aria-live="polite"` | ⬜ |
| SR7 | Progress announced | "Concept 3 of 8" readable by screen reader | ⬜ |
| SR8 | Quiz options are radio buttons or buttons with labels | Screen reader can navigate options | ⬜ |
| SR9 | Correct/incorrect feedback announced | `role="status"` on answer feedback | ⬜ |
| SR10 | Read-aloud status announced | "Playing", "Paused" state readable | ⬜ |
| SR11 | Voice listening status announced | "Listening for voice command" readable | ⬜ |
| SR12 | Navigation landmarks present | `<main>`, `<nav>`, `<aside>` used correctly | ⬜ |

---

### 3. Contrast

| # | Test | Expected | Status |
|---|------|----------|--------|
| C1 | Normal text contrast ratio ≥ 4.5:1 | All color schemes pass | ⬜ |
| C2 | Large text contrast ratio ≥ 3:1 | Headings pass | ⬜ |
| C3 | Interactive element contrast ≥ 3:1 against adjacent colors | Buttons, links visible | ⬜ |
| C4 | High-contrast profile meets 7:1 ratio | White on black = 21:1 | ⬜ |
| C5 | Focus indicator has sufficient contrast | 3px outline visible on all backgrounds | ⬜ |

---

### 4. Zoom / Text Resize

| # | Test | Expected | Status |
|---|------|----------|--------|
| Z1 | Page usable at 200% zoom | No horizontal scroll, no overlapping text | ⬜ |
| Z2 | Page usable at 400% zoom | Content reflows, still readable | ⬜ |
| Z3 | Font size slider works (14–32px) | Text resizes smoothly | ⬜ |
| Z4 | Line height slider works (1.2–2.4) | Spacing adjusts smoothly | ⬜ |
| Z5 | Letter spacing slider works (0–0.2em) | Letter spacing adjusts | ⬜ |

---

### 5. Reduced Motion

| # | Test | Expected | Status |
|---|------|----------|--------|
| RM1 | `prefers-reduced-motion: reduce` disables all CSS animations | No sliding, fading, or pulsing | ⬜ |
| RM2 | REWIRE content swap is instant (no transition) | Content changes without animation | ⬜ |
| RM3 | Voice button does not pulse when listening (reduced motion) | Static red background instead | ⬜ |
| RM4 | Manual "Reduced motion" toggle in preferences works | Override OS setting | ⬜ |

---

### 6. Focus Management

| # | Test | Expected | Status |
|---|------|----------|--------|
| F1 | After upload completes, focus moves to reader | Auto-focus on first chunk | ⬜ |
| F2 | After REWIRE, focus moves to REWIRE banner | Screen reader announces adaptation | ⬜ |
| F3 | After answering question, focus moves to feedback | Correct/incorrect feedback focused | ⬜ |
| F4 | After closing modal, focus returns to trigger element | Focus restoration works | ⬜ |
| F5 | After chunk navigation, focus moves to new chunk content | New chunk content focused | ⬜ |

---

### 7. Labels & ARIA

| # | Test | Expected | Status |
|---|------|----------|--------|
| A1 | Upload button has label: "Upload PDF" or "Paste text" | Clear purpose | ⬜ |
| A2 | Play button has label: "Read aloud" | Not just icon | ⬜ |
| A3 | Voice button has label: "Start voice input" | Clear purpose | ⬜ |
| A4 | Next/Previous buttons labeled: "Next concept" / "Previous concept" | Not just arrows | ⬜ |
| A5 | Progress bar has `aria-valuenow`, `aria-valuemin`, `aria-valuemax` | Accessible progress | ⬜ |
| A6 | Quiz options have `role="radio"` or `role="button"` | Navigable by screen reader | ⬜ |
| A7 | REWIRE banner has `role="alert"` | Announced automatically | ⬜ |

---

### 8. Touch Targets

| # | Test | Expected | Status |
|---|------|----------|--------|
| T1 | All buttons are at least 44×44px | Touch-friendly | ⬜ |
| T2 | Quiz answer options have sufficient spacing | No accidental taps | ⬜ |
| T3 | Voice button is 56×56px | Easy to tap | ⬜ |
| T4 | Slider controls are at least 44px tall | Thumb target usable | ⬜ |

---

### 9. Text-to-Speech

| # | Test | Expected | Status |
|---|------|----------|--------|
| TTS1 | Play button starts reading current concept | TTS speaks text | ⬜ |
| TTS2 | Pause/Resume works | TTS pauses and resumes | ⬜ |
| TTS3 | Stop cancels speech | TTS stops immediately | ⬜ |
| TTS4 | Speed control works (0.5x–2x) | Speech rate changes | ⬜ |
| TTS5 | Captions/subtitles shown during TTS | Visual text feedback | ⬜ |
| TTS6 | TTS reads REWIRE explanation | Adaptation explained via audio | ⬜ |

---

### 10. Transcripts

| # | Test | Expected | Status |
|---|------|----------|--------|
| TR1 | TTS output has visual caption/subtitle | Deaf users see what's being read | ⬜ |
| TR2 | Voice command feedback shown as text | "You said: explain this" displayed | ⬜ |
| TR3 | Error messages shown as text (not audio-only) | All errors visible | ⬜ |

---

### 11. No Color-Only Communication

| # | Test | Expected | Status |
|---|------|----------|--------|
| NC1 | Correct/incorrect answers use icon + color | ✓/✗ icons alongside green/red | ⬜ |
| NC2 | Progress uses text label + color | "3 of 8" text alongside progress bar | ⬜ |
| NC3 | REWIRE indicator uses icon + color + text | Not just purple border | ⬜ |
| NC4 | Error states use icon + color + text | Not just red color | ⬜ |

---

## Testing Tools

| Tool | Purpose |
|------|---------|
| Playwright accessibility API | Automated ARIA checks |
| axe-core (via @axe-core/playwright) | Automated WCAG violation detection |
| Manual keyboard testing | Tab through entire UI |
| NVDA or VoiceOver | Screen reader testing |
| Chrome DevTools → Rendering → Emulate `prefers-reduced-motion` | Reduced motion testing |
| Chrome DevTools → Lighthouse → Accessibility | Quick accessibility score |

---

## Minimum Compliance Target

**WCAG 2.1 Level AA** for MVP. Key criteria:
- 1.1.1 Non-text Content (alt text)
- 1.3.1 Info and Relationships (semantic HTML)
- 1.4.3 Contrast (Minimum 4.5:1)
- 1.4.4 Resize Text (200% zoom)
- 2.1.1 Keyboard (all functionality keyboard-accessible)
- 2.4.3 Focus Order (logical tab sequence)
- 2.4.7 Focus Visible (visible focus indicator)
- 2.5.5 Target Size (44×44px minimum)
- 4.1.2 Name, Role, Value (ARIA attributes correct)
