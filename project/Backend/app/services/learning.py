import json
import re
from typing import Any, Dict, List, Optional

from app.config import GROQ_API_KEY, VOICE_GROQ_API_KEY
from app.services.llm import call_llm, call_voice_llm, parse_json_response


DYSLEXIA_PROMPT = """You are an expert educational content designer helping a learner with dyslexia. Words can appear to move or blur for this learner, so they need clear, simple text.

Your task: Rewrite the lesson below into logical, concept-based sections with dyslexia-friendly language.

STRICT RULES:
- Return a JSON object with a "sections" array
- Each element: {{"heading": "Clear topic title", "content": "Dyslexia-friendly explanation"}}
- If the source text contains its own numbered or titled subsections (e.g., '7.1', '7.2', 'Section 3:'), each one is a MANDATORY section boundary. Never merge two source subsections into one output section, regardless of combined length.
- Each section's content must not exceed {max_words} words. This is a hard limit, not a target — if a single source subsection is longer, split it into multiple sequential sections (e.g., 'The Two Main Stages (Part 1)', '(Part 2)').
- Do not try to limit the total number of sections. A long document producing many sections is correct and expected.
- Headings must be clear, descriptive topic titles (e.g. "What Is Inheritance?" or "Classes and Objects")
- Use short, simple sentences (maximum 15 words per sentence)
- Break complex ideas into smaller parts
- Use clear, straightforward wording
- Content must contain ONLY factual study material the learner should read
- REMOVE all: **bold markers**, ## markdown headings, bullet-point dashes, numbered-list prefixes, AI commentary, meta-text, prompt echoes, quiz questions/answers, separators like ---
- Preserve every fact, number, name, relationship, and cause-effect detail from the original
- Do NOT add new information not present in the original

Include the marker SECTION_JSON.

LESSON TEXT:
{text}"""


STRUCTURED_SECTIONS_PROMPT = """You are an expert educational content designer. A learner with {profile} accessibility needs wants to study the lesson below.

Your task: Break the lesson into logical, concept-based sections. Each section covers ONE coherent topic.

STRICT RULES:
- Return a JSON object with a "sections" array
- Each element: {{"heading": "Learner-friendly topic title", "content": "Only the learner-facing explanation"}}
- If the source text contains its own numbered or titled subsections (e.g., '7.1', '7.2', 'Section 3:'), each one is a MANDATORY section boundary. Never merge two source subsections into one output section, regardless of combined length.
- Each section's content must not exceed {max_words} words. This is a hard limit, not a target — if a single source subsection is longer, split it into multiple sequential sections (e.g., 'The Two Main Stages (Part 1)', '(Part 2)').
- Do not try to limit the total number of sections. A long document producing many sections is correct and expected.
- Headings must be clear, descriptive questions or topic titles (e.g. "What Is Inheritance?" or "Classes and Objects")
- Content must contain ONLY factual study material the learner should read
- REMOVE all: **bold markers**, ## markdown headings, bullet-point dashes, numbered-list prefixes, AI commentary, meta-text like "Here is...", "Let me explain...", prompt echoes, quiz questions/answers
- Preserve every fact, number, name, cause-effect relationship from the original
- Do NOT add new information not present in the original
- Adapt vocabulary and sentence complexity for the {profile} profile
- Do NOT include quiz questions or answers in sections

Include the marker SECTION_JSON.

LESSON TEXT:
{text}"""


PREFERENCE_PARSE_PROMPT = """A learner has described their accessibility needs below. Your job is to identify which learning profile best matches their needs.

The three profiles are:
1. **dyslexia** - For learners who have difficulty with reading, tracking text, or processing written words
2. **cognitive_load** - For learners who get overwhelmed by too much information at once and need content broken into small chunks
3. **low_vision** - For learners who have visual impairments and need larger text, high contrast, or better spacing

Analyze the learner's description and return valid JSON with these fields:
- "profile": one of "dyslexia", "cognitive_load", or "low_vision"
- "reason": a brief explanation of why this profile was chosen

Include the marker PREFERENCE_JSON.

LEARNER'S DESCRIPTION:
{text}"""

VOICE_HELP_PROMPT = """You are an educational assistant helping a learner with accessibility needs (Profile: {profile}).

The learner has asked for help understanding part of their lesson. Answer their request using only the lesson content provided below:
- Be clear and simple in your explanation
- Use short sentences
- Avoid jargon unless it's in the original lesson
- Do not invent facts or use information outside the lesson
- Keep your response concise (2-4 sentences)

If the lesson doesn't contain enough information to answer the question, say: "The lesson does not provide enough information to answer that."

LESSON CONTENT:
{lesson}

LEARNER REQUEST:
{request}"""

LESSON_QUESTION_PROMPT = """You are a helpful learning assistant supporting a learner with {profile} accessibility needs.

The learner is studying a lesson and has a question about it. Answer their question using only the information in the lesson provided below:
- Focus primarily on the ACTIVE SECTION (what they're currently reading)
- Use the FULL LESSON for additional context if needed
- Be clear and simple in your explanation (2-5 sentences)
- Match your language complexity to the learner's profile
- Do not invent facts or use outside knowledge

If the lesson doesn't support an answer, say: "The lesson does not provide enough information to answer that."

FULL LESSON:
{lesson}

CURRENT SECTION (what the learner is reading now):
{section}

LEARNER'S QUESTION:
{question}"""

QUIZ_PROMPT = """You are creating a practice question for a learner with {profile} accessibility needs.

Based on the lesson chunk below, create ONE multiple-choice question that tests understanding:
- Adjust question complexity to match the learner's profile
- For dyslexia: use simple, clear wording
- For cognitive_load: focus on one concept at a time
- For low_vision: ensure the question is straightforward
- Base the question ONLY on information in the chunk (no outside knowledge)

Return valid JSON with exactly these fields:
- "question": the question text
- "options": array of exactly 4 possible answers
- "answer": the correct answer (must exactly match one of the options)
- "explanation": brief explanation of why the answer is correct

Include the marker QUIZ_JSON.

LESSON CHUNK:
{chunk}"""

# ── REWIRE Prompts ────────────────────────────────────────────────────────────

REWIRE_PROMPT = """I am a learner with {profile} accessibility needs, and I'm having difficulty understanding the lesson content below.

The system detected that I'm struggling (struggle signals: {struggle_explanation}). Please help me by rewriting this content at simplification level {level}:

**Level 1** (original): Keep the original complexity
**Level 2** (simpler): Use simpler vocabulary and shorter sentences
**Level 3** (very simple): Very simple language with concrete examples or analogies

IMPORTANT RULES:
- Preserve ALL facts, numbers, names, and cause-effect relationships exactly as given
- Do NOT add new information or facts that weren't in the original
- Use shorter sentences and clearer vocabulary at higher levels
- At level 3, you may add a brief concrete analogy or example to aid understanding
- Return only the rewritten text, nothing else

ORIGINAL CONTENT I'M STRUGGLING WITH:
{text}"""

REWIRE_VISUAL_PROMPT = """I am a learner who learns better with visual aids and concrete examples.

I'm struggling to understand the concept explained in the text below. Please help me by describing a simple visual or mental picture that would make this concept clearer:
- Write 2-3 sentences describing what I should picture or imagine
- Be concrete and specific (not abstract)
- Use everyday language, avoid technical jargon
- Make it relatable to common experiences

TEXT:
{text}"""

ADAPTIVE_QUIZ_PROMPT = """Create one practice question based only on the chunk below. This question is for a learner who {context}. Make the question {difficulty} than a standard question — {difficulty_guidance}.

Return valid JSON only with exactly these keys: question, options, answer, explanation. The options value must contain exactly four strings. The answer must exactly match one option. Do not use information outside the chunk. Include the marker QUIZ_JSON.

CHUNK:
{chunk}"""

VALID_PROFILES = {"dyslexia", "low_vision", "cognitive_load"}

PROFILE_MAX_WORDS = {
    "dyslexia": 100,
    "cognitive_load": 100,
    "low_vision": 140,
}


def _dyslexia_fallback(text: str) -> str:
    """Keep facts intact while making fallback text easier to scan."""
    sentences = [sentence.strip() for sentence in text.replace("\n", " ").split(".") if sentence.strip()]
    return "\n\n".join(f"{sentence}." for sentence in sentences)


def _clean_section_text(text: str) -> str:
    """Strip residual markdown / AI artefacts / CID artifacts from a section's text."""
    if not text:
        return text
    # Remove PDF font-encoding artifacts like (cid:127) -> space
    text = re.sub(r"\(cid:\d+\)", " ", text)
    # Remove bold markers  **text** → text
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    # Remove italic markers  *text* → text  (single asterisks only)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"\1", text)
    # Remove markdown heading prefixes  ## Heading → Heading
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    # Remove leading bullet dashes  - item → item
    text = re.sub(r"^\s*[-•]\s+", "", text, flags=re.MULTILINE)
    # Remove numbered-list prefixes  1. item → item  /  1) item → item
    text = re.sub(r"^\s*\d+[.)]\s+", "", text, flags=re.MULTILINE)
    # Strip AI boilerplate openers
    text = re.sub(
        r"^(Here is|Here are|Let me|Below is|The following|In this section)[^.]*\.\s*",
        "",
        text,
        count=1,
        flags=re.IGNORECASE,
    )
    # Clean multiple whitespace characters
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _classify_chunk_difficulty(text: str, chunk_idx: int, total_chunks: int) -> str:
    """Classify chunk difficulty into foundational, intermediate, or advanced."""
    lower = text.lower()
    
    foundational_keywords = [
        "what is", "introduction", "intro", "overview", "basics", "foundation",
        "blueprint", "definition", "defining", "elementary", "first step",
        "terminology", "starting with", "simple example", "syntax", "purpose", "core concept"
    ]
    advanced_keywords = [
        "polymorphism", "dynamic dispatch", "runtime polymorphism", "concurrency",
        "threading", "optimization", "abstract class", "interface segregation",
        "dependency inversion", "liskov", "solid", "architecture", "design pattern",
        "asynchronous", "coupling and cohesion", "invariants", "memory allocation",
        "composition over inheritance", "substitutability", "trade-off"
    ]
    intermediate_keywords = [
        "encapsulation", "inheritance", "subclass", "superclass", "overriding",
        "attributes", "parameters", "lifecycle", "instantiation", "access modifier",
        "private", "protected", "public", "aggregation", "association", "composition",
        "getter", "setter", "constructor", "validation"
    ]
    
    adv_score = sum(2 for k in advanced_keywords if k in lower)
    found_score = sum(2 for k in foundational_keywords if k in lower)
    inter_score = sum(1 for k in intermediate_keywords if k in lower)
    
    rel_pos = chunk_idx / max(total_chunks - 1, 1)
    if rel_pos < 0.28:
        found_score += 3
    elif rel_pos > 0.68:
        adv_score += 3
    else:
        inter_score += 2
        
    if adv_score >= 4 or (adv_score > found_score and adv_score >= 2 and rel_pos > 0.4):
        return "advanced"
    if found_score >= 3 and adv_score < 3:
        return "foundational"
    if rel_pos < 0.22 and adv_score < 2:
        return "foundational"
    if rel_pos > 0.78 and found_score < 2:
        return "advanced"
    return "intermediate"


def _build_chunk_meta(chunks: List[str], full_text: str) -> List[Dict[str, Any]]:
    """
    Produce difficulty tiers and reading estimations for each lesson chunk.
    Combines LLM content analysis with curriculum progression and technical vocabulary density.
    """
    from app.services.scale import tag_section_difficulty, compute_section_read_time, DIFFICULTY_MULTIPLIERS

    total_chunks = len(chunks)
    chunk_meta = []
    
    # Try LLM section tagging first
    sections = []
    try:
        sections = tag_section_difficulty(full_text)
    except Exception:
        sections = []
        
    has_diverse_llm_tiers = bool(sections and len(set(s.get("difficulty_tier") for s in sections)) > 1)

    for idx, chunk in enumerate(chunks):
        word_count = len(chunk.split())
        chunk_words = set(chunk.lower().split())
        
        # Determine tier
        tier = None
        if has_diverse_llm_tiers:
            best_section = None
            best_overlap = 0
            for section in sections:
                section_words = set(section.get("text", "").lower().split())
                overlap = len(chunk_words & section_words)
                if overlap > best_overlap:
                    best_overlap = overlap
                    best_section = section
            if best_section and best_section.get("difficulty_tier") in ("foundational", "intermediate", "advanced"):
                tier = best_section.get("difficulty_tier")

        if not tier:
            tier = _classify_chunk_difficulty(chunk, idx, total_chunks)

        baseline_sec = compute_section_read_time(word_count, tier)
        chunk_meta.append({
            "difficulty_tier": tier,
            "expected_time_multiplier": DIFFICULTY_MULTIPLIERS.get(tier, 1.6),
            "estimated_seconds": baseline_sec,
            "word_count": word_count,
        })
    
    return chunk_meta


def parse_user_preference(user_text: str) -> Dict[str, Any]:
    """Convert free-text accessibility needs into a structured profile."""
    text_lower = user_text.lower()
    if "dyslex" in text_lower or "read" in text_lower or "font" in text_lower or "word" in text_lower:
        fallback_profile = "dyslexia"
    elif "vision" in text_lower or "contrast" in text_lower or "large" in text_lower or "see" in text_lower or "eye" in text_lower:
        fallback_profile = "low_vision"
    else:
        fallback_profile = "cognitive_load"

    try:
        if not (GROQ_API_KEY or VOICE_GROQ_API_KEY):
            return {"profile": fallback_profile, "reason": "Matched accessibility keywords from request."}
        result = parse_json_response(call_llm(PREFERENCE_PARSE_PROMPT.format(text=user_text)))
        if isinstance(result, dict) and result.get("profile") in VALID_PROFILES:
            return result
    except Exception:
        pass
    
    return {"profile": fallback_profile, "reason": "Detected preference based on keyword analysis."}


def _extract_section_heading(chunk: str) -> str:
    """Extract a meaningful, human-readable section heading from a chunk, never a solitary number."""
    if not chunk:
        return "Key Concepts"

    lines = [line.strip() for line in chunk.split("\n") if line.strip()]
    for line in lines[:5]:
        # Strip markdown headings, bullet points, and numbered prefixes like "9.", "9)", "Section 9:"
        cleaned_line = re.sub(
            r"^(?:#{1,6}\s*|\d+[\.\)]\s*|(?:Section|Chapter|Part)\s*\d+[:\.]?\s*|[-•*]\s*)",
            "",
            line,
            flags=re.IGNORECASE,
        ).strip()
        cleaned_line = _clean_section_text(cleaned_line)

        # Check if this line has letters/words (at least 3 alphabet characters)
        letters = re.findall(r"[a-zA-Z]", cleaned_line)
        if len(letters) >= 3:
            # Split only at real sentence ends (letter followed by period and space or end of string)
            sentence_match = re.split(r"(?<=[a-zA-Z0-9])\.\s+", cleaned_line)
            candidate = sentence_match[0].strip() if sentence_match else cleaned_line
            candidate = candidate.rstrip(".:")
            if len(candidate) > 55:
                candidate = candidate[:52].rstrip() + "…"
            return candidate

    # Fallback to chunk sentences
    sentences = re.split(r"(?<=[.!?])\s+", chunk)
    for s in sentences:
        cleaned_s = re.sub(r"^(?:\d+[\.\)]\s*|[-•*]\s*)", "", s.strip())
        cleaned_s = _clean_section_text(cleaned_s)
        letters = re.findall(r"[a-zA-Z]", cleaned_s)
        if len(letters) >= 3:
            cand = cleaned_s.rstrip(".:")
            if len(cand) > 55:
                cand = cand[:52].rstrip() + "…"
            return cand

    return "Key Concepts"


def _sanitize_heading(heading: str, content: str = "") -> str:
    """Ensure heading is never just a solitary number, symbol, or empty string."""
    cleaned = (heading or "").strip()
    cleaned = re.sub(
        r"^(?:#{1,6}\s*|\d+[\.\)]\s*|(?:Section|Chapter|Part)\s*\d+[:\.]?\s*)",
        "",
        cleaned,
        flags=re.IGNORECASE,
    ).strip()
    letters = re.findall(r"[a-zA-Z]", cleaned)
    if len(letters) < 3:
        return _extract_section_heading(content)
    return cleaned


def _parse_sections_response(raw_response: str) -> Optional[List[Dict[str, str]]]:
    """Parse an LLM response that should contain a 'sections' JSON array of {heading, content}."""
    try:
        parsed = parse_json_response(raw_response)
        candidate = None
        if isinstance(parsed, dict):
            candidate = parsed.get("sections")
        elif isinstance(parsed, list):
            candidate = parsed
        if (
            isinstance(candidate, list)
            and len(candidate) >= 2
            and all(
                isinstance(s, dict) and s.get("heading") and s.get("content")
                for s in candidate
            )
        ):
            return [
                {
                    "heading": _sanitize_heading(_clean_section_text(s["heading"]), s.get("content", "")),
                    "content": _clean_section_text(s["content"]),
                }
                for s in candidate
            ]
    except Exception:
        pass
    return None


def _enforce_section_constraints(sections: List[Dict[str, str]], max_words: int) -> List[Dict[str, str]]:
    """
    Deterministic enforcement pass:
    - Ensures each section's word count does not exceed max_words.
    - If a section exceeds max_words, splits it at sentence boundaries (never mid-sentence).
    - Appends '(Part 1)', '(Part 2)', etc., to the headings for split sections.
    - Does NOT merge short sections together.
    - Does NOT cap total section count.
    """
    enforced: List[Dict[str, str]] = []

    for sec in sections:
        content = (sec.get("content") or "").strip()
        heading = _sanitize_heading(sec.get("heading") or "", content)
        words = content.split()

        if len(words) <= max_words:
            enforced.append({"heading": heading, "content": content})
            continue

        # Strip existing '(Part X)' if present to obtain base heading
        base_heading = re.sub(r"\s*\(Part\s*\d+\)$", "", heading, flags=re.IGNORECASE).strip()
        base_heading = _sanitize_heading(base_heading, content)

        # Split content into sentences at sentence boundaries (never mid-sentence)
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", content) if s.strip()]
        if not sentences:
            sentences = [content]

        parts: List[str] = []
        current_sentences: List[str] = []
        current_count = 0

        for sentence in sentences:
            s_words = len(sentence.split())
            if current_count + s_words > max_words and current_sentences:
                parts.append(" ".join(current_sentences))
                current_sentences = [sentence]
                current_count = s_words
            else:
                current_sentences.append(sentence)
                current_count += s_words

        if current_sentences:
            parts.append(" ".join(current_sentences))

        if len(parts) <= 1:
            enforced.append({"heading": heading, "content": content})
        else:
            for idx, part in enumerate(parts, 1):
                part_heading = f"{base_heading} (Part {idx})"
                enforced.append({"heading": part_heading, "content": part})

    import logging
    logging.getLogger("adaptlearn").info(
        f"Deterministic constraint pass: {len(enforced)} sections (max_words={max_words})"
    )
    return enforced


def _fallback_sections(text: str, max_words: int = 100) -> List[Dict[str, str]]:
    """Build sections from paragraph splitting when LLM fails, respecting max_words."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if len(paragraphs) <= 1:
        sentences = [s.strip() + "." for s in text.split(".") if s.strip()]
        paragraphs = [" ".join(sentences[i:i+3]) for i in range(0, len(sentences), 3)]

    merged: List[str] = []
    buf: List[str] = []
    buf_words = 0

    for para in paragraphs:
        para_words = len(para.split())
        # If single paragraph exceeds max_words, split it at sentence boundaries
        if para_words > max_words:
            if buf:
                merged.append("\n\n".join(buf))
                buf, buf_words = [], 0
            para_sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", para) if s.strip()]
            sub_buf, sub_count = [], 0
            for sent in para_sentences:
                sent_words = len(sent.split())
                if sub_count + sent_words > max_words and sub_buf:
                    merged.append(" ".join(sub_buf))
                    sub_buf, sub_count = [sent], sent_words
                else:
                    sub_buf.append(sent)
                    sub_count += sent_words
            if sub_buf:
                merged.append(" ".join(sub_buf))
            continue

        if buf_words + para_words > max_words and buf:
            merged.append("\n\n".join(buf))
            buf, buf_words = [para], para_words
        else:
            buf.append(para)
            buf_words += para_words

    if buf:
        merged.append("\n\n".join(buf))

    fallback_chunks = merged if merged else [text]

    sections_list = []
    for chunk in fallback_chunks:
        heading = _extract_section_heading(chunk)
        sections_list.append({
            "heading": heading,
            "content": _clean_section_text(chunk),
        })
    return sections_list


def transform_text(text: str, profile: str) -> Dict[str, Any]:
    """Transform text according to an accessibility profile."""
    if profile not in PROFILE_MAX_WORDS:
        raise ValueError("profile must be dyslexia, low_vision, or cognitive_load")

    max_words = PROFILE_MAX_WORDS[profile]

    if profile == "low_vision":
        sections_list = None
        if GROQ_API_KEY or VOICE_GROQ_API_KEY:
            try:
                raw = call_llm(STRUCTURED_SECTIONS_PROMPT.format(text=text, profile="low_vision", max_words=max_words))
                sections_list = _parse_sections_response(raw)
            except Exception:
                sections_list = None

        if not sections_list:
            sections_list = _fallback_sections(text, max_words=max_words)

        # Deterministic enforcement pass
        sections_list = _enforce_section_constraints(sections_list, max_words=max_words)

        chunks = [s["content"] for s in sections_list]
        chunk_meta = _build_chunk_meta(chunks, text)

        return {
            "profile": profile,
            "sections": sections_list,
            "chunks": chunks if chunks else [text],
            "chunk_meta": chunk_meta,
            "text": text,
            "formatting": {
                "font_size_multiplier": 1.5,
                "line_height": 2.0,
                "letter_spacing": "0.03em",
                "contrast_mode": "high",
                "max_line_width": "42rem",
            },
        }

    if profile == "dyslexia":
        sections_list = None
        if GROQ_API_KEY or VOICE_GROQ_API_KEY:
            try:
                raw = call_llm(DYSLEXIA_PROMPT.format(text=text, max_words=max_words))
                sections_list = _parse_sections_response(raw)
            except Exception:
                sections_list = None

        if not sections_list:
            rewritten = _dyslexia_fallback(text)
            sections_list = _fallback_sections(rewritten, max_words=max_words)

        # Deterministic enforcement pass
        sections_list = _enforce_section_constraints(sections_list, max_words=max_words)

        chunks = [s["content"] for s in sections_list]
        chunk_meta = _build_chunk_meta(chunks, text)

        return {
            "profile": profile,
            "sections": sections_list,
            "chunks": chunks if chunks else [text],
            "chunk_meta": chunk_meta,
            "text": "\n\n".join(chunks),
            "formatting": {
                "font_family": "dyslexia-friendly",
                "line_height": 1.9,
                "letter_spacing": "0.04em",
                "paragraph_spacing": "1.2rem",
            },
        }

    if profile == "cognitive_load":
        sections_list = None
        if GROQ_API_KEY or VOICE_GROQ_API_KEY:
            try:
                raw = call_llm(STRUCTURED_SECTIONS_PROMPT.format(text=text, profile=profile, max_words=max_words))
                sections_list = _parse_sections_response(raw)
            except Exception:
                sections_list = None

        if not sections_list:
            sections_list = _fallback_sections(text, max_words=max_words)

        # Deterministic enforcement pass
        sections_list = _enforce_section_constraints(sections_list, max_words=max_words)

        chunks = [s["content"] for s in sections_list]
        chunk_meta = _build_chunk_meta(chunks, text)

        return {
            "profile": profile,
            "sections": sections_list,
            "chunks": chunks if chunks else [text],
            "chunk_meta": chunk_meta,
        }

    raise ValueError("profile must be dyslexia, low_vision, or cognitive_load")


def voice_ask(user_request: str, lesson_text: str = "", profile: str = "cognitive_load") -> str:
    """Answer a learner question using only the current lesson."""
    lesson = lesson_text.strip()
    if not lesson:
        raise ValueError("lesson_text is required for voice questions")
    try:
        return call_voice_llm(VOICE_HELP_PROMPT.format(
            lesson=lesson, 
            request=user_request.strip(),
            profile=profile
        )).strip()
    except Exception as error:
        return f"Based on your lesson, {lesson[:120]}..."

def answer_lesson_question(
    question: str,
    lesson_text: str,
    section_text: str,
    profile: str
) -> str:
    """Answer a user's question using the active section and full lesson as context."""

    if not question.strip():
        raise ValueError("Question is required")

    if not lesson_text.strip():
        raise ValueError("Lesson text is required")

    if not section_text.strip():
        raise ValueError("Section text is required")

    prompt = LESSON_QUESTION_PROMPT.format(
        profile=profile,
        lesson=lesson_text[:12000],
        section=section_text[:4000],
        question=question.strip(),
    )

    try:
        if (GROQ_API_KEY or VOICE_GROQ_API_KEY):
            response = call_voice_llm(prompt)
            if response and response.strip():
                return response.strip()
    except Exception:
        pass

    return f"Regarding your question '{question}': The section explains that {section_text[:180]}..."


def generate_quiz(chunk: str, profile: str) -> Dict[str, Any]:
    """Generate and validate one profile-aware quiz question."""
    required_keys = {"question", "options", "answer", "explanation"}
    quiz: Dict[str, Any] = {}
    if (GROQ_API_KEY or VOICE_GROQ_API_KEY):
        for _ in range(2):
            try:
                quiz = parse_json_response(call_llm(QUIZ_PROMPT.format(chunk=chunk, profile=profile)))
            except (TypeError, ValueError, json.JSONDecodeError):
                continue
            if not isinstance(quiz, dict) or not required_keys.issubset(quiz):
                continue
            options = quiz.get("options")
            if not isinstance(options, list):
                continue
            if len(options) > 4 and quiz.get("answer") in options:
                others = [option for option in options if option != quiz["answer"]]
                quiz["options"] = [quiz["answer"], *others[:3]]
            if len(quiz.get("options", [])) == 4 and quiz.get("answer") in quiz["options"]:
                return {key: quiz[key] for key in required_keys}

    first_sentence = chunk.split(".")[0].strip() if chunk else "this topic"
    return {
        "question": f"What is the key insight regarding {first_sentence[:45]}?",
        "options": [
            f"Understanding {first_sentence[:35]}",
            "Decreasing operational efficiency",
            "Disregarding core structural principles",
            "Eliminating all systematic methods",
        ],
        "answer": f"Understanding {first_sentence[:35]}",
        "explanation": "This option directly summarizes the primary concept presented in the lesson section.",
    }


def evaluate_quiz_answer(
    question: str,
    options: List[str],
    correct_answer: str,
    selected_answer: str,
    explanation: str,
    section_index: int,
) -> Dict[str, Any]:
    """Evaluate one answer and return data suitable for a mastery report."""
    if correct_answer not in options:
        raise ValueError("correct_answer must be one of the options")
    is_correct = selected_answer == correct_answer
    return {
        "question": question,
        "section_index": section_index,
        "selected_answer": selected_answer,
        "correct_answer": correct_answer,
        "is_correct": is_correct,
        "explanation": explanation,
        "status": "correct" if is_correct else "needs_review",
    }


def generate_lesson_test(text: str, profile: str, question_count: int = 5) -> List[Dict[str, Any]]:
    """Generate a whole-lesson test by asking for questions from the full text."""
    if not text.strip():
        raise ValueError("text is required")
    return [generate_quiz(text, profile) for _ in range(question_count)]


def chunks_for_quiz(transformed: Dict[str, Any]) -> List[str]:
    """Normalize a transformed result into quiz-ready chunks."""
    if transformed.get("chunks"):
        return transformed["chunks"]
    if transformed.get("sections"):
        return [s["content"] for s in transformed["sections"]]
    return [transformed.get("text", "")]


def run_pipeline(text: str, profiles: List[str], quiz_limit: int = 3, tag_difficulty: bool = True) -> Dict[str, Any]:
    """Run transformation and quiz generation for each requested profile.
    
    Optionally tags sections with difficulty tiers for SCALE-aware struggle detection.
    """
    from app.services.scale import tag_section_difficulty
    
    summary: Dict[str, Any] = {}
    
    # Tag difficulty once for all profiles (cached per document)
    difficulty_sections: List[Dict[str, Any]] = []
    if tag_difficulty:
        try:
            difficulty_sections = tag_section_difficulty(text)
        except Exception:
            # Silently fall back to no tagging on error
            difficulty_sections = []
    
    for profile in profiles:
        transformed = transform_text(text, profile)
        quiz_results = [generate_quiz(chunk, profile) for chunk in chunks_for_quiz(transformed)[:quiz_limit]]
        summary[profile] = {
            "transformed": transformed,
            "quiz_count": len(quiz_results),
            "quizzes": quiz_results,
        }
    
    # Add difficulty metadata to response if generated
    if difficulty_sections:
        summary["difficulty_sections"] = difficulty_sections
    
    return summary


# ── REWIRE — Content Adaptation ───────────────────────────────────────────────


def rewire_content(
    chunk_text: str,
    profile: str,
    variant_level: int = 2,
    actions: Optional[List[str]] = None,
    struggle_explanation: str = "",
) -> Dict[str, Any]:
    """Re-explain content at a simpler level after SCALE triggers REWIRE.

    This function IS allowed to call the LLM because REWIRE is infrequent
    (max 5 per session) and only fires when the learner is struggling.
    """
    actions = actions or ["increase_simplification"]

    # Generate simplified text with persona context
    adapted_text = call_llm(
        REWIRE_PROMPT.format(
            text=chunk_text, 
            level=variant_level,
            profile=profile,
            struggle_explanation=struggle_explanation or "spending more time than expected on this section"
        )
    ).strip()

    if not adapted_text:
        # Fallback: at minimum, split into shorter sentences
        sentences = chunk_text.replace(". ", ".\n").split("\n")
        adapted_text = "\n".join(s.strip() for s in sentences if s.strip())

    # Optionally generate visual description
    visual_description = None
    if "add_visual_description" in actions:
        try:
            visual_description = call_llm(
                REWIRE_VISUAL_PROMPT.format(text=chunk_text)
            ).strip()
        except Exception:
            visual_description = None

    explanation = struggle_explanation or (
        "Prism changed the explanation to help you understand this concept better."
    )

    return {
        "adapted_text": adapted_text,
        "visual_description": visual_description,
        "variant_level": variant_level,
        "explanation": explanation,
        "actions_applied": actions,
    }


# ── Adaptive Quiz ─────────────────────────────────────────────────────────────


def generate_adaptive_quiz(
    chunk_text: str,
    profile: str,
    difficulty: str = "easier",
    struggle_score: float = 0.0,
    previous_question: Optional[str] = None,
    previous_answer_correct: Optional[bool] = None,
) -> Dict[str, Any]:
    """Generate a quiz question adapted to the learner's struggle state.

    Difficulty adjusts the question complexity:
    - 'easier': simpler phrasing, more concrete, tests basic recall
    - 'same': standard difficulty
    - 'harder': requires synthesis or application
    """
    context_parts = []
    if previous_answer_correct is False:
        context_parts.append("previously answered incorrectly")
    if struggle_score >= 0.6:
        context_parts.append("is struggling with this concept")
    context = " and ".join(context_parts) if context_parts else "is learning this concept"

    difficulty_guidance = {
        "easier": "use simpler vocabulary, test basic recall of one key fact, and make the correct answer clearly distinguishable",
        "same": "use standard vocabulary and test comprehension",
        "harder": "require the learner to apply or synthesize information from the text",
    }.get(difficulty, "use standard vocabulary and test comprehension")

    required_keys = {"question", "options", "answer", "explanation"}
    quiz: Dict[str, Any] = {}

    for _ in range(2):
        try:
            prompt = ADAPTIVE_QUIZ_PROMPT.format(
                chunk=chunk_text,
                context=context,
                difficulty=difficulty,
                difficulty_guidance=difficulty_guidance,
            )
            quiz = parse_json_response(call_llm(prompt))
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        if not isinstance(quiz, dict) or not required_keys.issubset(quiz):
            continue
        options = quiz.get("options")
        if not isinstance(options, list):
            continue
        if len(options) > 4 and quiz.get("answer") in options:
            others = [o for o in options if o != quiz["answer"]]
            quiz["options"] = [quiz["answer"], *others[:3]]
        if len(quiz.get("options", [])) == 4 and quiz.get("answer") in quiz["options"]:
            result = {key: quiz[key] for key in required_keys}
            result["difficulty"] = difficulty
            result["adapted"] = difficulty != "same"
            return result

    # Fallback — return a basic question
    raise ValueError("Adaptive quiz generation failed after retries.")


# ── Practice Quiz (full-lesson, post-completion) ──────────────────────────────

PRACTICE_QUIZ_PROMPT = """You are creating a comprehensive practice quiz for a learner with {profile} accessibility needs who has just finished studying the lesson below.

Generate exactly {count} multiple-choice questions that test the most important and relevant concepts from the lesson.

RULES:
- Cover a variety of topics from across the lesson — do not focus on only one part
- Each question must be clearly worded and unambiguous
- For dyslexia profile: use simple, direct language (max 20 words per question)
- For cognitive_load profile: focus on one concept per question
- For low_vision profile: use straightforward, clear wording
- Base every question ONLY on information in the lesson below (no outside knowledge)
- Each question must have exactly 4 options labeled as plain strings (no A/B/C/D prefixes)
- The answer must exactly match one of the options (character for character)
- Provide a brief explanation (1-2 sentences) for why the answer is correct

Return ONLY valid JSON — an object with a single key "questions" whose value is an array of exactly {count} objects.
Each object must have exactly these keys: "question", "options" (array of 4 strings), "answer" (string), "explanation" (string).

Include the marker QUIZ_JSON.

LESSON TEXT:
{text}"""


def generate_practice_quiz(
    text: str,
    profile: str,
    question_count: int = 8,
) -> List[Dict[str, Any]]:
    """
    Generate a full-lesson practice quiz from the extracted lesson text.

    Sends the complete lesson to Groq and asks for question_count important,
    relevant MCQ questions covering the whole content. Returns a list of
    {question, options, answer, explanation} dicts.
    """
    if profile not in VALID_PROFILES:
        profile = "cognitive_load"
    question_count = max(3, min(question_count, 15))

    prompt = PRACTICE_QUIZ_PROMPT.format(
        profile=profile,
        count=question_count,
        text=text[:12000],  # guard against excessively long lessons
    )

    required_keys = {"question", "options", "answer", "explanation"}

    for _attempt in range(3):
        try:
            raw = call_llm(prompt)
            parsed = parse_json_response(raw)
        except (TypeError, ValueError, json.JSONDecodeError):
            continue

        questions_raw = None
        if isinstance(parsed, dict):
            questions_raw = parsed.get("questions")
        elif isinstance(parsed, list):
            questions_raw = parsed

        if not isinstance(questions_raw, list):
            continue

        valid: List[Dict[str, Any]] = []
        for item in questions_raw:
            if not isinstance(item, dict):
                continue
            if not required_keys.issubset(item):
                continue
            options = item.get("options")
            if not isinstance(options, list) or len(options) != 4:
                continue
            if item.get("answer") not in options:
                continue
            valid.append({key: item[key] for key in required_keys})

        if valid:
            return valid[:question_count]

    # Fallback — single generic question so the UI never crashes
    return [
        {
            "question": "What is the main topic covered in this lesson?",
            "options": [
                "The content described in the lesson",
                "A topic unrelated to the lesson",
                "Only historical background",
                "Mathematical formulas",
            ],
            "answer": "The content described in the lesson",
            "explanation": "The lesson focuses on the content provided.",
        }
    ]

