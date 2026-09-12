"""
SCALE — Struggle-aware Content Adaptation Logic Engine.

This module implements difficulty-aware struggle detection by:
1. Tagging sections with difficulty tiers at ingestion time
2. Normalizing learner signals (dwell time, rereads, etc.) against expected baselines
3. Computing a weighted struggle score that triggers REWIRE when needed
"""
from typing import Any, Dict, List, Optional, Tuple
import json

from app.services.llm import call_llm, parse_json_response


# ──────────────────────────────────────────────────────────────────────────────
# CONFIGURATION CONSTANTS
# ──────────────────────────────────────────────────────────────────────────────

# Difficulty time multipliers
DIFFICULTY_MULTIPLIERS = {
    "foundational": 1.0,
    "intermediate": 1.6,
    "advanced": 2.5,
}

# Average reading speed (words per minute) for baseline calculation
AVERAGE_READING_SPEED_WPM = 200

# Struggle score component weights (must sum to 1.0)
WEIGHT_DWELL = 0.35
WEIGHT_REREAD = 0.25
WEIGHT_HELP = 0.15
WEIGHT_QUIZ_WRONG = 0.15
WEIGHT_QUIZ_LATENCY = 0.10

# REWIRE trigger threshold
REWIRE_THRESHOLD = 0.6

VALID_DIFFICULTY_TIERS = {"foundational", "intermediate", "advanced"}


# ──────────────────────────────────────────────────────────────────────────────
# PROMPTS
# ──────────────────────────────────────────────────────────────────────────────

DIFFICULTY_TAGGING_PROMPT = """You are an educational content analyzer. Analyze each section/concept in the lesson below and tag it with a difficulty tier.

Difficulty tiers:
- foundational: Basic concepts, definitions, simple examples. Prerequisites for understanding more complex ideas.
- intermediate: Builds on foundational concepts. Requires applying knowledge or combining ideas.
- advanced: Complex concepts, abstract reasoning, multiple integrated ideas, or expert-level material.

Return STRICT JSON only with this structure:
{{
  "sections": [
    {{
      "text": "exact text of the section (first 200 chars)",
      "difficulty_tier": "foundational|intermediate|advanced",
      "rationale": "1-sentence explanation of why this tier was chosen",
      "word_count": number
    }}
  ]
}}

Rules:
- Each section should be 1-3 paragraphs or a coherent concept block
- difficulty_tier must be exactly one of: foundational, intermediate, advanced
- rationale must be 1 sentence, no longer
- word_count is the approximate number of words in that section
- If the lesson is a single unified concept, return 1 section covering the whole lesson
- Do not invent content — use ONLY what's in the lesson

LESSON:
{lesson}
"""


# ──────────────────────────────────────────────────────────────────────────────
# DIFFICULTY TAGGING (Task 1)
# ──────────────────────────────────────────────────────────────────────────────

def tag_section_difficulty(lesson_text: str) -> List[Dict[str, Any]]:
    """
    Tag each section of a lesson with difficulty tier and expected time multiplier.
    
    This is called ONCE at ingestion time and cached per document.
    
    Returns:
        List of section dictionaries with:
        - text: section text
        - difficulty_tier: "foundational" | "intermediate" | "advanced"
        - expected_time_multiplier: float (1.0, 1.6, or 2.5)
        - expected_baseline_seconds: float (based on word count)
        - rationale: 1-sentence explanation
        - word_count: int
    """
    
    # Fallback: if LLM fails, split into paragraphs and tag everything "intermediate"
    def fallback_tagging(text: str) -> List[Dict[str, Any]]:
        """Deterministic fallback when LLM call fails."""
        # Split by double newlines or use whole text as one section
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        if not paragraphs:
            paragraphs = [text]
        
        sections = []
        for para in paragraphs:
            word_count = len(para.split())
            expected_baseline_seconds = (word_count / AVERAGE_READING_SPEED_WPM) * 60
            
            sections.append({
                "text": para,
                "difficulty_tier": "intermediate",
                "expected_time_multiplier": DIFFICULTY_MULTIPLIERS["intermediate"],
                "expected_baseline_seconds": expected_baseline_seconds,
                "rationale": "Default tier assigned (LLM tagging unavailable)",
                "word_count": word_count,
            })
        
        return sections
    
    # Try LLM tagging
    try:
        prompt = DIFFICULTY_TAGGING_PROMPT.format(lesson=lesson_text[:8000])
        response = call_llm(prompt)
        parsed = parse_json_response(response)
        
        if not isinstance(parsed, dict) or "sections" not in parsed:
            return fallback_tagging(lesson_text)
        
        sections_raw = parsed["sections"]
        if not isinstance(sections_raw, list) or len(sections_raw) == 0:
            return fallback_tagging(lesson_text)
        
        # Validate and enrich each section
        sections = []
        for sec in sections_raw:
            if not isinstance(sec, dict):
                continue
            
            tier = sec.get("difficulty_tier", "intermediate")
            if tier not in VALID_DIFFICULTY_TIERS:
                tier = "intermediate"
            
            word_count = sec.get("word_count", len(sec.get("text", "").split()))
            expected_baseline_seconds = (word_count / AVERAGE_READING_SPEED_WPM) * 60
            
            sections.append({
                "text": sec.get("text", "")[:4000],  # Truncate very long sections
                "difficulty_tier": tier,
                "expected_time_multiplier": DIFFICULTY_MULTIPLIERS[tier],
                "expected_baseline_seconds": expected_baseline_seconds,
                "rationale": sec.get("rationale", "")[:200],
                "word_count": word_count,
            })
        
        if not sections:
            return fallback_tagging(lesson_text)
        
        return sections
    
    except Exception:
        # Any error → use fallback
        return fallback_tagging(lesson_text)


# ──────────────────────────────────────────────────────────────────────────────
# STRUGGLE SCORE COMPUTATION (Task 2)
# ──────────────────────────────────────────────────────────────────────────────

def compute_struggle_score(
    actual_dwell_seconds: float,
    expected_baseline_seconds: float,
    expected_time_multiplier: float,
    reread_count: int = 0,
    help_requested: bool = False,
    quiz_incorrect: bool = False,
    quiz_response_seconds: Optional[float] = None,
    expected_quiz_seconds: float = 30.0,
) -> Tuple[float, Dict[str, float], str]:
    """
    Compute difficulty-normalized struggle score from learner signals.
    
    Args:
        actual_dwell_seconds: How long learner spent on this section
        expected_baseline_seconds: Expected time based on word count alone
        expected_time_multiplier: Difficulty adjustment (1.0, 1.6, or 2.5)
        reread_count: Number of times learner re-visited this section
        help_requested: Whether learner clicked "help" or asked a question
        quiz_incorrect: Whether learner answered quiz incorrectly
        quiz_response_seconds: How long learner took to answer quiz (optional)
        expected_quiz_seconds: Expected quiz response time (default 30s)
    
    Returns:
        Tuple of (struggle_score, component_breakdown, reason)
        - struggle_score: float between 0.0 and ~3.0 (typically 0-1)
        - component_breakdown: dict with individual weighted components
        - reason: string explaining primary struggle indicator
    """
    
    # Normalize dwell time against difficulty-adjusted baseline
    expected_total_seconds = expected_baseline_seconds * expected_time_multiplier
    dwell_ratio = actual_dwell_seconds / max(expected_total_seconds, 1.0)
    
    # Cap dwell ratio at 3.0 to prevent extreme outliers
    dwell_ratio = min(dwell_ratio, 3.0)
    
    # Normalize reread count (0-2 rereads is typical, 3+ is struggle)
    normalized_reread = min(reread_count / 3.0, 1.0)
    
    # Help request is binary
    help_flag = 1.0 if help_requested else 0.0
    
    # Quiz incorrect is binary
    quiz_wrong_flag = 1.0 if quiz_incorrect else 0.0
    
    # Normalize quiz latency
    quiz_latency_ratio = 0.0
    if quiz_response_seconds is not None:
        quiz_latency_ratio = min(quiz_response_seconds / expected_quiz_seconds, 2.0)
    
    # Compute weighted struggle score
    components = {
        "dwell": WEIGHT_DWELL * dwell_ratio,
        "reread": WEIGHT_REREAD * normalized_reread,
        "help": WEIGHT_HELP * help_flag,
        "quiz_wrong": WEIGHT_QUIZ_WRONG * quiz_wrong_flag,
        "quiz_latency": WEIGHT_QUIZ_LATENCY * quiz_latency_ratio,
    }
    
    struggle_score = sum(components.values())
    
    # Determine reason for struggle (or lack thereof)
    reason = _determine_struggle_reason(
        components=components,
        dwell_ratio=dwell_ratio,
        expected_time_multiplier=expected_time_multiplier,
        reread_count=reread_count,
        help_requested=help_requested,
        quiz_incorrect=quiz_incorrect,
        struggle_score=struggle_score,
    )
    
    return struggle_score, components, reason


def _determine_struggle_reason(
    components: Dict[str, float],
    dwell_ratio: float,
    expected_time_multiplier: float,
    reread_count: int,
    help_requested: bool,
    quiz_incorrect: bool,
    struggle_score: float,
) -> str:
    """
    Determine the primary reason for struggle (or normal engagement).
    
    Returns a machine-readable reason string that the frontend can use
    to decide between "distraction" vs "confusion" intervention strategies.
    """
    
    # Not struggling — normal engagement
    if struggle_score < REWIRE_THRESHOLD:
        if dwell_ratio > 0.8:
            return "normal_engagement"
        else:
            return "quick_completion"
    
    # Struggling — identify primary cause
    max_component = max(components.items(), key=lambda x: x[1])
    component_name, component_value = max_component
    
    # Multiple high signals → confusion
    high_signals = sum(1 for v in components.values() if v > 0.1)
    if high_signals >= 3:
        return "multiple_signals"
    
    # Primary signal: excessive dwell time
    if component_name == "dwell":
        # Check if it's on foundational/easy content (indicates real struggle)
        if expected_time_multiplier <= 1.0:
            return "excessive_dwell_on_foundational"
        elif dwell_ratio >= 2.5:
            return "excessive_dwell"
        else:
            return "elevated_dwell"
    
    # Primary signal: quiz failure
    if component_name == "quiz_wrong":
        return "quiz_failure"
    
    # Primary signal: help requests
    if component_name == "help":
        return "help_requested"
    
    # Primary signal: excessive rereading
    if component_name == "reread":
        if reread_count >= 3:
            return "excessive_rereads"
        else:
            return "rereading"
    
    # Primary signal: slow quiz response
    if component_name == "quiz_latency":
        return "quiz_latency"
    
    # Fallback
    return "elevated_struggle"


def should_trigger_rewire(struggle_score: float) -> bool:
    """
    Determine if REWIRE should be triggered based on struggle score.
    
    Args:
        struggle_score: Computed struggle score (0.0 to ~3.0)
    
    Returns:
        True if score >= REWIRE_THRESHOLD, False otherwise
    """
    return struggle_score >= REWIRE_THRESHOLD


# ──────────────────────────────────────────────────────────────────────────────
# UTILITIES
# ──────────────────────────────────────────────────────────────────────────────

def get_section_by_text(
    sections: List[Dict[str, Any]],
    section_text: str,
    fuzzy_match: bool = True
) -> Optional[Dict[str, Any]]:
    """
    Find a section by its text content.
    
    Args:
        sections: List of tagged sections
        section_text: Text to search for
        fuzzy_match: If True, match by substring (first 100 chars)
    
    Returns:
        Matching section dict or None
    """
    if not sections or not section_text:
        return None
    
    section_text_normalized = section_text.strip()[:100].lower()
    
    for section in sections:
        if fuzzy_match:
            if section_text_normalized in section.get("text", "").lower()[:100]:
                return section
        else:
            if section.get("text", "").strip() == section_text.strip():
                return section
    
    # If no match, return first section as fallback
    return sections[0] if sections else None


def estimate_word_count(text: str) -> int:
    """Simple word count estimation."""
    return len(text.split())


def estimate_baseline_seconds(word_count: int) -> float:
    """Estimate expected reading time from word count."""
    return (word_count / AVERAGE_READING_SPEED_WPM) * 60
