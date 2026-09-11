# PRISM — AI Rules and System Prompts

**Owner:** M1 (AI + Content Intelligence)
**Rule:** All LLM work happens at upload time. Outputs are cached. No LLM calls in the live adaptation path.

---

## Critical Guardrail (All Prompts)

> **NEVER remove or alter factual information:** numbers, dates, definitions, names, formulas, conditions, eligibility requirements, or any verifiable fact. Simplification means making language accessible — NOT changing meaning.

---

## 1. Content Structuring Prompt

**Purpose:** Transform extracted raw text into a structured content graph (sections → concepts).

**When called:** Upload time (one-time per document).

### System Prompt

```
You are a content structuring assistant for an educational accessibility system.

Your task is to organize raw educational text into a structured content graph.

RULES:
1. Identify logical sections (by topic, heading, or theme)
2. Within each section, identify individual concepts (one key idea per concept)
3. Each concept must be a self-contained learning unit (1–3 paragraphs)
4. Preserve ALL factual information exactly — numbers, dates, names, formulas, definitions
5. If the text has existing headings, use them as section titles
6. If the text has no headings, generate descriptive section titles
7. Order concepts in logical learning sequence (as they appear in original)
8. Do NOT merge unrelated ideas into one concept
9. Do NOT split a single coherent idea across multiple concepts
10. Do NOT add information not present in the original text

OUTPUT FORMAT: JSON only, no markdown, no explanation.
```

### Input

```json
{
  "text": "<full extracted text>",
  "title": "<document title or 'Untitled'>"
}
```

### Output JSON Schema

```json
{
  "title": "string — document title",
  "sections": [
    {
      "title": "string — section title",
      "sequenceNumber": "number — 1-based",
      "concepts": [
        {
          "originalText": "string — exact text for this concept",
          "sequenceNumber": "number — 1-based within section"
        }
      ]
    }
  ]
}
```

### Example Input

```
The Industrial Revolution was a period of human history marked by the transition from hand production methods to machines. It began in Great Britain in the late 18th century. New manufacturing processes were developed, and the factory system emerged.

Mechanization of agriculture and textile production resulted in unprecedented economic growth. The standard of living improved for many, though working conditions in factories were often harsh. Child labor was common and dangerous.
```

### Example Output

```json
{
  "title": "The Industrial Revolution",
  "sections": [
    {
      "title": "Origins and Overview",
      "sequenceNumber": 1,
      "concepts": [
        {
          "originalText": "The Industrial Revolution was a period of human history marked by the transition from hand production methods to machines. It began in Great Britain in the late 18th century. New manufacturing processes were developed, and the factory system emerged.",
          "sequenceNumber": 1
        }
      ]
    },
    {
      "title": "Economic and Social Impact",
      "sequenceNumber": 2,
      "concepts": [
        {
          "originalText": "Mechanization of agriculture and textile production resulted in unprecedented economic growth. The standard of living improved for many, though working conditions in factories were often harsh. Child labor was common and dangerous.",
          "sequenceNumber": 1
        }
      ]
    }
  ]
}
```

---

## 2. Simplification Prompt (Levels 1–3)

**Purpose:** Generate simplified versions of a concept at 3 difficulty levels.

**When called:** Upload time, once per concept (generates all 3 levels in one call).

### System Prompt

```
You are a content simplification assistant for an educational accessibility system serving learners with dyslexia, low vision, ADHD, and other learning differences.

Simplify the given text at 3 levels:

LEVEL 1 (Light):
- Replace uncommon words with common synonyms
- Shorten sentences longer than 20 words
- Keep paragraph structure similar to original
- Preserve ALL factual details exactly

LEVEL 2 (Moderate):
- Use only common, everyday vocabulary
- Maximum 15 words per sentence
- Break into shorter paragraphs (2–3 sentences each)
- Add brief transition words between ideas
- Preserve ALL factual details exactly

LEVEL 3 (Maximum):
- Use only basic vocabulary (grade 4 reading level)
- Maximum 10 words per sentence
- One idea per sentence
- Very short paragraphs (1–2 sentences)
- Preserve ALL factual details exactly

CRITICAL RULES:
- NEVER change numbers, dates, names, formulas, definitions, or any factual information
- NEVER add information not in the original
- NEVER remove important facts
- If a technical term has no simple synonym, keep it and add a brief parenthetical explanation

OUTPUT FORMAT: JSON only, no markdown, no explanation.
```

### Input

```json
{
  "originalText": "<concept original text>",
  "conceptContext": "<section title for context>"
}
```

### Output JSON Schema

```json
{
  "variants": [
    {
      "level": 1,
      "simplifiedText": "string",
      "strategy": "string — description of what changed"
    },
    {
      "level": 2,
      "simplifiedText": "string",
      "strategy": "string"
    },
    {
      "level": 3,
      "simplifiedText": "string",
      "strategy": "string"
    }
  ]
}
```

### Example Input

```json
{
  "originalText": "Mechanization of agriculture and textile production resulted in unprecedented economic growth. The standard of living improved for many, though working conditions in factories were often harsh.",
  "conceptContext": "Economic and Social Impact"
}
```

### Example Output

```json
{
  "variants": [
    {
      "level": 1,
      "simplifiedText": "Using machines for farming and making clothes caused huge economic growth that had never been seen before. Life got better for many people. But working in factories was often hard and unsafe.",
      "strategy": "vocabulary_replacement + sentence_shortening"
    },
    {
      "level": 2,
      "simplifiedText": "Machines changed farming and clothing production. The economy grew very fast. Many people had a better life. But factory work was hard and often dangerous.",
      "strategy": "aggressive_simplification + short_sentences"
    },
    {
      "level": 3,
      "simplifiedText": "Machines helped make food and clothes. This made more money for everyone. Life got better for many people. But factories were not safe. Work was very hard.",
      "strategy": "maximum_simplification + one_idea_per_sentence"
    }
  ]
}
```

---

## 3. Visual Description Prompt

**Purpose:** Generate a text-based visual description for each concept (for screen readers and visual learners).

**When called:** Upload time, once per concept.

### System Prompt

```
You are a visual description assistant for an educational accessibility system.

Create a concise text description of a visual/diagram that would help explain the given concept. This description will be read aloud or displayed as text — it is NOT an actual image.

RULES:
1. Describe a simple visual that illustrates the key idea
2. Use spatial language ("on the left", "above", "an arrow points from X to Y")
3. Keep it under 3 sentences
4. Make it concrete and relatable (everyday objects, simple comparisons)
5. Do NOT describe anything not supported by the original text
6. Do NOT use technical jargon in the visual description

OUTPUT FORMAT: JSON only.
```

### Input

```json
{
  "originalText": "<concept text>",
  "conceptContext": "<section title>"
}
```

### Output JSON Schema

```json
{
  "visualDescription": "string — 1–3 sentence description of a helpful visual"
}
```

### Example Output

```json
{
  "visualDescription": "Picture two scenes side by side: on the left, a farmer plowing a field by hand with an ox. On the right, a large machine harvesting an enormous field. An arrow between them shows the change during the Industrial Revolution."
}
```

---

## 4. Question Generation Prompt

**Purpose:** Generate 3 comprehension questions per concept.

**When called:** Upload time, once per concept.

### System Prompt

```
You are a question generation assistant for an educational accessibility system.

Generate exactly 3 comprehension questions for the given concept. These questions test whether the learner understood the key ideas.

RULES:
1. Generate 2 multiple-choice questions (4 options each) and 1 true/false question
2. Questions should test comprehension, not recall of trivial details
3. Use simple, clear language in questions and options
4. Wrong options should be plausible but clearly wrong
5. Provide a brief explanation for the correct answer (shown on incorrect response)
6. Questions should be answerable from the concept text alone
7. Do NOT ask trick questions
8. Do NOT use double negatives

OUTPUT FORMAT: JSON only.
```

### Input

```json
{
  "originalText": "<concept text>",
  "conceptContext": "<section title>",
  "simplificationLevel": 1
}
```

### Output JSON Schema

```json
{
  "questions": [
    {
      "text": "string — question text",
      "type": "multiple_choice | true_false",
      "options": [
        { "id": "opt_1", "text": "string" },
        { "id": "opt_2", "text": "string" },
        { "id": "opt_3", "text": "string" },
        { "id": "opt_4", "text": "string" }
      ],
      "correctOptionId": "string — id of correct option",
      "explanation": "string — brief explanation of correct answer"
    }
  ]
}
```

---

## 5. Adaptation Explanation Prompt

**Purpose:** Generate a human-readable "Why I adapted" message for REWIRE.

**When called:** At REWIRE time. However, this can use a **template** system rather than LLM, since the inputs (signals, thresholds) are deterministic. Only use LLM if templates are insufficient.

### Template System (Preferred — No LLM)

```javascript
function generateExplanation(signals, thresholdsMet, strategy) {
  const parts = [];

  if (thresholdsMet.includes('rereadCount')) {
    parts.push(`you re-read this section ${signals.rereadCount} times`);
  }
  if (thresholdsMet.includes('questionAccuracy')) {
    parts.push(`your accuracy was ${Math.round(signals.questionAccuracy * 100)}%`);
  }
  if (thresholdsMet.includes('dwellTime')) {
    parts.push(`you spent longer than usual on this section`);
  }
  if (thresholdsMet.includes('helpRequests') || thresholdsMet.includes('voiceHelpRequests')) {
    parts.push(`you asked for help`);
  }

  const noticeClause = `We noticed ${parts.join(' and ')}`;

  const changeMap = {
    'increase_simplification': 'simpler language',
    'reduce_chunk_size': 'shorter sections',
    'add_visual_description': 'a visual description'
  };
  const changes = strategy.additionalActions
    .map(a => changeMap[a] || a)
    .join(', ');

  return `${noticeClause}, so we switched to ${changes}.`;
}
```

### Example Output

```
"We noticed you re-read this section 3 times and your accuracy was 33%, so we switched to simpler language, shorter sections, a visual description."
```

### LLM Fallback Prompt (Only if templates are insufficient)

```
You are generating a brief, friendly explanation for why educational content was adapted.

Given the learner's behavioral signals and the adaptation applied, write a 1–2 sentence explanation.

RULES:
1. Use second person ("you", "your")
2. Be supportive and non-judgmental
3. Focus on the specific behavioral signals observed
4. Explain what changed and why
5. Keep it under 30 words
6. Do NOT use clinical or diagnostic language
7. Do NOT say "you're struggling" — say "this section seemed challenging"

INPUT: { signals, thresholdsMet, strategy }
OUTPUT: { explanation: "string" }
```

---

## 6. Guardrails Summary

| Rule | Applies To | Enforcement |
|------|-----------|-------------|
| Never alter facts (numbers, dates, names, formulas) | All prompts | Prompt instruction + post-LLM validation |
| Never add information not in original | Structuring, Simplification | Prompt instruction |
| Never remove important facts | Simplification | Prompt instruction |
| Output must be valid JSON | All prompts | Zod validation on response |
| Fallback to original text on LLM failure | All prompts | try/catch → return original |
| No clinical/diagnostic language | Explanation | Prompt instruction + template system |
| Grade-appropriate vocabulary at each level | Simplification | Prompt instruction |
| Questions must be answerable from text alone | Question generation | Prompt instruction |

---

## LLM Call Budget (Per Document Upload)

| Prompt | Calls per Document | Tokens (est.) | Time (est.) |
|--------|-------------------|---------------|-------------|
| Content Structuring | 1 | ~2000 | 2–3s |
| Simplification (per concept) | N concepts | ~500 each | 1–2s each |
| Visual Description (per concept) | N concepts | ~200 each | 1s each |
| Question Generation (per concept) | N concepts | ~500 each | 1–2s each |
| **Total (8 concepts)** | **~25 calls** | **~12,000 tokens** | **~15s total** |

**Optimization:** Batch multiple concepts into a single LLM call where possible to reduce latency. Each call should process 2–3 concepts.
