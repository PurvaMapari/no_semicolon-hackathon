"""
PRISM Visual Learning — backend renderer.

Architecture:
  1. generate_visual_spec()   → asks Groq for a structured JSON spec
  2. render_visual_spec()     → converts spec → SVG/HTML string (primary)
                                falls back to matplotlib PNG for bar/line charts only
  3. render_full_visual_card() → returns the complete card payload consumed by the frontend
"""
from __future__ import annotations

import base64
import html as _html
import io
import json
import math
import re
import textwrap
from typing import Any, Dict, List, Optional, Tuple

from app.services.llm import call_visual_llm, parse_json_response


# ──────────────────────────────────────────────────────────────────────────────
# PROMPT
# ──────────────────────────────────────────────────────────────────────────────
VISUAL_SPEC_PROMPT = """\
You are PRISM, an expert educational visual planner embedded in an adaptive learning platform.

Your job: analyse the lesson below and choose the SINGLE best visual representation that will
help a learner understand the KEY educational concept. Think about the STRUCTURE of the content
first — then pick the matching visual type.

PROFILE: {profile}
Profile constraints:
  dyslexia       → short labels (≤4 words), generous spacing, max 6 nodes, no dense text
  cognitive_load → step-by-step, max 5 nodes, one idea per node, clear primary path
  low_vision     → large labels, thick connectors, strong contrast, max 7 nodes

VISUAL TYPE SELECTION RULES:
  flowchart   → content describes a decision path or branching logic
  process     → content describes a sequence of stages/steps (A→B→C, no branching)
  cycle       → content describes a repeating loop (A→B→C→A)
  timeline    → content has ordered events with dates or time markers
  concept_map → content has one central idea that connects to several sub-concepts
  cause_effect→ content describes causes that produce effects (left side / right side)
  comparison  → content contrasts two or more things on the same dimensions
  hierarchy   → content describes a parent → children classification or taxonomy
  bar_chart   → content contains REAL numerical data worth comparing visually
  none        → content is purely abstract, definitional, or already clear as text

SEMANTIC NODE TYPES (assign to each node based on its meaning in the lesson):
  input       → starting materials, resources fed into a process (blue)
  resource    → materials, tools, requirements (blue)
  energy      → energy sources, power, fuel (yellow/orange)
  light       → light, sunlight, illumination (yellow)
  biological  → living things, organisms, life processes (green)
  natural     → nature, plants, ecosystems (green)
  process     → transformations, actions, operations (purple)
  action      → verbs, doing, execution (purple)
  output      → end products, results, what comes out (teal)
  result      → outcomes, effects, what happens (teal)
  conclusion  → key findings, important endpoints (orange)
  important   → critical concepts, emphasis (orange)
  warning     → dangers, risks, limitations (red - use sparingly!)
  limitation  → constraints, restrictions (red - use sparingly!)
  default     → neutral concepts (indigo)

Return STRICT JSON only. No markdown fences. No extra keys. Exactly this structure:
{{
  "should_visualize": true,
  "visual_type": "process",
  "title": "Short title (max 6 words)",
  "subtitle": "One supporting phrase",
  "central_concept": "Only for concept_map — the hub label",
  "explanation": "2-3 sentences that explain the concept in plain language. Grounded ONLY in the lesson.",
  "key_takeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],
  "why_visual": "1-sentence reason this visual type helps.",
  "nodes": [
    {{
      "id": "n1", 
      "label": "Short label", 
      "description": "Optional 1-sentence detail",
      "semantic_type": "input",
      "icon": "☀️"
    }},
    {{
      "id": "n2", 
      "label": "Short label", 
      "description": "",
      "semantic_type": "process",
      "icon": ""
    }}
  ],
  "connections": [
    {{"from": "n1", "to": "n2", "label": ""}}
  ],
  "data": []
}}

RULES:
- visual_type must be one of: flowchart, process, cycle, timeline, concept_map,
  cause_effect, comparison, hierarchy, bar_chart, none.
- If visual_type is "none", set should_visualize to false; nodes/connections/data may be [].
- nodes: each must have:
  * id (string)
  * label (string ≤ 6 words)
  * description (string, may be "")
  * semantic_type (one of the types above, or "default")
  * icon (emoji that represents the concept, or "" to use semantic_type default)
- Assign semantic_types based on the MEANING/ROLE of each node in the educational concept
- For photosynthesis example: "Sunlight" → light/energy, "Water" → input/resource, 
  "Photosynthesis" → process/biological, "Glucose" → output/result, "Oxygen" → output
- connections: from/to reference node ids. label is a short relationship word ("causes", "leads to", etc.) or "".
- data: for bar_chart ONLY — array of {{"label": str, "value": number}}. Use REAL values from lesson ONLY.
  For all other types, data MUST be [].
- key_takeaways: exactly 2-4 short bullet strings.
- explanation: plain language, 2-3 sentences, ONLY facts from the lesson.
- Do NOT invent facts, dates, numbers, or relationships not in the lesson.
- Keep node labels ≤ 6 words. For dyslexia/cognitive_load profiles ≤ 4 words.
- Use icons creatively but appropriately: ☀️💧🌿⚙️🍬💨⚡🔬📊🎯⭐ etc.

LESSON (first 6000 chars):
{lesson}
"""

REQUIRED_KEYS = {
    "should_visualize", "visual_type", "title", "subtitle",
    "central_concept", "explanation", "key_takeaways", "why_visual",
    "nodes", "connections", "data",
}
VALID_TYPES = {
    "flowchart", "process", "cycle", "timeline", "concept_map",
    "cause_effect", "comparison", "hierarchy", "bar_chart", "none",
}


# ──────────────────────────────────────────────────────────────────────────────
# SEMANTIC COLOR SYSTEM & ICONS
# ──────────────────────────────────────────────────────────────────────────────
SEMANTIC_COLORS = {
    "input": {"fill": "#DBEAFE", "stroke": "#1E40AF", "text": "#1E3A8A"},       # Blue
    "resource": {"fill": "#DBEAFE", "stroke": "#2563EB", "text": "#1E3A8A"},
    "energy": {"fill": "#FEF3C7", "stroke": "#D97706", "text": "#78350F"},      # Yellow/Orange
    "light": {"fill": "#FEF3C7", "stroke": "#F59E0B", "text": "#78350F"},
    "biological": {"fill": "#D1FAE5", "stroke": "#059669", "text": "#064E3B"},  # Green
    "natural": {"fill": "#D1FAE5", "stroke": "#10B981", "text": "#064E3B"},
    "process": {"fill": "#E9D5FF", "stroke": "#7C3AED", "text": "#581C87"},     # Purple
    "action": {"fill": "#E9D5FF", "stroke": "#8B5CF6", "text": "#581C87"},
    "output": {"fill": "#CCFBF1", "stroke": "#0D9488", "text": "#134E4A"},      # Teal
    "result": {"fill": "#CCFBF1", "stroke": "#14B8A6", "text": "#134E4A"},
    "conclusion": {"fill": "#FED7AA", "stroke": "#EA580C", "text": "#7C2D12"},  # Orange
    "important": {"fill": "#FED7AA", "stroke": "#F97316", "text": "#7C2D12"},
    "warning": {"fill": "#FEE2E2", "stroke": "#DC2626", "text": "#7F1D1D"},     # Red
    "limitation": {"fill": "#FEE2E2", "stroke": "#EF4444", "text": "#7F1D1D"},
    "default": {"fill": "#E0E7FF", "stroke": "#6366F1", "text": "#312E81"},     # Indigo (neutral)
}

SEMANTIC_ICONS = {
    "input": "⬇",
    "resource": "📦",
    "energy": "⚡",
    "light": "☀️",
    "biological": "🌿",
    "natural": "🌱",
    "process": "⚙️",
    "action": "▶️",
    "output": "⬆",
    "result": "✓",
    "conclusion": "🎯",
    "important": "⭐",
    "warning": "⚠️",
    "limitation": "⛔",
    "default": "•",
}


def _get_node_style(semantic_type: str, profile: str) -> Dict[str, str]:
    """Returns fill, stroke, text colors for a semantic node type with profile adjustments."""
    colors = SEMANTIC_COLORS.get(semantic_type, SEMANTIC_COLORS["default"])
    
    # Profile adjustments for contrast/accessibility
    if profile == "low_vision":
        # Increase contrast
        return {
            "fill": colors["fill"],
            "stroke": colors["stroke"],
            "text": "#000000",  # Pure black for maximum contrast
            "stroke_width": "3.5",
        }
    elif profile == "dyslexia":
        return {
            "fill": colors["fill"],
            "stroke": colors["stroke"],
            "text": colors["text"],
            "stroke_width": "2.5",
        }
    else:  # cognitive_load
        return {
            "fill": colors["fill"],
            "stroke": colors["stroke"],
            "text": colors["text"],
            "stroke_width": "2",
        }


def _get_icon(semantic_type: str) -> str:
    """Returns emoji icon for semantic type."""
    return SEMANTIC_ICONS.get(semantic_type, SEMANTIC_ICONS["default"])


# ──────────────────────────────────────────────────────────────────────────────
# PROFILE TOKENS (base styling)
# ──────────────────────────────────────────────────────────────────────────────
def _palette(profile: str) -> Dict[str, str]:
    if profile == "dyslexia":
        return {
            "bg": "#FAFBFF",
            "arrow": "#6366F1",
            "text": "#1E1B4B",
            "accent": "#7C3AED",
            "label_size": "13",
            "node_rx": "10",
            "lw": "2.5",
        }
    if profile == "low_vision":
        return {
            "bg": "#FFFEF7",
            "arrow": "#92400E",
            "text": "#000000",
            "accent": "#B45309",
            "label_size": "16",
            "node_rx": "12",
            "lw": "3.5",
        }
    # cognitive_load (default)
    return {
        "bg": "#FDFFFE",
        "arrow": "#059669",
        "text": "#14532D",
        "accent": "#059669",
        "label_size": "13",
        "node_rx": "10",
        "lw": "2",
    }


# ──────────────────────────────────────────────────────────────────────────────
# SMALL SVG HELPERS
# ──────────────────────────────────────────────────────────────────────────────
def _esc(s: str) -> str:
    return _html.escape(str(s), quote=True)


def _wrap(text: str, width: int = 18) -> List[str]:
    return textwrap.wrap(str(text), width=width) or [str(text)]


def _svg_node(cx: float, cy: float, w: float, h: float,
              label: str, desc: str, p: Dict, node_id: str,
              shape: str = "rect", semantic_type: str = "default",
              icon: str = "", step_num: int = 0) -> str:
    """
    Render a colorful semantic educational node.
    
    Args:
        semantic_type: node semantic category (input, process, output, etc.)
        icon: emoji icon to display
        step_num: if > 0, show a step number badge
    """
    style = _get_node_style(semantic_type, p.get("_profile", "cognitive_load"))
    lines = _wrap(label, 16)
    line_h = int(p["label_size"]) + 4
    total_text_h = len(lines) * line_h
    
    # Icon placement above text
    icon_size = 24
    icon_y = cy - h / 2 + 18
    ty = cy - total_text_h / 2 + line_h * 0.7 + (12 if icon else 0)

    if shape == "diamond":
        pts = f"{cx},{cy - h / 2} {cx + w / 2},{cy} {cx},{cy + h / 2} {cx - w / 2},{cy}"
        shape_svg = (
            f'<polygon points="{pts}" fill="{style["fill"]}" '
            f'stroke="{style["stroke"]}" stroke-width="{style["stroke_width"]}" />'
        )
    elif shape == "ellipse":
        shape_svg = (
            f'<ellipse cx="{cx}" cy="{cy}" rx="{w / 2}" ry="{h / 2}" '
            f'fill="{style["fill"]}" stroke="{style["stroke"]}" stroke-width="{style["stroke_width"]}" />'
        )
    else:
        shape_svg = (
            f'<rect x="{cx - w / 2}" y="{cy - h / 2}" width="{w}" height="{h}" '
            f'rx="{p["node_rx"]}" fill="{style["fill"]}" '
            f'stroke="{style["stroke"]}" stroke-width="{style["stroke_width"]}" />'
        )

    # Icon
    icon_svg = ""
    if icon:
        icon_svg = (
            f'<text x="{cx}" y="{icon_y}" text-anchor="middle" '
            f'font-size="{icon_size}" dominant-baseline="middle">{_esc(icon)}</text>'
        )
    
    # Step badge (circular badge at top-left corner)
    step_svg = ""
    if step_num > 0:
        badge_x = cx - w / 2 + 16
        badge_y = cy - h / 2 + 16
        step_svg = (
            f'<circle cx="{badge_x}" cy="{badge_y}" r="14" '
            f'fill="{style["stroke"]}" />'
            f'<text x="{badge_x}" y="{badge_y + 5}" text-anchor="middle" '
            f'font-size="12" font-weight="700" fill="white" '
            f'font-family="Inter,system-ui,sans-serif">{step_num}</text>'
        )

    text_lines = "".join(
        f'<tspan x="{cx}" dy="{0 if i == 0 else line_h}">{_esc(ln)}</tspan>'
        for i, ln in enumerate(lines)
    )
    tooltip = f'<title>{_esc(desc or label)}</title>' if desc else ""

    return (
        f'<g class="prism-node" data-id="{_esc(node_id)}" '
        f'data-desc="{_esc(desc or "")}" style="cursor:pointer;">'
        f'{tooltip}{shape_svg}{icon_svg}{step_svg}'
        f'<text x="{cx}" y="{ty}" text-anchor="middle" '
        f'font-size="{p["label_size"]}" font-weight="600" fill="{style["text"]}" '
        f'font-family="Inter,system-ui,sans-serif">{text_lines}</text>'
        f'</g>'
    )


def _arrow(x1: float, y1: float, x2: float, y2: float,
           label: str, p: Dict, marker_id: str) -> str:
    mid_x, mid_y = (x1 + x2) / 2, (y1 + y2) / 2
    lbl_svg = ""
    if label:
        lbl_svg = (
            f'<rect x="{mid_x - 28}" y="{mid_y - 10}" width="56" height="18" '
            f'rx="4" fill="white" opacity="0.85"/>'
            f'<text x="{mid_x}" y="{mid_y + 4}" text-anchor="middle" '
            f'font-size="10" fill="{p["accent"]}" '
            f'font-family="Inter,Arial,sans-serif" font-style="italic">{_esc(label)}</text>'
        )
    return (
        f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
        f'stroke="{p["arrow"]}" stroke-width="{p["lw"]}" '
        f'marker-end="url(#{marker_id})" />'
        + lbl_svg
    )


def _marker_defs(p: Dict, marker_id: str) -> str:
    return (
        f'<defs><marker id="{marker_id}" markerWidth="10" markerHeight="7" '
        f'refX="9" refY="3.5" orient="auto">'
        f'<polygon points="0 0, 10 3.5, 0 7" fill="{p["arrow"]}" /></marker></defs>'
    )


def _svg_wrap(content: str, w: int, h: int, p: Dict) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
        f'width="100%" style="max-width:{w}px;background:{p["bg"]};'
        f'border-radius:14px;display:block;">'
        + content
        + "</svg>"
    )


# ──────────────────────────────────────────────────────────────────────────────
# RENDERER  1 — PROCESS / FLOWCHART  (vertical linear chain with colorful nodes)
# ──────────────────────────────────────────────────────────────────────────────
def _render_process(spec: Dict, profile: str) -> str:
    nodes = spec["nodes"]
    conns = spec["connections"]
    p = _palette(profile)
    p["_profile"] = profile  # Pass profile to style functions
    n = len(nodes)
    if n == 0:
        return ""

    NW, NH = 240, 80  # Larger, more spacious nodes
    GAP = 56
    PAD = 50
    W = 380
    H = PAD * 2 + n * NH + (n - 1) * GAP
    mid = W / 2
    marker = "arr_proc"

    parts: List[str] = [_marker_defs(p, marker)]
    id_to_pos: Dict[str, Tuple[float, float]] = {}

    for i, node in enumerate(nodes):
        cy = PAD + i * (NH + GAP) + NH / 2
        id_to_pos[node["id"]] = (mid, cy)

        semantic_type = node.get("semantic_type", "default")
        icon = _get_icon(semantic_type) if semantic_type != "default" else node.get("icon", "")
        
        parts.append(_svg_node(
            mid, cy, NW, NH, 
            node["label"], 
            node.get("description", ""), 
            p, 
            node["id"],
            semantic_type=semantic_type,
            icon=icon,
            step_num=i + 1
        ))

    # draw arrows via connections, falling back to sequential
    drawn: set = set()
    for conn in conns:
        frm, to = conn.get("from"), conn.get("to")
        if frm in id_to_pos and to in id_to_pos:
            fx, fy = id_to_pos[frm]
            tx, ty = id_to_pos[to]
            parts.append(_arrow(fx, fy + NH / 2, tx, ty - NH / 2, conn.get("label", ""), p, marker))
            drawn.add((frm, to))

    if not drawn:
        ids = [nd["id"] for nd in nodes]
        for i in range(len(ids) - 1):
            fx, fy = id_to_pos[ids[i]]
            tx, ty = id_to_pos[ids[i + 1]]
            parts.append(_arrow(fx, fy + NH / 2, tx, ty - NH / 2, "", p, marker))

    return _svg_wrap("".join(parts), W, H, p)


# ──────────────────────────────────────────────────────────────────────────────
# RENDERER  2 — CYCLE  (nodes arranged in a circle with colorful semantic nodes)
# ──────────────────────────────────────────────────────────────────────────────
def _render_cycle(spec: Dict, profile: str) -> str:
    nodes = spec["nodes"]
    p = _palette(profile)
    p["_profile"] = profile
    n = len(nodes)
    if n == 0:
        return ""

    W, H = 480, 480
    CX, CY = 240, 240
    R = 165
    NW, NH = 160, 70  # Larger nodes
    marker = "arr_cycle"

    parts: List[str] = [_marker_defs(p, marker)]
    positions: List[Tuple[float, float]] = []
    for i in range(n):
        angle = 2 * math.pi * i / n - math.pi / 2
        positions.append((CX + R * math.cos(angle), CY + R * math.sin(angle)))

    for i, (node, (px, py)) in enumerate(zip(nodes, positions)):
        semantic_type = node.get("semantic_type", "default")
        icon = _get_icon(semantic_type) if semantic_type != "default" else node.get("icon", "")
        parts.append(_svg_node(
            px, py, NW, NH, 
            node["label"], 
            node.get("description", ""), 
            p, 
            node["id"], 
            "ellipse",
            semantic_type=semantic_type,
            icon=icon
        ))

    for i in range(n):
        fx, fy = positions[i]
        tx, ty = positions[(i + 1) % n]
        dx, dy = tx - fx, ty - fy
        dist = math.hypot(dx, dy) or 1
        sx = fx + dx / dist * NW / 2
        sy = fy + dy / dist * NH / 2
        ex = tx - dx / dist * NW / 2
        ey = ty - dy / dist * NH / 2
        parts.append(_arrow(sx, sy, ex, ey, "", p, marker))

    # centre label
    parts.append(
        f'<text x="{CX}" y="{CY + 6}" text-anchor="middle" '
        f'font-size="13" font-weight="700" fill="{p["accent"]}" '
        f'font-family="Inter,Arial,sans-serif">CYCLE</text>'
    )
    return _svg_wrap("".join(parts), W, H, p)


# ──────────────────────────────────────────────────────────────────────────────
# RENDERER  3 — TIMELINE  (horizontal with dots and labels)
# ──────────────────────────────────────────────────────────────────────────────
def _render_timeline(spec: Dict, profile: str) -> str:
    nodes = spec["nodes"]
    p = _palette(profile)
    n = len(nodes)
    if n == 0:
        return ""

    PAD = 40
    W = max(480, 80 * n + PAD * 2)
    H = 200
    CY = 90
    DOT_R = 10
    marker = "arr_tl"

    step = (W - PAD * 2) / max(n - 1, 1)
    positions = [PAD + i * step for i in range(n)]

    parts: List[str] = [_marker_defs(p, marker)]
    # baseline
    parts.append(
        f'<line x1="{PAD}" y1="{CY}" x2="{W - PAD}" y2="{CY}" '
        f'stroke="{p["arrow"]}" stroke-width="{p["lw"]}" '
        f'marker-end="url(#{marker})" />'
    )

    for i, (node, px) in enumerate(zip(nodes, positions)):
        # dot
        parts.append(
            f'<circle cx="{px}" cy="{CY}" r="{DOT_R}" '
            f'fill="{p["node_stroke"]}" stroke="{p["bg"]}" stroke-width="2" />'
            f'<text x="{px}" y="{CY - DOT_R - 6}" text-anchor="middle" '
            f'font-size="{p["label_size"]}" font-weight="700" fill="{p["text"]}" '
            f'font-family="Inter,Arial,sans-serif">{_esc(node["label"])}</text>'
        )
        # description below line (alternating)
        if node.get("description"):
            desc_y = CY + DOT_R + 20 + (0 if i % 2 == 0 else 18)
            for j, ln in enumerate(_wrap(node["description"], 14)):
                parts.append(
                    f'<text x="{px}" y="{desc_y + j * 14}" text-anchor="middle" '
                    f'font-size="10" fill="{p["accent"]}" '
                    f'font-family="Inter,Arial,sans-serif">{_esc(ln)}</text>'
                )

    return _svg_wrap("".join(parts), W, H, p)


# ──────────────────────────────────────────────────────────────────────────────
# RENDERER  4 — CONCEPT MAP  (hub and spokes)
# ──────────────────────────────────────────────────────────────────────────────
# RENDERER  4 — CONCEPT MAP  (hub and spokes with semantic colors)
# ──────────────────────────────────────────────────────────────────────────────
def _render_concept_map(spec: Dict, profile: str) -> str:
    nodes = spec["nodes"]
    conns = spec["connections"]
    p = _palette(profile)
    p["_profile"] = profile
    n = len(nodes)
    if n == 0:
        return ""

    W, H = 580, 480
    CX, CY = 290, 240
    HUB_W, HUB_H = 180, 70
    SPOKE_W, SPOKE_H = 150, 64
    R = 180
    marker = "arr_cm"

    # find hub — first node if no central_concept match, else match by label
    central = spec.get("central_concept", "")
    hub_idx = 0
    if central:
        for i, nd in enumerate(nodes):
            if nd["label"].lower() in central.lower() or central.lower() in nd["label"].lower():
                hub_idx = i
                break

    hub = nodes[hub_idx]
    spokes = [nd for i, nd in enumerate(nodes) if i != hub_idx]
    ns = len(spokes)

    parts: List[str] = [_marker_defs(p, marker)]

    # Hub node (central concept) — use semantic styling
    hub_semantic = hub.get("semantic_type", "important")
    hub_icon = _get_icon(hub_semantic) if hub_semantic != "default" else hub.get("icon", "")
    parts.append(_svg_node(CX, CY, HUB_W, HUB_H,
                           hub["label"], hub.get("description", ""),
                           p, hub["id"],
                           semantic_type=hub_semantic,
                           icon=hub_icon))

    spoke_positions: List[Tuple[float, float]] = []
    for i in range(ns):
        angle = 2 * math.pi * i / max(ns, 1) - math.pi / 2
        sx = CX + R * math.cos(angle)
        sy = CY + R * math.sin(angle)
        spoke_positions.append((sx, sy))

        # arrow from hub edge to spoke
        dx, dy = sx - CX, sy - CY
        dist = math.hypot(dx, dy) or 1
        conn_lbl = ""
        for c in conns:
            if c.get("from") == hub["id"] and c.get("to") == spokes[i]["id"]:
                conn_lbl = c.get("label", "")
        parts.append(_arrow(
            CX + dx / dist * HUB_W / 2, CY + dy / dist * HUB_H / 2,
            sx - dx / dist * SPOKE_W / 2, sy - dy / dist * SPOKE_H / 2,
            conn_lbl, p, marker,
        ))
        
        spoke_semantic = spokes[i].get("semantic_type", "default")
        spoke_icon = _get_icon(spoke_semantic) if spoke_semantic != "default" else spokes[i].get("icon", "")
        parts.append(_svg_node(sx, sy, SPOKE_W, SPOKE_H,
                               spokes[i]["label"], spokes[i].get("description", ""),
                               p, spokes[i]["id"],
                               semantic_type=spoke_semantic,
                               icon=spoke_icon))

    # spoke-to-spoke connections
    spoke_id_to_pos = {spokes[i]["id"]: spoke_positions[i] for i in range(ns)}
    for c in conns:
        frm, to = c.get("from"), c.get("to")
        if frm in spoke_id_to_pos and to in spoke_id_to_pos:
            fx, fy = spoke_id_to_pos[frm]
            tx, ty = spoke_id_to_pos[to]
            parts.append(_arrow(fx, fy, tx, ty, c.get("label", ""), p, marker))

    return _svg_wrap("".join(parts), W, H, p)


# ──────────────────────────────────────────────────────────────────────────────
# RENDERER  5 — CAUSE / EFFECT  (two-column layout with semantic colors)
# ──────────────────────────────────────────────────────────────────────────────
def _render_cause_effect(spec: Dict, profile: str) -> str:
    conns = spec["connections"]
    nodes = spec["nodes"]
    p = _palette(profile)
    p["_profile"] = profile
    if not nodes:
        return ""

    id_map = {nd["id"]: nd for nd in nodes}
    # split: causes are nodes that appear only as "from", effects only as "to"
    from_ids = {c["from"] for c in conns}
    to_ids   = {c["to"]   for c in conns}
    causes   = [nd for nd in nodes if nd["id"] in from_ids and nd["id"] not in to_ids]
    effects  = [nd for nd in nodes if nd["id"] in to_ids and nd["id"] not in from_ids]
    # fallback: first half causes, second half effects
    if not causes or not effects:
        mid = max(1, len(nodes) // 2)
        causes  = nodes[:mid]
        effects = nodes[mid:]

    NW, NH = 180, 64
    COLS_X = (100, 360)
    PAD_TOP = 70
    ROW_H = 80
    W = 520
    H = PAD_TOP * 2 + max(len(causes), len(effects)) * ROW_H
    marker = "arr_ce"

    parts: List[str] = [_marker_defs(p, marker)]

    # column headers with better styling
    for label, cx, color in [("CAUSES", COLS_X[0], "#DC2626"), ("EFFECTS", COLS_X[1], "#059669")]:
        parts.append(
            f'<text x="{cx}" y="32" text-anchor="middle" '
            f'font-size="12" font-weight="800" fill="{color}" '
            f'font-family="Inter,system-ui,sans-serif" letter-spacing="1.2">{label}</text>'
            f'<line x1="{cx - 60}" y1="42" x2="{cx + 60}" y2="42" '
            f'stroke="{color}" stroke-width="2.5" />'
        )

    c_pos: Dict[str, Tuple[float, float]] = {}
    e_pos: Dict[str, Tuple[float, float]] = {}

    for i, nd in enumerate(causes):
        cy = PAD_TOP + i * ROW_H + NH / 2
        c_pos[nd["id"]] = (COLS_X[0], cy)
        semantic_type = nd.get("semantic_type", "input")
        icon = _get_icon(semantic_type) if semantic_type != "default" else nd.get("icon", "")
        parts.append(_svg_node(COLS_X[0], cy, NW, NH, nd["label"], nd.get("description", ""), p, nd["id"],
                               semantic_type=semantic_type, icon=icon))

    for i, nd in enumerate(effects):
        cy = PAD_TOP + i * ROW_H + NH / 2
        e_pos[nd["id"]] = (COLS_X[1], cy)
        semantic_type = nd.get("semantic_type", "result")
        icon = _get_icon(semantic_type) if semantic_type != "default" else nd.get("icon", "")
        parts.append(_svg_node(COLS_X[1], cy, NW, NH, nd["label"], nd.get("description", ""), p, nd["id"],
                               semantic_type=semantic_type, icon=icon))

    # arrows — explicit connections first
    all_pos = {**c_pos, **e_pos}
    drawn: set = set()
    for c in conns:
        frm, to = c.get("from"), c.get("to")
        if frm in all_pos and to in all_pos:
            fx, fy = all_pos[frm]
            tx, ty = all_pos[to]
            parts.append(_arrow(fx + NW / 2, fy, tx - NW / 2, ty, c.get("label", ""), p, marker))
            drawn.add((frm, to))

    # fallback: zip causes → effects
    if not drawn:
        for ci, ei in zip(causes, effects):
            if ci["id"] in c_pos and ei["id"] in e_pos:
                fx, fy = c_pos[ci["id"]]
                tx, ty = e_pos[ei["id"]]
                parts.append(_arrow(fx + NW / 2, fy, tx - NW / 2, ty, "→", p, marker))

    return _svg_wrap("".join(parts), W, H, p)


# ──────────────────────────────────────────────────────────────────────────────
# RENDERER  6 — COMPARISON  (side-by-side cards)
# ──────────────────────────────────────────────────────────────────────────────
def _render_comparison(spec: Dict, profile: str) -> str:
    nodes = spec["nodes"]
    conns = spec["connections"]
    p = _palette(profile)
    p["_profile"] = profile
    if not nodes:
        return ""

    # group by connections: unconnected nodes become separate columns
    n = len(nodes)
    col_a = nodes[:math.ceil(n / 2)]
    col_b = nodes[math.ceil(n / 2):]

    NW, NH = 190, 68
    COL_X = (120, 370)
    PAD_TOP = 70
    ROW_H = 84
    W = 540
    H = PAD_TOP + max(len(col_a), len(col_b)) * ROW_H + 40
    marker = "arr_cmp"

    # derive column headers from connections label or first nodes
    headers = [col_a[0]["label"] if col_a else "A", col_b[0]["label"] if col_b else "B"]
    # prefer explicit labels from spec subtitle
    subtitle = spec.get("subtitle", "")
    if " vs " in subtitle.lower():
        parts_sub = re.split(r"\s+vs\.?\s+", subtitle, flags=re.IGNORECASE)
        if len(parts_sub) == 2:
            headers = [parts_sub[0].strip(), parts_sub[1].strip()]

    parts: List[str] = [_marker_defs(p, marker)]

    # column headers - colorful
    for hdr, cx, col in zip(headers, COL_X, ["#3B82F6", "#10B981"]):
        parts.append(
            f'<rect x="{cx - NW / 2}" y="12" width="{NW}" height="40" rx="10" fill="{col}" />'
            f'<text x="{cx}" y="38" text-anchor="middle" font-size="{int(p["label_size"]) + 2}" '
            f'font-weight="700" fill="white" font-family="Inter,system-ui,sans-serif">{_esc(hdr[:20])}</text>'
        )

    # VS divider
    mid = (COL_X[0] + COL_X[1]) / 2
    parts.append(
        f'<circle cx="{mid}" cy="32" r="20" fill="#F59E0B" />'
        f'<text x="{mid}" y="38" text-anchor="middle" font-size="14" '
        f'font-weight="900" fill="white" font-family="Inter,system-ui,sans-serif">VS</text>'
    )

    all_pos: Dict[str, Tuple[float, float]] = {}
    for col, cx in zip([col_a, col_b], COL_X):
        for i, nd in enumerate(col):
            cy = PAD_TOP + i * ROW_H + NH / 2
            all_pos[nd["id"]] = (cx, cy)
            semantic_type = nd.get("semantic_type", "default")
            icon = _get_icon(semantic_type) if semantic_type != "default" else nd.get("icon", "")
            parts.append(_svg_node(cx, cy, NW, NH, nd["label"], nd.get("description", ""), p, nd["id"],
                                   semantic_type=semantic_type, icon=icon))

    # horizontal connectors between matching rows
    for c in conns:
        frm, to = c.get("from"), c.get("to")
        if frm in all_pos and to in all_pos:
            fx, fy = all_pos[frm]
            tx, ty = all_pos[to]
            if abs(fy - ty) < 10:  # same row — horizontal dash
                parts.append(
                    f'<line x1="{fx + NW / 2}" y1="{fy}" x2="{tx - NW / 2}" y2="{ty}" '
                    f'stroke="{p["arrow"]}" stroke-width="2" stroke-dasharray="6 4" />'
                )

    return _svg_wrap("".join(parts), W, H, p)


# ──────────────────────────────────────────────────────────────────────────────
# RENDERER  7 — HIERARCHY  (top-down tree)
# ──────────────────────────────────────────────────────────────────────────────
# RENDERER  7 — HIERARCHY  (top-down tree with semantic colors)
# ──────────────────────────────────────────────────────────────────────────────
def _render_hierarchy(spec: Dict, profile: str) -> str:
    nodes = spec["nodes"]
    conns = spec["connections"]
    p = _palette(profile)
    p["_profile"] = profile
    if not nodes:
        return ""

    id_map = {nd["id"]: nd for nd in nodes}
    # Build parent→children map
    children: Dict[str, List[str]] = {nd["id"]: [] for nd in nodes}
    parents: Dict[str, List[str]]  = {nd["id"]: [] for nd in nodes}
    for c in conns:
        if c["from"] in children and c["to"] in children:
            children[c["from"]].append(c["to"])
            parents[c["to"]].append(c["from"])

    # Find root(s) — nodes with no parents
    roots = [nd["id"] for nd in nodes if not parents[nd["id"]]]
    if not roots:
        roots = [nodes[0]["id"]]

    NW, NH = 180, 64
    H_GAP = 90
    V_GAP = 70
    marker = "arr_hier"

    # BFS to assign levels
    levels: Dict[str, int] = {}
    queue = [(r, 0) for r in roots]
    visited: set = set()
    while queue:
        nid, lv = queue.pop(0)
        if nid in visited:
            continue
        visited.add(nid)
        levels[nid] = lv
        for ch in children[nid]:
            queue.append((ch, lv + 1))

    max_level = max(levels.values(), default=0)
    nodes_per_level: Dict[int, List[str]] = {}
    for nid, lv in levels.items():
        nodes_per_level.setdefault(lv, []).append(nid)

    max_count = max(len(v) for v in nodes_per_level.values())
    W = max(450, max_count * (NW + H_GAP) + H_GAP)
    H = (max_level + 1) * (NH + V_GAP) + V_GAP * 2

    positions: Dict[str, Tuple[float, float]] = {}
    for lv, nids in nodes_per_level.items():
        count = len(nids)
        total_w = count * NW + (count - 1) * H_GAP
        start_x = (W - total_w) / 2 + NW / 2
        y = V_GAP + lv * (NH + V_GAP) + NH / 2
        for i, nid in enumerate(nids):
            positions[nid] = (start_x + i * (NW + H_GAP), y)

    parts: List[str] = [_marker_defs(p, marker)]

    for c in conns:
        frm, to = c.get("from"), c.get("to")
        if frm in positions and to in positions:
            fx, fy = positions[frm]
            tx, ty = positions[to]
            parts.append(_arrow(fx, fy + NH / 2, tx, ty - NH / 2, c.get("label", ""), p, marker))

    for nid, (px, py) in positions.items():
        nd = id_map[nid]
        semantic_type = nd.get("semantic_type", "important" if nid in roots else "default")
        icon = _get_icon(semantic_type) if semantic_type != "default" else nd.get("icon", "")
        parts.append(_svg_node(px, py, NW, NH, nd["label"], nd.get("description", ""), p, nid,
                               semantic_type=semantic_type, icon=icon))

    return _svg_wrap("".join(parts), W, H, p)


# ──────────────────────────────────────────────────────────────────────────────
# RENDERER  8 — BAR CHART  (matplotlib — only for real numerical data)
# ──────────────────────────────────────────────────────────────────────────────
def _render_bar_chart(spec: Dict, profile: str) -> str:
    """Returns an SVG bar chart built with pure SVG (no matplotlib dependency here)."""
    data = spec.get("data", [])
    if not data:
        return ""
    p = _palette(profile)

    labels = [str(d.get("label", i)) for i, d in enumerate(data)]
    values = [float(d.get("value", 0)) for d in data]
    max_v = max(values) if values else 1
    n = len(labels)

    BAR_W = max(40, min(80, 340 // n))
    BAR_GAP = 14
    PAD_LEFT = 52
    PAD_BOTTOM = 52
    PAD_TOP = 24
    W = PAD_LEFT + n * (BAR_W + BAR_GAP) + BAR_GAP + 20
    CHART_H = 180
    H = PAD_TOP + CHART_H + PAD_BOTTOM

    parts: List[str] = []
    # axis lines
    parts.append(
        f'<line x1="{PAD_LEFT}" y1="{PAD_TOP}" x2="{PAD_LEFT}" y2="{PAD_TOP + CHART_H}" '
        f'stroke="{p["arrow"]}" stroke-width="1.5" />'
        f'<line x1="{PAD_LEFT}" y1="{PAD_TOP + CHART_H}" x2="{W - 10}" y2="{PAD_TOP + CHART_H}" '
        f'stroke="{p["arrow"]}" stroke-width="1.5" />'
    )

    # y-axis ticks (4 ticks)
    for tick_i in range(5):
        tick_v = max_v * tick_i / 4
        tick_y = PAD_TOP + CHART_H - (CHART_H * tick_i / 4)
        tick_lbl = f"{tick_v:.0f}" if tick_v == int(tick_v) else f"{tick_v:.1f}"
        parts.append(
            f'<line x1="{PAD_LEFT - 4}" y1="{tick_y}" x2="{PAD_LEFT}" y2="{tick_y}" '
            f'stroke="{p["arrow"]}" stroke-width="1" />'
            f'<text x="{PAD_LEFT - 7}" y="{tick_y + 4}" text-anchor="end" '
            f'font-size="9" fill="{p["text"]}" font-family="Inter,Arial,sans-serif">{tick_lbl}</text>'
            f'<line x1="{PAD_LEFT}" y1="{tick_y}" x2="{W - 10}" y2="{tick_y}" '
            f'stroke="{p["arrow"]}" stroke-width="0.4" stroke-dasharray="3 3" />'
        )

    bar_colours = [p["node_stroke"], p["accent"], p["node_stroke"], p["accent"]]

    for i, (lbl, val) in enumerate(zip(labels, values)):
        bx = PAD_LEFT + BAR_GAP + i * (BAR_W + BAR_GAP)
        bar_h = CHART_H * (val / max_v) if max_v else 0
        by = PAD_TOP + CHART_H - bar_h
        colour = bar_colours[i % len(bar_colours)]
        # bar
        parts.append(
            f'<rect x="{bx}" y="{by}" width="{BAR_W}" height="{bar_h}" '
            f'rx="4" fill="{colour}" opacity="0.85" />'
        )
        # value label on top of bar
        parts.append(
            f'<text x="{bx + BAR_W / 2}" y="{by - 4}" text-anchor="middle" '
            f'font-size="10" font-weight="700" fill="{p["text"]}" '
            f'font-family="Inter,Arial,sans-serif">{val:.0f}</text>'
        )
        # x-axis label
        for j, ll in enumerate(_wrap(lbl, 10)):
            parts.append(
                f'<text x="{bx + BAR_W / 2}" y="{PAD_TOP + CHART_H + 14 + j * 12}" '
                f'text-anchor="middle" font-size="10" fill="{p["text"]}" '
                f'font-family="Inter,Arial,sans-serif">{_esc(ll)}</text>'
            )

    return _svg_wrap("".join(parts), W, H, p)


# ──────────────────────────────────────────────────────────────────────────────
# RENDERER DISPATCHER
# ──────────────────────────────────────────────────────────────────────────────
def render_visual_spec(spec: Dict[str, Any], profile: str) -> Optional[str]:
    """
    Convert a validated visual spec into an SVG/HTML string.
    Returns None when no visual is needed or rendering fails.
    """
    if "error" in spec or not spec.get("should_visualize", False):
        return None
    vtype = spec.get("visual_type", "none")
    try:
        if vtype in ("process", "flowchart"):
            return _render_process(spec, profile)
        if vtype == "cycle":
            return _render_cycle(spec, profile)
        if vtype == "timeline":
            return _render_timeline(spec, profile)
        if vtype == "concept_map":
            return _render_concept_map(spec, profile)
        if vtype == "cause_effect":
            return _render_cause_effect(spec, profile)
        if vtype == "comparison":
            return _render_comparison(spec, profile)
        if vtype == "hierarchy":
            return _render_hierarchy(spec, profile)
        if vtype == "bar_chart":
            return _render_bar_chart(spec, profile)
    except Exception as exc:
        print(f"[render_visual_spec] rendering error for {vtype}: {exc}")
    return None


# ──────────────────────────────────────────────────────────────────────────────
# SPEC GENERATION + VALIDATION
# ──────────────────────────────────────────────────────────────────────────────
def _coerce_nodes(raw_nodes: Any) -> List[Dict[str, Any]]:
    """Accept both old-style string nodes and new-style dict nodes, preserving semantic metadata."""
    result: List[Dict[str, Any]] = []
    if not isinstance(raw_nodes, list):
        return result
    for item in raw_nodes:
        if isinstance(item, str):
            result.append({
                "id": f"n{len(result)}",
                "label": item,
                "description": "",
                "semantic_type": "default",
                "role": "concept",
                "icon": "",
                "group": "",
                "items": [],
            })
        elif isinstance(item, dict):
            result.append({
                "id":            str(item.get("id", f"n{len(result)}")),
                "label":         str(item.get("label", item.get("name", ""))),
                "description":   str(item.get("description", "")),
                "semantic_type": str(item.get("semantic_type", "default")),
                "role":          str(item.get("role", "concept")),
                "icon":          str(item.get("icon", "")),
                "group":         str(item.get("group", "")),
                "items":         item.get("items", []) if isinstance(item.get("items"), list) else [],
            })
    return result


def _coerce_connections(raw: Any, nodes: List[Dict]) -> List[Dict[str, str]]:
    """Accept old-style [int, int] edges and new-style {from, to, label} objects."""
    result: List[Dict[str, str]] = []
    if not isinstance(raw, list):
        return result
    id_list = [nd["id"] for nd in nodes]
    for item in raw:
        if isinstance(item, list) and len(item) == 2:
            try:
                fi, ti = int(item[0]), int(item[1])
                if 0 <= fi < len(id_list) and 0 <= ti < len(id_list):
                    result.append({"from": id_list[fi], "to": id_list[ti], "label": ""})
            except (ValueError, TypeError):
                pass
        elif isinstance(item, dict):
            lbl = str(item.get("label") or item.get("relationship") or item.get("verb") or "").strip()
            result.append({
                "from":  str(item.get("from", "")),
                "to":    str(item.get("to", "")),
                "label": lbl,
            })
    return result


def generate_visual_spec(lesson_text: str, profile: str) -> Dict[str, Any]:
    """
    Ask Groq to produce a visual specification for the lesson + profile.
    Returns a validated dict. Never raises — returns an {"error": "..."} dict on failure.
    """
    prompt = VISUAL_SPEC_PROMPT.format(profile=profile, lesson=lesson_text[:6000])
    try:
        raw = call_visual_llm(prompt)
        spec = parse_json_response(raw)
    except Exception as exc:
        return {"error": f"Visual LLM call failed: {exc}"}

    if not isinstance(spec, dict):
        return {"error": "Visual response was not a JSON object."}

    vtype = spec.get("visual_type", "none")
    if vtype not in VALID_TYPES:
        # try to recover if model returned an old type name
        type_map = {"graph": "bar_chart", "flowchart": "process"}
        vtype = type_map.get(vtype, "none")
        spec["visual_type"] = vtype

    # Normalise nodes and connections (tolerate old schema)
    spec["nodes"]       = _coerce_nodes(spec.get("nodes", []))
    spec["connections"] = _coerce_connections(
        spec.get("connections", spec.get("edges", [])), spec["nodes"]
    )

    # Fill any missing top-level keys with safe defaults
    spec.setdefault("should_visualize", vtype != "none")
    spec.setdefault("title",            "")
    spec.setdefault("subtitle",         "")
    spec.setdefault("central_concept",  "")
    spec.setdefault("explanation",      "")
    spec.setdefault("key_takeaways",    [])
    spec.setdefault("why_visual",       "")
    spec.setdefault("data",             [])

    # Ensure data is list of {label, value} for bar_chart
    if vtype == "bar_chart":
        clean_data = []
        for item in spec.get("data", []):
            if isinstance(item, dict) and "label" in item and "value" in item:
                try:
                    clean_data.append({"label": str(item["label"]), "value": float(item["value"])})
                except (TypeError, ValueError):
                    pass
        spec["data"] = clean_data
        if not clean_data:
            spec["visual_type"]      = "none"
            spec["should_visualize"] = False

    return spec


# ──────────────────────────────────────────────────────────────────────────────
# FULL VISUAL CARD  (used by /api/visual route)
# ──────────────────────────────────────────────────────────────────────────────
def render_full_visual_card(
    lesson_text: str,
    profile: str,
    source_images: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Returns a complete visual card payload:
      {
        "source":        "prism" | "pdf",
        "spec":          {...},
        "svg_html":      "<svg>...</svg>" | None,
        "source_images": [base64, ...],   # only when PDF images were found
        "explanation":   "...",
        "key_takeaways": [...],
        "why_visual":    "...",
        "title":         "...",
        "subtitle":      "...",
        "visual_type":   "...",
      }
    """
    has_source = bool(source_images)

    spec = generate_visual_spec(lesson_text, profile)
    svg_html = render_visual_spec(spec, profile) if spec.get("should_visualize") else None

    return {
        "source":        "pdf" if has_source else "prism",
        "spec":          spec,
        "svg_html":      svg_html,
        "source_images": source_images or [],
        "explanation":   spec.get("explanation", ""),
        "key_takeaways": spec.get("key_takeaways", []),
        "why_visual":    spec.get("why_visual", ""),
        "title":         spec.get("title", ""),
        "subtitle":      spec.get("subtitle", ""),
        "visual_type":   spec.get("visual_type", "none"),
        "error":         spec.get("error"),
    }


# ──────────────────────────────────────────────────────────────────────────────
# CONCEPT CLUSTERING & CLUSTER-LEVEL VISUALS
# ──────────────────────────────────────────────────────────────────────────────

_VISUAL_CLUSTER_CACHE: Dict[str, Dict[str, Any]] = {}

CLUSTER_SECTIONS_PROMPT = """\
You are an expert educational curriculum architect.
Analyze the sequential lesson sections below and group them into logical, contiguous concept clusters.

RULES:
- Every section must belong to exactly ONE cluster.
- Clusters must cover contiguous section index ranges from 0 to {max_index} with NO gaps and NO overlaps.
- Group based on semantic topic shifts, major subheadings, and prerequisite relationships.
- Do NOT group by an arbitrary number like 'every 10 sections'. A cluster may contain 3, 5, 8, 15, or more sections depending on coherent content.
- Typically 2 to 8 clusters total, matching the natural phases of the lesson.
- Provide a clear, educational title for each cluster (e.g. "OOP Foundations", "Encapsulation & Abstraction", "Inheritance & Polymorphism").
- Provide a short 1-sentence subtitle explaining what the cluster covers.

Return STRICT JSON only matching this schema:
{{
  "clusters": [
    {{
      "cluster_id": "c1",
      "title": "Topic Cluster Title",
      "subtitle": "One sentence describing this concept cluster",
      "start_index": 0,
      "end_index": 3,
      "rationale": "Brief reason for grouping"
    }}
  ]
}}

SECTIONS LIST:
{sections_summary}
"""

CLUSTER_VISUAL_SPEC_PROMPT = """\
You are PRISM, an expert educational visual architect embedded in an adaptive learning platform.

Your goal: Design ONE high-impact educational infographic diagram where the DIAGRAM ITSELF DIRECTLY TEACHES THE RELATIONSHIPS at a glance within 3–5 seconds.

Do NOT make a generic list or a uniform grid of cards. The visual must answer:
- "What is the central / main concept?"
- "How are the concepts connected?"
- "What leads to what / what depends on what / what implements what?"

CLUSTER: {cluster_title} ({covers_label})
CLUSTER FOCUS: {cluster_subtitle}
PROFILE: {profile}

PROFILE CONSTRAINTS:
  dyslexia       → concise node labels (≤4 words), clean visual spacing, max 6 nodes, high clarity
  cognitive_load → single clear flow or hierarchy, max 5 nodes, step-by-step logic
  low_vision     → bold high-contrast labels, strong directional indicators, max 6 nodes

VISUAL GRAMMAR SELECTION (Choose the most natural fit for this content):
  hierarchy   → Top-down conceptual hierarchy or contract/implementation pipeline:
                E.g.: ROOT CONCEPT (dominant) → [hides complexity] → INTERFACE/CONTRACT → [defines contract] → IMPLEMENTATIONS → [yields] → INTERCHANGEABLE CODE
  process     → Sequential pipeline (Stage 1 → [transforms] → Stage 2 → [produces] → Final Output)
  concept_map → Central dominant concept hub radiating to distinct dimensions/pillars with labeled outbound arrows
  cause_effect→ Causes/Triggers → [drives mechanism] → Direct Consequences/Outcomes
  comparison  → Side-by-side contrast between two opposing approaches or paradigms
  cycle       → Closed recurring loop (A → B → C → A)

CRITICAL DIAGRAM RULES:
  1. DOMINANT CENTRAL CONCEPT: Clearly identify the central/root concept in "central_concept". It should be the visually dominant focal point.
  2. DIRECTIONAL CONNECTOR LABELS: Every connection MUST have a short, informative relationship verb or phrase!
     Examples: "hides complexity", "defines contract", "implemented by", "leads to", "depends on", "contains", "encapsulates", "produces", "enables".
     Do NOT leave connector labels blank!
  3. COMPACT & FOCUSED: Keep node labels short (2 to 4 words max). Use 4 to 7 nodes total.

Return STRICT JSON only matching this schema:
{{
  "should_visualize": true,
  "visual_type": "hierarchy",
  "title": "Short descriptive title (max 6 words)",
  "subtitle": "Clear relationship summary phrase",
  "central_concept": "Label of the dominant core concept node",
  "explanation": "2-3 plain sentences explaining the diagram relationships. Grounded ONLY in the lesson.",
  "key_takeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],
  "why_visual": "1-sentence reason this diagram structure clarifies the concept.",
  "nodes": [
    {{
      "id": "n1",
      "label": "Short label",
      "description": "Optional 1-line note",
      "semantic_type": "process",
      "role": "root"
    }}
  ],
  "connections": [
    {{
      "from": "n1",
      "to": "n2",
      "label": "hides complexity"
    }}
  ],
  "data": []
}}

SECTIONS IN THIS CLUSTER:
{sections_text}
"""


def _heuristic_cluster_sections(sections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deterministic fallback: groups sections by natural heading patterns or ~4-7 section windows."""
    n = len(sections)
    if n == 0:
        return []
    if n <= 3:
        first_h = sections[0].get("heading") or "Lesson Concepts"
        first_h = re.sub(r"\s*\(Part\s*\d+\)$", "", first_h, flags=re.IGNORECASE).strip()
        return [{
            "cluster_id": "cluster_0",
            "title": first_h or "Lesson Overview",
            "subtitle": "Core concepts and overview",
            "start_section_index": 0,
            "end_section_index": n - 1,
            "covers_label": f"Sections 1–{n}" if n > 1 else "Section 1",
            "section_headings": [s.get("heading") or f"Section {i+1}" for i, s in enumerate(sections)],
            "rationale": "Single concept group for short lesson",
        }]

    # Target 2 to 8 clusters, each approx 3-8 sections depending on length
    target_cluster_size = max(3, min(8, math.ceil(n / 4)))
    clusters = []
    start = 0
    c_idx = 0
    while start < n:
        end = min(start + target_cluster_size - 1, n - 1)
        # If remaining sections after end is only 1 or 2, absorb them into current cluster
        if n - 1 - end <= 2:
            end = n - 1

        chunk_secs = sections[start : end + 1]
        first_heading = chunk_secs[0].get("heading") or f"Part {c_idx + 1}"
        clean_title = re.sub(r"^\d+[\.\)]\s*", "", first_heading)
        clean_title = re.sub(r"\s*\(Part\s*\d+\)$", "", clean_title, flags=re.IGNORECASE).strip() or f"Concept Phase {c_idx + 1}"

        covers = f"Sections {start+1}–{end+1}" if end > start else f"Section {start+1}"
        clusters.append({
            "cluster_id": f"cluster_{c_idx}",
            "title": clean_title,
            "subtitle": f"Key concepts across {covers.lower()}",
            "start_section_index": start,
            "end_section_index": end,
            "sections_count": end - start + 1,
            "covers_label": covers,
            "section_headings": [s.get("heading") or f"Section {start + j + 1}" for j, s in enumerate(chunk_secs)],
            "rationale": "Semantic boundary grouping",
        })
        c_idx += 1
        start = end + 1

    return clusters


def cluster_sections(
    sections: List[Dict[str, Any]],
    profile: str = "cognitive_load",
    doc_id: str = "",
) -> List[Dict[str, Any]]:
    """Group sections into 2-8 logical concept clusters."""
    if not sections:
        return []
    n = len(sections)
    if n <= 3:
        return _heuristic_cluster_sections(sections)

    # Prepare lightweight summary of sections for LLM (headings + first 80 chars)
    summary_lines = []
    for idx, s in enumerate(sections):
        h = s.get("heading") or f"Section {idx+1}"
        content = s.get("content") or s.get("paragraph") or ""
        gist = content[:90].replace("\n", " ").strip()
        summary_lines.append(f"[{idx}] {h} -- {gist}")

    sections_summary = "\n".join(summary_lines)
    prompt = CLUSTER_SECTIONS_PROMPT.format(max_index=n - 1, sections_summary=sections_summary)

    try:
        raw = call_visual_llm(prompt)
        parsed = parse_json_response(raw)
        raw_clusters = parsed.get("clusters") if isinstance(parsed, dict) else None
        if isinstance(raw_clusters, list) and len(raw_clusters) >= 2:
            validated: List[Dict[str, Any]] = []
            expected_start = 0
            for i, rc in enumerate(raw_clusters):
                s_idx = expected_start
                e_idx = int(rc.get("end_index", s_idx))
                if e_idx < s_idx:
                    e_idx = s_idx
                if i == len(raw_clusters) - 1 or e_idx >= n - 1:
                    e_idx = n - 1

                chunk_secs = sections[s_idx : e_idx + 1]
                covers = f"Sections {s_idx+1}–{e_idx+1}" if e_idx > s_idx else f"Section {s_idx+1}"
                title = str(rc.get("title") or f"Concept Cluster {i+1}").strip()
                subtitle = str(rc.get("subtitle") or "").strip()

                validated.append({
                    "cluster_id": f"cluster_{i}",
                    "title": title,
                    "subtitle": subtitle,
                    "start_section_index": s_idx,
                    "end_section_index": e_idx,
                    "sections_count": e_idx - s_idx + 1,
                    "covers_label": covers,
                    "section_headings": [s.get("heading") or f"Section {s_idx + j + 1}" for j, s in enumerate(chunk_secs)],
                    "rationale": str(rc.get("rationale", "")),
                })
                expected_start = e_idx + 1
                if expected_start >= n:
                    break

            if validated and validated[-1]["end_section_index"] == n - 1:
                return validated
    except Exception as exc:
        print(f"[cluster_sections] LLM clustering error: {exc}")

    return _heuristic_cluster_sections(sections)


def generate_cluster_visual_card(
    cluster: Dict[str, Any],
    all_sections: List[Dict[str, Any]],
    profile: str = "cognitive_load",
    doc_id: str = "",
) -> Dict[str, Any]:
    """Generate or retrieve cached visual card for a specific concept cluster."""
    cid = cluster.get("cluster_id", "cluster_0")
    cache_key = f"{doc_id}_{profile}_{cid}"
    if cache_key in _VISUAL_CLUSTER_CACHE:
        return _VISUAL_CLUSTER_CACHE[cache_key]

    s_start = int(cluster.get("start_section_index", 0))
    s_end = int(cluster.get("end_section_index", len(all_sections) - 1))
    cluster_sections = all_sections[s_start : s_end + 1]
    if not cluster_sections:
        cluster_sections = all_sections

    lines = []
    for idx, s in enumerate(cluster_sections, start=s_start + 1):
        h = s.get("heading") or f"Section {idx}"
        content = s.get("content") or s.get("paragraph") or ""
        lines.append(f"### Section {idx}: {h}\n{content[:350]}")
    sections_text = "\n\n".join(lines)

    prompt = CLUSTER_VISUAL_SPEC_PROMPT.format(
        cluster_title=cluster.get("title", "Concept Cluster"),
        cluster_subtitle=cluster.get("subtitle", ""),
        covers_label=cluster.get("covers_label", f"Sections {s_start+1}–{s_end+1}"),
        profile=profile,
        sections_text=sections_text,
    )

    try:
        raw = call_visual_llm(prompt)
        spec = parse_json_response(raw)
    except Exception as exc:
        spec = {"error": f"Visual planner error: {exc}"}

    if not isinstance(spec, dict):
        spec = {"error": "Visual response was not a JSON object."}

    vtype = spec.get("visual_type", "concept_map")
    if vtype not in VALID_TYPES:
        vtype = "concept_map"
        spec["visual_type"] = vtype

    spec["nodes"] = _coerce_nodes(spec.get("nodes", []))
    spec["connections"] = _coerce_connections(
        spec.get("connections", spec.get("edges", [])), spec["nodes"]
    )

    # Resilient fallback: if LLM failed or returned no nodes, construct relational spec from cluster headings
    if not spec.get("nodes") or len(spec["nodes"]) < 2:
        c_title = cluster.get("title", "Core Concept")
        headings = [s.get("heading") for s in cluster_sections if s.get("heading")]
        if not headings:
            headings = [f"Part {i+1}" for i in range(min(len(cluster_sections), 4))]
        
        fb_nodes = [{
            "id": "n0",
            "label": c_title,
            "description": f"Dominant concept governing {cluster.get('covers_label', 'these sections')}",
            "semantic_type": "core",
            "role": "root",
            "icon": "Layers",
            "group": "",
            "items": [],
        }]
        fb_conns = []
        for hi, h in enumerate(headings[:4], start=1):
            nid = f"n{hi}"
            fb_nodes.append({
                "id": nid,
                "label": h,
                "description": f"Key component in {cluster.get('covers_label', 'section')}",
                "semantic_type": "concept",
                "role": "concept",
                "icon": "Box",
                "group": "",
                "items": [],
            })
            fb_conns.append({
                "from": "n0",
                "to": nid,
                "label": "defines" if hi == 1 else "implements" if hi == 2 else "connects to",
            })
        spec["nodes"] = fb_nodes
        spec["connections"] = fb_conns
        spec["visual_type"] = cluster.get("suggested_visual_type") or "concept_map"
        spec["central_concept"] = c_title
        spec.pop("error", None)  # Cleared by resilient synthesis fallback
        if not spec.get("explanation"):
            spec["explanation"] = f"This concept visual organizes the core ideas of {c_title} across {cluster.get('covers_label', 'these sections')}."
        if not spec.get("key_takeaways"):
            spec["key_takeaways"] = [f"Synthesizes {len(cluster_sections)} lesson sections into a coherent concept model."]

    spec.setdefault("should_visualize", True)
    spec.setdefault("title", cluster.get("title", "Concept Model"))
    spec.setdefault("subtitle", cluster.get("subtitle", ""))
    spec.setdefault("central_concept", spec["nodes"][0]["label"] if spec["nodes"] else "")
    spec.setdefault("explanation", "")
    spec.setdefault("key_takeaways", [])
    spec.setdefault("why_visual", "")
    spec.setdefault("data", [])

    svg_html = render_visual_spec(spec, profile) if spec.get("should_visualize") else None

    covered = [
        {"index": s_start + i, "heading": s.get("heading") or f"Section {s_start + i + 1}"}
        for i, s in enumerate(cluster_sections)
    ]

    result = {
        "source": "prism",
        "cluster_id": cid,
        "title": spec.get("title") or cluster.get("title", ""),
        "subtitle": spec.get("subtitle") or cluster.get("subtitle", ""),
        "covers_label": cluster.get("covers_label", f"Sections {s_start+1}–{s_end+1}"),
        "start_section_index": s_start,
        "end_section_index": s_end,
        "sections_covered": covered,
        "visual_type": spec.get("visual_type", "concept_map"),
        "svg_html": svg_html,
        "explanation": spec.get("explanation", ""),
        "key_takeaways": spec.get("key_takeaways", []),
        "why_visual": spec.get("why_visual", ""),
        "spec": spec,
        "error": spec.get("error"),
    }

    if not spec.get("error"):
        _VISUAL_CLUSTER_CACHE[cache_key] = result

    return result
