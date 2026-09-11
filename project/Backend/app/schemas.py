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


class VisualRequest(BaseModel):
    lesson_text: str = Field(min_length=1)
    profile: str
    include_image: bool = True


class QuizRequest(BaseModel):
    chunk: str = Field(min_length=1)
    profile: str


class PipelineRequest(BaseModel):
    text: str = Field(min_length=1)
    profiles: List[str] = ["dyslexia", "low_vision", "cognitive_load"]
    quiz_limit: int = Field(default=3, ge=1, le=10)


class VisualResponse(BaseModel):
    spec: Dict[str, Any]
    image_base64: Optional[str] = None
