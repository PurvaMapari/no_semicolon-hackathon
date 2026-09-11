import json
from typing import Any, Dict, List, Optional

from app.services.llm import call_llm, call_voice_llm, parse_json_response


DYSLEXIA_PROMPT = """Rewrite the text below for a reader with dyslexia. Use short, simple sentences and clear wording. Preserve every fact, relationship, number, and cause-and-effect detail. Do not add facts. Return only the rewritten text.

TEXT:
{text}"""

COGNITIVE_LOAD_PROMPT = """Split the text below into an ordered JSON object with one key, chunks. Each chunk must contain 2 to 4 complete sentences. Preserve all original content and facts, do not summarize, and do not add facts. Return only valid JSON. Include the marker CHUNK_JSON nowhere except in this instruction context.

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


def parse_user_preference(user_text: str) -> Dict[str, Any]:
    """Convert free-text accessibility needs into a structured profile."""
    result = parse_json_response(call_llm(PREFERENCE_PARSE_PROMPT.format(text=user_text)))
    if not isinstance(result, dict) or result.get("profile") not in VALID_PROFILES:
        raise ValueError(f"Unrecognized profile returned: {result.get('profile') if isinstance(result, dict) else result}")
    return result


def transform_text(text: str, profile: str) -> Dict[str, Any]:
    """Transform text according to an accessibility profile."""
    if profile == "low_vision":
        return {"profile": profile, "text": text, "formatting": {"font_size_multiplier": 1.5, "contrast_mode": "high"}}
    if profile == "dyslexia":
        rewritten = call_llm(DYSLEXIA_PROMPT.format(text=text)).strip()
        if not rewritten:
            raise ValueError("The language model returned an empty dyslexia transformation.")
        return {"profile": profile, "text": rewritten}
    if profile == "cognitive_load":
        parsed = parse_json_response(call_llm(COGNITIVE_LOAD_PROMPT.format(text=text)))
        chunks = parsed.get("chunks") if isinstance(parsed, dict) else parsed
        if not isinstance(chunks, list) or not all(isinstance(chunk, str) and chunk.strip() for chunk in chunks):
            raise ValueError("Cognitive-load response must contain a JSON chunks array of strings.")
        return {"profile": profile, "chunks": chunks}
    raise ValueError("profile must be dyslexia, low_vision, or cognitive_load")


def voice_ask(user_request: str, lesson_text: str = "") -> str:
    """Answer a learner question using only the current lesson."""
    lesson = lesson_text.strip()
    if not lesson:
        raise ValueError("lesson_text is required for voice questions")
    try:
        return call_voice_llm(VOICE_HELP_PROMPT.format(lesson=lesson, request=user_request.strip())).strip()
    except Exception as error:
        return f"[Voice assistant error: {error}]"


def generate_quiz(chunk: str, profile: str) -> Dict[str, Any]:
    """Generate and validate one profile-aware quiz question."""
    required_keys = {"question", "options", "answer", "explanation"}
    quiz: Dict[str, Any] = {}
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

    raise ValueError("Quiz response must contain a question, four options, answer, and explanation.")


def chunks_for_quiz(transformed: Dict[str, Any]) -> List[str]:
    """Normalize a transformed result into quiz-ready chunks."""
    return transformed["chunks"] if transformed["profile"] == "cognitive_load" else [transformed["text"]]


def run_pipeline(text: str, profiles: List[str], quiz_limit: int = 3) -> Dict[str, Any]:
    """Run transformation and quiz generation for each requested profile."""
    summary: Dict[str, Any] = {}
    for profile in profiles:
        transformed = transform_text(text, profile)
        quiz_results = [generate_quiz(chunk, profile) for chunk in chunks_for_quiz(transformed)[:quiz_limit]]
        summary[profile] = {
            "transformed": transformed,
            "quiz_count": len(quiz_results),
            "quizzes": quiz_results,
        }
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
