import json
import re
from typing import Any, Dict, Optional

try:
    from groq import Groq
except ImportError:
    Groq = None

from app.config import (
    GROQ_API_KEY,
    GROQ_MODEL,
    VOICE_GROQ_API_KEY,
    VISUAL_GROQ_API_KEY,
)


QUIZ_FALLBACK = {
    "question": "What do plants use photosynthesis to produce?",
    "options": ["Glucose", "Sound", "Salt", "Metal"],
    "answer": "Glucose",
    "explanation": "Photosynthesis produces glucose, which stores chemical energy.",
}


def _select_model(client: Any, configured: Optional[str]) -> Optional[str]:
    if configured:
        return configured
    available = {model.id for model in client.models.list().data}
    preferred = (
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "openai/gpt-oss-20b",
        "openai/gpt-oss-120b",
    )
    return next((model for model in preferred if model in available),
                next((model for model in available if "llama" in model or "gpt" in model), None))


def _client_and_model(api_key: Optional[str], configured_model: Optional[str]):
    if not api_key or Groq is None:
        return None, None
    client = Groq(api_key=api_key)
    return client, _select_model(client, configured_model)


_MAIN_CLIENT, _MAIN_MODEL = _client_and_model(GROQ_API_KEY, GROQ_MODEL)
_VOICE_CLIENT, _VOICE_MODEL = _client_and_model(VOICE_GROQ_API_KEY, GROQ_MODEL)
_VISUAL_CLIENT, _VISUAL_MODEL = _client_and_model(VISUAL_GROQ_API_KEY, GROQ_MODEL)


def call_llm(prompt: str) -> str:
    """Generate text with Groq or return the notebook's local development fallback."""
    if _MAIN_CLIENT and _MAIN_MODEL:
        options: Dict[str, Any] = {
            "model": _MAIN_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "max_completion_tokens": 4096,
        }
        if "QUIZ_JSON" in prompt or "CHUNK_JSON" in prompt or "VISUAL_JSON" in prompt:
            options["response_format"] = {"type": "json_object"}
        if _MAIN_MODEL.startswith("openai/"):
            options["reasoning_effort"] = "low"
        return _MAIN_CLIENT.chat.completions.create(**options).choices[0].message.content or ""

    if "QUIZ_JSON" in prompt:
        return json.dumps(QUIZ_FALLBACK)
    if "CHUNK_JSON" in prompt:
        sentences = re.split(r"(?<=[.!?])\s+", prompt.split("TEXT:", 1)[-1].strip())
        return json.dumps({"chunks": [" ".join(sentences[index:index + 3]) for index in range(0, len(sentences), 3)]})
    if "PREFERENCE_JSON" in prompt:
        return json.dumps({"profile": "cognitive_load", "reason": "The description suggests that dense text is difficult to process."})
    if "VISUAL_JSON" in prompt:
        return json.dumps({"should_visualize": False, "visual_type": "none", "title": "", "description": "", "why_helpful": "", "nodes": [], "edges": [], "labels": [], "data": []})
    return (
        "Photosynthesis lets plants make food from sunlight. Chlorophyll captures light energy. "
        "Plants use water and carbon dioxide to produce glucose and release oxygen."
    )


def call_voice_llm(prompt: str) -> str:
    """Use the dedicated voice client when configured, otherwise use the main client."""
    if not (_VOICE_CLIENT and _VOICE_MODEL):
        return call_llm(prompt)
    options: Dict[str, Any] = {
        "model": _VOICE_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_completion_tokens": 1024,
    }
    if _VOICE_MODEL.startswith("openai/"):
        options["reasoning_effort"] = "low"
    return _VOICE_CLIENT.chat.completions.create(**options).choices[0].message.content or ""


def call_visual_llm(prompt: str) -> str:
    """Use the dedicated visual client when configured, otherwise use the main client."""
    if not (_VISUAL_CLIENT and _VISUAL_MODEL):
        return call_llm(prompt)
    options: Dict[str, Any] = {
        "model": _VISUAL_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_completion_tokens": 2048,
        "response_format": {"type": "json_object"},
    }
    if _VISUAL_MODEL.startswith("openai/"):
        options["reasoning_effort"] = "low"
    return _VISUAL_CLIENT.chat.completions.create(**options).choices[0].message.content or ""


def parse_json_response(response: str) -> Any:
    """Parse plain JSON or JSON wrapped in Markdown fences."""
    cleaned = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", response.strip(), flags=re.IGNORECASE)
    return json.loads(cleaned)
