import React, { useState } from "react";
import * as I from "lucide-react";

/**
 * Semantic Color Palettes for Educational Infographics
 */
const SEMANTIC_THEMES = {
  energy: {
    bg: "#fffbeb",
    border: "#f59e0b",
    text: "#92400e",
    subtext: "#b45309",
    badgeBg: "#fef3c7",
    badgeText: "#92400e",
    iconBg: "#fde68a",
    iconColor: "#d97706",
    glow: "rgba(245, 158, 11, 0.2)",
  },
  light: {
    bg: "#fefce8",
    border: "#eab308",
    text: "#854d0e",
    subtext: "#a16207",
    badgeBg: "#fef9c3",
    badgeText: "#854d0e",
    iconBg: "#fef08a",
    iconColor: "#ca8a04",
    glow: "rgba(234, 179, 8, 0.2)",
  },
  water: {
    bg: "#f0f9ff",
    border: "#0ea5e9",
    text: "#0369a1",
    subtext: "#0284c7",
    badgeBg: "#e0f2fe",
    badgeText: "#0369a1",
    iconBg: "#bae6fd",
    iconColor: "#0284c7",
    glow: "rgba(14, 165, 233, 0.2)",
  },
  gas: {
    bg: "#f8fafc",
    border: "#64748b",
    text: "#334155",
    subtext: "#475569",
    badgeBg: "#f1f5f9",
    badgeText: "#334155",
    iconBg: "#e2e8f0",
    iconColor: "#475569",
    glow: "rgba(100, 116, 139, 0.2)",
  },
  biological: {
    bg: "#f0fdf4",
    border: "#22c55e",
    text: "#166534",
    subtext: "#15803d",
    badgeBg: "#dcfce7",
    badgeText: "#166534",
    iconBg: "#bbf7d0",
    iconColor: "#16a34a",
    glow: "rgba(34, 197, 94, 0.2)",
  },
  process: {
    bg: "#fefce8",
    border: "#fce072",
    text: "#713f12",
    subtext: "#854d0e",
    badgeBg: "#fef9c3",
    badgeText: "#713f12",
    iconBg: "#fce072",
    iconColor: "#713f12",
    glow: "rgba(252, 224, 114, 0.4)",
  },
  product: {
    bg: "#fdf4ff",
    border: "#d946ef",
    text: "#86198f",
    subtext: "#a21caf",
    badgeBg: "#fae8ff",
    badgeText: "#86198f",
    iconBg: "#f5d0fe",
    iconColor: "#c026d3",
    glow: "rgba(217, 70, 239, 0.2)",
  },
  output: {
    bg: "#f0fdfa",
    border: "#14b8a6",
    text: "#115e59",
    subtext: "#0f766e",
    badgeBg: "#ccfbf1",
    badgeText: "#115e59",
    iconBg: "#99f6e4",
    iconColor: "#0d9488",
    glow: "rgba(20, 184, 166, 0.2)",
  },
  cause: {
    bg: "#fff7ed",
    border: "#f97316",
    text: "#9a3412",
    subtext: "#c2410c",
    badgeBg: "#ffedd5",
    badgeText: "#9a3412",
    iconBg: "#fed7aa",
    iconColor: "#ea580c",
    glow: "rgba(249, 115, 22, 0.2)",
  },
  effect: {
    bg: "#ecfdf5",
    border: "#10b981",
    text: "#065f46",
    subtext: "#047857",
    badgeBg: "#d1fae5",
    badgeText: "#065f46",
    iconBg: "#a7f3d0",
    iconColor: "#059669",
    glow: "rgba(16, 185, 129, 0.2)",
  },
  default: {
    bg: "#f8fafc",
    border: "#fce072",
    text: "#713f12",
    subtext: "#854d0e",
    badgeBg: "#fef9c3",
    badgeText: "#713f12",
    iconBg: "rgba(252, 224, 114, 0.35)",
    iconColor: "#713f12",
    glow: "rgba(252, 224, 114, 0.3)",
  },
};

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
 */
export function resolveNodeVisuals(node = {}) {
  const label = (node.label || "").toLowerCase();
  const desc = (node.description || "").toLowerCase();
  const sem = (node.semantic_type || "").toLowerCase();
  const role = (node.role || "").toLowerCase();
  const combined = `${label} ${desc} ${sem} ${role}`;

  // 1. Software & OOP Concepts
  if (combined.includes("abstract") || combined.includes("interface") || combined.includes("contract")) {
    return { icon: I.Layers, theme: SEMANTIC_THEMES.process, category: "Interface / Contract" };
  }
  if (combined.includes("implementation") || combined.includes("concrete") || combined.includes("subclass")) {
    return { icon: I.Code2, theme: SEMANTIC_THEMES.biological, category: "Implementation" };
  }
  if (combined.includes("polymorphism") || combined.includes("interchangeable") || combined.includes("dynamic dispatch")) {
    return { icon: I.Shuffle, theme: SEMANTIC_THEMES.product, category: "Polymorphism" };
  }
  if (combined.includes("encapsulat") || combined.includes("data hiding") || combined.includes("private") || combined.includes("modifier")) {
    return { icon: I.ShieldCheck, theme: SEMANTIC_THEMES.cause, category: "Access Control" };
  }
  if (combined.includes("class") || combined.includes("blueprint") || combined.includes("prototype")) {
    return { icon: I.Box, theme: SEMANTIC_THEMES.default, category: "Blueprint" };
  }
  if (combined.includes("object") || combined.includes("instance") || combined.includes("state")) {
    return { icon: I.Component, theme: SEMANTIC_THEMES.water, category: "Instance" };
  }
  if (combined.includes("inherit") || combined.includes("hierarchy") || combined.includes("extend")) {
    return { icon: I.GitFork, theme: SEMANTIC_THEMES.process, category: "Hierarchy" };
  }
  if (combined.includes("solid") || combined.includes("principle") || combined.includes("design pattern")) {
    return { icon: I.Compass, theme: SEMANTIC_THEMES.energy, category: "Principle" };
  }

  // 2. Physical & Natural Science Concepts
  if (combined.includes("sun") || combined.includes("light") || combined.includes("solar") || combined.includes("photon")) {
    return { icon: I.Sun, theme: SEMANTIC_THEMES.light, category: "Energy Input" };
  }
  if (combined.includes("water") || combined.includes("h2o") || combined.includes("liquid")) {
    return { icon: I.Droplets, theme: SEMANTIC_THEMES.water, category: "Raw Material" };
  }
  if (combined.includes("co2") || combined.includes("carbon") || combined.includes("gas") || combined.includes("air")) {
    return { icon: I.Cloud, theme: SEMANTIC_THEMES.gas, category: "Atmospheric Input" };
  }
  if (combined.includes("photosynthesis") || combined.includes("chloroplast") || combined.includes("chlorophyll") || combined.includes("plant") || combined.includes("leaf")) {
    return { icon: I.Leaf, theme: SEMANTIC_THEMES.biological, category: "Core Reaction" };
  }
  if (combined.includes("glucose") || combined.includes("sugar") || combined.includes("chemical energy")) {
    return { icon: I.Sparkles, theme: SEMANTIC_THEMES.product, category: "Energy Stored" };
  }
  if (combined.includes("oxygen") || combined.includes("o2") || combined.includes("breathable")) {
    return { icon: I.Wind, theme: SEMANTIC_THEMES.output, category: "Byproduct Released" };
  }

  // 3. General Semantic Roles
  if (sem === "input" || sem === "resource") {
    return { icon: I.ArrowDownToLine, theme: SEMANTIC_THEMES.water, category: "Input" };
  }
  if (sem === "output" || sem === "result" || role === "outcome") {
    return { icon: I.CheckCircle2, theme: SEMANTIC_THEMES.output, category: "Outcome" };
  }
  if (sem === "process" || sem === "action") {
    return { icon: I.Cpu, theme: SEMANTIC_THEMES.process, category: "Process" };
  }
  if (sem === "cause") {
    return { icon: I.HelpCircle, theme: SEMANTIC_THEMES.cause, category: "Cause" };
  }
  if (sem === "effect") {
    return { icon: I.Target, theme: SEMANTIC_THEMES.effect, category: "Effect" };
  }

  // Fallback
  return { icon: I.CircleDot, theme: SEMANTIC_THEMES.default, category: "Concept" };
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
        margin: isDown ? "4px 0" : "0 8px",
        gap: 2,
        position: "relative",
      }}
    >
      {/* Upper/Leading Stem */}
      <div
        style={{
          width: isDown ? 2 : 16,
          height: isDown ? 10 : 2,
          background: highlight
            ? "linear-gradient(to bottom, #fce072, #eab308)"
            : "linear-gradient(to bottom, #cbd5e1, #94a3b8)",
        }}
      />

      {/* Centered Relationship Pill */}
      {displayLabel && (
        <span
          className="connector-relationship-badge"
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.02em",
            textTransform: "lowercase",
            color: "#713f12",
            background: highlight ? "#fef9c3" : "#fefce8",
            border: `1.5px solid ${highlight ? "#fce072" : "rgba(252, 224, 114, 0.5)"}`,
            padding: "2px 10px",
            borderRadius: 999,
            whiteSpace: "nowrap",
            boxShadow: "0 1px 4px rgba(252, 224, 114, 0.25)",
            zIndex: 2,
          }}
        >
          {displayLabel}
        </span>
      )}

      {/* Arrowhead */}
      {isDown ? (
        <I.ArrowDown size={17} style={{ color: "#713f12", marginTop: -2 }} />
      ) : (
        <I.ArrowRight size={17} style={{ color: "#713f12", marginLeft: -2 }} />
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
  isDominant = false,
  isHero = false,
  activeNodeId,
  onSelectNode,
  badgeOverride = null,
  role = "concept",
}) {
  if (!node || typeof node !== "object") return null;

  const { icon: IconComponent, theme, category } = resolveNodeVisuals(node);
  const safeTheme = theme || SEMANTIC_THEMES.default;
  const Icon = (IconComponent && (typeof IconComponent === "function" || typeof IconComponent === "object"))
    ? IconComponent
    : I.CircleDot;

  const isSelected = Boolean(activeNodeId && node.id && activeNodeId === node.id);
  const isCoreHero = Boolean(isDominant || isHero || role === "root");
  const isOutcome = Boolean(role === "outcome" || (node.semantic_type === "output"));

  return (
    <div
      onClick={() => onSelectNode && onSelectNode(node)}
      className={`diagram-node-card ${isCoreHero ? "dominant-hero-node" : ""} ${isSelected ? "selected" : ""}`}
      style={{
        background: isCoreHero ? "#ffffff" : isOutcome ? "#f0fdf4" : safeTheme.bg,
        border: isCoreHero
          ? "2.5px solid #fce072"
          : `1.5px solid ${isSelected ? "#fce072" : isOutcome ? "#22c55e" : safeTheme.border}`,
        borderRadius: isCoreHero ? 16 : 12,
        padding: isCoreHero ? "14px 18px" : "10px 14px",
        boxShadow: isCoreHero
          ? "0 8px 24px rgba(252, 224, 114, 0.35), 0 2px 6px rgba(0,0,0,0.04)"
          : isSelected
          ? "0 4px 14px rgba(252, 224, 114, 0.4)"
          : "0 1px 4px rgba(0,0,0,0.03)",
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        transform: isSelected ? "translateY(-2px) scale(1.02)" : "none",
        position: "relative",
        display: "flex",
        flexDirection: isCoreHero ? "row" : "column",
        alignItems: isCoreHero ? "center" : "flex-start",
        gap: isCoreHero ? 14 : 6,
        width: "100%",
        maxWidth: isCoreHero ? 540 : "100%",
        margin: isCoreHero ? "0 auto" : 0,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: isCoreHero ? 42 : 30,
          height: isCoreHero ? 42 : 30,
          borderRadius: 10,
          background: isCoreHero ? "linear-gradient(135deg, #fce072, #f59e0b)" : safeTheme.iconBg,
          color: isCoreHero ? "#451a03" : safeTheme.iconColor,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          boxShadow: isCoreHero ? "0 4px 12px rgba(252, 224, 114, 0.45)" : "none",
        }}
      >
        <Icon size={isCoreHero ? 22 : 16} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Eyebrow / Category badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          {isCoreHero && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                background: "#fef9c3",
                color: "#713f12",
                border: "1px solid #fce072",
                padding: "1px 6px",
                borderRadius: 4,
              }}
            >
              ★ CORE CONCEPT
            </span>
          )}
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: isCoreHero ? "#713f12" : isOutcome ? "#15803d" : theme.badgeText,
            }}
          >
            {badgeOverride || category}
          </span>
        </div>

        {/* Node Label */}
        <div
          style={{
            fontSize: isCoreHero ? 17 : 14,
            fontWeight: 800,
            color: isCoreHero ? "#0f172a" : isOutcome ? "#14532d" : theme.text,
            lineHeight: 1.25,
          }}
        >
          {formatNodeLabel(node, isCoreHero)}
        </div>

        {/* Optional 1-line description */}
        {node.description && (
          <div
            style={{
              fontSize: 11,
              color: isCoreHero ? "#475569" : theme.subtext,
              lineHeight: 1.4,
              marginTop: 2,
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
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          width: "100%",
          marginTop: 6,
        }}
      >
        {satellites.map((sat) => {
          const relLabel = getLabel(sat.id);
          return (
            <div
              key={sat.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <DirectionalConnector label={relLabel} direction="down" />
              <DiagramNodeCard
                node={sat}
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
              {inputs.map((n) => (
                <DiagramNodeCard key={n.id} node={n} activeNodeId={activeNodeId} onSelectNode={onSelectNode} />
              ))}
            </div>
          </div>

          <DirectionalConnector label="absorbed & catalyzed" direction="down" highlight={true} />

          {/* Core Biological Transformation */}
          <DiagramNodeCard node={core} isDominant={true} activeNodeId={activeNodeId} onSelectNode={onSelectNode} role="root" />

          <DirectionalConnector label="synthesizes & releases" direction="down" highlight={true} />

          {/* Outputs */}
          <div style={{ width: "100%", background: "#f0fdf4", border: "1px dashed #bbf7d0", borderRadius: 12, padding: "10px 12px" }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#166534", textTransform: "uppercase" }}>Products Yielded</span>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(120px, 1fr))`, gap: 8, marginTop: 6 }}>
              {outputs.map((n) => (
                <DiagramNodeCard key={n.id} node={n} activeNodeId={activeNodeId} onSelectNode={onSelectNode} role="outcome" />
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
          {leftNodes.map((n) => (
            <DiagramNodeCard key={n.id} node={n} activeNodeId={activeNodeId} onSelectNode={onSelectNode} />
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
          {rightNodes.map((n) => (
            <DiagramNodeCard key={n.id} node={n} activeNodeId={activeNodeId} onSelectNode={onSelectNode} role="outcome" />
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
          <div style={{ fontSize: 11, fontWeight: 800, color: "#713f12", textTransform: "uppercase", textAlign: "center" }}>
            Paradigm A
          </div>
          {sideA.map((n) => (
            <DiagramNodeCard key={n.id} node={n} activeNodeId={activeNodeId} onSelectNode={onSelectNode} />
          ))}
        </div>

        {/* VS Divider */}
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "#fef9c3",
            color: "#713f12",
            fontWeight: 900,
            fontSize: 12,
            display: "grid",
            placeItems: "center",
            border: "2px solid #fce072",
          }}
        >
          VS
        </div>

        {/* Side B */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#059669", textTransform: "uppercase", textAlign: "center" }}>
            Paradigm B
          </div>
          {sideB.map((n) => (
            <DiagramNodeCard key={n.id} node={n} activeNodeId={activeNodeId} onSelectNode={onSelectNode} />
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
          background: "#fdf4ff",
          border: "1.5px dashed #d946ef",
          borderRadius: 10,
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          fontSize: 11,
          fontWeight: 800,
          color: "#86198f",
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
}) {
  const [activeNode, setActiveNode] = useState(null);
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

      {/* 3. INTERACTIVE NODE DETAIL DRAWER */}
      {activeNode && (
        <div
          style={{
            position: "relative",
            marginTop: 14,
            background: "rgba(252, 224, 114, 0.15)",
            border: "1px solid #fce072",
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
          <div style={{ fontWeight: 800, fontSize: 13, color: "#713f12", marginBottom: 2 }}>
            🔍 {activeNode.label}
          </div>
          <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.55 }}>
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

