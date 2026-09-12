# Persona-Based Prompt Enhancement

## Overview

All LLM prompts now include **first-person persona context** that explicitly describes the learner's accessibility needs. This creates a more empathetic and context-aware interaction where the AI understands it's helping someone with specific challenges.

---

## What Changed

### Before (Generic Prompts)
```
"Rewrite the text below for a reader with dyslexia..."
```

### After (Persona-Based Prompts)
```
"I am a learner with dyslexia, and I find reading long, complex sentences very difficult. 
Words can appear to move or blur, and I need clear spacing to track lines effectively.

Please help me study this lesson by rewriting it..."
```

---

## Updated Prompts

### 1. Dyslexia Profile

**OLD:**
> Rewrite the text below for a reader with dyslexia. Use short, simple sentences...

**NEW:**
> I am a learner with dyslexia, and I find reading long, complex sentences very difficult. Words can appear to move or blur, and I need clear spacing to track lines effectively.
>
> Please help me study this lesson by rewriting it in a dyslexia-friendly format:
> - Use short, simple sentences (maximum 15 words per sentence)
> - Break complex ideas into smaller parts
> - Use clear, straightforward wording
> - Preserve every fact, relationship, number, and cause-and-effect detail exactly as given
> - Do not add any new information

---

### 2. Cognitive Load Profile

**OLD:**
> Split the text below into an ordered JSON object with one key, chunks...

**NEW:**
> I am a learner who gets overwhelmed when too much information is presented at once. I need content broken down into small, digestible pieces so I can focus on one concept at a time.
>
> Please help me study this lesson by breaking it into manageable chunks:
> - Split the text into 8 to 20 separate chunks
> - Each chunk should contain ONE complete idea or concept (roughly one paragraph or 3-6 sentences)
> - Do NOT split individual sentences into separate chunks
> - Preserve all original content word-for-word — do not summarize or paraphrase
> - Do not add any new information

---

### 3. Low Vision Profile

Currently, low_vision only applies formatting (larger text, high contrast) without rewriting content. However, the system is designed to support text adaptation if needed in the future.

---

### 4. Voice Assistant (All Profiles)

**OLD:**
> You are an educational assistant. Answer the learner's request using only the supplied lesson content...

**NEW:**
> You are an educational assistant helping a learner with {profile} accessibility needs.
>
> The learner has asked for help understanding part of their lesson. Answer their request using only the lesson content provided below:
> - Be clear and simple in your explanation
> - Use short sentences
> - Avoid jargon unless it's in the original lesson
> - Do not invent facts or use information outside the lesson
> - Keep your response concise (2-4 sentences)

**Example for dyslexia:**
> You are an educational assistant helping a learner with **dyslexia** accessibility needs...

---

### 5. Lesson Questions (All Profiles)

**OLD:**
> Answer the learner's question using only the supplied lesson and active section. Match the learner profile: {profile}...

**NEW:**
> You are a helpful learning assistant supporting a learner with **{profile}** accessibility needs.
>
> The learner is studying a lesson and has a question about it. Answer their question using only the information in the lesson provided below:
> - Focus primarily on the ACTIVE SECTION (what they're currently reading)
> - Use the FULL LESSON for additional context if needed
> - Be clear and simple in your explanation (2-5 sentences)
> - Match your language complexity to the learner's profile
> - Do not invent facts or use outside knowledge

---

### 6. Quiz Generation (All Profiles)

**OLD:**
> Create one practice question based only on the chunk below. Adjust phrasing complexity to the learner profile: {profile}...

**NEW:**
> You are creating a practice question for a learner with **{profile}** accessibility needs.
>
> Based on the lesson chunk below, create ONE multiple-choice question that tests understanding:
> - Adjust question complexity to match the learner's profile
> - For dyslexia: use simple, clear wording
> - For cognitive_load: focus on one concept at a time
> - For low_vision: ensure the question is straightforward
> - Base the question ONLY on information in the chunk (no outside knowledge)

---

### 7. REWIRE Adaptation (Struggle Response)

**OLD:**
> You are an adaptive learning assistant. The learner is struggling with the text below. Rewrite it at simplification level {level}...

**NEW:**
> I am a learner with **{profile}** accessibility needs, and I'm having difficulty understanding the lesson content below.
>
> The system detected that I'm struggling (struggle signals: {struggle_explanation}). Please help me by rewriting this content at simplification level {level}:
>
> **Level 1** (original): Keep the original complexity
> **Level 2** (simpler): Use simpler vocabulary and shorter sentences
> **Level 3** (very simple): Very simple language with concrete examples or analogies
>
> IMPORTANT RULES:
> - Preserve ALL facts, numbers, names, and cause-effect relationships exactly as given
> - Do NOT add new information or facts that weren't in the original
> - Use shorter sentences and clearer vocabulary at higher levels
> - At level 3, you may add a brief concrete analogy or example to aid understanding

**Example struggle signals:**
- "spending more time than expected on this section"
- "re-reading this section multiple times"
- "scored low on practice questions"
- "requested help 3 times"

---

### 8. Visual Descriptions (Struggle Response)

**OLD:**
> Describe a simple visual that would help a struggling learner understand this concept...

**NEW:**
> I am a learner who learns better with visual aids and concrete examples.
>
> I'm struggling to understand the concept explained in the text below. Please help me by describing a simple visual or mental picture that would make this concept clearer:
> - Write 2-3 sentences describing what I should picture or imagine
> - Be concrete and specific (not abstract)
> - Use everyday language, avoid technical jargon
> - Make it relatable to common experiences

---

### 9. Profile Detection (User Input)

**OLD:**
> A user described their accessibility needs below. Map it to exactly one profile: dyslexia, cognitive_load, or low_vision...

**NEW:**
> A learner has described their accessibility needs below. Your job is to identify which learning profile best matches their needs.
>
> The three profiles are:
> 1. **dyslexia** - For learners who have difficulty with reading, tracking text, or processing written words
> 2. **cognitive_load** - For learners who get overwhelmed by too much information at once and need content broken into small chunks
> 3. **low_vision** - For learners who have visual impairments and need larger text, high contrast, or better spacing
>
> Analyze the learner's description and return valid JSON with these fields:
> - "profile": one of "dyslexia", "cognitive_load", or "low_vision"
> - "reason": a brief explanation of why this profile was chosen

---

## Implementation Details

### Files Modified

1. **`project/Backend/app/services/learning.py`**
   - Updated all prompt templates
   - Modified `rewire_content()` to pass profile and struggle context
   - Modified `voice_ask()` to accept profile parameter

2. **`project/Backend/app/schemas.py`**
   - Added `profile` field to `VoiceRequest`

3. **`project/Backend/app/main.py`**
   - Updated `/api/voice/ask` endpoint to pass profile

### How Profiles Are Passed

```python
# Dyslexia transformation
rewritten = call_llm(DYSLEXIA_PROMPT.format(text=text)).strip()

# Cognitive load chunking
parsed = call_llm(COGNITIVE_LOAD_PROMPT.format(text=text))

# REWIRE adaptation
adapted_text = call_llm(
    REWIRE_PROMPT.format(
        text=chunk_text, 
        level=variant_level,
        profile=profile,  # ← NEW
        struggle_explanation=struggle_explanation  # ← NEW
    )
).strip()

# Voice help
answer = call_voice_llm(VOICE_HELP_PROMPT.format(
    lesson=lesson, 
    request=user_request,
    profile=profile  # ← NEW
)).strip()
```

---

## Benefits

### 1. More Empathetic Responses
The AI understands it's helping someone with specific challenges, not just "rewriting text."

### 2. Better Context Awareness
The AI knows WHY certain accommodations are needed (e.g., "words can appear to move" for dyslexia).

### 3. Consistent Persona
All interactions maintain the same learner perspective, creating a cohesive experience.

### 4. Improved Accuracy
Explicit context helps the AI make better decisions about simplification, chunking, and explanation style.

### 5. Struggle Context in REWIRE
When REWIRE triggers, the AI knows HOW the learner is struggling (e.g., "re-reading multiple times"), allowing for more targeted adaptations.

---

## Example Flow

### User selects "Dyslexia support"
1. **Upload lesson** → Extract text
2. **Transform text** → AI receives:
   ```
   I am a learner with dyslexia, and I find reading long, 
   complex sentences very difficult...
   
   Please help me study this lesson by rewriting it...
   
   LESSON TEXT: [photosynthesis content]
   ```
3. **AI rewrites** with short sentences, clear spacing
4. **User struggles** → REWIRE triggers with:
   ```
   I am a learner with dyslexia accessibility needs, and I'm 
   having difficulty understanding the lesson content below.
   
   The system detected that I'm struggling (struggle signals: 
   re-reading this section 4 times, spent 2x expected time).
   
   Please help me by rewriting this content at simplification 
   level 3...
   ```
5. **User asks voice question** → AI receives:
   ```
   You are an educational assistant helping a learner with 
   dyslexia accessibility needs.
   
   The learner has asked: "What does chlorophyll do?"
   ```

---

## Testing Recommendations

1. **Test each profile selection:**
   - Upload a complex document
   - Select dyslexia → verify persona in backend logs
   - Select cognitive_load → verify persona in backend logs
   - Select low_vision → verify formatting applied

2. **Test REWIRE:**
   - Intentionally struggle (re-read, take a long time)
   - Verify REWIRE prompt includes profile + struggle signals

3. **Test voice assistant:**
   - Ask a question while in dyslexia mode
   - Verify response is simple and clear

4. **Test quiz generation:**
   - Generate quiz in each profile
   - Verify questions match complexity level

---

## Future Enhancements

1. **Low Vision Text Adaptation**
   - Currently only applies CSS formatting
   - Could add prompt to simplify layout/structure descriptions

2. **Custom User Descriptions**
   - Allow users to write their own accessibility needs
   - Pass custom description directly to prompts

3. **Multi-Profile Support**
   - Some users might need dyslexia + low_vision
   - Combine personas in prompts

4. **Struggle Signal Details**
   - Pass specific metrics to REWIRE
   - Example: "You re-read this 5 times, spent 3 minutes (expected 45 seconds), and asked for help twice"

---

## Summary

**Before:** Generic "rewrite for dyslexia" instructions
**After:** "I am a learner with dyslexia... help me study this"

All prompts now speak in **first person from the learner's perspective**, creating a more empathetic, context-aware AI that understands it's helping someone with specific accessibility needs.
