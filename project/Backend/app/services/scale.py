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

# Difficulty time multipliers (legacy — kept for backward compat with struggle score)
DIFFICULTY_MULTIPLIERS = {
    "foundational": 1.0,
    "intermediate": 1.6,
    "advanced": 2.5,
}

# Per-difficulty reading speeds (words per minute).
# Difficulty is determined by CONTENT ANALYSIS (LLM), NOT by word count.
# These constants affect only the estimated reading time and dwell baseline.
# Foundational = familiar concepts, reader moves fast
# Intermediate = requires some mental effort
# Advanced     = dense / abstract material, reader slows down
READING_SPEEDS_WPM = {
    "foundational": 220,
    "intermediate": 180,
    "advanced":     140,
}

# Fallback when difficulty tier is unknown
DEFAULT_READING_SPEED_WPM = 180

# Legacy flat speed — retained so existing callers that reference this name
# still compile; new code must use READING_SPEEDS_WPM.
AVERAGE_READING_SPEED_WPM = DEFAULT_READING_SPEED_WPM

# Struggle score component weights (must sum exactly to 1.0)
WEIGHT_DWELL_CONTINUOUS = 0.20   # Continuous active-dwell evidence
WEIGHT_DWELL_EXCEEDED = 0.10     # Difficulty-aware exceeded-time evidence (max)
# Active Reading / Dwell total weight = 0.30 (30%)
WEIGHT_QUIZ_ACCURACY = 0.35      # Quiz accuracy (inverted) = 35%
WEIGHT_HELP = 0.15               # Help requests (text + voice) = 15%
WEIGHT_QUIZ_LATENCY = 0.10       # Quiz response latency = 10%
WEIGHT_SCROLL = 0.10             # Scroll-back / backtracking = 10%

# Maximum difficulty-specific exceeded-time contribution (part of the 10% exceeded component)
DIFFICULTY_EXCEEDED_MAX_CONTRIBUTIONS = {
    "foundational": 0.10,  # Easy: full 0.10 max
    "intermediate": 0.07,  # Medium: 0.07 max
    "advanced":     0.05,  # Hard: 0.05 max
}

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
            expected_baseline_seconds = compute_section_read_time(word_count, "intermediate")

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
            expected_baseline_seconds = compute_section_read_time(word_count, tier)
            
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

def compute_exceeded_time_contribution(dwell_ratio: float, difficulty_tier: str = "intermediate") -> float:
    """
    Compute the progressive difficulty-aware exceeded-time contribution (part of the 30% dwell weight, max 0.10).
    Uses the SAME dwell_ratio (actual / expected) as continuous dwell to prevent double-counting.
    
    Difficulty caps:
      - foundational (Easy): 0.10 max
      - intermediate (Medium): 0.07 max
      - advanced (Hard): 0.05 max
      
    Progression:
      - ratio <= 1.00: 0.0
      - 1.00 < ratio <= 1.25: small contribution (up to 30% of max)
      - 1.25 < ratio < 1.50: moderate contribution (30% to 100% of max)
      - ratio >= 1.50: maximum difficulty contribution
    """
    tier = (difficulty_tier or "intermediate").lower()
    max_exceeded = DIFFICULTY_EXCEEDED_MAX_CONTRIBUTIONS.get(tier, 0.07)
    
    if dwell_ratio <= 1.00:
        return 0.0
    elif dwell_ratio <= 1.25:
        return 0.30 * max_exceeded * ((dwell_ratio - 1.00) / 0.25)
    elif dwell_ratio < 1.50:
        return max_exceeded * (0.30 + 0.70 * ((dwell_ratio - 1.25) / 0.25))
    else:
        return max_exceeded


def compute_struggle_score(
    actual_dwell_seconds: float,
    expected_baseline_seconds: float,
    expected_time_multiplier: float = 1.0,
    reread_count: int = 0,
    help_requested: bool = False,
    quiz_incorrect: bool = False,
    quiz_response_seconds: Optional[float] = None,
    expected_quiz_seconds: float = 30.0,
    difficulty_tier: Optional[str] = None,
    help_requests_count: Optional[int] = None,
    quiz_accuracy: Optional[float] = None,
    scroll_back_count: int = 0,
) -> Tuple[float, Dict[str, float], str]:
    """
    Compute difficulty-normalized struggle score from learner signals.
    
    Follows the PRISM SCALE Final Authoritative Scoring Model:
    - Active Reading / Dwell Behavior: 30%
      - 20% continuous active-dwell evidence
      - up to 10% progressive difficulty-aware exceeded-time evidence (from the SAME dwell_ratio)
    - Quiz Accuracy: 35%
    - Help Requests (text + voice): 15%
    - Quiz Answer Latency: 10%
    - Scroll / Backtracking: 10%
    TOTAL = 100% (1.00)
    """
    # Resolve difficulty tier
    if not difficulty_tier:
        if expected_time_multiplier <= 1.1:
            difficulty_tier = "foundational"
        elif expected_time_multiplier >= 2.0:
            difficulty_tier = "advanced"
        else:
            difficulty_tier = "intermediate"
    
    # Calculate canonical dwell ratio
    expected_total_seconds = expected_baseline_seconds * (expected_time_multiplier if expected_time_multiplier > 0 else 1.0)
    dwell_ratio = actual_dwell_seconds / max(expected_total_seconds, 1.0)

    # 1a. Continuous Active Dwell (20% max)
    if dwell_ratio <= 1.0:
        normalized_continuous_dwell = 0.0
    elif dwell_ratio >= 3.0:
        normalized_continuous_dwell = 1.0
    else:
        normalized_continuous_dwell = (dwell_ratio - 1.0) / (3.0 - 1.0)
    dwell_continuous_contrib = WEIGHT_DWELL_CONTINUOUS * normalized_continuous_dwell

    # 1b. Difficulty-Aware Exceeded-Time (Up to 10% max, progressive from SAME ratio)
    dwell_exceeded_contrib = compute_exceeded_time_contribution(dwell_ratio, difficulty_tier)

    # Combined dwell
    dwell_total_contrib = dwell_continuous_contrib + dwell_exceeded_contrib

    # 2. Quiz Accuracy (35% max, inverted)
    if quiz_accuracy is not None:
        acc = quiz_accuracy
    elif quiz_incorrect:
        acc = 0.0
    else:
        acc = 1.0

    if acc >= 0.80:
        normalized_accuracy = 0.0
    elif acc <= 0.20:
        normalized_accuracy = 1.0
    else:
        normalized_accuracy = (0.80 - acc) / (0.80 - 0.20)
    quiz_accuracy_contrib = WEIGHT_QUIZ_ACCURACY * normalized_accuracy

    # 3. Help Requests (15% max, text + voice)
    total_help = help_requests_count if help_requests_count is not None else (1 if help_requested else 0)
    normalized_help = min(total_help / 3.0, 1.0)
    help_contrib = WEIGHT_HELP * normalized_help

    # 4. Quiz Response Latency (10% max)
    if quiz_response_seconds is None:
        normalized_latency = 0.0
    elif quiz_response_seconds <= 5.0:
        normalized_latency = 0.0
    elif quiz_response_seconds >= 20.0:
        normalized_latency = 1.0
    else:
        normalized_latency = (quiz_response_seconds - 5.0) / (20.0 - 5.0)
    quiz_latency_contrib = WEIGHT_QUIZ_LATENCY * normalized_latency

    # 5. Scroll / Backtracking (10% max)
    normalized_scroll = min(scroll_back_count / 3.0, 1.0)
    scroll_contrib = WEIGHT_SCROLL * normalized_scroll

    components = {
        "dwell_continuous": round(dwell_continuous_contrib, 4),
        "dwell_exceeded": round(dwell_exceeded_contrib, 4),
        "dwell": round(dwell_total_contrib, 4),
        "quiz_accuracy": round(quiz_accuracy_contrib, 4),
        "help": round(help_contrib, 4),
        "quiz_latency": round(quiz_latency_contrib, 4),
        "scroll": round(scroll_contrib, 4),
    }

    struggle_score = min(1.0, max(0.0, sum([
        dwell_continuous_contrib,
        dwell_exceeded_contrib,
        quiz_accuracy_contrib,
        help_contrib,
        quiz_latency_contrib,
        scroll_contrib,
    ])))
    struggle_score = round(struggle_score, 4)

    reason = _determine_struggle_reason(
        components=components,
        dwell_ratio=dwell_ratio,
        difficulty_tier=difficulty_tier,
        expected_time_multiplier=expected_time_multiplier,
        reread_count=reread_count,
        help_requested=total_help > 0,
        quiz_incorrect=acc < 0.80,
        struggle_score=struggle_score,
    )

    return struggle_score, components, reason


def _determine_struggle_reason(
    components: Dict[str, float],
    dwell_ratio: float,
    difficulty_tier: str = "intermediate",
    expected_time_multiplier: float = 1.0,
    reread_count: int = 0,
    help_requested: bool = False,
    quiz_incorrect: bool = False,
    struggle_score: float = 0.0,
) -> str:
    """
    Determine the primary reason for struggle (or normal engagement).
    """
    if struggle_score < REWIRE_THRESHOLD:
        if dwell_ratio > 0.8:
            return "normal_engagement"
        else:
            return "quick_completion"

    # Identify primary cause among active signals
    key_signals = {
        "dwell": components.get("dwell", 0.0),
        "quiz_accuracy": components.get("quiz_accuracy", 0.0),
        "help": components.get("help", 0.0),
        "quiz_latency": components.get("quiz_latency", 0.0),
        "scroll": components.get("scroll", 0.0),
    }
    max_component = max(key_signals.items(), key=lambda x: x[1])
    component_name, component_value = max_component

    high_signals = sum(1 for v in key_signals.values() if v >= 0.08)
    if high_signals >= 3:
        return "multiple_signals"

    if component_name == "dwell":
        if difficulty_tier == "foundational" or expected_time_multiplier <= 1.0:
            return "excessive_dwell_on_foundational"
        elif dwell_ratio >= 2.0:
            return "excessive_dwell"
        else:
            return "elevated_dwell"

    if component_name == "quiz_accuracy":
        return "quiz_failure"

    if component_name == "help":
        return "help_requested"

    if component_name == "quiz_latency":
        return "quiz_latency"

    if component_name == "scroll":
        return "frequent_backtracking"

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


def reading_speed_for_tier(difficulty_tier: str) -> int:
    """Return the configured WPM for a given difficulty tier.

    Difficulty is set by content analysis — this function only maps the
    already-determined tier to the appropriate reading-speed constant.
    """
    return READING_SPEEDS_WPM.get(difficulty_tier, DEFAULT_READING_SPEED_WPM)


def compute_section_read_time(word_count: int, difficulty_tier: str) -> float:
    """Return estimated reading time in seconds for a section.

    Formula:  seconds = (word_count / wpm_for_difficulty) * 60

    This is the single source of truth used by both the backend
    (baseline for dwell-ratio computation) and the frontend (display).
    Difficulty is NOT derived from word count here — the caller is
    responsible for providing the content-analysis tier.
    """
    wpm = reading_speed_for_tier(difficulty_tier)
    return (word_count / max(wpm, 1)) * 60


def estimate_baseline_seconds(word_count: int, difficulty_tier: str = "intermediate") -> float:
    """Estimate expected reading time from word count + difficulty tier.

    Replaces the old flat-WPM version.  The difficulty_tier parameter
    must come from content analysis, not from word count.
    """
    return compute_section_read_time(word_count, difficulty_tier)
