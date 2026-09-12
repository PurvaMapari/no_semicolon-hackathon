import json
import re
from typing import Any, Dict, List, Optional

from app.config import GROQ_API_KEY, VOICE_GROQ_API_KEY
from app.services.llm import call_llm, call_voice_llm, parse_json_response


DYSLEXIA_PROMPT = """Rewrite the text below for a reader with dyslexia. Use short, simple sentences and clear wording. Preserve every fact, relationship, number, and cause-and-effect detail. Do not add facts. Return only the rewritten text.

TEXT:
{text}"""

COGNITIVE_LOAD_PROMPT = """Split the text below into an ordered JSON object with one key, chunks.
Aim for 8 to 20 total chunks regardless of document length — each chunk should represent one complete idea or concept (roughly one paragraph or 3–6 sentences). Do NOT create a separate chunk per sentence. Preserve all original content and facts verbatim, do not summarize, and do not add facts. Return only valid JSON.

TEXT:
{text}"""

PREFERENCE_PARSE_PROMPT = """A user described their accessibility needs below. Map it to exactly one profile: dyslexia, cognitive_load, or low_vision. Return valid JSON only with profile and reason. Include the marker PREFERENCE_JSON.

USER DESCRIPTION:
{text}"""

VOICE_HELP_PROMPT = """You are an educational assistant. Answer the learner's request using only the supplied lesson content. Do not invent facts. Explain clearly and simply. Keep the response concise. If the answer cannot be determined from the lesson, say: The lesson does not provide enough information to answer that.

LESSON CONTENT:
{lesson}

LEARNER REQUEST:
{request}"""

LESSON_QUESTION_PROMPT = """You are the question-answering assistant inside an adaptive learning platform.
Answer the learner's question using only the supplied lesson and active section.
Treat the active section as the primary context and use the full lesson only to clarify it.
Do not invent facts or use outside knowledge.
Answer clearly in 2 to 5 sentences and match the learner profile: {profile}.
If the answer is not supported by the lesson, say: The lesson does not provide enough information to answer that.

FULL EXTRACTED LESSON:
{lesson}

ACTIVE LESSON SECTION:
{section}

LEARNER QUESTION:
{question}"""

QUIZ_PROMPT = """Create one practice question based only on the chunk below. Adjust phrasing complexity to the learner profile: {profile}. Return valid JSON only with exactly these keys: question, options, answer, explanation. The options value must contain exactly four strings. The answer must exactly match one option. Do not use information outside the chunk. Include the marker QUIZ_JSON.

CHUNK:
{chunk}"""

# ── REWIRE Prompts ────────────────────────────────────────────────────────────

REWIRE_PROMPT = """You are an adaptive learning assistant. The learner is struggling with the text below. Rewrite it at simplification level {level} (1=original, 2=simpler vocabulary and shorter sentences, 3=very simple with concrete examples).

Rules:
- Preserve ALL facts, numbers, names, and cause-effect relationships.
- Do NOT add new facts or information.
- Use shorter sentences and simpler vocabulary at higher levels.
- At level 3, add a brief concrete analogy or example if helpful.
- Return only the rewritten text, nothing else.

ORIGINAL TEXT:
{text}"""

REWIRE_VISUAL_PROMPT = """Describe a simple visual that would help a struggling learner understand this concept. Write 2-3 sentences describing what to picture. Be concrete and specific. Do not use technical language.

TEXT:
{text}"""

ADAPTIVE_QUIZ_PROMPT = """Create one practice question based only on the chunk below. This question is for a learner who {context}. Make the question {difficulty} than a standard question — {difficulty_guidance}.

Return valid JSON only with exactly these keys: question, options, answer, explanation. The options value must contain exactly four strings. The answer must exactly match one option. Do not use information outside the chunk. Include the marker QUIZ_JSON.

CHUNK:
{chunk}"""

VALID_PROFILES = {"dyslexia", "low_vision", "cognitive_load"}


def _dyslexia_fallback(text: str) -> str:
    """Keep facts intact while making fallback text easier to scan."""
    sentences = [sentence.strip() for sentence in text.replace("\n", " ").split(".") if sentence.strip()]
    return "\n\n".join(f"{sentence}." for sentence in sentences)


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


def transform_text(text: str, profile: str) -> Dict[str, Any]:
    """Transform text according to an accessibility profile."""
    if profile == "low_vision":
        return {
            "profile": profile,
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
        rewritten = _dyslexia_fallback(text) if not (GROQ_API_KEY or VOICE_GROQ_API_KEY) else call_llm(DYSLEXIA_PROMPT.format(text=text)).strip()
        if not rewritten:
            rewritten = _dyslexia_fallback(text)
        return {
            "profile": profile,
            "text": rewritten,
            "formatting": {
                "font_family": "dyslexia-friendly",
                "line_height": 1.9,
                "letter_spacing": "0.04em",
                "paragraph_spacing": "1.2rem",
            },
        }
    if profile == "cognitive_load":
        parsed = parse_json_response(call_llm(COGNITIVE_LOAD_PROMPT.format(text=text))) if (GROQ_API_KEY or VOICE_GROQ_API_KEY) else None
        chunks = parsed.get("chunks") if isinstance(parsed, dict) else (parsed if isinstance(parsed, list) else None)
        if not isinstance(chunks, list) or not all(isinstance(chunk, str) and chunk.strip() for chunk in chunks):
            # Fallback: group paragraphs into ~100-200 word chunks (max 20 chunks)
            paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
            if len(paragraphs) <= 1:
                sentences = [s.strip() + "." for s in text.split(".") if s.strip()]
                paragraphs = [" ".join(sentences[i:i+4]) for i in range(0, len(sentences), 4)]
            # Merge small paragraphs until each chunk is ~120+ words or max 20 chunks
            merged, buf, buf_words = [], [], 0
            for para in paragraphs:
                words = len(para.split())
                buf.append(para)
                buf_words += words
                if buf_words >= 120 or len(merged) + 1 + (len(buf) > 0) >= 20:
                    merged.append("\n\n".join(buf))
                    buf, buf_words = [], 0
            if buf:
                if merged:
                    merged[-1] += "\n\n" + "\n\n".join(buf)
                else:
                    merged.append("\n\n".join(buf))
            chunks = merged if merged else [text]

        # Hard cap: if LLM still returned too many tiny chunks, merge them down to 20
        if len(chunks) > 20:
            target = 20
            group_size = max(1, len(chunks) // target)
            merged = []
            for i in range(0, len(chunks), group_size):
                merged.append("\n\n".join(chunks[i:i+group_size]))
            chunks = merged[:target]
        return {"profile": profile, "chunks": chunks if chunks else [text]}
    raise ValueError("profile must be dyslexia, low_vision, or cognitive_load")


def voice_ask(user_request: str, lesson_text: str = "") -> str:
    """Answer a learner question using only the current lesson."""
    lesson = lesson_text.strip()
    if not lesson:
        raise ValueError("lesson_text is required for voice questions")
    try:
        return call_voice_llm(VOICE_HELP_PROMPT.format(lesson=lesson, request=user_request.strip())).strip()
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
    return transformed["chunks"] if transformed["profile"] == "cognitive_load" else [transformed["text"]]


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

    # Generate simplified text
    adapted_text = call_llm(
        REWIRE_PROMPT.format(text=chunk_text, level=variant_level)
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
