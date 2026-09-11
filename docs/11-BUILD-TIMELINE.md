# PRISM — Build Timeline (24 Hours)

---

## Hour 0–2: Foundation

| Member | Tasks | Deliverable |
|--------|-------|-------------|
| **M1** | Set up backend project (Express + SQLite), initialize DB schema, implement extraction skill (PDF.js + Tesseract.js) | `POST /api/upload` accepting files, returning extracted text |
| **M2** | Implement signal normalization functions, struggle score computation, SCALE config constants | `processSignals()` and `computeStruggleScore()` passing unit tests |
| **M3** | Set up frontend project (Vite + React + Tailwind), create design tokens CSS, build Upload page component | Upload UI rendering, file/text input working |
| **M4** | Set up SQLite tables for sessions/profiles/answers, implement profile CRUD endpoints, set up voice hooks skeleton | `POST /api/profile`, `GET /api/profile/:id` working |
| **All** | Freeze shared JSON contracts (content graph, signal shape, SCALE response) | Contracts documented in `04-API-CONTRACT.md` |

---

## Hour 2–4: Core Pipelines

| Member | Tasks | Deliverable |
|--------|-------|-------------|
| **M1** | Implement content structuring prompt, text cleaning, LLM integration (GPT-4o-mini), test with fixture text | Structured content graph from golden-path fixture text |
| **M2** | Implement threshold rules, adaptation strategy selection, cooldown mechanism, loop prevention | `scaleEvaluate()` function passing all test cases |
| **M3** | Build Profile Selector component, Reader component skeleton, chunk navigation | Profile selection → reader view navigation working |
| **M4** | Implement question generation skill, voice intent router skeleton, TTS hook (useVoiceOutput) | Question generation from text working, TTS reading content |

---

## Hour 4–6: Content Intelligence + Adaptation Engine

| Member | Tasks | Deliverable |
|--------|-------|-------------|
| **M1** | Implement simplification prompt (levels 1–3), visual description prompt, caching to SQLite, variant retrieval endpoint | All variants cached, `GET /api/content/:id/variant` serving cached data |
| **M2** | Implement `POST /api/scale/evaluate` endpoint, adaptation explanation template system | SCALE endpoint returning decisions from signals |
| **M3** | Implement signal capture hooks (useSignalCapture: dwell time, rereads, scroll-backs), read-aloud controls (play/pause/stop) | Signal events captured in frontend state, TTS controls working |
| **M4** | Implement STT hook (useVoiceInput), voice intent matching, voice quiz answering | Voice commands recognized and routed to actions |

### 🔴 INTEGRATION CHECKPOINT — Hour 6

**Verify:**
- [ ] Upload → extraction → structuring → caching pipeline works end-to-end
- [ ] Content graph serves from `GET /api/content/:id`
- [ ] Frontend renders content from API response
- [ ] Profile selection applies typography/colors
- [ ] Signal capture events are firing
- [ ] TTS reads content aloud
- [ ] Questions display for a concept

---

## Hour 6–8: Integration + REWIRE Foundation

| Member | Tasks | Deliverable |
|--------|-------|-------------|
| **M1** | Optimize LLM batching (multiple concepts per call), fact-preservation validation, handle edge cases in extraction | Upload handles various PDF formats, LLM errors fallback gracefully |
| **M2** | Integrate SCALE evaluation with frontend signal data, test adaptation decisions with golden-path signals | Frontend calls SCALE API → receives adaptation decision |
| **M3** | Build REWIRE banner component, REWIRE transition animation (fade-out/fade-in), keyboard navigation handler | REWIRE visual transition renders when triggered |
| **M4** | Implement session progress endpoint, answer verification module, voice signal → SCALE integration | Progress saves/retrieves, voice help generates signals |

---

## Hour 8–10: REWIRE + Voice

| Member | Tasks | Deliverable |
|--------|-------|-------------|
| **M1** | Test full upload pipeline with 3+ different documents, fix caching bugs, optimize response times | Reliable upload for diverse content |
| **M2** | Outcome measurement implementation, adaptation history recording, post-REWIRE accuracy tracking | Outcome delta computed and stored |
| **M3** | Connect REWIRE to SCALE response: signal capture → SCALE evaluate → REWIRE display → variant swap | Full REWIRE flow working: content restructures visibly |
| **M4** | Voice button UI component, voice command → SCALE signal path, voice quiz answer submission | Voice interaction fully integrated |

---

## Hour 10–12: End-to-End Flow

| Member | Tasks | Deliverable |
|--------|-------|-------------|
| **M1** | Add question generation to upload pipeline (pre-generate for all concepts), edge case handling | Complete content intelligence pipeline |
| **M2** | Tune SCALE thresholds and weights using golden-path fixture, verify cooldown behavior | SCALE engine calibrated for demo |
| **M3** | Full accessible reader: focus management, ARIA labels, reduced-motion support, progress bar | Accessible reader passing keyboard and screen reader tests |
| **M4** | Integration testing: upload → read → signal → SCALE → REWIRE → outcome | End-to-end flow working |

---

## Hour 12–14: Polish + Fix

| Member | Tasks | Deliverable |
|--------|-------|-------------|
| **M1** | Fix any content intelligence bugs, ensure all variants are cached correctly | Stable content pipeline |
| **M2** | Fix edge cases in SCALE (e.g., first concept with no history, max level reached) | Robust adaptive engine |
| **M3** | Polish REWIRE animation, fix visual bugs, ensure responsive layout, add explanation text | Visually polished REWIRE experience |
| **M4** | Fix voice integration bugs, ensure text fallbacks work when voice fails | Reliable voice interaction |

### 🔴 INTEGRATION CHECKPOINT — Hour 14

**Verify:**
- [ ] Complete golden-path fixture works: upload → read → struggle → SCALE → REWIRE → outcome
- [ ] REWIRE visually restructures content with explanation
- [ ] Voice commands work ("Read this", "Explain this", "Simplify")
- [ ] Keyboard navigation works throughout
- [ ] Progress tracking saves and retrieves correctly
- [ ] Outcome measurement shows improvement after adaptation
- [ ] Fallbacks work when LLM/voice/TTS fails

---

## Hour 14–16: Testing + Bug Fixes

| Member | Tasks | Deliverable |
|--------|-------|-------------|
| **M1** | Write unit tests for extraction and structuring skills | Tests passing |
| **M2** | Write unit tests for signal processing and SCALE engine | Tests passing |
| **M3** | Accessibility QA: keyboard, contrast, focus, screen reader, zoom | Accessibility checklist passing |
| **M4** | Write integration tests, golden-path fixture test, voice tests | Integration tests passing |

---

## Hour 16–18: Demo Preparation

| Member | Tasks | Deliverable |
|--------|-------|-------------|
| **M1** | Prepare golden-path fixture document (ensure it demonstrates REWIRE well) | Fixture document ready |
| **M2** | Verify SCALE triggers at right moments in demo | SCALE calibrated for demo flow |
| **M3** | Final UI polish, demo-specific styling, ensure REWIRE animation is impressive | Demo-ready UI |
| **M4** | Demo smoke test, rehearse demo flow, prepare backup plan | Demo script verified |

---

## Hour 18–20: Feature Freeze + Hardening

| Member | Tasks | Deliverable |
|--------|-------|-------------|
| **All** | **FEATURE FREEZE** — No new features after Hour 18 | — |
| **M1** | Fix any remaining bugs in content pipeline | Stable backend |
| **M2** | Final SCALE tuning if needed | Calibrated engine |
| **M3** | Final accessibility pass, fix any visual bugs | Polished, accessible UI |
| **M4** | Final integration test, deploy to staging | Deployed application |

### 🔴 INTEGRATION CHECKPOINT — Hour 20

**Verify:**
- [ ] Deployed application accessible at staging URL
- [ ] Golden-path demo works end-to-end on deployed version
- [ ] No critical bugs remaining
- [ ] Voice works on Chrome/Edge
- [ ] REWIRE animation looks good
- [ ] Demo script runs in under 3 minutes

---

## Hour 20–22: Demo Rehearsal

| Member | Tasks | Deliverable |
|--------|-------|-------------|
| **All** | Rehearse demo 2–3 times, identify weak points, prepare talking points | Demo rehearsed |
| **M3** | Screenshot/recording of REWIRE for backup | Visual backup ready |
| **M4** | Prepare offline fallback (recorded demo video if live demo fails) | Backup demo ready |

---

## Hour 22–24: Final Polish + Present

| Member | Tasks | Deliverable |
|--------|-------|-------------|
| **All** | Final bug fixes only (no features), present demo | Presentation delivered |

---

## Integration Checkpoint Summary

| Checkpoint | Hour | Key Verification |
|------------|------|-----------------|
| **Checkpoint 1** | 6 | Upload → Content → Render pipeline |
| **Checkpoint 2** | 14 | Full SCALE → REWIRE loop |
| **Checkpoint 3** | 20 | Deployed + demo-ready |

---

## Risk Mitigation

| Risk | Mitigation | Owner |
|------|-----------|-------|
| LLM API down | Deterministic fallback (word replacement + sentence splitting) | M1 |
| Voice not working | Text input fallback for all voice actions | M4 |
| REWIRE animation buggy | Simple content swap (no animation) as fallback | M3 |
| Demo document doesn't trigger REWIRE | Pre-calibrated golden-path fixture with known trigger points | M2 |
| Deployment fails | Run locally from laptop | M4 |
