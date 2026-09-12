import json
import re
from typing import Any, Dict, List, Optional

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
    "qwen/qwen3.8-27b",
    "qwen/qwen3.6-27b",
    "openai/gpt-oss-20b",
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "llama3-70b-8192",
    "openai/gpt-oss-120b",
    "groq/compound",
)

# Model IDs that are NOT suitable for chat completions (guard / speech / embedding)
_NON_CHAT_KEYWORDS = ("prompt-guard", "whisper", "orpheus", "allam", "safeguard")


def _get_candidate_models(client: Any, configured: Optional[str]) -> List[str]:
    candidates = []
    if configured:
        candidates.append(configured)
    try:
        available = {model.id for model in client.models.list().data}
    except Exception as e:
        print(f"Warning: Could not fetch models from Groq ({e}). Using preferred list.")
        available = set(_PREFERRED_MODELS)

    # Try preferred list first
    for model in _PREFERRED_MODELS:
        if model in available and model not in candidates:
            candidates.append(model)
    for model in available:
        if model not in candidates and not any(kw in model for kw in _NON_CHAT_KEYWORDS):
            candidates.append(model)
    return candidates or list(_PREFERRED_MODELS)


def _client_and_models(api_key: Optional[str], configured_model: Optional[str]):
    if not api_key or Groq is None:
        return None, []
    try:
        client = Groq(api_key=api_key)
        return client, _get_candidate_models(client, configured_model)
    except Exception as e:
        print(f"Warning: Failed to initialize Groq client ({e}). Falling back to offline/mock mode.")
        return None, []


_MAIN_CLIENT, _MAIN_MODELS = _client_and_models(GROQ_API_KEY, GROQ_MODEL)
_MAIN_MODEL = _MAIN_MODELS[0] if _MAIN_MODELS else None

_VOICE_CLIENT, _VOICE_MODELS = _client_and_models(VOICE_GROQ_API_KEY, GROQ_MODEL)
_VOICE_MODEL = _VOICE_MODELS[0] if _VOICE_MODELS else None

_VISUAL_CLIENT, _VISUAL_MODELS = _client_and_models(VISUAL_GROQ_API_KEY, GROQ_MODEL)
_VISUAL_MODEL = _VISUAL_MODELS[0] if _VISUAL_MODELS else None


def call_llm(prompt: str) -> str:
    """Generate text with Groq or return the notebook's local development fallback."""
    if _MAIN_CLIENT and _MAIN_MODELS:
        needs_json = "QUIZ_JSON" in prompt or "CHUNK_JSON" in prompt or "VISUAL_JSON" in prompt or "SECTION_JSON" in prompt
        for model in _MAIN_MODELS:
            is_openai_model = model.startswith("openai/")
            options: Dict[str, Any] = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "max_completion_tokens": 4096,
            }
            if needs_json and not is_openai_model:
                options["response_format"] = {"type": "json_object"}
            if is_openai_model:
                options["reasoning_effort"] = "low"
            try:
                res = _MAIN_CLIENT.chat.completions.create(**options)
                return res.choices[0].message.content or ""
            except Exception as err:
                # If rate limited or model error, fail over to the next candidate model
                if len(_MAIN_MODELS) > 1 and model != _MAIN_MODELS[-1]:
                    continue
                break

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
 
 
def call_llm_chat(
    messages: List[Dict[str, str]],
    system_prompt: Optional[str] = None,
    json_mode: bool = True,
) -> str:
    """Multi-turn chat completion with Groq or structured fallback."""
    if _MAIN_CLIENT and _MAIN_MODELS:
        formatted_messages = []
        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})
        formatted_messages.extend(messages)
        if json_mode and not any("json" in m.get("content", "").lower() for m in formatted_messages):
            formatted_messages.append({"role": "system", "content": "Return output in valid JSON format."})

        for model in _MAIN_MODELS:
            is_openai_model = model.startswith("openai/")
            options: Dict[str, Any] = {
                "model": model,
                "messages": formatted_messages,
                "temperature": 0.3,
                "max_completion_tokens": 4096,
            }
            if json_mode and not is_openai_model:
                options["response_format"] = {"type": "json_object"}
            if is_openai_model:
                options["reasoning_effort"] = "low"
            try:
                res = _MAIN_CLIENT.chat.completions.create(**options)
                return res.choices[0].message.content or ""
            except Exception as err:
                if len(_MAIN_MODELS) > 1 and model != _MAIN_MODELS[-1]:
                    continue
                break

    last_user_msg = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "the topic")
    return json.dumps({
        "reply": f"I would love to teach you about {last_user_msg}! What is your current level of experience?",
        "suggested_replies": ["Complete beginner", "I know the basics", "Generate full lesson now"],
        "topic_title": f"Intro to {last_user_msg.capitalize()}",
        "ready_lesson_text": None,
        "is_complete": False,
        "sections_preview": [],
    })


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

