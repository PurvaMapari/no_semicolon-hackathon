# PRISM — Skills (Reusable Implementation Modules)

**Purpose:** Define reusable, testable modules that multiple team members can depend on. Each skill is a focused function or class with clear inputs, outputs, and contracts.

---

## 1. Extraction Skill

**Owner:** M1 | **Folder:** `server/skills/extraction/`

**Purpose:** Extract raw text from uploaded documents.

```typescript
interface ExtractionInput {
  file?: Buffer;        // PDF binary
  text?: string;        // Pasted text
  mimeType?: string;    // "application/pdf" | "text/plain"
}

interface ExtractionOutput {
  text: string;           // Extracted raw text
  method: 'pdfjs' | 'tesseract' | 'paste';
  characterCount: number;
  warnings: string[];     // e.g., "OCR fallback used — accuracy may vary"
}

function extractText(input: ExtractionInput): Promise<ExtractionOutput>
```

**Behavior:**
1. If `text` provided → return directly (method: `paste`)
2. If PDF → try PDF.js extraction
3. If PDF.js returns <100 chars → try Tesseract.js OCR fallback
4. If both fail → throw ExtractionError

---

## 2. Text Cleaning Skill

**Owner:** M1 | **Folder:** `server/skills/cleaning/`

**Purpose:** Normalize and clean extracted text before structuring.

```typescript
interface CleaningInput {
  rawText: string;
}

interface CleaningOutput {
  cleanedText: string;
  removedCharCount: number;
}

function cleanText(input: CleaningInput): CleaningOutput
```

**Operations:**
- Remove excessive whitespace (normalize to single spaces)
- Remove non-printable characters
- Normalize line endings
- Remove page headers/footers (heuristic: repeated lines at page boundaries)
- Preserve paragraph breaks (double newlines)
- Preserve numbered/bulleted lists

---

## 3. Content Structuring Skill

**Owner:** M1 | **Folder:** `server/skills/structuring/`

**Purpose:** Transform cleaned text into a content graph using LLM.

```typescript
interface StructuringInput {
  cleanedText: string;
  title: string;
}

interface StructuringOutput {
  sections: Section[];
  conceptCount: number;
}

interface Section {
  title: string;
  sequenceNumber: number;
  concepts: Concept[];
}

interface Concept {
  originalText: string;
  sequenceNumber: number;
}

function structureContent(input: StructuringInput): Promise<StructuringOutput>
```

**Fallback:** If LLM fails, split text into paragraphs → each paragraph is one concept in one section.

---

## 4. Simplification Skill

**Owner:** M1 | **Folder:** `server/skills/simplification/`

**Purpose:** Generate simplified variants at 3 levels for a concept.

```typescript
interface SimplificationInput {
  originalText: string;
  conceptContext: string;  // Section title
}

interface SimplificationOutput {
  variants: ContentVariant[];
}

interface ContentVariant {
  level: 1 | 2 | 3;
  simplifiedText: string;
  strategy: string;
}

function simplify(input: SimplificationInput): Promise<SimplificationOutput>
```

**Fallback:** Deterministic simplification using:
- Word replacement dictionary (complex → simple)
- Sentence splitting at conjunctions (and, but, however)
- Maximum 20-word sentence enforcement

---

## 5. Chunking Skill

**Owner:** M3 | **Folder:** `client/skills/chunking/`

**Purpose:** Group concepts into display chunks based on profile chunk size.

```typescript
interface ChunkingInput {
  concepts: Concept[];
  chunkSize: number;  // Concepts per chunk (from profile)
}

interface ChunkingOutput {
  chunks: Chunk[];
}

interface Chunk {
  chunkIndex: number;
  concepts: Concept[];
}

function chunkContent(input: ChunkingInput): ChunkingOutput
```

---

## 6. Question Generation Skill

**Owner:** M4 | **Folder:** `server/skills/questions/`

**Purpose:** Generate comprehension questions for a concept.

```typescript
interface QuestionGenInput {
  originalText: string;
  conceptContext: string;
  simplificationLevel: number;
}

interface QuestionGenOutput {
  questions: Question[];
}

interface Question {
  text: string;
  type: 'multiple_choice' | 'true_false';
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
}

function generateQuestions(input: QuestionGenInput): Promise<QuestionGenOutput>
```

**Fallback:** Return generic self-assessment:
```json
[{
  "text": "Did you understand the main idea of this section?",
  "type": "true_false",
  "options": [
    { "id": "opt_yes", "text": "Yes, I understood it" },
    { "id": "opt_no", "text": "No, I need more help" }
  ],
  "correctOptionId": "opt_yes",
  "explanation": "If you're unsure, try re-reading or asking for a simpler explanation."
}]
```

---

## 7. Fact Preservation Skill

**Owner:** M1 | **Folder:** `server/skills/fact-preservation/`

**Purpose:** Validate that simplified text preserves factual information from original.

```typescript
interface FactCheckInput {
  originalText: string;
  simplifiedText: string;
}

interface FactCheckOutput {
  factsPreserved: boolean;
  missingFacts: string[];  // Facts found in original but not in simplified
  warnings: string[];
}

function checkFactPreservation(input: FactCheckInput): FactCheckOutput
```

**Implementation (MVP):** Heuristic checks:
- Extract numbers from original → verify they exist in simplified
- Extract proper nouns (capitalized words) → verify they exist
- Extract dates (regex patterns) → verify they exist
- Log warnings for any missing facts

---

## 8. Adaptation Reasoning Skill

**Owner:** M2 | **Folder:** `client/skills/adaptation-reasoning/`

**Purpose:** Generate "Why I adapted" explanation from SCALE signals.

```typescript
interface ReasoningInput {
  signals: NormalizedSignals;
  thresholdsMet: string[];
  strategy: AdaptationStrategy;
}

interface ReasoningOutput {
  explanation: string;  // Human-readable, 1–2 sentences
}

function generateExplanation(input: ReasoningInput): ReasoningOutput
```

**Implementation:** Template-based (no LLM). See `06-AI-RULES-AND-SYSTEM-PROMPTS.md` §5.

---

## 9. Signal Processing Skill

**Owner:** M2 | **Folder:** `client/skills/signal-processing/`

**Purpose:** Normalize raw signals and compute struggle score.

```typescript
interface SignalInput {
  rawSignals: RawSignals;
  config: ScaleConfig;
}

interface SignalOutput {
  normalizedSignals: NormalizedSignals;
  struggleScore: number;
  thresholdsMet: string[];
}

function processSignals(input: SignalInput): SignalOutput
```

**Implementation:** Pure deterministic computation. See `07-ADAPTIVE-ENGINE-LOGIC.md` for exact formulas.

---

## Skill Dependency Map

```
Extraction → Cleaning → Structuring → Simplification → Cache
                                    → Question Generation → Cache
                                    → Fact Preservation (validation)

Signal Processing → Adaptation Reasoning → REWIRE
Chunking → Frontend Render
```

---

## Testing Contract

Every skill MUST have:
1. Unit tests with at least 3 test cases
2. A fallback path that returns valid output on failure
3. Input validation (reject invalid inputs early)
4. Type-safe interfaces (TypeScript or JSDoc)
