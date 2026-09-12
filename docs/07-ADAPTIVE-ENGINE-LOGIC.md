# PRISM — Adaptive Engine Logic (SCALE)

**Authoritative Specification — Current Implementation**  
**Architecture:** Deterministic, rule-based, client-side. No ML classifier. No LLM calls.  
**Core Reference:** `Frontend/src/engine/scale.js`, `Frontend/src/engine/signals.js`

---

## 1. SCALE Overview & Core Philosophy

**S**ignal → **C**alibrate → **A**dapt → **L**et learner engage → **E**valuate

The SCALE engine runs entirely client-side. It processes real-time learner behavioral signals, calibrates them against section-specific baselines, computes a normalized struggle score, and triggers **REWIRE** cognitive adaptations when sufficient evidence indicates learner comprehension difficulty.

### The Guiding Principle

$$\text{Expected Learning Time} \neq \text{Page Open Time}$$

A section's reading time is the expected active learning time for that content. It is **not** a timeout, a countdown, or an automatic struggle trigger. Struggling is detected only when active learning time significantly exceeds the expected baseline in combination with other behavioral and assessment evidence.

System overhead, page load delay, PDF extraction, API latency, LLM transformation, visual/quiz generation, and tab-hidden periods are **strictly isolated and excluded** from struggle evaluation.

---

## 2. Section-Specific Baselines (Difficulty-Aware Reading Time)

Content difficulty is determined independently by content analysis (foundational, intermediate, advanced) and is never derived from word count alone.

Each section has an expected active learning baseline in seconds:

$$\text{expected\_baseline\_seconds} = \left(\frac{\text{word\_count}}{\text{WPM}_{\text{difficulty}}}\right) \times 60$$

### Difficulty Reading Speeds

| Difficulty Tier | Reading Speed | Rationale |
|-----------------|---------------|-----------|
| **Foundational** | **220 WPM** | Core definitions and introductory concepts; reader processes quickly |
| **Intermediate** | **180 WPM** | Standard explanatory content requiring applied conceptual connections |
| **Advanced** | **140 WPM** | Dense, abstract, or multi-step reasoning; reader naturally slows down |

---

## 3. Active Dwell Time Logic & State Machine

Only time spent in `SECTION_ACTIVE` contributes to active dwell.

```
       [User Navigates / Content Requested]
                        │
                        ▼
               ┌──────────────────┐
               │ SECTION_LOADING  │ ◄── (Pauses active timer; API / generation)
               └────────┬─────────┘
                        │ Content rendered & ready
                        ▼
               ┌──────────────────┐
               │  SECTION_READY   │
               └────────┬─────────┘
                        │ Learner viewing & tab focused
                        ▼
     ┌───────► ┌──────────────────┐
(Tab │         │  SECTION_ACTIVE  │ ◄── [DWELL TIMER RUNS]
resumed)       └────────┬─────────┘
     │                  │ (Tab hidden / busy async action / modal)
     │                  ▼
     └──────── ┌──────────────────┐
               │  SECTION_PAUSED  │ ◄── (Timer stopped, elapsed time accumulated)
               └────────┬─────────┘
                        │ Learner marks complete / navigates away
                        ▼
               ┌──────────────────┐
               │SECTION_COMPLETED │ ◄── (Timer finalized, sent to SCALE)
               └──────────────────┘
```

### What is Excluded from Active Dwell:
- Initial route mounting and navigation transitions
- PDF extraction and API round-trip latency
- Content transformation, visual infographic, and quiz generation time
- Background or hidden browser tabs (`document.hidden === true`)
- Web camera initialization or permission dialogs
- Modal dialogs and blocking loading spinners

### Minimum Active-Time Guard

To prevent fleeting navigation or accidental clicks from generating false struggle signals:

$$\text{MIN\_MEANINGFUL\_DWELL\_SECONDS} = 3\text{ seconds}$$

If active dwell is under 3 seconds, `normalized_dwell` is forced to `0.0`.

---

## 4. Signal Definitions & Conceptual Groups

Signals are organized into three clear conceptual groups:

### Group A: Learning Behavior
| Signal | Type | Description |
|--------|------|-------------|
| `activeDwellMs` | ms | Active learning time in current section |
| `helpRequests` | count | Explicit UI "Request explanation" clicks |
| `voiceHelpRequests` | count | Spoken help requests ("explain this", "simplify") |
| `scrollBack` | count | Scroll reversals and navigation backtracking |
| `audioReplayCount` | count | Audio/TTS replay requests ("Re-read section" button) |

### Group B: Assessment
| Signal | Type | Description |
|--------|------|-------------|
| `questionAccuracy` | ratio [0–1] | Check question accuracy: $\frac{\text{correct answers}}{\text{total questions}}$ |
| `answerLatency` | ms | Average response latency from question render to answer |
| `retryCount` | count | Answer retry attempts (contextual record; not double-counted with accuracy) |

### Group C: Optional Supporting Context
| Signal | Type | Description |
|--------|------|-------------|
| `presenceRatio` | ratio [0–1] | Fraction of session time learner face was detected |
| `facePresent` | boolean | Real-time face presence at evaluation moment |
| `tabFocused` | boolean | Browser tab focus state |
| `headStable` | boolean | Head stability (indicates steady attention vs. high movement) |
| `scrollConsistent` | boolean | Smooth unidirectional reading scroll vs. erratic jumping |

---

## 5. Audio / TTS Replay Semantics

The "Re-read section" button in the UI is primarily an **Audio/TTS replay control**.

- It signals: *"The learner wants to hear this section read aloud again."*
- It is **not** a direct indication of comprehension failure.
- It receives a small contextual weight (`0.05`), down from the legacy 0.20.
- Even multiple audio replays can contribute at most $0.05$ to the struggle score, ensuring audio replay alone **never** triggers REWIRE.

---

## 6. Single Assessment Signal (No Double-Counting)

Legacy models penalized learners twice by independently weighting `questionAccuracy` (0.25) and `retryCount` (0.05). In the current engine:
- `questionAccuracy` is the primary assessment signal with weight `0.30`.
- `retryCount` is logged for analytics and history, but does not independently penalize the struggle score.

---

## 7. Unified Help Request Signal

Text help (`helpRequests`) and voice help (`voiceHelpRequests`) represent the same underlying behavior: the learner is asking for assistance.
- Both are unified into a single conceptual help metric:
  $$\text{totalHelp} = \text{helpRequests} + \text{voiceHelpRequests}$$
- The unified signal carries weight `0.15`. Modality remains recorded in session metadata to determine the best response format (voice vs. text).

---

## 8. Webcam as Supporting Evidence Only

Webcam attention signals are strictly **supporting evidence**:
- They modulate the score by at most `0.05` (`WEBCAM_CONTEXT_WEIGHT = 0.05`).
- Webcam disengagement (e.g. looking away, temporary face absence) **cannot** independently trigger REWIRE.
- When no camera is active or permission was denied, `webcamContext` normalizes to `0.0`, and the learner progresses normally based on learning and assessment signals.

---

## 9. Authoritative Named Weights (Total = 1.00)

| Signal Key | Named Constant | Weight | Conceptual Group | Rationale |
|------------|----------------|--------|------------------|-----------|
| `dwellTime` | `DWELL_WEIGHT` | **0.30** | Learning Behavior | Strong signal when normalized against section expected time |
| `questionAccuracy` | `QUIZ_ACCURACY_WEIGHT` | **0.30** | Assessment | Primary direct measurement of comprehension |
| `helpRequests` | `HELP_REQUEST_WEIGHT` | **0.15** | Learning Behavior | Unified text + voice explicit help seeking |
| `answerLatency` | `QUIZ_LATENCY_WEIGHT` | **0.10** | Assessment | Supporting assessment signal for hesitation/uncertainty |
| `scrollBack` | `SCROLL_BACK_WEIGHT` | **0.05** | Learning Behavior | Backtracking / re-searching for context |
| `audioReplay` | `AUDIO_REPLAY_WEIGHT` | **0.05** | Learning Behavior | Audio/TTS replay requests (contextual) |
| `webcamContext` | `WEBCAM_CONTEXT_WEIGHT` | **0.05** | Optional Context | Supporting attention signals (capped at 0.05) |
| **TOTAL** | | **1.00** | | **Exact sum = 1.000** |

---

## 10. Normalization Formulas

All normalized values are strictly bounded in $[0.0, 1.0]$.

### 1. Active Dwell Ratio Normalization
$$\text{dwell\_ratio} = \frac{\text{active\_dwell\_seconds}}{\text{expected\_baseline\_seconds}}$$

$$\text{normalized\_dwell} = \begin{cases} 
0.0 & \text{if active\_dwell\_seconds} < 3 \\
0.0 & \text{if dwell\_ratio} \le 1.0 \\
\frac{\text{dwell\_ratio} - 1.0}{3.0 - 1.0} & \text{if } 1.0 < \text{dwell\_ratio} < 3.0 \\
1.0 & \text{if dwell\_ratio} \ge 3.0 
\end{cases}$$

### 2. Question Accuracy Normalization (Inverted)
$$\text{normalized\_accuracy} = \begin{cases} 
0.0 & \text{if accuracy} \ge 0.80 \text{ (or no quiz taken)} \\
\frac{0.80 - \text{accuracy}}{0.80 - 0.20} & \text{if } 0.20 < \text{accuracy} < 0.80 \\
1.0 & \text{if accuracy} \le 0.20 
\end{cases}$$

*Mathematical Note:* For a learner with $60\%$ accuracy ($0.60$):
$$\text{normalized\_accuracy} = \frac{0.80 - 0.60}{0.80 - 0.20} = \frac{0.20}{0.60} = 0.3333\dots$$

### 3. Unified Help Request Normalization
$$\text{totalHelp} = \text{helpRequests} + \text{voiceHelpRequests}$$

$$\text{normalized\_help} = \begin{cases} 
0.0 & \text{if totalHelp} \le 0 \\
\frac{\text{totalHelp}}{3.0} & \text{if } 0 < \text{totalHelp} < 3 \\
1.0 & \text{if totalHelp} \ge 3 
\end{cases}$$

### 4. Question Response Latency Normalization
$$\text{normalized\_latency} = \begin{cases} 
0.0 & \text{if latency} \le 5{,}000\text{ ms} \\
\frac{\text{latency} - 5{,}000}{20{,}000 - 5{,}000} & \text{if } 5{,}000\text{ ms} < \text{latency} < 20{,}000\text{ ms} \\
1.0 & \text{if latency} \ge 20{,}000\text{ ms} 
\end{cases}$$

### 5. Scroll-Back Normalization
$$\text{normalized\_scroll} = \begin{cases} 
0.0 & \text{if scrollBack} \le 0 \\
\frac{\text{scrollBack}}{3.0} & \text{if } 0 < \text{scrollBack} < 3 \\
1.0 & \text{if scrollBack} \ge 3 
\end{cases}$$

### 6. Audio Replay Normalization
$$\text{normalized\_audio} = \begin{cases} 
0.0 & \text{if audioReplay} \le 0 \\
\frac{\text{audioReplay}}{4.0} & \text{if } 0 < \text{audioReplay} < 4 \\
1.0 & \text{if audioReplay} \ge 4 
\end{cases}$$

### 7. Webcam Attention Context Normalization
When webcam context is present, disengagement components are combined:
$$\text{presenceScore} = (!\text{facePresent} \lor \text{presenceRatio} < 0.5) \;?\; \min(1.0, 1.0 - \text{presenceRatio}) : 0.0$$
$$\text{tabScore} = !\text{tabFocused} \;?\; 1.0 : 0.0$$
$$\text{headScore} = !\text{headStable} \;?\; 1.0 : 0.0$$
$$\text{scrollScore} = !\text{scrollConsistent} \;?\; 1.0 : 0.0$$

$$\text{normalized\_webcam} = \min\big(1.0, \; 0.40 \cdot \text{presenceScore} + 0.30 \cdot \text{tabScore} + 0.15 \cdot \text{headScore} + 0.15 \cdot \text{scrollScore}\big)$$

---

## 11. Final Authoritative Struggle Score Formula

$$\begin{aligned}
\text{struggle\_score} = \;& \text{normalized\_dwell} \times 0.30 \\
+\;& \text{normalized\_accuracy} \times 0.30 \\
+\;& \text{normalized\_help} \times 0.15 \\
+\;& \text{normalized\_latency} \times 0.10 \\
+\;& \text{normalized\_scroll} \times 0.05 \\
+\;& \text{normalized\_audio} \times 0.05 \\
+\;& \text{normalized\_webcam} \times 0.05
\end{aligned}$$

$$\text{Clamped: } 0.0 \le \text{struggle\_score} \le 1.0$$

---

## 12. Intervention Thresholds & REWIRE Rules

$$\text{STRUGGLE\_THRESHOLD} = 0.60$$
$$\text{CRITICAL\_THRESHOLD} = 0.80$$

| Score Range | Classification | Engine Response |
|-------------|----------------|-----------------|
| **0.00 – 0.39** | Normal Engagement | Continue standard learning flow |
| **0.40 – 0.59** | Elevated Cognitive Load | Telemetry warning; monitor next section |
| **0.60 – 0.79** | Comprehension Struggle | **REWIRE Level +1**: simplify language, reduce chunk size |
| **0.80 – 1.00** | Critical Struggle | **REWIRE Level +2**: max simplification, visual mental model |

### The Combined Evidence Rule
A single weak signal can **never** trigger REWIRE:
- Face lost alone: $\max 0.05 < 0.60 \implies$ No REWIRE
- 4 Audio replays alone: $\max 0.05 < 0.60 \implies$ No REWIRE
- High dwell alone: $\max 0.30 < 0.60 \implies$ No REWIRE
- Poor quiz accuracy alone: $\max 0.30 < 0.60 \implies$ No REWIRE
- **High Dwell ($0.30$) + Poor Quiz ($0.30$):** $0.60 \ge 0.60 \implies$ **REWIRE Triggered**

---

## 13. Learner-Friendly Explanation Generation

When REWIRE triggers, PRISM presents a supportive, educational explanation based on dominant evidence.

### Design Principles:
1. **Never misrepresent audio replay as struggle**: Do not say *"You re-read this section 4 times."*
2. **Never expose raw telemetry metrics**: Do not say *"Head stability was 0.41"* or *"Presence was 52%."*
3. **Focus on learning actions**: Emphasize reading pace, question responses, and help requests.
4. **Neutral webcam phrasing**: If attention signals contributed, state:  
   *"PRISM combined your recent learning interactions with optional attention signals."*

### Examples:
- **Dwell + Quiz:**  
  *"Your active reading time was higher than expected and your quiz responses suggest this concept needs reinforcement, so PRISM switched to simpler language."*
- **Quiz + Help:**  
  *"Your quiz responses suggest this concept needs reinforcement and your help requests indicate this concept was challenging, so PRISM adapted the explanation."*
- **With Attention Context:**  
  *"Your active reading time was higher than expected and your quiz responses suggest this concept needs reinforcement, so PRISM switched to simpler language. PRISM combined your recent learning interactions with optional attention signals."*

---

## 14. Step-by-Step Mathematical Examples

### Example 1: Normal Learner
- Expected: 120s, Active Dwell: 95s $\implies$ ratio $= 0.79 \le 1.0 \implies \mathbf{0.0}$
- Quiz Accuracy: 85% ($0.85 \ge 0.80$) $\implies \mathbf{0.0}$
- Help: 0 $\implies \mathbf{0.0}$
- Latency: 4,500 ms $\implies \mathbf{0.0}$
- Scroll Back: 0 $\implies \mathbf{0.0}$
- Audio Replay: 0 $\implies \mathbf{0.0}$
- Webcam: normal $\implies \mathbf{0.0}$

$$\text{Struggle Score} = 0.000 \quad \text{(No REWIRE)}$$

### Example 2: Mild Dwell with Solid Quiz
- Expected: 120s, Active Dwell: 180s $\implies$ ratio $= 1.5 \implies \frac{1.5 - 1.0}{2.0} = 0.25 \times 0.30 = \mathbf{0.075}$
- Quiz Accuracy: 80% $\implies \mathbf{0.0}$
- Other signals: normal $\implies \mathbf{0.0}$

$$\text{Struggle Score} = 0.075 \quad \text{(No REWIRE)}$$

### Example 3: Audio Replay Only
- Expected: 60s, Active Dwell: 50s $\implies \mathbf{0.0}$
- Audio Replay: 4 clicks $\implies 1.0 \times 0.05 = \mathbf{0.050}$
- Other signals: normal $\implies \mathbf{0.0}$

$$\text{Struggle Score} = 0.050 \quad \text{(No REWIRE)}$$

### Example 4: High Dwell + Failed Quiz (Combined Evidence)
- Expected: 60s, Active Dwell: 180s $\implies$ ratio $= 3.0 \implies 1.0 \times 0.30 = \mathbf{0.300}$
- Quiz Accuracy: 0% ($0.0 \le 0.20$) $\implies 1.0 \times 0.30 = \mathbf{0.300}$

$$\text{Struggle Score} = 0.300 + 0.300 = \mathbf{0.600} \quad \text{(REWIRE ACTIVATED)}$$

### Example 5: Golden-Path Comprehension Struggle
- Section: 70 words intermediate $\implies$ expected baseline $\approx 30$s
- Active Dwell: 50s $\implies$ ratio $= 1.67 \implies 0.3333 \times 0.30 = \mathbf{0.1000}$
- Quiz Accuracy: 0% $\implies 1.0 \times 0.30 = \mathbf{0.3000}$
- Help Requests: 2 text + 1 voice $= 3 \implies 1.0 \times 0.15 = \mathbf{0.1500}$
- Latency: 12,000 ms $\implies \frac{12000 - 5000}{15000} = 0.4667 \times 0.10 = \mathbf{0.0467}$
- Scroll Back: 2 reversals $\implies \frac{2}{3} = 0.6667 \times 0.05 = \mathbf{0.0333}$
- Audio Replay: 4 replays $\implies 1.0 \times 0.05 = \mathbf{0.0500}$

$$\text{Struggle Score} = 0.1000 + 0.3000 + 0.1500 + 0.0467 + 0.0333 + 0.0500 = \mathbf{0.6800}$$

$$\text{Result: } 0.6800 \ge 0.60 \implies \text{REWIRE LEVEL 2 ACTIVATED}$$
