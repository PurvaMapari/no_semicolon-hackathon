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
    profile: str = "cognitive_load"


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


class QuizEvaluationRequest(BaseModel):
    question: str = Field(min_length=1)
    options: List[str] = Field(min_length=2)
    correct_answer: str = Field(min_length=1)
    selected_answer: str = Field(min_length=1)
    explanation: str = ""
    section_index: int = Field(default=0, ge=0)


class LessonTestRequest(BaseModel):
    text: str = Field(min_length=1)
    profile: str
    question_count: int = Field(default=5, ge=1, le=10)


class PipelineRequest(BaseModel):
    text: str = Field(min_length=1)
    profiles: List[str] = ["dyslexia", "low_vision", "cognitive_load"]
    quiz_limit: int = Field(default=3, ge=1, le=10)
    tag_difficulty: bool = Field(default=True, description="Whether to tag sections with difficulty tiers")


# ── Difficulty & SCALE ────────────────────────────────────────────────────────


class DifficultySection(BaseModel):
    """A section of content tagged with difficulty metadata."""
    text: str
    difficulty_tier: str  # "foundational" | "intermediate" | "advanced"
    expected_time_multiplier: float
    expected_baseline_seconds: float
    rationale: str
    word_count: int


class StruggleScoreRequest(BaseModel):
    """Compute struggle score for a learner on a specific section."""
    actual_dwell_seconds: float = Field(ge=0.0)
    expected_baseline_seconds: float = Field(ge=0.0)
    expected_time_multiplier: float = Field(default=1.6, ge=0.5, le=5.0)
    reread_count: int = Field(default=0, ge=0)
    help_requested: bool = Field(default=False)
    quiz_incorrect: bool = Field(default=False)
    quiz_response_seconds: Optional[float] = Field(default=None, ge=0.0)
    expected_quiz_seconds: float = Field(default=30.0, ge=1.0)


class StruggleScoreResponse(BaseModel):
    """Computed struggle score with component breakdown."""
    struggle_score: float
    should_rewire: bool
    components: Dict[str, float]  # Individual weighted components
    threshold: float  # REWIRE trigger threshold for reference
    reason: str  # Why REWIRE was triggered (or not) — e.g., "excessive_dwell_on_foundational", "multiple_signals", "quiz_failure"


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


class PracticeQuizRequest(BaseModel):
    """Request to generate a full-lesson practice quiz."""
    text: str = Field(min_length=1, description="The full extracted lesson text")
    profile: str = Field(default="cognitive_load", description="Learner profile")
    question_count: int = Field(default=8, ge=3, le=15, description="Number of questions to generate")

