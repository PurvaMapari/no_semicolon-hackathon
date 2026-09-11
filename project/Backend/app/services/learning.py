import json
import re
from typing import Any, Dict, List

from app.config import GROQ_API_KEY
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

VALID_PROFILES = {"dyslexia", "low_vision", "cognitive_load"}


def _dyslexia_fallback(text: str) -> str:
    """Keep facts intact while making fallback text easier to scan."""
    sentences = [sentence.strip() for sentence in text.replace("\n", " ").split(".") if sentence.strip()]
    return "\n\n".join(f"{sentence}." for sentence in sentences)


def parse_user_preference(user_text: str) -> Dict[str, Any]:
    """Convert free-text accessibility needs into a structured profile."""
    result = parse_json_response(call_llm(PREFERENCE_PARSE_PROMPT.format(text=user_text)))
    if not isinstance(result, dict) or result.get("profile") not in VALID_PROFILES:
        raise ValueError(f"Unrecognized profile returned: {result.get('profile') if isinstance(result, dict) else result}")
    return result


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
        rewritten = _dyslexia_fallback(text) if not GROQ_API_KEY else call_llm(DYSLEXIA_PROMPT.format(text=text)).strip()
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


def answer_lesson_question(question: str, lesson_text: str, section_text: str, profile: str) -> str:
    """Answer a question using the active section plus the full extracted lesson."""
    if not question.strip() or not lesson_text.strip() or not section_text.strip():
        raise ValueError("question, lesson_text, and section_text are required")
    if not GROQ_API_KEY:
        stop_words = {"what", "why", "how", "when", "where", "which", "who", "is", "are", "the", "a", "an", "does", "do", "this", "that", "about"}
        question_words = {word for word in re.findall(r"[a-zA-Z]+", question.lower()) if word not in stop_words}
        sentences = [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+", section_text) if sentence.strip()]
        matching = next((sentence for sentence in sentences if question_words & set(re.findall(r"[a-zA-Z]+", sentence.lower()))), None)
        if matching:
            return f"Based on this section: {matching}"
        return "The lesson does not provide enough information to answer that."
    prompt = LESSON_QUESTION_PROMPT.format(
        profile=profile,
        lesson=lesson_text[:12000],
        section=section_text[:4000],
        question=question.strip(),
    )
    try:
        return call_voice_llm(prompt).strip()
    except Exception as error:
        return f"[Lesson assistant error: {error}]"


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
