import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPOSITORY_DIR = BACKEND_DIR.parents[1]

# Support both project/Backend/.env and the repository-level .env.
load_dotenv(REPOSITORY_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env", override=True)

def _collect_groq_keys():
    raw_candidates = []
    for var in ("GROQ_KEYS", "GROQ_API_KEYS"):
        val = os.getenv(var)
        if val:
            parts = [p.strip().strip('"').strip("'") for p in val.split(",") if p.strip()]
            raw_candidates.extend(parts)

    for var in ("GROQ_API_KEY", "GROQ_KEY", "GROQ_API_KEY_1", "GROQ_API_KEY_2", "GROQ_API_KEY_3"):
        val = os.getenv(var)
        if val:
            cleaned = val.strip().strip('"').strip("'")
            if cleaned:
                raw_candidates.append(cleaned)

    seen = set()
    unique_keys = []
    for k in raw_candidates:
        if k not in seen:
            seen.add(k)
            unique_keys.append(k)
    return unique_keys

GROQ_API_KEYS = _collect_groq_keys()
GROQ_API_KEY = GROQ_API_KEYS[0] if GROQ_API_KEYS else None
GROQ_MODEL = os.getenv("GROQ_MODEL")
VOICE_GROQ_API_KEY = os.getenv("VOICE_GROQ_API_KEY")
VISUAL_GROQ_API_KEY = os.getenv("VISUAL_GROQ_API_KEY")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
