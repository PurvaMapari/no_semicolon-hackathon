# PRISM — Testing

**Owner:** All (M4 leads integration + golden-path)

---

## Test Categories

### 1. Unit Tests

**Framework:** Vitest
**Location:** `server/tests/unit/`, `client/src/__tests__/`

#### Content Intelligence (M1)

| Test | File | What It Tests |
|------|------|--------------|
| Extraction — text paste | `extraction.test.js` | Text input returns cleaned text |
| Extraction — PDF (mock) | `extraction.test.js` | PDF.js mock returns extracted text |
| Text cleaning | `cleaning.test.js` | Whitespace normalization, line endings, non-printable removal |
| Content structuring (mock LLM) | `structuring.test.js` | LLM response → valid content graph |
| Structuring fallback | `structuring.test.js` | LLM failure → paragraph-based fallback |
| Simplification (mock LLM) | `simplification.test.js` | 3 levels generated, facts preserved |
| Fact preservation | `fact-preservation.test.js` | Numbers, dates, names present in output |

#### SCALE Engine (M2)

| Test | File | What It Tests |
|------|------|--------------|
| Signal normalization | `signal-processing.test.js` | Each signal normalizes correctly (0–1) |
| Inverted normalization | `signal-processing.test.js` | questionAccuracy inverts correctly |
| Struggle score — low | `scale.test.js` | Normal signals → score < 0.6 |
| Struggle score — high | `scale.test.js` | Struggle signals → score > 0.6 |
| Threshold trigger | `scale.test.js` | Score > 0.6 → shouldAdapt = true |
| Cooldown active | `scale.test.js` | Recent adaptation → shouldAdapt = false |
| Cooldown expired | `scale.test.js` | Past cooldown → shouldAdapt = true |
| Max adaptations | `scale.test.js` | 5 adaptations → no more allowed |
| Adaptation strategy | `scale.test.js` | Score 0.7 → level +1; score 0.9 → level +2 |
| Explanation generation | `adaptation-reasoning.test.js` | Template produces valid explanation text |

#### Assessment (M4)

| Test | File | What It Tests |
|------|------|--------------|
| Answer verification | `assessment.test.js` | Correct/incorrect determined |
| Score calculation | `assessment.test.js` | Accuracy ratio computed |
| Voice answer parsing | `voice-intent.test.js` | "Answer A" → option 'a' |

---

### 2. API Tests

**Framework:** Supertest
**Location:** `server/tests/api/`

| Test | Endpoint | What It Tests |
|------|----------|--------------|
| Upload text | `POST /api/upload` | Text → structured content → cached |
| Upload PDF (mock) | `POST /api/upload` | PDF binary → extraction → structure |
| Upload validation — no input | `POST /api/upload` | 400 error returned |
| Upload validation — too large | `POST /api/upload` | 400 error for >25k chars |
| Get content graph | `GET /api/content/:id` | Returns full content graph with variants |
| Get content — not found | `GET /api/content/:id` | 404 for nonexistent doc |
| Get variant | `GET /api/content/:id/variant` | Returns cached variant for concept+level |
| Create profile | `POST /api/profile` | Profile created in SQLite |
| Get profile | `GET /api/profile/:id` | Profile retrieved correctly |
| SCALE evaluate — no adaptation | `POST /api/scale/evaluate` | Low signals → shouldAdapt: false |
| SCALE evaluate — adaptation | `POST /api/scale/evaluate` | High signals → shouldAdapt: true |
| SCALE evaluate — cooldown | `POST /api/scale/evaluate` | Cooldown → shouldAdapt: false |
| Voice intent — known | `POST /api/voice/intent` | "read this" → intent: read_aloud |
| Voice intent — unknown | `POST /api/voice/intent` | Gibberish → intent: unknown |
| Save progress | `POST /api/session/progress` | Progress saved to SQLite |
| Retrieve progress | `POST /api/session/progress` | Session state retrieved |
| Health check | `GET /api/health` | Returns { status: "ok" } |

---

### 3. Adaptive Engine Tests

**Framework:** Vitest
**Location:** `server/tests/unit/scale/`

Test the full SCALE evaluation with the golden-path fixture signals:

| Scenario | Input Signals | Expected Output |
|----------|--------------|----------------|
| Normal reading | dwellTime=12000, reread=0, accuracy=0.8 | shouldAdapt: false, score < 0.3 |
| Moderate struggle | dwellTime=25000, reread=1, accuracy=0.5 | shouldAdapt: false, score 0.3–0.6 |
| High struggle | dwellTime=35000, reread=3, accuracy=0.33 | shouldAdapt: true, score > 0.6 |
| Critical struggle | dwellTime=60000, reread=5, accuracy=0.0 | shouldAdapt: true, score > 0.8 |
| Voice help struggle | helpRequests=2, voiceHelp=2, accuracy=0.5 | shouldAdapt: true |
| Cooldown active | (high signals but adapted 1 chunk ago) | shouldAdapt: false, cooldownActive: true |
| Max level reached | currentLevel=3, score>0.6 | action: at_maximum |

---

### 4. Voice Tests

**Framework:** Vitest (unit) + Playwright (E2E)
**Location:** `server/tests/unit/voice/`, `client/tests/e2e/`

| Test | Type | What It Tests |
|------|------|--------------|
| Intent routing — all intents | Unit | Each voice command maps to correct intent |
| Answer extraction — "Answer A" | Unit | Extracts option 'a' |
| Answer extraction — "True" | Unit | Extracts 'true' |
| Answer extraction — unrecognized | Unit | Returns null |
| Voice button visibility | E2E | Visible when Speech API supported |
| Voice button hidden | E2E | Hidden when Speech API not supported |
| TTS plays content | E2E | SpeechSynthesis called with correct text |

---

### 5. Accessibility Tests

**Framework:** Playwright + axe-core
**Location:** `client/tests/accessibility/`

| Test | What It Tests |
|------|--------------|
| Upload page — axe scan | No WCAG violations |
| Reader page — axe scan | No WCAG violations |
| Keyboard tab order | Logical focus sequence |
| Focus visible on all elements | Outline ring visible |
| Skip-to-content link | Exists and works |
| REWIRE banner announced | role="alert" present |
| All buttons have labels | aria-label or visible text |
| Contrast check | Minimum 4.5:1 for text |

---

### 6. Integration Tests

**Framework:** Playwright
**Location:** `client/tests/e2e/`

| Test | Scenario |
|------|----------|
| Upload → Reader flow | Upload text → profile selected → reader renders content |
| Signal → SCALE → REWIRE | Simulate struggle → SCALE fires → REWIRE banner appears → content changes |
| Voice command flow | Click voice → say "read this" → TTS starts |
| Quiz flow | Answer questions → see feedback → progress updates |
| Profile change | Switch profile → typography/colors update |

---

### 7. Golden-Path Test

**Framework:** Playwright
**Location:** `client/tests/e2e/golden-path.test.js`

A single end-to-end test that exercises the entire demo flow:

```javascript
test('Golden path — full PRISM flow', async ({ page }) => {
  // 1. Upload golden-path fixture text
  await page.goto('/');
  await page.fill('#text-input', GOLDEN_PATH_TEXT);
  await page.click('#upload-btn');

  // 2. Select dyslexia profile
  await page.click('[data-profile="dyslexia"]');

  // 3. Verify reader renders
  await expect(page.locator('.chunk--active')).toBeVisible();

  // 4. Read first concept — verify content displayed
  await expect(page.locator('.concept-text')).toContainText('Industrial Revolution');

  // 5. Answer questions correctly
  await page.click('[data-option="opt_1"]');
  await expect(page.locator('.feedback--correct')).toBeVisible();

  // 6. Navigate to struggle concept
  await page.click('#next-btn');

  // 7. Simulate struggle (slow reading + wrong answer)
  await page.waitForTimeout(40000); // Simulate dwell time
  await page.click('[data-option="opt_3"]'); // Wrong answer

  // 8. Verify REWIRE triggers
  await expect(page.locator('.rewire-banner')).toBeVisible();
  await expect(page.locator('.rewire-banner__explanation')).toContainText('noticed');

  // 9. Verify content changed
  const newContent = await page.locator('.concept-text').textContent();
  // Content should be simpler (shorter sentences, etc.)

  // 10. Answer adapted question correctly
  await page.click('[data-option="opt_1"]');
  await expect(page.locator('.feedback--correct')).toBeVisible();

  // 11. Verify progress
  await expect(page.locator('.progress-text')).toContainText('2 of');
});
```

---

### 8. Demo Smoke Test

**Manual checklist — run before every demo:**

- [ ] Application loads without errors
- [ ] Upload golden-path text succeeds
- [ ] Dyslexia profile applies typography
- [ ] Content renders in reader
- [ ] TTS plays audio
- [ ] Questions display and accept answers
- [ ] REWIRE triggers on struggle simulation
- [ ] REWIRE banner shows explanation
- [ ] Content visibly changes after REWIRE
- [ ] Voice button appears and responds
- [ ] Keyboard navigation works (Tab, Enter, Arrows)
- [ ] No console errors

---

## Running Tests

```bash
# Unit tests (server)
cd server && npx vitest run

# Unit tests (client)
cd client && npx vitest run

# API tests
cd server && npx vitest run tests/api/

# E2E tests (requires dev server running)
cd client && npx playwright test

# Golden-path test only
cd client && npx playwright test golden-path

# Accessibility audit
cd client && npx playwright test tests/accessibility/
```
