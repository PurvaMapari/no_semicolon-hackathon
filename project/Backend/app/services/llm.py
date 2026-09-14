import json
import re
from typing import Any, Dict, List, Optional

try:
    from groq import Groq
except ImportError:
    Groq = None

import threading

from app.config import (
    GROQ_API_KEYS,
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
    "qwen/qwen3.8-27b",
    "qwen/qwen3.6-27b",
    "groq/compound",
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
)

# Model IDs that are NOT suitable for chat completions (guard / speech / embedding)
_NON_CHAT_KEYWORDS = ("prompt-guard", "whisper", "orpheus", "allam", "safeguard")


def _safe_max_tokens(model: str, requested: int) -> int:
    """Cap output tokens to respect free-tier per-model output limits (e.g. Qwen 1000 OTPM)."""
    if "qwen" in model.lower():
        return min(requested, 800)
    return min(requested, 2048)


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
        print(f"Warning: Failed to initialize Groq client ({e}).")
        return None, []


class GroqClientEntry:
    def __init__(self, key: str, client: Any, models: List[str], key_index: int):
        self.key = key
        self.client = client
        self.models = models
        self.key_index = key_index
        self.masked_key = f"{key[:7]}...{key[-4:]}" if len(key) > 12 else f"key_{key_index}"


# Initialize multi-key client pool
_CLIENT_POOL: List[GroqClientEntry] = []
for idx, key in enumerate(GROQ_API_KEYS):
    client, models = _client_and_models(key, GROQ_MODEL)
    if client:
        _CLIENT_POOL.append(GroqClientEntry(key, client, models, idx))

if _CLIENT_POOL:
    print(f"[Groq Multi-Key] Initialized pool with {len(_CLIENT_POOL)} active keys.")
else:
    print("Warning: No active Groq keys found in pool. Falling back to offline/mock mode.")

# Backward compatibility references
_MAIN_CLIENT = _CLIENT_POOL[0].client if _CLIENT_POOL else None
_MAIN_MODELS = _CLIENT_POOL[0].models if _CLIENT_POOL else []
_MAIN_MODEL = _MAIN_MODELS[0] if _MAIN_MODELS else None

# Dedicated voice/visual clients (if configured separately)
_VOICE_CLIENT, _VOICE_MODELS = _client_and_models(VOICE_GROQ_API_KEY, GROQ_MODEL)
_VOICE_MODEL = _VOICE_MODELS[0] if _VOICE_MODELS else None

_VISUAL_CLIENT, _VISUAL_MODELS = _client_and_models(VISUAL_GROQ_API_KEY, GROQ_MODEL)
_VISUAL_MODEL = _VISUAL_MODELS[0] if _VISUAL_MODELS else None

_pool_lock = threading.Lock()
_round_robin_counter = 0


def _get_ordered_pool() -> List[GroqClientEntry]:
    """Rotate pool per request to load-balance across keys, followed by backups for failover."""
    global _round_robin_counter
    if not _CLIENT_POOL:
        return []
    with _pool_lock:
        start_idx = _round_robin_counter % len(_CLIENT_POOL)
        _round_robin_counter += 1
    return _CLIENT_POOL[start_idx:] + _CLIENT_POOL[:start_idx]


def call_llm(prompt: str) -> str:
    """Generate text with Groq with multi-key failover or return offline fallback."""
    ordered_pool = _get_ordered_pool()
    if ordered_pool:
        needs_json = "QUIZ_JSON" in prompt or "CHUNK_JSON" in prompt or "VISUAL_JSON" in prompt or "SECTION_JSON" in prompt
        for entry in ordered_pool:
            client = entry.client
            models = entry.models or list(_PREFERRED_MODELS)
            key_exhausted = False
            for model in models:
                is_openai_model = model.startswith("openai/")
                options: Dict[str, Any] = {
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                    "max_completion_tokens": _safe_max_tokens(model, 2048),
                }
                if needs_json and not is_openai_model:
                    options["response_format"] = {"type": "json_object"}
                if is_openai_model:
                    options["reasoning_effort"] = "low"
                try:
                    res = client.chat.completions.create(**options)
                    return res.choices[0].message.content or ""
                except Exception as err:
                    err_str = str(err).lower()
                    is_account_limit = any(k in err_str for k in ("daily quota", "quota exceeded", "tpd", "too many requests")) and "reduce max_tokens" not in err_str
                    if is_account_limit:
                        print(f"[Groq Multi-Key] Account rate limit hit on key #{entry.key_index} ({entry.masked_key}). Failing over to next backup key...")
                        key_exhausted = True
                        break
                    print(f"[Groq Multi-Key] Model {model} failed on key #{entry.key_index} ({entry.masked_key}): {err}. Trying next candidate...")
                    if len(models) > 1 and model != models[-1]:
                        continue
                    break
            if key_exhausted:
                continue

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
    """Use dedicated voice client if available, with automatic failover across models and to the multi-key pool."""
    if _VOICE_CLIENT and _VOICE_MODELS:
        models = _VOICE_MODELS or list(_PREFERRED_MODELS)
        for model in models:
            options: Dict[str, Any] = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "max_completion_tokens": _safe_max_tokens(model, 1024),
            }
            if model.startswith("openai/"):
                options["reasoning_effort"] = "low"
            try:
                return _VOICE_CLIENT.chat.completions.create(**options).choices[0].message.content or ""
            except Exception as err:
                print(f"[Groq Voice] Dedicated voice key with model {model} failed ({err}). Trying next model...")
                continue
    return call_llm(prompt)


def call_visual_llm(prompt: str) -> str:
    """Use dedicated visual client if available, with automatic failover across models and to the multi-key pool."""
    if _VISUAL_CLIENT and _VISUAL_MODELS:
        models = _VISUAL_MODELS or list(_PREFERRED_MODELS)
        for model in models:
            is_openai_model = model.startswith("openai/")
            options: Dict[str, Any] = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_completion_tokens": _safe_max_tokens(model, 2048),
            }
            if not is_openai_model:
                options["response_format"] = {"type": "json_object"}
            else:
                options["reasoning_effort"] = "low"
            try:
                return _VISUAL_CLIENT.chat.completions.create(**options).choices[0].message.content or ""
            except Exception as err:
                print(f"[Groq Visual] Dedicated visual key with model {model} failed ({err}). Trying next candidate...")
                continue
    return call_llm(prompt)


def call_llm_chat(
    messages: List[Dict[str, str]],
    system_prompt: Optional[str] = None,
    json_mode: bool = True,
) -> str:
    """Multi-turn chat completion with Groq multi-key pool or structured fallback."""
    ordered_pool = _get_ordered_pool()
    if ordered_pool:
        formatted_messages = []
        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})
        formatted_messages.extend(messages)
        if json_mode and not any("json" in m.get("content", "").lower() for m in formatted_messages):
            formatted_messages.append({"role": "system", "content": "Return output in valid JSON format."})

        for entry in ordered_pool:
            client = entry.client
            models = entry.models or list(_PREFERRED_MODELS)
            key_exhausted = False
            for model in models:
                is_openai_model = model.startswith("openai/")
                options: Dict[str, Any] = {
                    "model": model,
                    "messages": formatted_messages,
                    "temperature": 0.3,
                    "max_completion_tokens": _safe_max_tokens(model, 2048),
                }
                if json_mode and not is_openai_model:
                    options["response_format"] = {"type": "json_object"}
                if is_openai_model:
                    options["reasoning_effort"] = "low"
                try:
                    res = client.chat.completions.create(**options)
                    return res.choices[0].message.content or ""
                except Exception as err:
                    err_str = str(err).lower()
                    is_account_limit = any(k in err_str for k in ("daily quota", "quota exceeded", "tpd", "too many requests")) and "reduce max_tokens" not in err_str
                    if is_account_limit:
                        print(f"[Groq Multi-Key Chat] Rate limit on key #{entry.key_index} ({entry.masked_key}). Switching to next backup key...")
                        key_exhausted = True
                        break
                    print(f"[Groq Multi-Key Chat] Model {model} failed on key #{entry.key_index} ({entry.masked_key}): {err}. Trying next candidate...")
                    if len(models) > 1 and model != models[-1]:
                        continue
                    break
            if key_exhausted:
                continue

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

