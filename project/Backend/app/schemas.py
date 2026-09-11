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
    include_image: bool = True


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


class VisualResponse(BaseModel):
    spec: Dict[str, Any]
    image_base64: Optional[str] = None
