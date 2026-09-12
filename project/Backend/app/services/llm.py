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


# Chat-capable models in preference order (guard/whisper/TTS models are excluded).
# Update this list if your Groq account gains access to newer models.
_PREFERRED_MODELS = (
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "llama3-70b-8192",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.6-27b",
    "groq/compound",
)

# Model IDs that are NOT suitable for chat completions (guard / speech / embedding)
_NON_CHAT_KEYWORDS = ("prompt-guard", "whisper", "orpheus", "allam", "safeguard")


def _select_model(client: Any, configured: Optional[str]) -> Optional[str]:
    if configured:
        return configured
    available = {model.id for model in client.models.list().data}
    # Try preferred list first
    for model in _PREFERRED_MODELS:
        if model in available:
            return model
    # Fallback: any chat-capable model (exclude known non-chat models)
    for model in available:
        if not any(kw in model for kw in _NON_CHAT_KEYWORDS):
            return model
    return None


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
        needs_json = "QUIZ_JSON" in prompt or "CHUNK_JSON" in prompt or "VISUAL_JSON" in prompt or "SECTION_JSON" in prompt
        is_openai_model = _MAIN_MODEL.startswith("openai/")
        options: Dict[str, Any] = {
            "model": _MAIN_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "max_completion_tokens": 4096,
        }
        # response_format and reasoning_effort are mutually exclusive on openai/ models
        if needs_json and not is_openai_model:
            options["response_format"] = {"type": "json_object"}
        if is_openai_model:
            options["reasoning_effort"] = "low"
        return _MAIN_CLIENT.chat.completions.create(**options).choices[0].message.content or ""

    if "QUIZ_JSON" in prompt:
        return json.dumps(QUIZ_FALLBACK)
    if "CHUNK_JSON" in prompt:
        sentences = re.split(r"(?<=[.!?])\s+", prompt.split("TEXT:", 1)[-1].strip())
        return json.dumps({"chunks": [" ".join(sentences[index:index + 3]) for index in range(0, len(sentences), 3)]})
    if "PREFERENCE_JSON" in prompt:
        return json.dumps({"profile": "cognitive_load", "reason": "The description suggests that dense text is difficult to process."})
    if "SECTION_JSON" in prompt:
        return json.dumps({"sections": [
            {"heading": "Introduction", "content": "Photosynthesis is the process plants use to make food from sunlight."},
            {"heading": "How It Works", "content": "Chlorophyll in leaves captures light energy and combines water with carbon dioxide to produce glucose."},
            {"heading": "Why It Matters", "content": "Photosynthesis produces oxygen as a byproduct, which is essential for life on Earth."},
        ]})
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
    is_openai_model = _VISUAL_MODEL.startswith("openai/")
    options: Dict[str, Any] = {
        "model": _VISUAL_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_completion_tokens": 2048,
    }
    # response_format and reasoning_effort are mutually exclusive on openai/ models
    if not is_openai_model:
        options["response_format"] = {"type": "json_object"}
    else:
        options["reasoning_effort"] = "low"
    return _VISUAL_CLIENT.chat.completions.create(**options).choices[0].message.content or ""


def parse_json_response(response: str) -> Any:
    """Parse plain JSON, JSON wrapped in Markdown fences, or JSON preceded by markers."""
    cleaned = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", response.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"^\s*(?:SECTION_JSON|QUIZ_JSON|PREFERENCE_JSON|SCALE_JSON)\s*", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Extract the outermost JSON object {...} or array [...]
        match = re.search(r"(\{.*\}|\[.*\])", cleaned, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        raise

