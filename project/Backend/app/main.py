import os
import tempfile
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.config import FRONTEND_ORIGIN
from app.schemas import (
    PipelineRequest,
    LessonQuestionRequest,
    PreferenceRequest,
    QuizRequest,
    TransformRequest,
    VisualRequest,
    VoiceRequest,
)
from app.services.extraction import (
    extract_text_and_tables_from_pdf,
    extract_text_from_document,
    extract_text_from_image,
)
from app.services.learning import (
    chunks_for_quiz,
    generate_quiz,
    parse_user_preference,
    run_pipeline,
    transform_text,
    voice_ask,
    answer_lesson_question,
)
from app.services.visuals import generate_visual_spec, render_visual_spec


app = FastAPI(
    title="AdaptLearn Backend",
    version="1.0.0",
    description="API for the adaptive learning functions from the Phase 1 notebook.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _raise_http(error: Exception) -> None:
    if isinstance(error, (ValueError, FileNotFoundError)):
        raise HTTPException(status_code=400, detail=str(error)) from error
    raise HTTPException(status_code=500, detail=str(error)) from error


@app.get("/api/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "adaptlearn-backend"}


@app.post("/api/extract/pdf")
async def extract_pdf(file: UploadFile = File(...)) -> Dict[str, Any]:
    suffix = Path(file.filename or "lesson.pdf").suffix or ".pdf"
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temporary:
            temporary.write(await file.read())
            temporary_path = temporary.name
        text, tables = extract_text_and_tables_from_pdf(temporary_path)
        return {"filename": file.filename, "text": text, "tables": tables, "word_count": len(text.split())}
    except Exception as error:
        _raise_http(error)
    finally:
        if temporary_path:
            os.unlink(temporary_path)


@app.post("/api/extract/document")
async def extract_document(file: UploadFile = File(...)) -> Dict[str, Any]:
    suffix = Path(file.filename or "lesson.txt").suffix.lower()
    if suffix not in {".pdf", ".txt", ".docx", ".epub"}:
        raise HTTPException(status_code=400, detail="Unsupported document type. Use PDF, TXT, DOCX, or EPUB.")
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temporary:
            temporary.write(await file.read())
            temporary_path = temporary.name
        text, tables = extract_text_from_document(temporary_path)
        return {"filename": file.filename, "text": text, "tables": tables, "word_count": len(text.split())}
    except Exception as error:
        _raise_http(error)
    finally:
        if temporary_path:
            os.unlink(temporary_path)


@app.post("/api/extract/image")
async def extract_image(file: UploadFile = File(...)) -> Dict[str, Any]:
    suffix = Path(file.filename or "lesson.png").suffix or ".png"
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temporary:
            temporary.write(await file.read())
            temporary_path = temporary.name
        text = extract_text_from_image(temporary_path)
        return {"filename": file.filename, "text": text, "word_count": len(text.split())}
    except Exception as error:
        _raise_http(error)
    finally:
        if temporary_path:
            os.unlink(temporary_path)


@app.post("/api/profile/detect")
def detect_profile(request: PreferenceRequest) -> Dict[str, Any]:
    try:
        return parse_user_preference(request.text)
    except Exception as error:
        _raise_http(error)


@app.post("/api/transform")
def transform(request: TransformRequest) -> Dict[str, Any]:
    try:
        return transform_text(request.text, request.profile)
    except Exception as error:
        _raise_http(error)


@app.post("/api/voice/ask")
def ask_voice(request: VoiceRequest) -> Dict[str, str]:
    try:
        return {"answer": voice_ask(request.question, request.lesson_text)}
    except Exception as error:
        _raise_http(error)


@app.post("/api/lesson/question")
def ask_lesson_question(request: LessonQuestionRequest) -> Dict[str, str]:
    """Answer a learner question using the active section and full lesson context."""
    try:
        answer = answer_lesson_question(
            request.question,
            request.lesson_text,
            request.section_text,
            request.profile,
        )
        return {"answer": answer}
    except Exception as error:
        _raise_http(error)


@app.post("/api/visual")
def visual(request: VisualRequest) -> Dict[str, Any]:
    try:
        spec = generate_visual_spec(request.lesson_text, request.profile)
        image = render_visual_spec(spec, request.profile) if request.include_image else None
        return {"spec": spec, "image_base64": image}
    except Exception as error:
        _raise_http(error)


@app.post("/api/quiz")
def quiz(request: QuizRequest) -> Dict[str, Any]:
    try:
        return generate_quiz(request.chunk, request.profile)
    except Exception as error:
        _raise_http(error)


@app.post("/api/pipeline")
def pipeline(request: PipelineRequest) -> Dict[str, Any]:
    try:
        return run_pipeline(request.text, request.profiles, request.quiz_limit)
    except Exception as error:
        _raise_http(error)


@app.post("/api/chunks-for-quiz")
def normalized_chunks(transformed: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return {"chunks": chunks_for_quiz(transformed)}
    except Exception as error:
        _raise_http(error)
