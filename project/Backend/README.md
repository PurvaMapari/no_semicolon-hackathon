# AdaptLearn Backend

Standalone FastAPI backend for the adaptive learning functions from `adaptive_learning_phase1.ipynb`.

## Setup

```powershell
cd project/Backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000/docs` for the API documentation.

## API capabilities

- PDF and image text/table extraction
- Free-text accessibility profile detection
- Dyslexia, cognitive-load, and low-vision transformations
- Lesson voice Q&A
- Visual specification generation and PNG rendering
- Quiz generation and validation
- End-to-end transformation and quiz pipeline

Without a Groq key, deterministic local fallbacks are used for development. OCR also requires the Tesseract executable installed on the machine and available on `PATH`.
