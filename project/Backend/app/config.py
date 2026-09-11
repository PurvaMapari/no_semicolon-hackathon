import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPOSITORY_DIR = BACKEND_DIR.parents[1]

# Support both project/Backend/.env and the repository-level .env.
load_dotenv(REPOSITORY_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env", override=True)

GROQ_API_KEY = os.getenv("GROQ_API_KEY") or os.getenv("GROQ_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL")
VOICE_GROQ_API_KEY = os.getenv("VOICE_GROQ_API_KEY")
VISUAL_GROQ_API_KEY = os.getenv("VISUAL_GROQ_API_KEY")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
