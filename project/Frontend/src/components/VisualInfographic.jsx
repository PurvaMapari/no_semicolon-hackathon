import React, { useState } from "react";
import * as I from "lucide-react";
import "./VisualInfographic.css";

/**
 * Semantic Color Palettes for Educational Infographics
 */
/**
 * Semantic Color Palettes for Educational Infographics
 * Vibrant, modern, distinct color themes with rich gradients and crisp contrast
 */
const SEMANTIC_THEMES = {
  emerald: {
    bg: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
    border: "#16a34a",
    borderHover: "#15803d",
    text: "#14532d",
    subtext: "#166534",
    badgeBg: "#bbf7d0",
    badgeText: "#14532d",
    iconBg: "linear-gradient(135deg, #22c55e, #16a34a)",
    iconColor: "#ffffff",
    glow: "rgba(34, 197, 94, 0.25)",
  },
  amber: {
    bg: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
    border: "#f59e0b",
    borderHover: "#d97706",
    text: "#78350f",
    subtext: "#92400e",
    badgeBg: "#fde68a",
    badgeText: "#78350f",
    iconBg: "linear-gradient(135deg, #f59e0b, #d97706)",
    iconColor: "#ffffff",
    glow: "rgba(245, 158, 11, 0.25)",
  },
  cyan: {
    bg: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
    border: "#0284c7",
    borderHover: "#0369a1",
    text: "#0c4a6e",
    subtext: "#0369a1",
    badgeBg: "#bae6fd",
    badgeText: "#0c4a6e",
    iconBg: "linear-gradient(135deg, #0ea5e9, #0284c7)",
    iconColor: "#ffffff",
    glow: "rgba(14, 165, 233, 0.25)",
  },
  rose: {
    bg: "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)",
    border: "#f43f5e",
    borderHover: "#e11d48",
    text: "#881337",
    subtext: "#9f1239",
    badgeBg: "#fecdd3",
    badgeText: "#881337",
    iconBg: "linear-gradient(135deg, #fb7185, #f43f5e)",
    iconColor: "#ffffff",
    glow: "rgba(244, 63, 94, 0.25)",
  },
  purple: {
    bg: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)",
    border: "#a855f7",
    borderHover: "#9333ea",
    text: "#581c87",
    subtext: "#6b21a8",
    badgeBg: "#e9d5ff",
    badgeText: "#581c87",
    iconBg: "linear-gradient(135deg, #a855f7, #9333ea)",
    iconColor: "#ffffff",
    glow: "rgba(168, 85, 247, 0.25)",
  },
  indigo: {
    bg: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
    border: "#6366f1",
    borderHover: "#4f46e5",
    text: "#312e81",
    subtext: "#3730a3",
    badgeBg: "#c7d2fe",
    badgeText: "#312e81",
    iconBg: "linear-gradient(135deg, #6366f1, #4f46e5)",
    iconColor: "#ffffff",
    glow: "rgba(99, 102, 241, 0.25)",
  },
  teal: {
    bg: "linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)",
    border: "#0d9488",
    borderHover: "#0f766e",
    text: "#134e4a",
    subtext: "#115e59",
    badgeBg: "#99f6e4",
    badgeText: "#134e4a",
    iconBg: "linear-gradient(135deg, #14b8a6, #0d9488)",
    iconColor: "#ffffff",
    glow: "rgba(13, 148, 136, 0.25)",
  },
  orange: {
    bg: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
    border: "#ea580c",
    borderHover: "#c2410c",
    text: "#7c2d12",
    subtext: "#9a3412",
    badgeBg: "#fed7aa",
    badgeText: "#7c2d12",
    iconBg: "linear-gradient(135deg, #f97316, #ea580c)",
    iconColor: "#ffffff",
    glow: "rgba(234, 88, 12, 0.25)",
  },
  default: {
    bg: "linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)",
    border: "#0d9488",
    borderHover: "#0f766e",
    text: "#134e4a",
    subtext: "#115e59",
    badgeBg: "#99f6e4",
    badgeText: "#134e4a",
    iconBg: "linear-gradient(135deg, #14b8a6, #0d9488)",
    iconColor: "#ffffff",
    glow: "rgba(13, 148, 136, 0.25)",
  },
};

// Aliases for backwards compatibility with earlier semantic tags
SEMANTIC_THEMES.biological = SEMANTIC_THEMES.emerald;
SEMANTIC_THEMES.energy     = SEMANTIC_THEMES.amber;
SEMANTIC_THEMES.light      = SEMANTIC_THEMES.amber;
SEMANTIC_THEMES.water      = SEMANTIC_THEMES.cyan;
SEMANTIC_THEMES.gas        = SEMANTIC_THEMES.indigo;
SEMANTIC_THEMES.process    = SEMANTIC_THEMES.teal;
SEMANTIC_THEMES.product    = SEMANTIC_THEMES.purple;
SEMANTIC_THEMES.output     = SEMANTIC_THEMES.purple;
SEMANTIC_THEMES.cause      = SEMANTIC_THEMES.orange;
SEMANTIC_THEMES.effect     = SEMANTIC_THEMES.teal;

/**
 * Deterministic Fallback Pool for visually differentiating adjacent concepts
 */
const FALLBACK_PALETTES = [
  { theme: SEMANTIC_THEMES.emerald, icon: I.Leaf,         category: "Core Aspect" },
  { theme: SEMANTIC_THEMES.rose,    icon: I.FlaskConical, category: "Reaction" },
  { theme: SEMANTIC_THEMES.purple,  icon: I.Sparkles,     category: "Outcome" },
  { theme: SEMANTIC_THEMES.cyan,    icon: I.Component,    category: "Component" },
  { theme: SEMANTIC_THEMES.amber,   icon: I.Zap,          category: "Energy / Factor" },
  { theme: SEMANTIC_THEMES.teal,    icon: I.Layers,       category: "Role & Function" },
  { theme: SEMANTIC_THEMES.indigo,  icon: I.Cpu,          category: "Mechanism" },
];

/**
 * Semantic Visual Metadata with Lucide Icons (Zero Raw Emojis)
 */
const VTYPE_META = {
  process:      { icon: I.Settings,       label: "Process Diagram"   },
  flowchart:    { icon: I.GitFork,        label: "Flowchart"          },
  cycle:        { icon: I.RotateCw,       label: "Cycle Diagram"       },
  timeline:     { icon: I.Calendar,       label: "Timeline"           },
  concept_map:  { icon: I.MapPin,         label: "Concept Map"        },
  cause_effect: { icon: I.Zap,            label: "Cause & Effect"     },
  comparison:   { icon: I.Scale,          label: "Comparison"         },
  hierarchy:    { icon: I.GitBranch,      label: "Hierarchy"           },
  bar_chart:    { icon: I.BarChart3,      label: "Chart"              },
  none:         { icon: I.MessageSquare,  label: "Text Explanation"   },
};

/**
 * Resolves semantic icon, color theme, and category badge for a node
 * Accepts optional index for diverse fallback color rotation
 */
export function resolveNodeVisuals(node = {}, index = 0) {
  const label = (node.label || "").toLowerCase();
  const desc = (node.description || "").toLowerCase();
  const sem = (node.semantic_type || "").toLowerCase();
  const role = (node.role || "").toLowerCase();
  const combined = `${label} ${desc} ${sem} ${role}`;

  // 1. Biological & Botanical Concepts
  if (/photo|chloroplast|chlorophyll|plant|leaf|organism|cellular|biology|autotroph|thylakoid|stroma/i.test(combined)) {
    return { icon: I.Leaf, theme: SEMANTIC_THEMES.emerald, category: "Biological Process" };
  }

  // 2. Chemical Reactions & Formulas
  if (/reaction|chemical|equation|formula|reactant|react|catalyze|enzyme|synthesis|compound|molecular/i.test(combined)) {
    return { icon: I.FlaskConical, theme: SEMANTIC_THEMES.rose, category: "Chemical Reaction" };
  }

  // 3. Products, Glucose, Yields & Stored Energy
  if (/product|glucose|sugar|carbohydrate|starch|cellulose|yield|energy stored|atp|nadph/i.test(combined)) {
    return { icon: I.Sparkles, theme: SEMANTIC_THEMES.purple, category: "Biological Product" };
  }

  // 4. Energy & Solar Inputs
  if (/sun|sunlight|light|solar|photon|energy|radiation|power|wavelength/i.test(combined)) {
    return { icon: I.Sun, theme: SEMANTIC_THEMES.amber, category: "Energy Input" };
  }

  // 5. Water & Moisture
  if (/water|h2o|liquid|soil|roots|moisture|hydrate|fluid/i.test(combined)) {
    return { icon: I.Droplets, theme: SEMANTIC_THEMES.cyan, category: "Raw Material" };
  }

  // 6. Atmospheric Gases & Byproducts
  if (/carbon|co2|gas|atmosphere|air|oxygen|o2|stomata|breath/i.test(combined)) {
    return { icon: I.Wind, theme: SEMANTIC_THEMES.indigo, category: "Atmospheric Exchange" };
  }

  // 7. System Roles & Ecosystem Function
  if (/role|function|importance|ecosystem|life|purpose|benefit|sustain|producer/i.test(combined)) {
    return { icon: I.Activity, theme: SEMANTIC_THEMES.teal, category: "Biological Role" };
  }

  // 8. Software & OOP Concepts
  if (/abstract|interface|contract/i.test(combined)) {
    return { icon: I.Layers, theme: SEMANTIC_THEMES.indigo, category: "Interface / Contract" };
  }
  if (/implement|concrete|subclass/i.test(combined)) {
    return { icon: I.Code2, theme: SEMANTIC_THEMES.emerald, category: "Implementation" };
  }
  if (/polymorph|dynamic|dispatch|interchangeable/i.test(combined)) {
    return { icon: I.Shuffle, theme: SEMANTIC_THEMES.purple, category: "Polymorphism" };
  }
  if (/encapsulat|private|modifier|data hiding/i.test(combined)) {
    return { icon: I.ShieldCheck, theme: SEMANTIC_THEMES.orange, category: "Access Control" };
  }
  if (/class|blueprint|prototype/i.test(combined)) {
    return { icon: I.Box, theme: SEMANTIC_THEMES.teal, category: "Blueprint" };
  }
  if (/object|instance|state/i.test(combined)) {
    return { icon: I.Component, theme: SEMANTIC_THEMES.cyan, category: "Instance" };
  }
  if (/inherit|hierarchy|extend/i.test(combined)) {
    return { icon: I.GitFork, theme: SEMANTIC_THEMES.teal, category: "Hierarchy" };
  }
  if (/solid|principle|pattern/i.test(combined)) {
    return { icon: I.Compass, theme: SEMANTIC_THEMES.amber, category: "Principle" };
  }

  // 9. Explicit Semantic Roles from Backend
  if (sem === "input" || sem === "resource") {
    return { icon: I.ArrowDownToLine, theme: SEMANTIC_THEMES.cyan, category: "Input" };
  }
  if (sem === "output" || sem === "result" || role === "outcome") {
    return { icon: I.CheckCircle2, theme: SEMANTIC_THEMES.purple, category: "Outcome" };
  }
  if (sem === "process" || sem === "action") {
    return { icon: I.Cpu, theme: SEMANTIC_THEMES.teal, category: "Process" };
  }
  if (sem === "cause") {
    return { icon: I.HelpCircle, theme: SEMANTIC_THEMES.orange, category: "Cause" };
  }
  if (sem === "effect") {
    return { icon: I.Target, theme: SEMANTIC_THEMES.teal, category: "Effect" };
  }

  // 10. Diverse Rotating Color Palette Fallback (Ensures no two adjacent cards are identical)
  const safeHash = Math.abs(
    (String(node.id || node.label || "")).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) + index
  );
  const fallback = FALLBACK_PALETTES[safeHash % FALLBACK_PALETTES.length];
  return {
    icon: fallback.icon,
    theme: fallback.theme,
    category: fallback.category,
  };
}

/**
 * Directional Connector with Centered Relationship Label
 */
function DirectionalConnector({ label, direction = "down", highlight = false }) {
  const isDown = direction === "down";
  const displayLabel = label && label.trim().length > 0 ? label.trim() : null;

  return (
    <div
      className={`directional-connector ${isDown ? "vertical" : "horizontal"} ${highlight ? "highlight" : ""}`}
      style={{
        display: "flex",
        flexDirection: isDown ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        margin: isDown ? "6px 0" : "0 8px",
        gap: 3,
        position: "relative",
      }}
    >
      {/* Stem */}
      <div
        style={{
          width: isDown ? 2 : 18,
          height: isDown ? 12 : 2,
          background: highlight
            ? "linear-gradient(to bottom, #10b981, #059669)"
            : "linear-gradient(to bottom, #94a3b8, #cbd5e1)",
          borderRadius: 2,
        }}
      />

      {/* Centered Relationship Pill */}
      {displayLabel && (
        <span
          className="connector-relationship-badge"
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: "0.03em",
            textTransform: "lowercase",
            color: "#1e293b",
            background: "#ffffff",
            border: `1.5px solid ${highlight ? "#10b981" : "#cbd5e1"}`,
            padding: "2px 9px",
            borderRadius: 999,
            whiteSpace: "nowrap",
            boxShadow: "0 2px 5px rgba(15, 23, 42, 0.06)",
            zIndex: 2,
          }}
        >
          {displayLabel}
        </span>
      )}

      {/* Arrowhead */}
      {isDown ? (
        <I.ArrowDown size={15} style={{ color: highlight ? "#10b981" : "#64748b", marginTop: -2 }} />
      ) : (
        <I.ArrowRight size={15} style={{ color: highlight ? "#10b981" : "#64748b", marginLeft: -2 }} />
      )}
    </div>
  );
}

function formatNodeLabel(node, isCoreHero = false) {
  const labelStr = String(node?.label || "").trim();
  const letters = labelStr.match(/[a-zA-Z]/g);
  if (!letters || letters.length < 2) {
    const desc = String(node?.description || "").trim();
    const cleanedDesc = desc.replace(/^(?:Key component in|Dominant concept governing|Concept for)\s*[^:]*[:]?\s*/i, "").trim();
    const sentenceParts = cleanedDesc.split(/(?<=[a-zA-Z0-9])\.\s+/);
    const firstSentence = (sentenceParts[0] || cleanedDesc).replace(/[.:]+$/, "").trim();
    if (firstSentence && firstSentence.match(/[a-zA-Z]/g)?.length >= 3) {
      return firstSentence.length > 40 ? firstSentence.slice(0, 38) + "…" : firstSentence;
    }
    return isCoreHero ? "Core Concept" : "Key Component";
  }
  return labelStr;
}

/**
 * Diagram Node Card: adapts dynamically for Hero/Central, Mediator, Implementation, or Outcome
 */
function DiagramNodeCard({
  node,
  index = 0,
  isDominant = false,
  isHero = false,
  activeNodeId,
  onSelectNode,
  badgeOverride = null,
  role = "concept",
}) {
  if (!node || typeof node !== "object") return null;

  const isCoreHero = Boolean(isDominant || isHero || role === "root");
  const isOutcome = Boolean(role === "outcome" || (node.semantic_type === "output"));
  const { icon: IconComponent, theme, category } = resolveNodeVisuals(node, index);
  const safeTheme = isOutcome ? SEMANTIC_THEMES.emerald : (theme || SEMANTIC_THEMES.default);
  const Icon = (IconComponent && (typeof IconComponent === "function" || typeof IconComponent === "object"))
    ? IconComponent
    : I.CircleDot;

  const isSelected = Boolean(activeNodeId && node.id && activeNodeId === node.id);

  return (
    <div
      onClick={() => onSelectNode && onSelectNode(node)}
      className={`diagram-node-card ${isCoreHero ? "dominant-hero-node" : ""} ${isSelected ? "selected" : ""}`}
      style={{
        background: isCoreHero
          ? "linear-gradient(135deg, #ffffff 0%, #fffbeb 45%, #fef3c7 100%)"
          : isSelected
          ? "#ffffff"
          : safeTheme.bg,
        border: isCoreHero
          ? "2px solid #f59e0b"
          : isSelected
          ? "2px solid #0d9488"
          : `1.5px solid ${safeTheme.border}`,
        borderRadius: isCoreHero ? 16 : 14,
        padding: isCoreHero ? "15px 18px" : "11px 13px",
        boxShadow: isCoreHero
          ? "0 10px 28px rgba(245, 158, 11, 0.22), 0 2px 6px rgba(0,0,0,0.04)"
          : isSelected
          ? "0 0 0 3px rgba(13, 148, 136, 0.25), 0 6px 18px rgba(0,0,0,0.06)"
          : `0 2px 8px ${safeTheme.glow || "rgba(0,0,0,0.04)"}`,
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        transform: isSelected ? "translateY(-2px) scale(1.02)" : "none",
        position: "relative",
        display: "flex",
        flexDirection: isCoreHero ? "row" : "column",
        alignItems: isCoreHero ? "center" : "flex-start",
        gap: isCoreHero ? 14 : 7,
        width: "100%",
        maxWidth: isCoreHero ? 540 : "100%",
        margin: isCoreHero ? "0 auto" : 0,
      }}
    >
      {/* Icon with white glyph and gradient background */}
      <div
        style={{
          width: isCoreHero ? 44 : 32,
          height: isCoreHero ? 44 : 32,
          borderRadius: isCoreHero ? 12 : 9,
          background: isCoreHero
            ? "linear-gradient(135deg, #f59e0b, #d97706)"
            : safeTheme.iconBg,
          color: safeTheme.iconColor || "#ffffff",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          boxShadow: isCoreHero
            ? "0 4px 14px rgba(245, 158, 11, 0.4)"
            : `0 2px 6px ${safeTheme.glow || "rgba(0,0,0,0.12)"}`,
        }}
      >
        <Icon size={isCoreHero ? 22 : 16} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Eyebrow / Category badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
          {isCoreHero && (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 900,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                background: "#f59e0b",
                color: "#ffffff",
                padding: "2px 7px",
                borderRadius: 999,
              }}
            >
              ★ CORE CONCEPT
            </span>
          )}
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              background: isCoreHero ? "#fef3c7" : safeTheme.badgeBg,
              color: isCoreHero ? "#92400e" : safeTheme.badgeText,
              border: `1px solid ${isCoreHero ? "#fde68a" : safeTheme.border + "55"}`,
              padding: "2px 7px",
              borderRadius: 6,
              display: "inline-block",
            }}
          >
            {badgeOverride || category}
          </span>
        </div>

        {/* Node Label */}
        <div
          style={{
            fontSize: isCoreHero ? 17 : 13.5,
            fontWeight: 800,
            color: isCoreHero ? "#0f172a" : safeTheme.text,
            lineHeight: 1.28,
          }}
        >
          {formatNodeLabel(node, isCoreHero)}
        </div>

        {/* Optional 1-line description */}
        {node.description && (
          <div
            style={{
              fontSize: 11.5,
              color: isCoreHero ? "#475569" : (safeTheme.subtext || "#475569"),
              lineHeight: 1.4,
              marginTop: 3,
            }}
          >
            {node.description}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAMMAR 1: HIERARCHY & CONTRACT IMPLEMENTATION (Abstraction -> Interface -> Impls -> Result)
// ─────────────────────────────────────────────────────────────────────────────
function HierarchyInfographic({ nodes = [], connections = [], centralConcept = "", activeNodeId, onSelectNode }) {
  const safeNodes = (Array.isArray(nodes) ? nodes : []).filter(Boolean);
  const safeConns = (Array.isArray(connections) ? connections : []).filter(Boolean);
  if (safeNodes.length === 0) return null;

  // 1. Identify Root node (dominant core concept)
  const rootNode =
    safeNodes.find((n) => centralConcept && String(n.label || "").toLowerCase().includes(centralConcept.toLowerCase())) ||
    safeNodes.find((n) => n.role === "root") ||
    safeNodes[0];

  if (!rootNode) return null;

  // Helper to find connection label between two nodes
  const getConnLabel = (fromId, toId, fallback = "defines") => {
    const direct = safeConns.find((c) => c && c.from === fromId && c.to === toId);
    if (direct && direct.label) return direct.label;
    const reverse = safeConns.find((c) => c && c.to === fromId && c.from === toId);
    if (reverse && reverse.label) return reverse.label;
    return fallback;
  };

  // Find nodes connected from root
  const rootOutIds = new Set(
    safeConns.filter((c) => c && c.from === rootNode.id).map((c) => c.to)
  );

  // Remaining nodes excluding root
  const nonRootNodes = safeNodes.filter((n) => n && n.id !== rootNode.id);

  // If there's an intermediate mediator (e.g. "Interface", "Contract", or first child of root)
  const mediatorNode =
    nonRootNodes.find((n) => rootOutIds.has(n.id) && (n.role === "mediator" || /interface|contract|blueprint|protocol/i.test(String(n.label || "")))) ||
    nonRootNodes.find((n) => rootOutIds.has(n.id)) ||
    (nonRootNodes.length > 0 ? nonRootNodes[0] : null);

  // Remaining nodes after mediator
  const remaining = nonRootNodes.filter((n) => n && n.id !== mediatorNode?.id);

  // Check if any node represents the final outcome (e.g. "Interchangeable Code", "Polymorphic Code", "Result")
  const outcomeNode = remaining.find(
    (n) => n.role === "outcome" || /interchangeable|reusab|polymorphic|result|output|benefit/i.test(String(n.label || ""))
  );

  const implementationNodes = remaining.filter((n) => n && n.id !== outcomeNode?.id);

  // Connection labels
  const rootToMediatorLabel = mediatorNode
    ? getConnLabel(rootNode.id, mediatorNode.id, "hides complexity")
    : "defines";

  const mediatorToImplsLabel = mediatorNode && implementationNodes.length > 0
    ? getConnLabel(mediatorNode.id, implementationNodes[0].id, "defines contract")
    : "implemented by";

  const implsToOutcomeLabel = outcomeNode
    ? (implementationNodes[0] ? getConnLabel(implementationNodes[0].id, outcomeNode.id, "yields") : "enables")
    : "interchangeable";

  return (
    <div className="hierarchy-diagram-flow" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: "100%", padding: "4px 0" }}>
      {/* TIER 1: DOMINANT ROOT CONCEPT */}
      <DiagramNodeCard
        node={rootNode}
        isDominant={true}
        activeNodeId={activeNodeId}
        onSelectNode={onSelectNode}
        badgeOverride="Dominant Concept"
        role="root"
      />

      {/* CONNECTOR: Root -> Mediator */}
      {mediatorNode && (
        <DirectionalConnector label={rootToMediatorLabel} direction="down" highlight={true} />
      )}

      {/* TIER 2: INTERFACE / MEDIATOR NODE */}
      {mediatorNode && (
        <div style={{ width: "100%", maxWidth: 440 }}>
          <DiagramNodeCard
            node={mediatorNode}
            activeNodeId={activeNodeId}
            onSelectNode={onSelectNode}
            badgeOverride="Contract Specification"
            role="mediator"
          />
        </div>
      )}

      {/* CONNECTOR: Mediator -> Implementations */}
      {implementationNodes.length > 0 && (
        <DirectionalConnector label={mediatorToImplsLabel} direction="down" highlight={true} />
      )}

      {/* TIER 3: IMPLEMENTATIONS CLUSTER */}
      {implementationNodes.length > 0 && (
        <div
          className="implementations-group-box"
          style={{
            width: "100%",
            maxWidth: 520,
            background: "#f8fafc",
            border: "1.5px dashed #cbd5e1",
            borderRadius: 14,
            padding: "12px 14px",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#475569",
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <I.Code2 size={13} style={{ color: "#16a34a" }} />
            <span>Concrete Implementations ({implementationNodes.length})</span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(auto-fit, minmax(130px, 1fr))`,
              gap: 8,
            }}
          >
            {implementationNodes.map((node, i) => (
              <DiagramNodeCard
                key={node.id}
                node={node}
                index={i}
                activeNodeId={activeNodeId}
                onSelectNode={onSelectNode}
                badgeOverride={`Impl ${i + 1}`}
                role="implementation"
              />
            ))}
          </div>
        </div>
      )}

      {/* CONNECTOR: Implementations -> Outcome */}
      {outcomeNode && (
        <DirectionalConnector label={implsToOutcomeLabel} direction="down" highlight={true} />
      )}

      {/* TIER 4: OUTCOME / INTERCHANGEABLE LEAF */}
      {outcomeNode && (
        <div style={{ width: "100%", maxWidth: 380 }}>
          <DiagramNodeCard
            node={outcomeNode}
            index={implementationNodes.length + 1}
            activeNodeId={activeNodeId}
            onSelectNode={onSelectNode}
            badgeOverride="Resulting System Property"
            role="outcome"
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAMMAR 2: CONCEPT MAP (Radial Dominant Hub with Labeled Satellite Connectors)
// ─────────────────────────────────────────────────────────────────────────────
function ConceptMapInfographic({ nodes = [], connections = [], centralConcept = "", activeNodeId, onSelectNode }) {
  const safeNodes = (Array.isArray(nodes) ? nodes : []).filter(Boolean);
  const safeConns = (Array.isArray(connections) ? connections : []).filter(Boolean);
  if (safeNodes.length === 0) return null;

  const hubNode =
    safeNodes.find((n) => centralConcept && String(n.label || "").toLowerCase().includes(centralConcept.toLowerCase())) ||
    safeNodes.find((n) => n.role === "root") ||
    safeNodes[0];

  if (!hubNode) return null;

  const satellites = safeNodes.filter((n) => n && n.id !== hubNode.id);

  // Helper to find connection label between hub and satellite
  const getLabel = (satId) => {
    const direct = safeConns.find((c) => c && c.from === hubNode.id && c.to === satId);
    if (direct && direct.label) return direct.label;
    const reverse = safeConns.find((c) => c && c.to === hubNode.id && c.from === satId);
    if (reverse && reverse.label) return reverse.label;
    return "relates to";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%" }}>
      {/* 1. Visually Dominant Central Concept Hub */}
      <DiagramNodeCard
        node={hubNode}
        index={0}
        isDominant={true}
        activeNodeId={activeNodeId}
        onSelectNode={onSelectNode}
        badgeOverride="Central Paradigm"
        role="root"
      />

      {/* 2. Radiant Connectors & Satellites Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: satellites.length === 1 ? "1fr" : satellites.length === 2 ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 12,
          width: "100%",
          marginTop: 6,
        }}
      >
        {satellites.map((sat, sIdx) => {
          const relLabel = getLabel(sat.id);
          return (
            <div
              key={sat.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                minWidth: 0,
              }}
            >
              <DirectionalConnector label={relLabel} direction="down" />
              <DiagramNodeCard
                node={sat}
                index={sIdx}
                activeNodeId={activeNodeId}
                onSelectNode={onSelectNode}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAMMAR 3: PROCESS & PIPELINE FLOW (Sequential with Transition Action Badges)
// ─────────────────────────────────────────────────────────────────────────────
function ProcessInfographic({ nodes, connections, activeNodeId, onSelectNode }) {
  // Check for Photosynthesis Converge-Diverge pattern
  const isPhotosynthesis = nodes.some(
    (n) => /photosynthesis|chloroplast|light reaction|calvin cycle/i.test(n.label || "")
  );

  if (isPhotosynthesis) {
    const inputs = nodes.filter((n) => /sun|light|water|co2|photon/i.test(n.label));
    const outputs = nodes.filter((n) => /glucose|sugar|oxygen|o2|energy/i.test(n.label));
    const core = nodes.find((n) => !inputs.includes(n) && !outputs.includes(n)) || nodes[0];

    if (inputs.length > 0 && outputs.length > 0) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%" }}>
          {/* Inputs */}
          <div style={{ width: "100%", background: "#f0f9ff", border: "1px dashed #bae6fd", borderRadius: 12, padding: "10px 12px" }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#0369a1", textTransform: "uppercase" }}>Inputs Absorbed</span>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(120px, 1fr))`, gap: 8, marginTop: 6 }}>
              {inputs.map((n, i) => (
                <DiagramNodeCard key={n.id} node={n} index={i} activeNodeId={activeNodeId} onSelectNode={onSelectNode} />
              ))}
            </div>
          </div>

          <DirectionalConnector label="absorbed & catalyzed" direction="down" highlight={true} />

          {/* Core Biological Transformation */}
          <DiagramNodeCard node={core} index={0} isDominant={true} activeNodeId={activeNodeId} onSelectNode={onSelectNode} role="root" />

          <DirectionalConnector label="synthesizes & releases" direction="down" highlight={true} />

          {/* Outputs */}
          <div style={{ width: "100%", background: "#f0fdf4", border: "1px dashed #bbf7d0", borderRadius: 12, padding: "10px 12px" }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#166534", textTransform: "uppercase" }}>Products Yielded</span>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(120px, 1fr))`, gap: 8, marginTop: 6 }}>
              {outputs.map((n, i) => (
                <DiagramNodeCard key={n.id} node={n} index={i + 2} activeNodeId={activeNodeId} onSelectNode={onSelectNode} role="outcome" />
              ))}
            </div>
          </div>
        </div>
      );
    }
  }

  // General Sequential Pipeline with Directional Verbs
  return (
    <div className="process-pipeline-flow" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, width: "100%" }}>
      {nodes.map((node, i) => {
        const isFirst = i === 0;
        const nextNode = nodes[i + 1];
        let transitionLabel = "leads to";
        if (nextNode) {
          const direct = connections.find((c) => c.from === node.id && c.to === nextNode.id);
          if (direct && direct.label) transitionLabel = direct.label;
        }

        return (
          <React.Fragment key={node.id}>
            <div style={{ width: "100%", maxWidth: isFirst ? 500 : 440 }}>
              <DiagramNodeCard
                node={node}
                index={i}
                isDominant={isFirst}
                activeNodeId={activeNodeId}
                onSelectNode={onSelectNode}
                badgeOverride={`Stage ${i + 1}`}
              />
            </div>
            {i < nodes.length - 1 && (
              <DirectionalConnector label={transitionLabel} direction="down" highlight={i === 0} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAMMAR 4: CAUSE & EFFECT (Triggers -> Mechanism -> Impacts)
// ─────────────────────────────────────────────────────────────────────────────
function CauseEffectInfographic({ nodes, connections, activeNodeId, onSelectNode }) {
  const causes = nodes.filter((n) => n.semantic_type === "cause" || n.role === "cause");
  const effects = nodes.filter((n) => n.semantic_type === "effect" || n.role === "outcome");
  const mid = Math.ceil(nodes.length / 2);

  const leftNodes = causes.length > 0 ? causes : nodes.slice(0, mid);
  const rightNodes = effects.length > 0 ? effects : nodes.slice(mid);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center" }}>
        {/* Causes Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#ea580c", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
            <I.HelpCircle size={14} /> Causes / Triggers
          </div>
          {leftNodes.map((n, i) => (
            <DiagramNodeCard key={n.id} node={n} index={i} activeNodeId={activeNodeId} onSelectNode={onSelectNode} />
          ))}
        </div>

        {/* Central Transition Bridge */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <DirectionalConnector label="drives" direction="right" highlight={true} />
        </div>

        {/* Effects Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#059669", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
            <I.Target size={14} /> Consequences / Effects
          </div>
          {rightNodes.map((n, i) => (
            <DiagramNodeCard key={n.id} node={n} index={i + 3} activeNodeId={activeNodeId} onSelectNode={onSelectNode} role="outcome" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAMMAR 5: SIDE-BY-SIDE COMPARISON
// ─────────────────────────────────────────────────────────────────────────────
function ComparisonInfographic({ nodes, activeNodeId, onSelectNode }) {
  const mid = Math.ceil(nodes.length / 2);
  const sideA = nodes.slice(0, mid);
  const sideB = nodes.slice(mid);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center" }}>
        {/* Side A */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#0d9488", textTransform: "uppercase", textAlign: "center" }}>
            Paradigm A
          </div>
          {sideA.map((n, i) => (
            <DiagramNodeCard key={n.id} node={n} index={i} activeNodeId={activeNodeId} onSelectNode={onSelectNode} />
          ))}
        </div>

        {/* VS Divider */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
            color: "#334155",
            fontWeight: 900,
            fontSize: 12,
            display: "grid",
            placeItems: "center",
            border: "2px solid #cbd5e1",
            boxShadow: "0 2px 6px rgba(15, 23, 42, 0.08)",
          }}
        >
          VS
        </div>

        {/* Side B */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#059669", textTransform: "uppercase", textAlign: "center" }}>
            Paradigm B
          </div>
          {sideB.map((n, i) => (
            <DiagramNodeCard key={n.id} node={n} index={i + 2} activeNodeId={activeNodeId} onSelectNode={onSelectNode} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAMMAR 6: RECURRING CYCLE
// ─────────────────────────────────────────────────────────────────────────────
function CycleInfographic({ nodes, connections, activeNodeId, onSelectNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: "100%" }}>
      {nodes.map((node, i) => (
        <React.Fragment key={node.id}>
          <div style={{ width: "100%", maxWidth: 440 }}>
            <DiagramNodeCard
              node={node}
              index={i}
              activeNodeId={activeNodeId}
              onSelectNode={onSelectNode}
              badgeOverride={`Step ${i + 1}`}
            />
          </div>
          {i < nodes.length - 1 && (
            <DirectionalConnector label="feeds into" direction="down" />
          )}
        </React.Fragment>
      ))}

      {/* Return Loop Bridge */}
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#faf5ff",
          border: "1.5px dashed #c084fc",
          borderRadius: 10,
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          fontSize: 11,
          fontWeight: 800,
          color: "#7e22ce",
          marginTop: 6,
        }}
      >
        <I.RotateCw size={14} />
        <span>Loop closes: Final output returns back to Step 1</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER INFOGRAPHIC DISPATCHER
// ─────────────────────────────────────────────────────────────────────────────
class VisualErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.warn("[VisualInfographic] Fallback triggered due to error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      if (this.props.svgHtmlFallback) {
        return (
          <div
            style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb", background: "#fafafa", padding: 8 }}
            dangerouslySetInnerHTML={{ __html: this.props.svgHtmlFallback }}
          />
        );
      }
      return (
        <div style={{ padding: 18, background: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: 12, textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "#475569", fontWeight: 600, margin: 0 }}>
            Simplified visual overview displayed.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

function VisualInfographicInner({
  spec = {},
  sourceImages = [],
  onReadAloud,
  svgHtmlFallback = null,
  activeNode: controlledActiveNode,
  onSelectNode: controlledOnSelectNode,
}) {
  const [internalActiveNode, setInternalActiveNode] = useState(null);
  const activeNode = controlledActiveNode !== undefined ? controlledActiveNode : internalActiveNode;
  const setActiveNode = controlledOnSelectNode || setInternalActiveNode;
  const [imgIndex, setImgIndex] = useState(0);

  const hasSourceImages = sourceImages && sourceImages.length > 0;
  const visualType = (spec.visual_type || "hierarchy").toLowerCase();
  const nodes = spec.nodes || [];
  const connections = spec.connections || [];
  const centralConcept = spec.central_concept || "";

  return (
    <div className="diagram-canvas" style={{ padding: "0 4px", marginTop: 10 }}>
      {/* 1. Authentic PDF Source Visual if extracted */}
      {hasSourceImages && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                background: "#fef3c7",
                color: "#92400e",
                padding: "2px 8px",
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <I.FileText size={11} /> Source Document Figure
            </span>
          </div>

          <div
            style={{
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid #e2e8f0",
              background: "#fafafa",
            }}
          >
            <img
              src={`data:image/png;base64,${sourceImages[imgIndex]}`}
              alt={`Source figure ${imgIndex + 1}`}
              style={{ width: "100%", maxHeight: 300, objectFit: "contain", display: "block" }}
            />
          </div>
        </div>
      )}

      {/* 2. Concept Relationship Diagram Engine */}
      {nodes.length > 0 ? (
        <div className="infographic-engine-container">
          {visualType === "hierarchy" || visualType === "tree" || visualType === "flowchart" ? (
            <HierarchyInfographic
              nodes={nodes}
              connections={connections}
              centralConcept={centralConcept}
              activeNodeId={activeNode?.id}
              onSelectNode={setActiveNode}
            />
          ) : visualType === "concept_map" ? (
            <ConceptMapInfographic
              nodes={nodes}
              connections={connections}
              centralConcept={centralConcept}
              activeNodeId={activeNode?.id}
              onSelectNode={setActiveNode}
            />
          ) : visualType === "cause_effect" ? (
            <CauseEffectInfographic
              nodes={nodes}
              connections={connections}
              activeNodeId={activeNode?.id}
              onSelectNode={setActiveNode}
            />
          ) : visualType === "comparison" ? (
            <ComparisonInfographic
              nodes={nodes}
              activeNodeId={activeNode?.id}
              onSelectNode={setActiveNode}
            />
          ) : visualType === "cycle" ? (
            <CycleInfographic
              nodes={nodes}
              activeNodeId={activeNode?.id}
              onSelectNode={setActiveNode}
            />
          ) : (
            /* Default to smart Multi-Stage Process */
            <ProcessInfographic
              nodes={nodes}
              connections={connections}
              activeNodeId={activeNode?.id}
              onSelectNode={setActiveNode}
            />
          )}
        </div>
      ) : svgHtmlFallback ? (
        /* Fallback to SVG if nodes are somehow empty */
        <div
          style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb", background: "#fafafa" }}
          dangerouslySetInnerHTML={{ __html: svgHtmlFallback }}
        />
      ) : null}

      {/* 3. INTERACTIVE NODE DETAIL DRAWER - only when uncontrolled */}
      {activeNode && controlledActiveNode === undefined && (
        <div
          style={{
            position: "relative",
            marginTop: 14,
            background: "rgba(13, 148, 136, 0.08)",
            border: "1px solid #14b8a6",
            borderRadius: 12,
            padding: "12px 36px 12px 14px",
            animation: "fade 0.2s ease-in-out",
          }}
        >
          <button
            onClick={() => setActiveNode(null)}
            style={{
              position: "absolute",
              top: 8,
              right: 10,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              color: "#6b7280",
            }}
            aria-label="Close"
          >
            ✕
          </button>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#115e59", marginBottom: 2 }}>
            🔍 {activeNode.label}
          </div>
          <div style={{ fontSize: 12, color: "#134e4a", lineHeight: 1.55 }}>
            {activeNode.description || "Key educational milestone in this conceptual process."}
          </div>
        </div>
      )}

      {nodes.length > 0 && (
        <p style={{ margin: "8px 0 0", fontSize: 11, color: "#94a3b8", fontStyle: "italic", textAlign: "center" }}>
          Tap any card above to explore concept details
        </p>
      )}
    </div>
  );
}

export default function VisualInfographic(props) {
  return (
    <VisualErrorBoundary svgHtmlFallback={props.svgHtmlFallback}>
      <VisualInfographicInner {...props} />
    </VisualErrorBoundary>
  );
}

