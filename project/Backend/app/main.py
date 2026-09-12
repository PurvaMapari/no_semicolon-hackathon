import os
import tempfile
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.config import FRONTEND_ORIGIN
from app.schemas import (
    AdaptiveQuizRequest,
    AdaptiveQuizResponse,
    DifficultySection,
    PipelineRequest,
    LessonQuestionRequest,
    LessonTestRequest,
    PracticeQuizRequest,
    PreferenceRequest,
    QuizRequest,
    RewireRequest,
    RewireResponse,
    QuizEvaluationRequest,
    StruggleScoreRequest,
    StruggleScoreResponse,
    TopicChatRequest,
    TopicChatResponse,
    TransformRequest,
    VisualCardResponse,
    VisualClustersRequest,
    VisualClustersResponse,
    ClusterVisualCardRequest,
    ClusterVisualCardResponse,
    VisualRequest,
    VoiceRequest,
)
from app.services.extraction import (
    extract_source_images_from_pdf,
    extract_text_and_tables_from_pdf,
    extract_text_from_document,
    extract_text_from_image,
)
from app.services.learning import (
    chunks_for_quiz,
    generate_adaptive_quiz,
    generate_practice_quiz,
    generate_quiz,
    evaluate_quiz_answer,
    generate_lesson_test,
    parse_user_preference,
    rewire_content,
    run_pipeline,
    transform_text,
    voice_ask,
    answer_lesson_question,
    chat_topic_assistant,
)
from app.services.visuals import (
    render_full_visual_card,
    cluster_sections,
    generate_cluster_visual_card,
)


app = FastAPI(
    title="AdaptLearn Backend",
    version="1.0.0",
    description="API for the adaptive learning functions from the Phase 1 notebook.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_origins=[
        FRONTEND_ORIGIN,
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ],
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
        return {"answer": voice_ask(request.question, request.lesson_text, request.profile)}
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


@app.post("/api/visual", response_model=VisualCardResponse)
def visual(request: VisualRequest) -> VisualCardResponse:
    """
    Generate a full PRISM visual card for the supplied lesson text.

    Flow:
      1. If source_pdf_path was supplied, attempt to extract embedded images
         from the PDF so the frontend can display source figures first.
      2. Call render_full_visual_card() which runs the LLM spec + SVG renderer.
      3. Return a VisualCardResponse with svg_html, source_images, explanation,
         key_takeaways and metadata — everything the frontend needs in one call.
    """
    try:
        # Step 1 — source image extraction (best-effort, never crashes the route)
        source_images: list = []
        if request.source_pdf_path:
            try:
                source_images = extract_source_images_from_pdf(request.source_pdf_path)
            except Exception:
                pass  # silently degrade — visual card still works without PDF images

        # Step 2 — generate spec + render SVG
        card = render_full_visual_card(
            lesson_text=request.lesson_text,
            profile=request.profile,
            source_images=source_images,
        )

        # Step 3 — return typed response
        return VisualCardResponse(
            source=card.get("source", "prism"),
            visual_type=card.get("visual_type", "none"),
            title=card.get("title", ""),
            subtitle=card.get("subtitle", ""),
            explanation=card.get("explanation", ""),
            key_takeaways=card.get("key_takeaways", []),
            why_visual=card.get("why_visual", ""),
            svg_html=card.get("svg_html"),
            source_images=card.get("source_images", []),
            spec=card.get("spec", {}),
            error=card.get("error"),
        )
    except Exception as error:
        _raise_http(error)


@app.post("/api/visual/clusters", response_model=VisualClustersResponse)
def get_visual_clusters(request: VisualClustersRequest) -> VisualClustersResponse:
    """Group structured sections into 2-8 logical concept clusters."""
    try:
        clusters = cluster_sections(request.sections, request.profile, request.doc_id or "")
        return VisualClustersResponse(clusters=clusters)
    except Exception as error:
        _raise_http(error)


@app.post("/api/visual/cluster-card", response_model=ClusterVisualCardResponse)
def get_cluster_visual_card(request: ClusterVisualCardRequest) -> ClusterVisualCardResponse:
    """Generate or retrieve cached visual card for a specific concept cluster."""
    try:
        card = generate_cluster_visual_card(
            cluster=request.cluster.model_dump(),
            all_sections=request.sections,
            profile=request.profile,
            doc_id=request.doc_id or "",
        )
        return ClusterVisualCardResponse(**card)
    except Exception as error:
        _raise_http(error)


@app.post("/api/quiz")
def quiz(request: QuizRequest) -> Dict[str, Any]:
    try:
        return generate_quiz(request.chunk, request.profile)
    except Exception as error:
        _raise_http(error)


@app.post("/api/quiz/evaluate")
def evaluate_quiz(request: QuizEvaluationRequest) -> Dict[str, Any]:
    try:
        return evaluate_quiz_answer(
            request.question,
            request.options,
            request.correct_answer,
            request.selected_answer,
            request.explanation,
            request.section_index,
        )
    except Exception as error:
        _raise_http(error)


@app.post("/api/test")
def lesson_test(request: LessonTestRequest) -> Dict[str, Any]:
    try:
        questions = generate_lesson_test(request.text, request.profile, request.question_count)
        return {"questions": questions, "question_count": len(questions)}
    except Exception as error:
        _raise_http(error)


@app.post("/api/practice-quiz")
def practice_quiz(request: PracticeQuizRequest) -> Dict[str, Any]:
    """Generate a full-lesson practice quiz to be taken after all sections are complete."""
    try:
        questions = generate_practice_quiz(request.text, request.profile, request.question_count)
        return {"questions": questions, "question_count": len(questions)}
    except Exception as error:
        _raise_http(error)


@app.post("/api/topic/chat", response_model=TopicChatResponse)
def topic_chat(request: TopicChatRequest) -> TopicChatResponse:
    """Conversational AI Topic Assistant to scaffold and generate full lesson material."""
    try:
        messages_dict = [{"role": m.role, "content": m.content} for m in request.messages]
        result = chat_topic_assistant(
            messages=messages_dict,
            current_topic=request.current_topic,
            profile=request.profile,
            force_generate=request.force_generate,
        )
        return TopicChatResponse(**result)
    except Exception as error:
        _raise_http(error)


@app.post("/api/pipeline")
def pipeline(request: PipelineRequest) -> Dict[str, Any]:
    try:
        return run_pipeline(request.text, request.profiles, request.quiz_limit, request.tag_difficulty)
    except Exception as error:
        _raise_http(error)


@app.post("/api/chunks-for-quiz")
def normalized_chunks(transformed: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return {"chunks": chunks_for_quiz(transformed)}
    except Exception as error:
        _raise_http(error)


# ── REWIRE — Content Adaptation ───────────────────────────────────────────────


@app.post("/api/rewire", response_model=RewireResponse)
def rewire(request: RewireRequest) -> RewireResponse:
    """
    Adapt (re-explain) content after the SCALE engine triggers REWIRE.

    Called when the frontend detects that the learner's struggle score
    exceeds the adaptation threshold. Returns simplified content,
    an optional visual description, and a "why I adapted" explanation.
    """
    try:
        result = rewire_content(
            chunk_text=request.chunk_text,
            profile=request.profile,
            variant_level=request.variant_level,
            actions=request.actions,
            struggle_explanation=request.struggle_explanation,
        )
        return RewireResponse(**result)
    except Exception as error:
        _raise_http(error)


# ── Adaptive Quiz ─────────────────────────────────────────────────────────────


@app.post("/api/adaptive-quiz", response_model=AdaptiveQuizResponse)
def adaptive_quiz(request: AdaptiveQuizRequest) -> AdaptiveQuizResponse:
    """
    Generate a quiz question adapted to the learner's current struggle state.

    After REWIRE, this endpoint generates an easier question focused on the
    concept the learner struggled with. The difficulty parameter controls
    complexity: 'easier' (post-struggle), 'same' (normal), 'harder' (mastered).
    """
    try:
        result = generate_adaptive_quiz(
            chunk_text=request.chunk_text,
            profile=request.profile,
            difficulty=request.difficulty,
            struggle_score=request.struggle_score,
            previous_question=request.previous_question,
            previous_answer_correct=request.previous_answer_correct,
        )
        return AdaptiveQuizResponse(**result)
    except Exception as error:
        _raise_http(error)


# ── SCALE — Struggle Score ────────────────────────────────────────────────────


@app.post("/api/struggle-score", response_model=StruggleScoreResponse)
def struggle_score(request: StruggleScoreRequest) -> StruggleScoreResponse:
    """
    Compute difficulty-normalized struggle score from learner signals.
    
    This endpoint implements the SCALE (Struggle-aware Content Adaptation Logic Engine)
    algorithm that normalizes learner behavior against section difficulty.
    
    Returns the computed score, whether REWIRE should trigger, component breakdown,
    and a machine-readable reason for frontend decision-making.
    """
    from app.services.scale import compute_struggle_score, should_trigger_rewire, REWIRE_THRESHOLD
    
    try:
        score, components, reason = compute_struggle_score(
            actual_dwell_seconds=request.actual_dwell_seconds,
            expected_baseline_seconds=request.expected_baseline_seconds,
            expected_time_multiplier=request.expected_time_multiplier,
            reread_count=request.reread_count,
            help_requested=request.help_requested,
            quiz_incorrect=request.quiz_incorrect,
            quiz_response_seconds=request.quiz_response_seconds,
            expected_quiz_seconds=request.expected_quiz_seconds,
        )
        
        return StruggleScoreResponse(
            struggle_score=score,
            should_rewire=should_trigger_rewire(score),
            components=components,
            threshold=REWIRE_THRESHOLD,
            reason=reason,
        )
    except Exception as error:
        _raise_http(error)


@app.post("/api/tag-difficulty")
def tag_difficulty(request: Dict[str, str]) -> Dict[str, Any]:
    """
    Tag sections of a lesson with difficulty tiers.
    
    This is called once at ingestion time and cached per document.
    Returns a list of sections with difficulty metadata.
    """
    from app.services.scale import tag_section_difficulty
    
    try:
        lesson_text = request.get("text", "")
        if not lesson_text:
            raise ValueError("text field is required")
        
        sections = tag_section_difficulty(lesson_text)
        return {"sections": sections}
    except Exception as error:
        _raise_http(error)
