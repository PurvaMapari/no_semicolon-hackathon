import base64
import io
import re
import textwrap
from typing import Any, Dict, Optional

import matplotlib
matplotlib.use("Agg")
import matplotlib.patches as patches
import matplotlib.pyplot as plt

from app.services.llm import call_visual_llm, parse_json_response


VISUAL_SPEC_PROMPT = """You are an educational visual designer. Analyse the lesson and decide whether a visual representation would help the learner profile: {profile}.
Use only facts from the lesson. Return strict JSON with exactly these keys: should_visualize, visual_type, title, description, why_helpful, nodes, edges, labels, data.
visual_type must be flowchart, timeline, process, graph, concept_map, or none. nodes are short labels. edges are [from_index, to_index] pairs. labels match edges. data is only for graph visuals and contains label/value objects.

LESSON:
{lesson}"""

REQUIRED_KEYS = {"should_visualize", "visual_type", "title", "description", "why_helpful", "nodes", "edges", "labels", "data"}
VALID_TYPES = {"flowchart", "timeline", "process", "graph", "concept_map", "none"}


def _fallback_visual_spec(lesson_text: str) -> Dict[str, Any]:
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", lesson_text) if part.strip()]
    nodes = [" ".join(textwrap.wrap(sentence, 24)) for sentence in sentences[:5]]
    return {
        "should_visualize": bool(nodes),
        "visual_type": "flowchart" if nodes else "none",
        "title": "Lesson sequence",
        "description": "Key lesson ideas in order.",
        "why_helpful": "A sequence makes relationships between the main ideas easier to follow.",
        "nodes": nodes,
        "edges": [[index, index + 1] for index in range(max(0, len(nodes) - 1))],
        "labels": [""] * max(0, len(nodes) - 1),
        "data": [],
    }


def generate_visual_spec(lesson_text: str, profile: str) -> Dict[str, Any]:
    """Generate and validate an educational visual specification."""
    try:
        spec = parse_json_response(call_visual_llm(VISUAL_SPEC_PROMPT.format(profile=profile, lesson=lesson_text[:6000])))
    except Exception:
        spec = _fallback_visual_spec(lesson_text)
    if not isinstance(spec, dict) or not REQUIRED_KEYS.issubset(spec) or spec["visual_type"] not in VALID_TYPES:
        return {"error": "The visual response was not valid JSON."}
    node_count = len(spec.get("nodes", []))
    for edge in spec.get("edges", []):
        if not (isinstance(edge, list) and len(edge) == 2 and all(isinstance(index, int) and 0 <= index < node_count for index in edge)):
            return {"error": f"Invalid visual edge: {edge}"}
    return spec


def _fig_to_base64(fig) -> str:
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", bbox_inches="tight", dpi=130)
    plt.close(fig)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def render_visual_spec(spec: Dict[str, Any], profile: str) -> Optional[str]:
    """Render a visual specification as a base64-encoded PNG."""
    if "error" in spec or not spec.get("should_visualize"):
        return None
    if spec.get("visual_type") == "graph" and spec.get("data"):
        labels = [item.get("label", "") for item in spec["data"]]
        values = [float(item.get("value", 0)) for item in spec["data"]]
        fig, axis = plt.subplots(figsize=(10, 5))
        axis.bar(labels, values, color="#93c5fd", edgecolor="#1d4ed8", linewidth=2)
        axis.set_title(spec.get("title", ""), fontsize=16, fontweight="bold")
        axis.tick_params(labelsize=12)
        return _fig_to_base64(fig)

    nodes = spec.get("nodes", [])
    if not nodes:
        return None
    fig, axis = plt.subplots(figsize=(10, max(4, len(nodes) * 1.1)))
    axis.set_xlim(0, 1)
    axis.set_ylim(0, 1)
    axis.axis("off")
    box_width = 0.64
    box_height = min(0.12, 0.78 / len(nodes))
    gap = (1 - box_height * len(nodes)) / (len(nodes) + 1)
    centers = []
    for index, node in enumerate(nodes):
        center = (0.5, 1 - gap - index * (box_height + gap) - box_height / 2)
        centers.append(center)
        box = patches.FancyBboxPatch(
            (center[0] - box_width / 2, center[1] - box_height / 2),
            box_width, box_height, boxstyle="round,pad=0.02",
            facecolor="#dcfce7", edgecolor="#166534", linewidth=2,
        )
        axis.add_patch(box)
        axis.text(center[0], center[1], node, ha="center", va="center", fontsize=12, fontweight="bold")
    for first, second in spec.get("edges", []):
        x0, y0 = centers[first]
        x1, y1 = centers[second]
        axis.annotate("", xy=(x1, y1 + box_height / 2), xytext=(x0, y0 - box_height / 2),
                      arrowprops={"arrowstyle": "->", "color": "#166534", "lw": 2})
    axis.set_title(spec.get("title", ""), fontsize=16, fontweight="bold", pad=10)
    return _fig_to_base64(fig)
