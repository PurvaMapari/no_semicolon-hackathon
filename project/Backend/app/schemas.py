from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class PreferenceRequest(BaseModel):
    text: str = Field(min_length=1)


class TransformRequest(BaseModel):
    text: str = Field(min_length=1)
    profile: str


class VoiceRequest(BaseModel):
    question: str = Field(min_length=1)
    lesson_text: str = ""


class LessonQuestionRequest(BaseModel):
    question: str = Field(min_length=1)
    lesson_text: str = Field(min_length=1)
    section_text: str = Field(min_length=1)
    profile: str = "cognitive_load"


class VisualRequest(BaseModel):
    lesson_text: str = Field(min_length=1)
    profile: str
    # When True the backend also extracts source images from a previously
    # uploaded PDF.  The caller passes the temp path via source_pdf_path.
    include_image: bool = True
    source_pdf_path: Optional[str] = None   # server-side temp path, optional


class VisualCardResponse(BaseModel):
    """Full visual card returned by /api/visual."""
    source: str                          # "prism" | "pdf"
    visual_type: str                     # process, cycle, timeline, …, none
    title: str
    subtitle: str
    explanation: str
    key_takeaways: List[str]
    why_visual: str
    svg_html: Optional[str] = None       # inline SVG string rendered by the backend
    source_images: List[str] = []        # base64 PNG strings from the PDF
    spec: Dict[str, Any] = {}            # raw spec for debugging / future use
    error: Optional[str] = None


class QuizRequest(BaseModel):
    chunk: str = Field(min_length=1)
    profile: str


class PipelineRequest(BaseModel):
    text: str = Field(min_length=1)
    profiles: List[str] = ["dyslexia", "low_vision", "cognitive_load"]
    quiz_limit: int = Field(default=3, ge=1, le=10)


# ── REWIRE ────────────────────────────────────────────────────────────────────


class RewireRequest(BaseModel):
    """Request to adapt (re-explain) content after SCALE triggers REWIRE."""
    chunk_text: str = Field(min_length=1, description="The original chunk text to re-explain")
    profile: str = Field(description="Learner profile: dyslexia | cognitive_load | low_vision")
    variant_level: int = Field(default=2, ge=1, le=3, description="Target simplification level")
    actions: List[str] = Field(
        default=["increase_simplification"],
        description="Adaptation actions: increase_simplification, reduce_chunk_size, add_visual_description",
    )
    struggle_explanation: str = Field(
        default="",
        description="Human-readable explanation of why adaptation happened",
    )


class RewireResponse(BaseModel):
    """Adapted content returned after REWIRE."""
    adapted_text: str
    visual_description: Optional[str] = None
    variant_level: int
    explanation: str  # "Why I adapted" message
    actions_applied: List[str]


# ── Adaptive Quiz ─────────────────────────────────────────────────────────────


class AdaptiveQuizRequest(BaseModel):
    """Generate a quiz question adapted to the learner's current struggle state."""
    chunk_text: str = Field(min_length=1)
    profile: str
    difficulty: str = Field(default="easier", description="easier | same | harder")
    struggle_score: float = Field(default=0.0, ge=0.0, le=1.0)
    previous_question: Optional[str] = None
    previous_answer_correct: Optional[bool] = None


class AdaptiveQuizResponse(BaseModel):
    """Adaptive quiz question with metadata."""
    question: str
    options: List[str]
    answer: str
    explanation: str
    difficulty: str
    adapted: bool  # True if this question was adapted from a prior attempt


# Legacy response shape kept for backwards-compatibility with any older clients
class VisualResponse(BaseModel):
    spec: Dict[str, Any]
    image_base64: Optional[str] = None
