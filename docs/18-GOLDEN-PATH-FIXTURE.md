# PRISM — Golden-Path Fixture

**Purpose:** ONE fixed demo lesson that all team members build against. This document specifies the exact expected output at every stage of the PRISM pipeline.

---

## Source Text

**Title:** The Industrial Revolution

```text
The Industrial Revolution was a period of major change in how goods were produced. It began in Great Britain in the late 1700s and spread to other parts of the world over the next century. Before this time, most goods were made by hand in small workshops or at home. The Industrial Revolution changed this by introducing machines and factories that could produce goods much faster and in larger quantities.

One of the most important inventions was the steam engine, improved by James Watt in 1769. The steam engine powered factories, trains, and ships. It allowed goods to be transported over long distances quickly and cheaply. Coal became the main fuel source, and mining grew rapidly to meet demand.

The textile industry was among the first to be transformed. Machines like the spinning jenny, invented by James Hargreaves in 1764, and the power loom allowed cloth to be made much faster than by hand. Factories replaced small workshops, and workers moved from rural areas to cities to find jobs in these new factories.

While the Industrial Revolution brought economic growth and new opportunities, it also created serious problems. Factory workers, including children as young as 5 years old, often worked 12 to 16 hours a day in dangerous conditions. Wages were low, and there were no safety regulations. Cities grew rapidly but lacked proper housing, clean water, and sanitation, leading to disease and poverty.

Over time, reforms were introduced. The Factory Act of 1833 limited child labor and set minimum age requirements. Trade unions formed to fight for workers' rights, including better pay and safer conditions. These changes laid the foundation for modern labor laws that protect workers today.
```

---

## Expected Extracted Text

Identical to source text (text paste — no extraction loss).

- **Method:** `paste`
- **Character count:** 1,587
- **Warnings:** none

---

## Expected Structured Content

```json
{
  "title": "The Industrial Revolution",
  "sections": [
    {
      "sectionId": "sec_001",
      "title": "Overview and Origins",
      "sequenceNumber": 1,
      "concepts": [
        {
          "conceptId": "con_001",
          "originalText": "The Industrial Revolution was a period of major change in how goods were produced. It began in Great Britain in the late 1700s and spread to other parts of the world over the next century. Before this time, most goods were made by hand in small workshops or at home. The Industrial Revolution changed this by introducing machines and factories that could produce goods much faster and in larger quantities.",
          "sequenceNumber": 1
        }
      ]
    },
    {
      "sectionId": "sec_002",
      "title": "The Steam Engine and Energy",
      "sequenceNumber": 2,
      "concepts": [
        {
          "conceptId": "con_002",
          "originalText": "One of the most important inventions was the steam engine, improved by James Watt in 1769. The steam engine powered factories, trains, and ships. It allowed goods to be transported over long distances quickly and cheaply. Coal became the main fuel source, and mining grew rapidly to meet demand.",
          "sequenceNumber": 1
        }
      ]
    },
    {
      "sectionId": "sec_003",
      "title": "The Textile Industry",
      "sequenceNumber": 3,
      "concepts": [
        {
          "conceptId": "con_003",
          "originalText": "The textile industry was among the first to be transformed. Machines like the spinning jenny, invented by James Hargreaves in 1764, and the power loom allowed cloth to be made much faster than by hand. Factories replaced small workshops, and workers moved from rural areas to cities to find jobs in these new factories.",
          "sequenceNumber": 1
        }
      ]
    },
    {
      "sectionId": "sec_004",
      "title": "Problems and Working Conditions",
      "sequenceNumber": 4,
      "concepts": [
        {
          "conceptId": "con_004",
          "originalText": "While the Industrial Revolution brought economic growth and new opportunities, it also created serious problems. Factory workers, including children as young as 5 years old, often worked 12 to 16 hours a day in dangerous conditions. Wages were low, and there were no safety regulations. Cities grew rapidly but lacked proper housing, clean water, and sanitation, leading to disease and poverty.",
          "sequenceNumber": 1
        }
      ]
    },
    {
      "sectionId": "sec_005",
      "title": "Reforms and Legacy",
      "sequenceNumber": 5,
      "concepts": [
        {
          "conceptId": "con_005",
          "originalText": "Over time, reforms were introduced. The Factory Act of 1833 limited child labor and set minimum age requirements. Trade unions formed to fight for workers' rights, including better pay and safer conditions. These changes laid the foundation for modern labor laws that protect workers today.",
          "sequenceNumber": 1
        }
      ]
    }
  ]
}
```

---

## Expected Learner Profile (Dyslexia)

```json
{
  "profileId": "profile_demo",
  "profileType": "dyslexia",
  "typography": {
    "fontFamily": "'OpenDyslexic', 'Arial', sans-serif",
    "fontSize": 18,
    "lineHeight": 1.8,
    "letterSpacing": 0.12,
    "wordSpacing": 0.16,
    "textAlign": "left"
  },
  "colorScheme": "cream-on-dark",
  "adaptationSettings": {
    "simplificationLevel": 1,
    "chunkSize": 1,
    "readAloudRate": 0.9,
    "readAloudPitch": 1.0
  },
  "voiceSettings": {
    "voiceEnabled": true,
    "preferredVoice": null,
    "autoRead": false
  }
}
```

---

## Expected Initial Render (Concept 1, Level 1)

**Displayed text (Level 1 simplification):**

> The Industrial Revolution was a big change in how things were made. It started in Great Britain in the late 1700s. Before this, most things were made by hand at home or in small workshops. Then machines and factories were built. They could make things much faster and in much larger amounts.

**Visual description:**

> Picture two scenes: on the left, a person making shoes by hand at a table in a small room. On the right, a large factory building with smoke stacks and many workers operating machines. An arrow between them shows the change.

---

## Expected Signals (Concept 3 — Struggle Point)

The demo is designed so the learner struggles on **Concept 3 (Textile Industry)**:

```json
{
  "conceptId": "con_003",
  "signals": {
    "dwellTime": 42000,
    "rereadCount": 3,
    "scrollBack": 1,
    "helpRequests": 1,
    "questionAccuracy": 0.33,
    "answerLatency": 9000,
    "retryCount": 1,
    "voiceHelpRequests": 0
  }
}
```

---

## Expected Struggle Score (Concept 3)

Using the authoritative weights and section-specific normalization from `07-ADAPTIVE-ENGINE-LOGIC.md`:

```
Concept 3 baseline: ~70 words @ 180 WPM = 25–30 sec expected reading time
Active dwell:       50,000 ms (50 sec) -> dwell_ratio = 1.67
```

### Signal Breakdown & Normalized Contribution

```
dwellTime:        ratio 1.67 on 30s expected = 0.333   × 0.30 = 0.1000
questionAccuracy: accuracy 0.0 (inverted)   = 1.000   × 0.30 = 0.3000
helpRequests:     2 text + 1 voice = 3 total = 1.000   × 0.15 = 0.1500
answerLatency:    12,000 ms in [5k, 20k]     = 0.467   × 0.10 = 0.0467
scrollBack:       2 reversals on [0, 3]      = 0.667   × 0.05 = 0.0333
audioReplay:      4 replays on [0, 4]        = 1.000   × 0.05 = 0.0500
webcamContext:    none active / neutral      = 0.000   × 0.05 = 0.0000

STRUGGLE SCORE = 0.680 ✅ (above 0.60 threshold -> REWIRE Activated)
```

---

## Expected Adaptation (SCALE → REWIRE)

```json
{
  "shouldAdapt": true,
  "struggleScore": 0.680,
  "threshold": 0.6,
  "reason": "Struggle score 0.68 exceeds threshold 0.6",
  "thresholdsMet": [
    "rereadCount (4) > baseline (0)",
    "questionAccuracy (0.0) < baseline (0.8)",
    "helpRequests (2) > baseline (0)"
  ],
  "adaptationStrategy": {
    "action": "increase_simplification",
    "newVariantLevel": 2,
    "additionalActions": [
      "increase_simplification",
      "reduce_chunk_size",
      "add_visual_description"
    ]
  },
  "explanation": "We noticed you re-read this section 4 times and asked for help twice, so we switched to simpler language, shorter sections, and a visual description."
}
```

---

## Expected REWIRE Output (Concept 3, Level 2)

**Adapted text (Level 2):**

> Cloth used to be made slowly by hand. Then new machines were invented. The spinning jenny was made by James Hargreaves in 1764. The power loom was another important machine. These machines made cloth much faster. Small workshops closed. Big factories opened. People moved from the countryside to cities to work in factories.

**Visual description:**

> Two images: 1) A person sitting at a hand loom, slowly weaving cloth. 2) A row of large machines in a factory, with many threads spinning at once. Workers stand nearby.

**REWIRE explanation banner:**

> "We noticed you re-read this section 4 times and asked for help twice, so we switched to simpler language, shorter sections, and a visual description."

---

## Expected Adapted Question (Post-REWIRE)

```json
{
  "questionId": "q_con003_adapted",
  "text": "What did the spinning jenny do?",
  "type": "multiple_choice",
  "options": [
    { "id": "opt_1", "text": "It made cloth faster" },
    { "id": "opt_2", "text": "It powered trains" },
    { "id": "opt_3", "text": "It heated homes" },
    { "id": "opt_4", "text": "It pumped water" }
  ],
  "correctOptionId": "opt_1",
  "explanation": "The spinning jenny was a machine that made cloth (textiles) much faster than making it by hand."
}
```

---

## Expected Answer

Learner answers **opt_1** ("It made cloth faster") → **Correct** ✅

---

## Expected Outcome

```json
{
  "preAccuracy": 0.0,
  "postAccuracy": 1.0,
  "outcomeDelta": 1.0,
  "improved": true,
  "significantImprovement": true
}
```

**Demo narrative:** *"Accuracy improved from 0% to 100% after adaptation. REWIRE worked."*

---

## Fixture Summary

| Stage | Key Value |
|-------|-----------|
| Source | 5 paragraphs, 1,587 characters |
| Sections | 5 |
| Concepts | 5 (1 per section) |
| Struggle point | Concept 3 (Textile Industry) |
| Struggle score | 0.761 (above 0.6 threshold) |
| REWIRE level | 1 → 2 |
| Pre-accuracy | 0.0 |
| Post-accuracy | 1.0 |
| Outcome delta | +1.0 (100% improvement) |
