import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

GROQ_API_KEY = os.getenv("GROQ_API_KEY") or os.getenv("GROQ_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL")
VOICE_GROQ_API_KEY = os.getenv("VOICE_GROQ_API_KEY")
VISUAL_GROQ_API_KEY = os.getenv("VISUAL_GROQ_API_KEY")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
