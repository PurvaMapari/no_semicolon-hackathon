# PRISM — Design System

**Owner:** M3 (Frontend + Accessibility + REWIRE)

---

## 1. Typography

### Font Stack

| Profile | Primary Font | Fallback | Why |
|---------|-------------|----------|-----|
| Dyslexia | OpenDyslexic | Arial, sans-serif | Weighted bottoms reduce letter confusion |
| Low Vision | Atkinson Hyperlegible | Verdana, sans-serif | Designed for low-vision readability |
| Cognitive Load | Inter | system-ui, sans-serif | Clean, neutral, high x-height |
| Custom | User-selected | system-ui, sans-serif | — |

### Scale

| Token | Default | Dyslexia | Low Vision | Cognitive Load |
|-------|---------|----------|------------|----------------|
| `--font-size-base` | 16px | 18px | 22px | 16px |
| `--font-size-lg` | 20px | 22px | 28px | 20px |
| `--font-size-xl` | 24px | 28px | 34px | 24px |
| `--font-size-sm` | 14px | 16px | 18px | 14px |
| `--line-height` | 1.5 | 1.8 | 1.6 | 1.6 |
| `--letter-spacing` | 0 | 0.12em | 0.05em | 0 |
| `--word-spacing` | 0 | 0.16em | 0.1em | 0 |

---

## 2. Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | 4px | Inline gaps |
| `--space-sm` | 8px | Component padding |
| `--space-md` | 16px | Section gaps |
| `--space-lg` | 24px | Card padding |
| `--space-xl` | 32px | Page margins |
| `--space-2xl` | 48px | Major section spacing |

### Reading Area

```css
.reader-content {
  max-width: 680px;
  margin: 0 auto;
  padding: var(--space-lg);
}
```

---

## 3. Colors

### Light Theme (Default)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg` | `#FFFFFF` | Page background |
| `--color-surface` | `#F8F9FA` | Card/panel background |
| `--color-text` | `#1A1A2E` | Primary text |
| `--color-text-secondary` | `#4A4A6A` | Secondary text |
| `--color-accent` | `#6C63FF` | Interactive elements |
| `--color-accent-hover` | `#5A52E0` | Hover state |
| `--color-success` | `#10B981` | Correct answers |
| `--color-warning` | `#F59E0B` | Warnings |
| `--color-error` | `#EF4444` | Errors |
| `--color-rewire` | `#8B5CF6` | REWIRE accent (adaptation indicator) |

### Cream-on-Dark (Dyslexia Profile)

| Token | Value |
|-------|-------|
| `--color-bg` | `#1E1E2E` |
| `--color-surface` | `#2A2A3E` |
| `--color-text` | `#F5E6C8` |
| `--color-text-secondary` | `#C4B89A` |
| `--color-accent` | `#A78BFA` |

### High Contrast (Low Vision Profile)

| Token | Value |
|-------|-------|
| `--color-bg` | `#000000` |
| `--color-surface` | `#1A1A1A` |
| `--color-text` | `#FFFFFF` |
| `--color-text-secondary` | `#E0E0E0` |
| `--color-accent` | `#FFD700` |

---

## 4. Contrast Requirements

- All text must meet **WCAG 2.1 AA** minimum contrast ratio
- Normal text (< 18px): **4.5:1** contrast ratio
- Large text (≥ 18px bold or ≥ 24px): **3:1** contrast ratio
- Interactive elements: **3:1** against adjacent colors
- **No color-only communication** — always pair color with icon, label, or pattern

---

## 5. Focus States

```css
:focus-visible {
  outline: 3px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Remove outline for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}
```

- Focus ring: 3px solid, accent color
- Focus offset: 2px (visible gap from element)
- Tab order must follow logical reading order
- Skip-to-content link at page top

---

## 6. Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move to next interactive element |
| `Shift+Tab` | Move to previous interactive element |
| `Enter` / `Space` | Activate button/link |
| `ArrowRight` / `ArrowDown` | Next chunk |
| `ArrowLeft` / `ArrowUp` | Previous chunk |
| `P` | Play/Pause read-aloud |
| `S` | Stop read-aloud |
| `H` | Open help / explain |
| `V` | Toggle voice input |
| `Escape` | Close modal/banner |
| `1`–`4` | Select answer option 1–4 |

All keyboard shortcuts displayed in a help overlay accessible via `?` key.

---

## 7. Chunking Visual Design

### Chunk Container
```css
.chunk {
  background: var(--color-surface);
  border-radius: 12px;
  padding: var(--space-lg);
  margin-bottom: var(--space-md);
  border-left: 4px solid var(--color-accent);
  transition: all 0.3s ease;
}

.chunk--active {
  border-left-color: var(--color-accent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
```

### Progress Indicator
```css
.progress-bar {
  height: 4px;
  background: var(--color-surface);
  border-radius: 2px;
}

.progress-bar__fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  transition: width 0.3s ease;
}
```

---

## 8. Motion & Reduced Motion

### Default Animations

```css
.transition-fade {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.rewire-enter {
  animation: rewire-slide-in 0.5s ease forwards;
}

@keyframes rewire-slide-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- All animations respect `prefers-reduced-motion`
- Reduced-motion users see instant state changes (no sliding, fading)
- Content changes are still visible — only animation is removed

---

## 9. Visual Hierarchy

```
Page Title (h1) — --font-size-xl, bold
  Section Title (h2) — --font-size-lg, semibold
    Concept Content (p) — --font-size-base, regular
      Explanation / Visual (aside) — --font-size-sm, italic
        Question Text (p) — --font-size-base, medium
          Answer Options (button) — --font-size-base, regular
```

---

## 10. Accessible Components

### Button

```css
.btn {
  min-height: 44px;      /* Touch target */
  min-width: 44px;
  padding: var(--space-sm) var(--space-md);
  border-radius: 8px;
  font-size: var(--font-size-base);
  font-weight: 500;
  cursor: pointer;
  border: 2px solid transparent;
}

.btn:focus-visible {
  outline: 3px solid var(--color-accent);
  outline-offset: 2px;
}
```

**Requirements:**
- Minimum 44×44px touch target
- Visible label (no icon-only without aria-label)
- Disabled state visually distinct (50% opacity + `cursor: not-allowed`)

### REWIRE Banner

```css
.rewire-banner {
  background: color-mix(in srgb, var(--color-rewire) 12%, var(--color-surface));
  border: 2px solid var(--color-rewire);
  border-radius: 12px;
  padding: var(--space-lg);
  margin: var(--space-md) 0;
}

.rewire-banner__icon {
  /* Prism/refraction icon */
  color: var(--color-rewire);
}

.rewire-banner__title {
  font-weight: 600;
  color: var(--color-rewire);
  margin-bottom: var(--space-xs);
}

.rewire-banner__explanation {
  color: var(--color-text);
  font-size: var(--font-size-base);
}
```

**ARIA:** `role="alert"` with `aria-live="polite"` so screen readers announce the adaptation.

---

## 11. Learner Preferences Panel

Controls exposed to the learner:

| Setting | Control | Range |
|---------|---------|-------|
| Font size | Slider | 14–32px |
| Line height | Slider | 1.2–2.4 |
| Letter spacing | Slider | 0–0.2em |
| Color scheme | Radio group | Light, Dark, Cream, High Contrast |
| Read-aloud speed | Slider | 0.5–2.0x |
| Read-aloud pitch | Slider | 0.5–2.0 |
| Voice input | Toggle | On/Off |
| Reduced motion | Toggle | On/Off (auto-detects OS setting) |

---

## 12. REWIRE Visual Behavior

The REWIRE transition is the signature visual moment of the demo.

### Sequence

1. **Pulse indicator:** Border of current chunk briefly pulses with `--color-rewire`
2. **Content fade-out:** Current text fades (opacity 1→0, 200ms)
3. **Banner slide-in:** REWIRE explanation banner slides down (300ms)
4. **Content fade-in:** New adapted text fades in (opacity 0→1, 300ms)
5. **Question update:** Question area smoothly transitions to adapted question
6. **Focus moves:** Keyboard focus moves to the REWIRE banner

### With Reduced Motion

1. Content instantly swaps (no fade)
2. Banner appears instantly (no slide)
3. Focus moves to banner

---

## 13. Voice UI

### Voice Button
```css
.voice-btn {
  position: fixed;
  bottom: var(--space-lg);
  right: var(--space-lg);
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.voice-btn--listening {
  animation: voice-pulse 1.5s ease infinite;
  background: var(--color-error);
}

@keyframes voice-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
}
```

### Voice Feedback
- **Listening:** Pulsing red mic icon + "Listening..." text
- **Processing:** Spinner + "Processing..." text
- **Recognized:** Brief toast showing recognized text
- **Error:** Toast with "Didn't catch that. Try again."
- **All voice feedback must also appear as visual text** (no audio-only feedback)
