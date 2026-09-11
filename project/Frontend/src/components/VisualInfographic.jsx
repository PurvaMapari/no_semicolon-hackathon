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
    bg: "#f5f3ff",
    border: "#8b5cf6",
    text: "#5b21b6",
    subtext: "#6d28d9",
    badgeBg: "#ede9fe",
    badgeText: "#5b21b6",
    iconBg: "#ddd6fe",
    iconColor: "#7c3aed",
    glow: "rgba(139, 92, 246, 0.25)",
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
    border: "#6366f1",
    text: "#312e81",
    subtext: "#4338ca",
    badgeBg: "#e0e7ff",
    badgeText: "#312e81",
    iconBg: "#c7d2fe",
    iconColor: "#4f46e5",
    glow: "rgba(99, 102, 241, 0.2)",
  },
};

/**
 * Resolves appropriate Lucide icon and semantic theme based on node properties
 */
export function resolveNodeVisuals(node = {}) {
  const label = (node.label || "").toLowerCase();
  const desc = (node.description || "").toLowerCase();
  const sem = (node.semantic_type || "").toLowerCase();
  const combined = `${label} ${desc} ${sem}`;

  // 1. Light & Solar Energy
  if (combined.includes("sun") || combined.includes("light") || combined.includes("solar") || combined.includes("photon")) {
    return { icon: I.Sun, theme: SEMANTIC_THEMES.light, category: "Energy Input" };
  }
  // 2. Water / Liquid
  if (combined.includes("water") || combined.includes("h2o") || combined.includes("h₂o") || combined.includes("rain") || combined.includes("liquid")) {
    return { icon: I.Droplets, theme: SEMANTIC_THEMES.water, category: "Raw Material" };
  }
  // 3. Carbon Dioxide / Air / Gas
  if (combined.includes("co2") || combined.includes("co₂") || combined.includes("carbon") || combined.includes("gas")) {
    return { icon: I.Cloud, theme: SEMANTIC_THEMES.gas, category: "Atmospheric Input" };
  }
  // 4. Photosynthesis / Plant / Biological
  if (combined.includes("photosynthesis") || combined.includes("chloroplast") || combined.includes("chlorophyll") || combined.includes("plant") || combined.includes("leaf")) {
    return { icon: I.Leaf, theme: SEMANTIC_THEMES.biological, category: "Core Reaction" };
  }
  // 5. Glucose / Sugar / Chemical Energy
  if (combined.includes("glucose") || combined.includes("sugar") || combined.includes("c6h12o6") || combined.includes("c₆h₁₂o₆")) {
    return { icon: I.Sparkles, theme: SEMANTIC_THEMES.product, category: "Energy Stored" };
  }
  // 6. Oxygen / Breathable
  if (combined.includes("oxygen") || combined.includes("o2") || combined.includes("o₂")) {
    return { icon: I.Wind, theme: SEMANTIC_THEMES.output, category: "Byproduct Released" };
  }
  // 7. Steam Engine, Coal, Heat
  if (combined.includes("steam") || combined.includes("coal") || combined.includes("heat") || combined.includes("fuel") || combined.includes("watt")) {
    return { icon: I.Flame, theme: SEMANTIC_THEMES.energy, category: "Power Source" };
  }
  // 8. Spinning Jenny, Loom, Factory, Textile
  if (combined.includes("spinning") || combined.includes("loom") || combined.includes("factory") || combined.includes("textile") || combined.includes("cloth")) {
    return { icon: I.Building2, theme: SEMANTIC_THEMES.process, category: "Mechanization" };
  }
  // 9. Labor, Child Labor, Workers, Reform, Union
  if (combined.includes("worker") || combined.includes("labor") || combined.includes("reform") || combined.includes("union") || combined.includes("law")) {
    return { icon: I.Scale, theme: SEMANTIC_THEMES.default, category: "Social Reform" };
  }
  // 10. General Energy
  if (sem === "energy" || combined.includes("energy") || combined.includes("power") || combined.includes("electricity")) {
    return { icon: I.Zap, theme: SEMANTIC_THEMES.energy, category: "Energy" };
  }
  // 11. General Input / Resource
  if (sem === "input" || sem === "resource") {
    return { icon: I.ArrowDownToLine, theme: SEMANTIC_THEMES.water, category: "Input" };
  }
  // 12. General Output / Result
  if (sem === "output" || sem === "result") {
    return { icon: I.CheckCircle2, theme: SEMANTIC_THEMES.output, category: "Output" };
  }
  // 13. General Process / Action
  if (sem === "process" || sem === "action") {
    return { icon: I.Cpu, theme: SEMANTIC_THEMES.process, category: "Process" };
  }
  // 14. Cause
  if (sem === "cause") {
    return { icon: I.HelpCircle, theme: SEMANTIC_THEMES.cause, category: "Cause" };
  }
  // 15. Effect
  if (sem === "effect") {
    return { icon: I.Target, theme: SEMANTIC_THEMES.effect, category: "Effect" };
  }

  // Fallback
  return { icon: I.CircleDot, theme: SEMANTIC_THEMES.default, category: "Concept" };
}

/**
 * Reusable Node Card
 */
function InfographicNodeCard({ node, index, isHero = false, activeNodeId, onSelectNode, badgeText }) {
  const { icon: IconComponent, theme, category } = resolveNodeVisuals(node);
  const isSelected = activeNodeId === node.id;

  return (
    <div
      onClick={() => onSelectNode && onSelectNode(node)}
      style={{
        background: theme.bg,
        border: `2px solid ${isSelected ? "#4f46e5" : theme.border}`,
        borderRadius: isHero ? 16 : 14,
        padding: isHero ? "16px 18px" : "12px 14px",
        boxShadow: isHero
          ? `0 10px 25px ${theme.glow}, 0 4px 10px rgba(0,0,0,0.04)`
          : isSelected
          ? "0 6px 16px rgba(79, 70, 229, 0.25)"
          : "0 2px 8px rgba(0,0,0,0.04)",
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        transform: isSelected ? "translateY(-2px) scale(1.02)" : "none",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {/* Top row: Icon + Category Badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div
          style={{
            width: isHero ? 38 : 32,
            height: isHero ? 38 : 32,
            borderRadius: 10,
            background: theme.iconBg,
            color: theme.iconColor,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <IconComponent size={isHero ? 20 : 17} />
        </div>

        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            padding: "2px 8px",
            borderRadius: 999,
            background: theme.badgeBg,
            color: theme.badgeText,
          }}
        >
          {badgeText || category}
        </span>
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: isHero ? 16 : 14,
          fontWeight: 800,
          color: theme.text,
          lineHeight: 1.25,
          marginTop: 2,
        }}
      >
        {node.label}
      </div>

      {/* Description / Formula */}
      {node.description && (
        <div
          style={{
            fontSize: 12,
            color: theme.subtext,
            lineHeight: 1.45,
            fontWeight: 500,
          }}
        >
          {node.description}
        </div>
      )}
    </div>
  );
}

/**
 * Connector Arrow with Relationship Label
 */
function ConnectorBadge({ label = "produces", direction = "down", split = false }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: direction === "down" ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        margin: direction === "down" ? "8px 0" : "0 8px",
        gap: 4,
      }}
    >
      {split ? (
        <div style={{ display: "flex", width: "100%", justifyContent: "space-around", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <I.ArrowDownLeft size={22} style={{ color: "#8b5cf6" }} />
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                background: "#ede9fe",
                color: "#6d28d9",
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid #ddd6fe",
              }}
            >
              synthesizes
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <I.ArrowDownRight size={22} style={{ color: "#0d9488" }} />
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                background: "#ccfbf1",
                color: "#0f766e",
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid #99f6e4",
              }}
            >
              releases
            </span>
          </div>
        </div>
      ) : (
        <>
          {direction === "down" && (
            <div
              style={{
                width: 2,
                height: 12,
                background: "linear-gradient(to bottom, #cbd5e1, #818cf8)",
              }}
            />
          )}
          {label && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#4f46e5",
                background: "#eef2ff",
                border: "1px solid #c7d2fe",
                padding: "2px 10px",
                borderRadius: 999,
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
                boxShadow: "0 1px 4px rgba(79, 70, 229, 0.08)",
              }}
            >
              {label}
            </span>
          )}
          {direction === "down" ? (
            <I.ArrowDown size={18} style={{ color: "#4f46e5", marginTop: -2 }} />
          ) : (
            <I.ArrowRight size={18} style={{ color: "#4f46e5" }} />
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT 1: PHOTOSYNTHESIS & MULTI-STAGE PROCESS
// ─────────────────────────────────────────────────────────────────────────────
function ProcessInfographic({ nodes, connections, activeNodeId, onSelectNode }) {
  // Check if this matches a Photosynthesis/Converge-Diverge pattern
  const coreNode = nodes.find(
    (n) =>
      n.label.toLowerCase().includes("photosynthesis") ||
      n.description.toLowerCase().includes("conversion") ||
      n.semantic_type === "process"
  ) || nodes[Math.floor(nodes.length / 2)];

  const inputs = nodes.filter(
    (n) =>
      n.id !== coreNode?.id &&
      (n.semantic_type === "input" ||
        n.semantic_type === "resource" ||
        n.semantic_type === "energy" ||
        n.semantic_type === "light" ||
        n.label.toLowerCase().includes("sun") ||
        n.label.toLowerCase().includes("water") ||
        n.label.toLowerCase().includes("co2") ||
        n.label.toLowerCase().includes("light"))
  );

  const outputs = nodes.filter(
    (n) =>
      n.id !== coreNode?.id &&
      !inputs.some((inp) => inp.id === n.id)
  );

  // If we have a clear Input → Core → Output structure (Photosynthesis pattern)
  if (inputs.length > 0 && coreNode && outputs.length > 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%", padding: "4px 0" }}>
        {/* Tier 1: Inputs Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            1. Essential Inputs & Energy
          </span>
          <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
        </div>

        {/* Tier 1: Input Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fit, minmax(130px, 1fr))`,
            gap: 10,
          }}
        >
          {inputs.map((node, i) => (
            <InfographicNodeCard
              key={node.id}
              node={node}
              index={i}
              activeNodeId={activeNodeId}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>

        {/* Central Convergence Connector */}
        <div style={{ margin: "10px 0" }}>
          <ConnectorBadge label="absorbed & converted inside chloroplast" direction="down" />
        </div>

        {/* Tier 2: Core Transformation Hero Card */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            2. Core Biological Reaction
          </span>
          <div style={{ flex: 1, height: 1, background: "#bbf7d0" }} />
        </div>

        <InfographicNodeCard
          node={coreNode}
          isHero={true}
          activeNodeId={activeNodeId}
          onSelectNode={onSelectNode}
          badgeText="Chemical Transformation"
        />

        {/* Diverging Branching Connectors */}
        <div style={{ margin: "10px 0" }}>
          <ConnectorBadge split={true} />
        </div>

        {/* Tier 3: Outputs Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#0f766e", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            3. Final Products & Energy Storage
          </span>
          <div style={{ flex: 1, height: 1, background: "#99f6e4" }} />
        </div>

        {/* Tier 3: Output Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))`,
            gap: 10,
          }}
        >
          {outputs.map((node, i) => (
            <InfographicNodeCard
              key={node.id}
              node={node}
              index={i}
              activeNodeId={activeNodeId}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      </div>
    );
  }

  // Linear Sequential Process (Step 1 → Step 2 → Step 3)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {nodes.map((node, i) => (
        <React.Fragment key={node.id}>
          <div style={{ display: "flex", alignItems: "stretch", gap: 12 }}>
            {/* Step Number Spine */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28, flexShrink: 0 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#4f46e5",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 800,
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 2px 6px rgba(79, 70, 229, 0.3)",
                }}
              >
                {i + 1}
              </div>
              {i < nodes.length - 1 && (
                <div style={{ width: 2, flex: 1, background: "linear-gradient(#4f46e5, #cbd5e1)", margin: "4px 0" }} />
              )}
            </div>

            {/* Card */}
            <div style={{ flex: 1 }}>
              <InfographicNodeCard
                node={node}
                index={i}
                activeNodeId={activeNodeId}
                onSelectNode={onSelectNode}
                badgeText={`Stage ${i + 1}`}
              />
            </div>
          </div>
          {i < nodes.length - 1 && (
            <div style={{ marginLeft: 34, padding: "2px 0" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#6366f1" }}>↓ leads to</span>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT 2: CHRONOLOGICAL TIMELINE
// ─────────────────────────────────────────────────────────────────────────────
function TimelineInfographic({ nodes, activeNodeId, onSelectNode }) {
  return (
    <div style={{ position: "relative", padding: "8px 0" }}>
      {/* Central spine */}
      <div
        style={{
          position: "absolute",
          left: 20,
          top: 10,
          bottom: 10,
          width: 3,
          background: "linear-gradient(to bottom, #6366f1, #a855f7, #ec4899)",
          borderRadius: 999,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {nodes.map((node, i) => {
          const { icon: IconComp, theme } = resolveNodeVisuals(node);
          // Try to extract date/year from label or description (e.g. 1764, 1769, 1833)
          const dateMatch = (node.label + " " + (node.description || "")).match(/\b(1\d{3}|20\d{2})\b/);
          const dateLabel = dateMatch ? dateMatch[0] : `Event ${i + 1}`;

          return (
            <div key={node.id} style={{ display: "flex", gap: 14, alignItems: "flex-start", paddingLeft: 6 }}>
              {/* Timeline marker node */}
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: theme.iconBg,
                  border: `3px solid #fff`,
                  boxShadow: `0 0 0 2px ${theme.border}, 0 2px 8px rgba(0,0,0,0.08)`,
                  display: "grid",
                  placeItems: "center",
                  color: theme.iconColor,
                  zIndex: 2,
                  flexShrink: 0,
                }}
              >
                <IconComp size={15} />
              </div>

              {/* Event Card */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "inline-block", background: "#ede9fe", color: "#6d28d9", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6, marginBottom: 4 }}>
                  📅 {dateLabel}
                </div>
                <InfographicNodeCard
                  node={node}
                  index={i}
                  activeNodeId={activeNodeId}
                  onSelectNode={onSelectNode}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT 3: CONCEPT MAP (Central Hub & Radiant Nodes)
// ─────────────────────────────────────────────────────────────────────────────
function ConceptMapInfographic({ nodes, centralConcept, activeNodeId, onSelectNode }) {
  const hubLabel = centralConcept || (nodes[0] ? nodes[0].label : "Core Concept");
  const hubNode = nodes.find((n) => n.label.toLowerCase() === hubLabel.toLowerCase()) || {
    id: "hub",
    label: hubLabel,
    description: "Central educational focus",
    semantic_type: "process",
  };
  const satellites = nodes.filter((n) => n.id !== hubNode.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Central Hub Hero Node */}
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 4, letterSpacing: "0.06em" }}>
          Central Focus
        </div>
        <InfographicNodeCard
          node={hubNode}
          isHero={true}
          activeNodeId={activeNodeId}
          onSelectNode={onSelectNode}
          badgeText="Hub Concept"
        />
      </div>

      {/* Radial Bridge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0" }}>
        <I.Share2 size={16} style={{ color: "#6366f1" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#4f46e5" }}>connected sub-concepts</span>
        <div style={{ flex: 1, height: 1, background: "#c7d2fe" }} />
      </div>

      {/* Satellite Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        {satellites.map((sat, i) => (
          <InfographicNodeCard
            key={sat.id}
            node={sat}
            index={i}
            activeNodeId={activeNodeId}
            onSelectNode={onSelectNode}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT 4: CAUSE & EFFECT (Split Two-Column)
// ─────────────────────────────────────────────────────────────────────────────
function CauseEffectInfographic({ nodes, activeNodeId, onSelectNode }) {
  const midpoint = Math.ceil(nodes.length / 2);
  const causes = nodes.slice(0, midpoint);
  const effects = nodes.slice(midpoint);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Causes section */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#c2410c", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            ⚡ Root Causes & Drivers
          </span>
          <div style={{ flex: 1, height: 1, background: "#ffedd5" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {causes.map((node, i) => (
            <InfographicNodeCard
              key={node.id}
              node={{ ...node, semantic_type: "cause" }}
              index={i}
              activeNodeId={activeNodeId}
              onSelectNode={onSelectNode}
              badgeText="Cause"
            />
          ))}
        </div>
      </div>

      {/* Bridge connector */}
      <ConnectorBadge label="causes & triggers" direction="down" />

      {/* Effects section */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#065f46", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            🎯 Observed Outcomes & Impacts
          </span>
          <div style={{ flex: 1, height: 1, background: "#d1fae5" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {effects.map((node, i) => (
            <InfographicNodeCard
              key={node.id}
              node={{ ...node, semantic_type: "effect" }}
              index={i}
              activeNodeId={activeNodeId}
              onSelectNode={onSelectNode}
              badgeText="Outcome"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT 5: SIDE-BY-SIDE COMPARISON
// ─────────────────────────────────────────────────────────────────────────────
function ComparisonInfographic({ nodes, activeNodeId, onSelectNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))`, gap: 12 }}>
        {nodes.map((node, i) => (
          <div key={node.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#4f46e5", textTransform: "uppercase", textAlign: "center" }}>
              Case {i + 1}
            </div>
            <InfographicNodeCard
              node={node}
              index={i}
              activeNodeId={activeNodeId}
              onSelectNode={onSelectNode}
            />
          </div>
        ))}
      </div>
      <div style={{ background: "#f1f5f9", padding: "10px 14px", borderRadius: 10, fontSize: 12, color: "#334155", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
        <I.Scale size={16} style={{ color: "#6366f1", flexShrink: 0 }} />
        <span>Compare the core distinctions and operational parameters highlighted above.</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT 6: CIRCULAR CYCLE
// ─────────────────────────────────────────────────────────────────────────────
function CycleInfographic({ nodes, activeNodeId, onSelectNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <I.RotateCw size={16} style={{ color: "#7c3aed" }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: "#5b21b6", textTransform: "uppercase" }}>
          Perpetual Cycle Flow
        </span>
        <div style={{ flex: 1, height: 1, background: "#ede9fe" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 10 }}>
        {nodes.map((node, i) => (
          <InfographicNodeCard
            key={node.id}
            node={node}
            index={i}
            activeNodeId={activeNodeId}
            onSelectNode={onSelectNode}
            badgeText={`Step ${i + 1}`}
          />
        ))}
      </div>

      {/* Return loop indicator */}
      <div
        style={{
          background: "#fdf4ff",
          border: "1px dashed #d946ef",
          borderRadius: 10,
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          fontSize: 12,
          fontWeight: 700,
          color: "#86198f",
          marginTop: 6,
        }}
      >
        <I.RotateCw size={14} />
        <span>Output feeds continuously back into Step 1</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT 7: NUMERICAL DATA CHART
// ─────────────────────────────────────────────────────────────────────────────
function NumericalChartInfographic({ data = [] }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map((d) => d.value || 0), 1);

  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#1e1b4b", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
        <I.BarChart3 size={16} style={{ color: "#4f46e5" }} />
        <span>Quantitative Comparison</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.map((item, i) => {
          const pct = Math.min(100, Math.round(((item.value || 0) / maxVal) * 100));
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: "#334155" }}>{item.label}</span>
                <span style={{ fontWeight: 800, color: "#4f46e5" }}>
                  {item.value} {item.unit || ""}
                </span>
              </div>
              <div style={{ height: 10, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: "linear-gradient(90deg, #6366f1, #a855f7)",
                    borderRadius: 999,
                    transition: "width 0.6s ease-out",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER INFOGRAPHIC COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function VisualInfographic({
  spec = {},
  sourceImages = [],
  onReadAloud,
  svgHtmlFallback = null,
}) {
  const [activeNode, setActiveNode] = useState(null);
  const [imgIndex, setImgIndex] = useState(0);

  // If source images from PDF exist, prioritize showing the authentic source figure
  const hasSourceImages = sourceImages && sourceImages.length > 0;

  const visualType = spec.visual_type || "process";
  const nodes = spec.nodes || [];
  const connections = spec.connections || [];
  const chartData = spec.data || [];

  return (
    <div style={{ padding: "0 18px", marginTop: 12 }}>
      {/* 1. PDF SOURCE VISUAL (Priority if present) */}
      {hasSourceImages && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                background: "#fef3c7",
                color: "#92400e",
                padding: "3px 9px",
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <I.FileText size={12} /> Source Figure from Document
            </span>
          </div>

          <div
            style={{
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid #e2e8f0",
              background: "#fafafa",
              boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
            }}
          >
            <img
              src={`data:image/png;base64,${sourceImages[imgIndex]}`}
              alt={`Source figure ${imgIndex + 1}`}
              style={{ width: "100%", maxHeight: 320, objectFit: "contain", display: "block" }}
            />
            {sourceImages.length > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "8px 0", background: "#f8fafc" }}>
                {sourceImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIndex(i)}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      border: "none",
                      background: i === imgIndex ? "#4f46e5" : "#cbd5e1",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. DYNAMIC EDUCATIONAL INFOGRAPHIC BY TYPE */}
      {nodes.length > 0 ? (
        <div style={{ marginTop: 8 }}>
          {visualType === "timeline" ? (
            <TimelineInfographic
              nodes={nodes}
              activeNodeId={activeNode?.id}
              onSelectNode={setActiveNode}
            />
          ) : visualType === "concept_map" ? (
            <ConceptMapInfographic
              nodes={nodes}
              centralConcept={spec.central_concept}
              activeNodeId={activeNode?.id}
              onSelectNode={setActiveNode}
            />
          ) : visualType === "cause_effect" ? (
            <CauseEffectInfographic
              nodes={nodes}
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
          ) : visualType === "bar_chart" && chartData.length > 0 ? (
            <NumericalChartInfographic data={chartData} />
          ) : (
            /* Default to smart Multi-Stage Process (Photosynthesis pattern) */
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
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
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
          <div style={{ fontWeight: 800, fontSize: 13, color: "#1e1b4b", marginBottom: 2 }}>
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
