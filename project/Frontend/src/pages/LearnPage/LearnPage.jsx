import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as I from "lucide-react";
import { useSession } from "../../context/SessionContext";
import { useWebcam } from "../../hooks/WebcamContext";
import { useToast } from "../../components/PrismToast";
import { WebcamStatusBadge } from "../../components/WebcamStatusBadge";
import { useWebcamToasts } from "../../hooks/useWebcamToasts.jsx";
import VisualInfographic from "../../components/VisualInfographic";
import VoiceAssistant from "../../components/VoiceAssistant";
import { Layout } from "../../components/Layout/Layout";
import { formatReadTime } from "../../utils/formatReadTime";
import { evaluateSignals } from "../../engine/signals";
import { SCALE_CONFIG } from "../../engine/scale";
import ErrorNotice from "../../components/ErrorNotice";
import { speakFemaleVoice, stopSpeech } from "../../utils/speechVoice";
import "./LearnPage.css";

function VisualCard({ visual, cluster = null, sections = [], onReadAloud, clusterIndex = -1, clusterTotal = 0 }) {
  if (!visual) return null;

  const {
    source        = "prism",
    visual_type   = "none",
    title         = "",
    subtitle      = "",
    explanation   = "",
    key_takeaways = [],
    why_visual    = "",
    svg_html      = null,
    source_images = [],
    spec          = {},
    error         = null,
    covers_label  = "",
    start_section_index = null,
    end_section_index   = null,
  } = visual;

  const [expandedSections, setExpandedSections] = useState(false);
  const [activeNode, setActiveNode] = useState(null);
  const [isPlayingNotes, setIsPlayingNotes] = useState(false);

  // Stop audio and clear spotlight when switching visuals
  useEffect(() => {
    setActiveNode(null);
    setIsPlayingNotes(false);
    return () => {
      stopSpeech();
    };
  }, [title, visual]);

  function handleToggleNotesAudio() {
    if (isPlayingNotes) {
      stopSpeech();
      setIsPlayingNotes(false);
      return;
    }
    const fullNotesText = [explanation, ...(key_takeaways || [])].filter(Boolean).join(". ");
    if (!fullNotesText.trim()) return;
    speakFemaleVoice(fullNotesText, {
      onStart: () => setIsPlayingNotes(true),
      onEnd: () => setIsPlayingNotes(false),
      onError: () => setIsPlayingNotes(false),
    });
    setIsPlayingNotes(true);
  }

  // Compute coverage label
  const coverageText = covers_label || (
    start_section_index !== null && end_section_index !== null
      ? `Covers: Sections ${start_section_index + 1}–${end_section_index + 1}`
      : ""
  );

  // Filter sections that this visual covers
  const startIndex = start_section_index ?? cluster?.start_section_index ?? null;
  const endIndex = end_section_index ?? cluster?.end_section_index ?? null;
  const coveredSections = (Array.isArray(sections) && startIndex !== null && endIndex !== null)
    ? sections.slice(startIndex, endIndex + 1)
    : [];

  if (error) {
    return (
      <section className="card" style={{ padding: 18, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#b91c1c" }}>
          <I.AlertCircle size={20} />
          <span>{error}</span>
        </div>
      </section>
    );
  }

  const hasNotes = Boolean(explanation || (key_takeaways && key_takeaways.length > 0) || why_visual);

  return (
    <section className="card prism-visual-card" style={{ marginTop: 16, padding: "20px 22px" }}>
      <div className="prism-visual-card-header">
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {clusterIndex >= 0 && clusterTotal > 0 && (
              <span className="pill" style={{ background: "var(--primary-gradient)", color: "#ffffff", fontWeight: 800, letterSpacing: "0.02em", boxShadow: "0 2px 6px rgba(31, 94, 99, 0.25)" }}>
                <I.Eye size={12} style={{ marginRight: 4 }} />
                Visual {clusterIndex + 1} of {clusterTotal}
              </span>
            )}
            <span className="pill" style={{ background: source === "pdf" ? "#fef3c7" : "var(--primary-light)", color: source === "pdf" ? "#92400e" : "var(--primary)", fontWeight: 700 }}>
              {source === "pdf" ? "SOURCE VISUAL" : "PRISM CONCEPT VISUAL"}
            </span>
            {coverageText && (
              <span className="pill visual-coverage-pill">
                <I.Layers size={12} style={{ marginRight: 4 }} />
                {coverageText}
              </span>
            )}
            {(cluster?.suggested_visual_type || visual_type) && visual_type !== "none" && (
              <span className="pill" style={{ background: "#f1f5f9", color: "#475569", textTransform: "capitalize", fontWeight: 600 }}>
                {(cluster?.suggested_visual_type || visual_type).replace(/_/g, " ")}
              </span>
            )}
          </div>
          {title && (
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 20, margin: "6px 0 2px", color: "var(--ink)", fontWeight: 800 }}>
              {cleanHeading(title, subtitle || cluster?.title, 1)}
            </h2>
          )}
          {subtitle && <p style={{ fontSize: 13, color: "var(--muted)", margin: "2px 0 0" }}>{subtitle}</p>}
        </div>
      </div>

      {coveredSections.length > 0 && (
        <div className="covered-sections-dropdown-container">
          <button
            type="button"
            className="covered-sections-toggle-btn"
            onClick={() => setExpandedSections(!expandedSections)}
            aria-expanded={expandedSections}
          >
            <span>
              <strong>{coveredSections.length}</strong> sections synthesized in this visual
            </span>
            {expandedSections ? <I.ChevronUp size={15} /> : <I.ChevronDown size={15} />}
          </button>
          {expandedSections && (
            <ul className="covered-sections-list">
              {coveredSections.map((sec, sIdx) => {
                const secNum = (startIndex ?? 0) + sIdx + 1;
                return (
                  <li key={sIdx} className="covered-sections-item">
                    <span className="covered-sec-badge">Section {secNum}</span>
                    <span className="covered-sec-heading">{sec.heading || `Concept Part ${sIdx + 1}`}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── Side-by-Side Visual Split Layout ── */}
      <div className={`visual-split-layout ${!hasNotes ? "no-notes" : ""}`}>
        {/* Left Column: Interactive Visual Infographic */}
        <div className="visual-diagram-column">
          <VisualInfographic
            spec={spec}
            sourceImages={source_images}
            svgHtmlFallback={svg_html}
            onReadAloud={onReadAloud}
            activeNode={activeNode}
            onSelectNode={setActiveNode}
          />
        </div>

        {/* Right Column: Detailed Concept Notes & Key Takeaways */}
        {hasNotes && (
          <div className="visual-notes-column">
            <div className="visual-notes-card">
              <div className="visual-notes-header">
                <div className="visual-notes-title-group">
                  <div className="visual-notes-icon-badge">
                    <I.BookOpen size={16} />
                  </div>
                  <div>
                    <h3 className="visual-notes-title">Detailed Concept Notes</h3>
                    <span className="visual-notes-subtitle">Side-by-side explanation & takeaways</span>
                  </div>
                </div>

                <button
                  type="button"
                  className={`visual-notes-audio-btn ${isPlayingNotes ? "playing" : ""}`}
                  onClick={handleToggleNotesAudio}
                  title={isPlayingNotes ? "Stop audio" : "Read aloud"}
                >
                  {isPlayingNotes ? <I.Square size={13} /> : <I.Volume2 size={13} />}
                  <span>{isPlayingNotes ? "Stop audio" : "Read aloud"}</span>
                </button>
              </div>

              <div className="visual-notes-body">
                {/* Dynamic Node Spotlight when user clicks any diagram node */}
                {activeNode && (
                  <div className="visual-node-spotlight">
                    <div className="spotlight-header">
                      <span className="spotlight-badge">
                        <I.Sparkles size={11} /> Focused Concept
                      </span>
                      <button
                        type="button"
                        className="spotlight-close-btn"
                        onClick={() => setActiveNode(null)}
                        title="Clear selection"
                      >
                        ✕
                      </button>
                    </div>
                    <h4 className="spotlight-node-title">{activeNode.label}</h4>
                    {activeNode.description && (
                      <p className="spotlight-node-desc">{activeNode.description}</p>
                    )}
                  </div>
                )}

                {/* Understand It */}
                {explanation && (
                  <div className="visual-notes-section">
                    <div className="visual-notes-section-header">
                      <I.Lightbulb size={15} className="notes-icon-bulb" />
                      <span>Understand It</span>
                    </div>
                    <p className="visual-notes-paragraph">{explanation}</p>
                  </div>
                )}

                {/* Key Takeaways */}
                {key_takeaways && key_takeaways.length > 0 && (
                  <div className="visual-notes-section">
                    <div className="visual-notes-section-header">
                      <I.CheckCircle2 size={15} className="notes-icon-check" />
                      <span>Key Takeaways</span>
                    </div>
                    <ul className="visual-takeaways-list">
                      {key_takeaways.map((takeaway, tIdx) => (
                        <li key={tIdx} className="visual-takeaway-item">
                          <span className="takeaway-item-num">{tIdx + 1}</span>
                          <span className="takeaway-item-text">{takeaway}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Why This Visual / Mental Model */}
                {why_visual && (
                  <div className="visual-notes-section visual-why-card">
                    <div className="visual-notes-section-header">
                      <I.Compass size={14} className="notes-icon-compass" />
                      <span>Visual Mental Model</span>
                    </div>
                    <p className="visual-why-text">{why_visual}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function splitIntoLessonSections(text) {
  if (!text || typeof text !== "string") return [];
  const clean = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!clean) return [];

  const lines = clean.split("\n");

  // Patterns for logical section headings:
  // e.g. "1. What is OOP?", "1) Introduction", "Section 1:", "Chapter 2", "## Topic"
  const numberedHeadingRegex = /^(\d+)[\.\)]\s+([A-Z].*)$/;
  const mdHeadingRegex = /^#{1,4}\s+(.*)$/;
  const labelHeadingRegex = /^(?:Chapter|Section|Module|Part|Topic)\s+\d+[:\.]?\s*(.*)$/i;

  let firstHeadingNum = null;
  let matchesCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const numM = trimmed.match(numberedHeadingRegex);
    if (numM) {
      const num = parseInt(numM[1], 10);
      if (firstHeadingNum === null && (num === 1 || num === 0)) {
        firstHeadingNum = num;
      }
      matchesCount++;
    } else if (mdHeadingRegex.test(trimmed) || labelHeadingRegex.test(trimmed)) {
      matchesCount++;
    }
  }

  const hasHeadings = matchesCount >= 2;

  if (hasHeadings) {
    const sections = [];
    let currentLines = [];
    let expectedNextNumber = firstHeadingNum !== null ? firstHeadingNum : 1;
    let headingSeen = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) {
        if (currentLines.length > 0) currentLines.push("");
        continue;
      }

      const numM = trimmed.match(numberedHeadingRegex);
      const isMd = mdHeadingRegex.test(trimmed);
      const isLabel = labelHeadingRegex.test(trimmed);

      let isNewHeading = false;
      if (numM) {
        const num = parseInt(numM[1], 10);
        if (num === expectedNextNumber) {
          isNewHeading = true;
          expectedNextNumber = num + 1;
        }
      } else if (isMd || isLabel) {
        isNewHeading = true;
      }

      if (isNewHeading) {
        if (!headingSeen) {
          headingSeen = true;
          // Preamble before first heading (e.g. document title / subtitle)
          if (currentLines.length > 0) {
            const preambleText = currentLines.join("\n").trim();
            // If preamble is short (title / subtitle), attach it to the first section
            if (preambleText.split(/\s+/).length < 40) {
              currentLines = [preambleText, "", trimmed];
            } else {
              sections.push(preambleText);
              currentLines = [trimmed];
            }
          } else {
            currentLines = [trimmed];
          }
        } else {
          if (currentLines.length > 0) {
            sections.push(currentLines.join("\n").trim());
          }
          currentLines = [trimmed];
        }
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      sections.push(currentLines.join("\n").trim());
    }

    const filtered = sections.map((s) => s.trim()).filter(Boolean);
    if (filtered.length >= 2) {
      return filtered;
    }
  }

  // Fallback 2: Check for double line breaks (paragraphs)
  const paragraphs = clean.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length >= 2 && paragraphs.length <= 15) {
    return paragraphs;
  }

  // Fallback 3: Group paragraphs or sentences into 3-5 sentence chunks
  const sentenceRegex = /(?<=[.!?])\s+(?=[A-Z0-9])/;
  const rawParts = (paragraphs.length > 1 ? paragraphs : clean.split(sentenceRegex))
    .map((p) => p.trim())
    .filter(Boolean);

  const groupedSections = [];
  let currentGroup = [];
  let currentWordCount = 0;

  for (const part of rawParts) {
    const words = part.split(/\s+/).length;
    currentGroup.push(part);
    currentWordCount += words;

    // Group around 3-5 sentences or 60-120 words
    if (currentWordCount >= 70 || currentGroup.length >= 4) {
      groupedSections.push(currentGroup.join("\n\n").trim());
      currentGroup = [];
      currentWordCount = 0;
    }
  }

  if (currentGroup.length > 0) {
    if (groupedSections.length > 0 && currentWordCount < 30) {
      groupedSections[groupedSections.length - 1] += "\n\n" + currentGroup.join("\n\n").trim();
    } else {
      groupedSections.push(currentGroup.join("\n\n").trim());
    }
  }

  return groupedSections.length > 0 ? groupedSections : [clean];
}

/**
 * Sanitizes headings to ensure they are never solitary numbers (e.g. "6", "9", "10")
 * which occur when split on numbered prefixes or unmapped PDF subheadings.
 */
export function cleanHeading(heading, paragraph = "", fallbackNum = 1) {
  let h = (heading || "").trim();
  // Strip leading numbering "9. ", "9) ", "Section 9: ", "## "
  h = h.replace(/^(?:#{1,6}\s*|\d+[\.\)]\s*|(?:Section|Chapter|Part)\s*\d+[:\.]?\s*)/i, "").trim();

  // If h is empty, purely digits, or has fewer than 3 alphabet characters (e.g. "6", "9", "10", "4")
  const letters = h.match(/[a-zA-Z]/g);
  if (!letters || letters.length < 3) {
    if (paragraph && typeof paragraph === "string") {
      const lines = paragraph.split("\n").map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const cleanedLine = line.replace(/^(?:#{1,6}\s*|\d+[\.\)]\s*|(?:Section|Chapter|Part)\s*\d+[:\.]?\s*|[-•*]\s*)/i, "").trim();
        const lMatch = cleanedLine.match(/[a-zA-Z]/g);
        if (lMatch && lMatch.length >= 3) {
          const sentenceParts = cleanedLine.split(/(?<=[a-zA-Z0-9])\.\s+/);
          const firstSentence = (sentenceParts[0] || cleanedLine).replace(/[.:]+$/, "").trim();
          return firstSentence.length > 50 ? firstSentence.slice(0, 48) + "…" : firstSentence;
        }
      }
    }
    return `Section ${fallbackNum}`;
  }
  return h;
}

/**
 * Robust section difficulty resolver:
 * Ensures realistic progression (foundational -> intermediate -> advanced)
 * based on pedagogical keywords and position in the curriculum,
 * even when backend metadata defaulted all items to intermediate.
 */
export function resolveSectionDifficulty(section, index = 0, totalSections = 1) {
  const explicitTier = section?.meta?.difficulty_tier;
  if (explicitTier === "foundational" || explicitTier === "advanced") {
    return explicitTier;
  }

  const text = (
    (section?.heading || "") + " " +
    (section?.paragraph || section?.content || "")
  ).toLowerCase();

  const foundationalKeywords = [
    "what is", "introduction", "intro", "overview", "basics", "foundation",
    "blueprint", "definition", "defining", "elementary", "first step",
    "terminology", "starting with", "simple example", "syntax", "purpose", "core concept",
    "mental model", "thinking in", "state and behavior", "physical entity"
  ];
  const advancedKeywords = [
    "polymorphism", "dynamic dispatch", "concurrency", "solid", "architecture",
    "design pattern", "interface segregation", "dependency inversion", "liskov",
    "composition over inheritance", "substitutability", "trade-off", "coupling", "cohesion",
    "architectural", "invariants", "common interface", "extensibility", "flexible design",
    "loosely coupled"
  ];
  const intermediateKeywords = [
    "encapsulation", "inheritance", "subclass", "superclass", "overriding",
    "attributes", "parameters", "lifecycle", "instantiation", "access modifier",
    "private", "protected", "public", "aggregation", "association", "composition",
    "getter", "setter", "constructor", "validation", "methods"
  ];

  let advScore = 0;
  let foundScore = 0;
  let interScore = 0;

  for (const k of advancedKeywords) {
    if (text.includes(k)) advScore += 2;
  }
  for (const k of foundationalKeywords) {
    if (text.includes(k)) foundScore += 2;
  }
  for (const k of intermediateKeywords) {
    if (text.includes(k)) interScore += 1;
  }

  const relPos = totalSections > 1 ? index / (totalSections - 1) : 0;
  if (relPos < 0.28) {
    foundScore += 3;
  } else if (relPos > 0.68) {
    advScore += 3;
  } else {
    interScore += 2;
  }

  if (advScore >= 4 || (advScore > foundScore && advScore >= 2 && relPos > 0.45)) {
    return "advanced";
  }
  if (foundScore >= 3 && advScore < 3) {
    return "foundational";
  }
  if (relPos < 0.25 && advScore < 2) {
    return "foundational";
  }
  if (relPos > 0.75 && foundScore < 2) {
    return "advanced";
  }

  return "intermediate";
}

function Learn() {
  const {
    session,
    busy,
    adapt,
    ask,
    getVisual,
    loadVisualClusters,
    loadClusterVisual,
    setSelectedClusterId,
    completeChunk,
    completeSection,
    recordRereadAction,
    recordHelpAction,
    recordVoiceHelpAction,
    recordTimeStruggleAction,
    dismissRewire,
    updateActiveDwell,
    resetDwellForNewSection,
    setHasStartedLearning,
    setActiveSectionIndex,
  } = useSession();
  const navigate = useNavigate();
  const transformed = session.transformed;

  // Webcam presence — shared instance from WebcamContext (persists across Step 2→3)
  const webcamHook = useWebcam();
  const { push: pushToast, dismiss: dismissToast } = useToast();

  // Face presence from shared webcam hook
  const facePresent = webcamHook.facePresent;
  const isFaceAway = Boolean(webcamHook.webcamStatus === "ready" && !webcamHook.webcamSkipped && !facePresent);

  // Fire contextual toasts on webcam state transitions
  useWebcamToasts({
    webcam: webcamHook,
    push: pushToast,
    dismiss: dismissToast,
    I,
    toggleCamera:    webcamHook.toggleCamera,
    setWebcamSkipped: webcamHook.setWebcamSkipped,
  });

  const [activeSection, setActiveSection] = useState(session.activeSectionIndex || 0);
  const [playing, setPlaying] = useState(false);
  const [showVisualPanel, setShowVisualPanel] = useState(false);
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);
  const [showQuizPrompt, setShowQuizPrompt] = useState(false);
  const sectionPickerRef = useRef(null);

  // Sync active section to session state
  useEffect(() => {
    if (session.activeSectionIndex !== activeSection) {
      setActiveSectionIndex(activeSection);
    }
  }, [activeSection, session.activeSectionIndex, setActiveSectionIndex]);

  // Ensure hasStartedLearning is true when viewing lesson
  useEffect(() => {
    if (transformed && !session.hasStartedLearning) {
      setHasStartedLearning(true);
    }
  }, [transformed, session.hasStartedLearning, setHasStartedLearning]);

  // Close section dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (sectionPickerRef.current && !sectionPickerRef.current.contains(event.target)) {
        setSectionMenuOpen(false);
      }
    }
    if (sectionMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [sectionMenuOpen]);

  // ── Active Dwell Timer ──────────────────────────────────────────────────────
  // Tracks ONLY active learning time. Pauses during:
  //   • tab hidden (visibilitychange)
  //   • face not detected (user away from camera)
  //   • busy operations (loading, generation, quiz gen)
  //   • section not yet ready
  // Resets on section switch. Uses refs to avoid re-render loops.
  const dwellRef = useRef({ startTime: null, accumulatedMs: 0, sectionIndex: -1 });
  const [sectionContentReady, setSectionContentReady] = useState(false);

  // Helper: get current accumulated active dwell including any in-flight period
  const getCurrentActiveDwellMs = useCallback(() => {
    let total = dwellRef.current.accumulatedMs;
    if (dwellRef.current.startTime !== null) {
      total += Date.now() - dwellRef.current.startTime;
    }
    return total;
  }, []);

  // Helper: pause the active timer (accumulate elapsed, clear startTime)
  const pauseDwellTimer = useCallback(() => {
    if (dwellRef.current.startTime !== null) {
      dwellRef.current.accumulatedMs += Date.now() - dwellRef.current.startTime;
      dwellRef.current.startTime = null;
    }
  }, []);

  // Helper: resume the active timer (set startTime to now)
  const resumeDwellTimer = useCallback(() => {
    if (dwellRef.current.startTime === null) {
      dwellRef.current.startTime = Date.now();
    }
  }, []);

  // Effect 1: Section switching — reset timer for the new section
  useEffect(() => {
    // Flush any accumulated dwell from the previous section into signals
    if (dwellRef.current.sectionIndex >= 0 && dwellRef.current.sectionIndex !== activeSection) {
      pauseDwellTimer();
      updateActiveDwell(dwellRef.current.accumulatedMs);
    }

    // Reset for the new section
    dwellRef.current = { startTime: null, accumulatedMs: 0, sectionIndex: activeSection };
    setSectionContentReady(false);
    resetDwellForNewSection();

    // Mark section content as ready after the next frame (content rendered)
    const frameId = requestAnimationFrame(() => {
      setSectionContentReady(true);
    });
    return () => cancelAnimationFrame(frameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  // Effect 2: Start/stop timer based on conditions
  // Timer runs ONLY when: transformed + not busy + sectionContentReady + tab visible + face present
  useEffect(() => {
    const canTime = transformed && !busy && sectionContentReady && !document.hidden && !isFaceAway;
    if (canTime) {
      resumeDwellTimer();
    } else {
      pauseDwellTimer();
    }
    // Sync active dwell into signals whenever conditions change
    updateActiveDwell(getCurrentActiveDwellMs());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, transformed, sectionContentReady, isFaceAway]);

  // Effect 3: Visibility change — pause on tab hidden, resume on visible
  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden || isFaceAway) {
        pauseDwellTimer();
        updateActiveDwell(getCurrentActiveDwellMs());
      } else if (transformed && !busy && sectionContentReady && !isFaceAway) {
        resumeDwellTimer();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transformed, busy, sectionContentReady, isFaceAway]);

  // Cleanup: flush dwell on unmount (route change away from /learn)
  useEffect(() => {
    return () => {
      pauseDwellTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If user visits /learn after starting learning, but camera is off (e.g., after quitting learning),
  // route them to Step 2 (/profile) to enable camera and calibrate
  useEffect(() => {
    if (
      transformed &&
      session.hasStartedLearning &&
      webcamHook.webcamStatus === "off" &&
      !webcamHook.webcamEnabled &&
      !webcamHook.mediaStream
    ) {
      navigate("/profile");
    }
  }, [transformed, session.hasStartedLearning, webcamHook.webcamStatus, webcamHook.webcamEnabled, webcamHook.mediaStream, navigate]);

  const isCognitiveLoad = transformed?.profile === "cognitive_load";
  const hasStructuredSections = Array.isArray(transformed?.sections) && transformed.sections.length > 0;
  const chunks =
    Array.isArray(transformed?.chunks)
      ? transformed.chunks
      : [transformed?.text || session.text];

  // Extract metadata for each chunk/section
  const chunkMeta = transformed?.chunk_meta || [];
  const sectionMeta = transformed?.section_meta || null;

  let globalIndex = 0;
  const sections = hasStructuredSections
    ? transformed.sections.map((sec, idx) => {
        const rawMeta = chunkMeta[idx] || null;
        const totalCount = transformed.sections.length;
        const sanitizedHeading = cleanHeading(sec.heading, sec.content, idx + 1);
        const resolvedTier = resolveSectionDifficulty(
          { heading: sanitizedHeading, paragraph: sec.content, meta: rawMeta },
          idx,
          totalCount
        );
        const sectionWordCount = (sec.content || "").split(/\s+/).filter(Boolean).length;
        const wpmByDifficulty = { foundational: 220, intermediate: 180, advanced: 140 };
        const wpm = wpmByDifficulty[resolvedTier] || 180;
        const estimatedSec = Math.round((sectionWordCount / wpm) * 60);

        return {
          id: `section-${idx}`,
          heading: sanitizedHeading,
          paragraph: sec.content,
          chunk: idx + 1,
          chunkIndex: idx,
          sectionIndex: idx,
          meta: {
            difficulty_tier: resolvedTier,
            expected_time_multiplier: resolvedTier === "foundational" ? 1.0 : resolvedTier === "advanced" ? 2.5 : 1.6,
            estimated_seconds: rawMeta?.estimated_seconds && rawMeta?.difficulty_tier === resolvedTier
              ? rawMeta.estimated_seconds
              : estimatedSec,
            word_count: rawMeta?.word_count || sectionWordCount,
          },
        };
      })
    : chunks.filter(Boolean).flatMap((chunk, chunkIndex) => {
        // For cognitive_load without structured sections: each chunk IS one section.
        const parts = isCognitiveLoad ? [chunk] : splitIntoLessonSections(chunk);
        const totalEstChunks = Math.max(chunks.length, parts.length * chunks.length);
        return parts.map((paragraph, paragraphIndex) => {
          const idx = globalIndex++;
          const rawMeta = chunkMeta[chunkIndex] || null;
          const sanitizedHeading = cleanHeading(null, paragraph, idx + 1);
          const resolvedTier = resolveSectionDifficulty(
            { heading: sanitizedHeading, paragraph, meta: rawMeta },
            idx,
            totalEstChunks
          );
          const sectionWordCount = paragraph.split(/\s+/).filter(Boolean).length;
          const wpmByDifficulty = { foundational: 220, intermediate: 180, advanced: 140 };
          const wpm = wpmByDifficulty[resolvedTier] || 180;
          const estimatedSec = Math.round((sectionWordCount / wpm) * 60);

          return {
            id: `${chunkIndex}-${paragraphIndex}`,
            heading: sanitizedHeading,
            paragraph,
            chunk: chunkIndex + 1,
            chunkIndex,
            sectionIndex: idx,
            meta: {
              difficulty_tier: resolvedTier,
              expected_time_multiplier: resolvedTier === "foundational" ? 1.0 : resolvedTier === "advanced" ? 2.5 : 1.6,
              estimated_seconds: rawMeta?.estimated_seconds && rawMeta?.difficulty_tier === resolvedTier
                ? rawMeta.estimated_seconds
                : estimatedSec,
              word_count: sectionWordCount,
            },
          };
        });
      });

  const currentSection = sections[activeSection] || sections[0];
  const formatting = transformed?.formatting || {};
  const completedSections = session.completedSections || [];
  const isComplete = completedSections.includes(activeSection);

  // ── Visual Concept Clusters ────────────────────────────────────────────────
  const clusters = session.visualClusters || [];

  // Find cluster covering the active reading section
  const currentSectionCluster = clusters.find(
    (c) => c.start_section_index <= activeSection && activeSection <= c.end_section_index
  ) || null;

  // Selected cluster tab (if manually chosen by user, otherwise follows current reading section)
  const activeCluster = (session.selectedClusterId
    ? clusters.find((c) => c.cluster_id === session.selectedClusterId)
    : null) || currentSectionCluster || clusters[0] || null;

  // Auto-fetch clusters when sections become available
  useEffect(() => {
    if (sections.length > 0 && (!session.visualClusters || session.visualClusters.length === 0) && busy !== "clusters") {
      loadVisualClusters(sections);
    }
  }, [sections.length, session.visualClusters?.length, busy]);

  // When reading section changes, reset manual cluster override so visual follows learner's active section
  useEffect(() => {
    setSelectedClusterId(null);
  }, [activeSection]);

  // Get difficulty and estimated time from section metadata (needed for SCALE evaluation)
  const sectionDifficulty = currentSection?.meta?.difficulty_tier || resolveSectionDifficulty(currentSection, activeSection, sections.length);
  const estimatedSeconds = currentSection?.meta?.estimated_seconds || 60;

  // ── Reading Friction Timer ───────────────────────────────────────────────────
  // Internal reading timer for the current section (no countdown displayed on screen).
  // Includes a 5-second grace threshold for initial page load / reading orientation.
  // Pauses automatically when the user's face is not detected (isFaceAway is true).
  // When active reading time exceeds estimatedSeconds + 5s, inline assistance is triggered
  // beside the prompt buttons, an assistance toast is displayed, and struggle score increases by 10%.
  const [activeReadSeconds, setActiveReadSeconds] = useState(0);
  const [struggleTriggered, setStruggleTriggered] = useState(false);
  const sectionStruggleFiredRef = useRef(new Set());
  const elapsedReadSecondsRef = useRef(0);

  // Keep fresh refs for timer interval callback so interval is NOT torn down on every webcam frame
  const estimatedSecondsRef = useRef(estimatedSeconds);
  estimatedSecondsRef.current = estimatedSeconds;

  const activeSectionRef = useRef(activeSection);
  activeSectionRef.current = activeSection;

  const currentSectionRef = useRef(currentSection);
  currentSectionRef.current = currentSection;

  const isFaceAwayRef = useRef(isFaceAway);
  isFaceAwayRef.current = isFaceAway;

  const canRunTimerRef = useRef(true);
  canRunTimerRef.current = Boolean(transformed && sectionContentReady && !document.hidden && !isFaceAway);

  const recordTimeStruggleRef = useRef(recordTimeStruggleAction);
  recordTimeStruggleRef.current = recordTimeStruggleAction;

  const pushToastRef = useRef(pushToast);
  pushToastRef.current = pushToast;

  // Reset read timer & triggered flag when navigating between sections
  useEffect(() => {
    elapsedReadSecondsRef.current = 0;
    setActiveReadSeconds(0);
    setStruggleTriggered(false);
  }, [activeSection]);

  // Stable read timer ticker: runs once, inspects refs every 1s
  useEffect(() => {
    const interval = setInterval(() => {
      if (!canRunTimerRef.current) return;

      elapsedReadSecondsRef.current += 1;

      const secIdx = activeSectionRef.current;
      const targetThreshold = (estimatedSecondsRef.current || 25) + 5;

      console.log(`[PRISM Timer] Section ${secIdx + 1}: ${elapsedReadSecondsRef.current}s / ${targetThreshold}s`);

      if (elapsedReadSecondsRef.current >= targetThreshold && !sectionStruggleFiredRef.current.has(secIdx)) {
        sectionStruggleFiredRef.current.add(secIdx);
        setStruggleTriggered(true);

        // Record struggle signal
        if (recordTimeStruggleRef.current) {
          recordTimeStruggleRef.current(secIdx, currentSectionRef.current?.paragraph);
        }
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      stopSpeech();
    };
  }, []);

  const evaluation = evaluateSignals(
    session.signals, 
    session.sessionMeta, 
    null, 
    estimatedSeconds,
    sectionDifficulty
  );
  const struggleScore = evaluation.struggleScore;
  const lessonClass =
    transformed?.profile === "dyslexia"
      ? "dyslexia-lesson"
      : transformed?.profile === "low_vision"
        ? "low-vision-lesson"
        : "";

  function readAloud(text) {
    if (playing) {
      stopSpeech();
      setPlaying(false);
      return;
    }
    if (!text || !text.trim()) return;
    speakFemaleVoice(text, {
      onStart: () => setPlaying(true),
      onEnd: () => setPlaying(false),
      onError: () => setPlaying(false),
    });
    setPlaying(true);
  }

  // Track scroll consistency for SCALE evidence
  const [scrollConsistent, setScrollConsistent] = useState(true);
  const lastScrollY = React.useRef(0);
  const scrollReversals = React.useRef(0);

  React.useEffect(() => {
    function onScroll() {
      const currentY = window.scrollY;
      const diff = currentY - lastScrollY.current;
      if (diff < -40) {
        scrollReversals.current += 1;
        if (scrollReversals.current > 2) setScrollConsistent(false);
      } else if (diff > 40) {
        if (scrollReversals.current > 0) scrollReversals.current -= 0.5;
        if (scrollReversals.current <= 1) setScrollConsistent(true);
      }
      lastScrollY.current = currentY;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function markSectionComplete() {
    // Flush active dwell into signals before completing
    pauseDwellTimer();
    const finalDwellMs = getCurrentActiveDwellMs();
    updateActiveDwell(finalDwellMs);

    completeSection(activeSection);
    // Pass current webcam context so SCALE receives all 5 signals as supporting evidence
    // Also pass estimated reading time baseline for dynamic dwell ratio computation
    completeChunk({
      presence_ratio:        webcamHook.presenceRatio,
      face_present_now:      webcamHook.facePresent,
      head_stable_now:       webcamHook.headStable,
      tab_focused_now:       webcamHook.tabFocused,
      scroll_consistent_now: scrollConsistent,
      // camelCase aliases
      presenceRatio:         webcamHook.presenceRatio,
      facePresentNow:        webcamHook.facePresent,
      headStableNow:         webcamHook.headStable,
      tabFocusedNow:         webcamHook.tabFocused,
      scrollConsistentNow:   scrollConsistent,
    }, estimatedSeconds);

    const isLastSection = activeSection === sections.length - 1;
    const currentCompleted = session.completedSections || [];
    const newCompletedSections = currentCompleted.includes(activeSection)
      ? currentCompleted
      : [...currentCompleted, activeSection];
    const allDone = sections.length > 0 && sections.every((_, idx) => newCompletedSections.includes(idx));

    if (allDone) {
      // All sections complete — ask learner to take the Practice Quiz
      setShowQuizPrompt(true);
    } else if (!isLastSection) {
      setActiveSection((index) => index + 1);
    }
  }

  const isAdapted =
    session.rewireState.active &&
    (currentSection?.sectionIndex === session.rewireState.chunkIndex ||
      currentSection?.chunkIndex === session.rewireState.chunkIndex ||
      (chunks.length === 1 && session.rewireState.chunkIndex === activeSection));
  const displayText = isAdapted
    ? session.rewireState.adaptedContent?.adapted_text || currentSection?.paragraph
    : currentSection?.paragraph;

  // Floating voice assistant panel state
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceAutoPrompt, setVoiceAutoPrompt] = useState(null);

  function handleTriggerVoicePrompt(promptQuery) {
    if (currentSection) {
      recordHelpAction(activeSection, currentSection.paragraph);
      recordVoiceHelpAction();
    }
    setVoiceAutoPrompt({ query: promptQuery, timestamp: Date.now() });
    setVoiceOpen(true);
  }

  // Format difficulty for display (sectionDifficulty and estimatedSeconds already defined above)
  const difficultyLabel = sectionDifficulty.toUpperCase();
  const difficultyColor = 
    sectionDifficulty === "foundational" ? "#10b981" : 
    sectionDifficulty === "advanced" ? "#f59e0b" : 
    "#fce072";

  // Topic title: use structured heading if available, otherwise first line
  const sectionTopic =
    cleanHeading(currentSection?.heading, currentSection?.paragraph, activeSection + 1) ||
    session.lessonTitle ||
    "Lesson";

  const allSectionsCompleted =
    sections.length > 0 &&
    sections.every((_, idx) => (session.completedSections || []).includes(idx));

  return (
    <Layout section="Learn">
      <main className="page learn-page">

        {/* ── All sections complete banner ───────────────────────────── */}
        {allSectionsCompleted && (
          <div
            className="card"
            style={{
              marginBottom: 16,
              padding: "16px 20px",
              background: "linear-gradient(135deg, #f0fdf4 0%, rgba(252, 224, 114, 0.15) 100%)",
              border: "2px solid #86efac",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "#059669",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <I.Trophy size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#065f46" }}>
                  All Sections Complete!
                </div>
                <div style={{ fontSize: 13, color: "#166534", marginTop: 2 }}>
                  You have completed every section. Ready to test your understanding with the AI Practice Quiz?
                </div>
              </div>
            </div>
            <button
              className="primary-action"
              style={{
                background: "#059669",
                padding: "9px 18px",
                fontSize: 14,
                width: "auto",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
              onClick={() => navigate("/practice")}
            >
              Take Practice Quiz <I.ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ── REWIRE Banner ──────────────────────────────────────────── */}
        {session.rewireState.active && (
          <div className="rewire-banner">
            <div className="rewire-header">
              <span className="rewire-tag">
                <I.Zap size={13} style={{ marginRight: 4 }} /> REWIRE ACTIVATED
              </span>
              <button
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4 }}
                onClick={dismissRewire}
              >
                <I.X size={16} />
              </button>
            </div>
            <div className="rewire-title">Cognitive Adaptation Applied</div>
            <p className="rewire-explanation">
              {session.rewireState.adaptedContent?.explanation ||
                session.rewireState.evaluation?.explanation ||
                "Increased comprehension struggle was detected. The material has been automatically restructured into clearer terms."}
            </p>
            <div className="rewire-actions-pills">
              {(session.rewireState.adaptedContent?.actions_applied || [
                "increase_simplification", "add_visual_description",
              ]).map((act) => (
                <span key={act} className="rewire-action-pill">
                  <I.Check size={11} style={{ marginRight: 3 }} /> {act.replace(/_/g, " ")}
                </span>
              ))}
            </div>
            <button
              className="primary-action"
              style={{ marginTop: 14, width: "100%" }}
              onClick={() => navigate("/practice")}
            >
              Take Adapted Practice Quiz <I.ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ── Empty state ─────────────────────────────────────────────── */}
        {!transformed ? (
          <section className="card empty-state" style={{ marginTop: 20, textAlign: "center", padding: 40 }}>
            <I.BookOpen size={36} style={{ color: "var(--muted)", margin: "0 auto 12px", display: "block" }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>
              This lesson has not been adapted yet.
            </p>
            <button
              className="primary-action"
              onClick={() => {
                if (session.text) {
                  navigate("/profile");
                } else {
                  navigate("/upload");
                }
              }}
              style={{ maxWidth: 220, margin: "0 auto" }}
            >
              {session.text ? "Configure & Adapt" : "Add learning material"} <I.Sparkles size={16} />
            </button>
          </section>
        ) : (
          <>
            {/* ── Lesson Card ─────────────────────────────────────────── */}
            <section className={`lesson-card ${lessonClass} ${isAdapted ? "adapted-chunk-card" : ""}`}>

              {/* Card header row */}
              <div className="lesson-card-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="lesson-card-section-label">
                    SECTION {activeSection + 1} OF {sections.length}
                  </span>
                  <span 
                    style={{ 
                      color: difficultyColor === "#fce072" ? "#713f12" : difficultyColor, 
                      fontSize: 11, 
                      fontWeight: 700, 
                      letterSpacing: "0.05em",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      backgroundColor: difficultyColor === "#fce072" ? "#fef9c3" : `${difficultyColor}15`,
                      border: `1px solid ${difficultyColor === "#fce072" ? "#fce072" : `${difficultyColor}40`}`
                    }}
                  >
                    {difficultyLabel}
                  </span>
                  {sectionTopic && (
                    <>
                      <span style={{ color: "rgba(113, 63, 18, 0.4)", fontSize: 12 }}>›</span>
                      <span className="lesson-card-topic">{sectionTopic}</span>
                    </>
                  )}
                  {isAdapted && (
                    <span className="adapted-badge" style={{ marginLeft: 4 }}>
                      REWIRED
                    </span>
                  )}
                </div>
                <span className="lesson-card-readtime">
                  Estimated read: {formatReadTime(estimatedSeconds)}
                  {isFaceAway && (
                    <span className="readtime-paused-pill" title="Reading timer paused because face is not detected">
                      ⏸ (Paused)
                    </span>
                  )}
                </span>
                {/* Webcam status badge — shows current relevant state */}
                <WebcamStatusBadge
                  webcamStatus={webcamHook.webcamStatus}
                  facePresent={facePresent}
                  tabFocused={webcamHook.tabFocused}
                  webcamSkipped={webcamHook.webcamSkipped}
                  presenceRatio={webcamHook.presenceRatio}
                />
              </div>

              {/* Section body */}
              {currentSection && (
                <div className="lesson-card-body">
                  {currentSection?.heading && (
                    <h2 className="lesson-section-title">
                      {currentSection.heading}
                    </h2>
                  )}
                  <p
                    style={{
                      fontSize: formatting.font_size_multiplier
                        ? `${formatting.font_size_multiplier}em`
                        : undefined,
                      lineHeight: formatting.line_height || 1.75,
                      letterSpacing: formatting.letter_spacing,
                      whiteSpace: "pre-line",
                      color: "#1e293b",
                      margin: 0,
                    }}
                  >
                    {displayText}
                  </p>

                  {isAdapted && session.rewireState.adaptedContent?.visual_description && (
                    <div className="visual-description-box" style={{ marginTop: 16 }}>
                      <div className="visual-description-label">
                        <I.Image size={14} /> Visual Mental Model
                      </div>
                      <p className="visual-description-text">
                        {session.rewireState.adaptedContent.visual_description}
                      </p>
                    </div>
                  )}

                  {/* Section micro-actions */}
                  <div className="lesson-audio-ribbon">
                    <button
                      type="button"
                      className={`audio-tool-btn ${playing ? "active" : ""}`}
                      onClick={() => readAloud(displayText)}
                      title={playing ? "Stop audio" : "Read aloud"}
                    >
                      {playing ? (
                        <>
                          <I.VolumeX size={13} />
                          <span>Stop audio</span>
                        </>
                      ) : (
                        <>
                          <I.Volume2 size={13} />
                          <span>Read aloud</span>
                        </>
                      )}
                    </button>

                    <span className="audio-ribbon-divider" />

                    {struggleTriggered && (
                      <div className="struggle-inline-hint" role="status">
                        <I.Sparkles size={12} className="struggle-hint-icon" />
                        <span>Struggling with this explanation?</span>
                      </div>
                    )}

                    <button
                      type="button"
                      className={`audio-tool-btn prompt-tool-btn ${struggleTriggered ? "highlighted" : ""}`}
                      onClick={() => handleTriggerVoicePrompt("Explain this section in very simple terms.")}
                      title="Ask AI Assistant to explain this section simply"
                    >
                      <I.HelpCircle size={13} />
                      <span>Explain simply</span>
                    </button>

                    <button
                      type="button"
                      className={`audio-tool-btn prompt-tool-btn ${struggleTriggered ? "highlighted" : ""}`}
                      onClick={() => handleTriggerVoicePrompt("Give me an intuitive, real-world example of this concept.")}
                      title="Ask AI Assistant for an intuitive real-world example"
                    >
                      <I.Compass size={13} />
                      <span>Real-world example</span>
                    </button>

                    <button
                      type="button"
                      className={`audio-tool-btn prompt-tool-btn ${struggleTriggered ? "highlighted" : ""}`}
                      onClick={() => handleTriggerVoicePrompt("What is the single most important point in this section?")}
                      title="Ask AI Assistant for the key takeaway"
                    >
                      <I.Key size={13} />
                      <span>Key takeaway</span>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* ── Unified Lesson Navigation & Action Toolbar ── */}
            <div className="lesson-unified-toolbar">
              <div className="lesson-nav-cluster">
                {/* Previous */}
                <button
                  className="lesson-tool-btn"
                  disabled={activeSection === 0}
                  onClick={() => setActiveSection((i) => i - 1)}
                  aria-label="Previous section"
                >
                  <I.ChevronLeft size={15} />
                  <span>Prev</span>
                </button>

                {/* Section dots (<= 10) or Scalable Jump Selector (> 10) */}
                {sections.length <= 10 ? (
                  <div className="lesson-nav-dots">
                    {sections.map((section, index) => (
                      <button
                        key={section.id}
                        className={`lesson-dot ${index === activeSection ? "current" : ""} ${completedSections.includes(index) ? "done" : ""}`}
                        onClick={() => setActiveSection(index)}
                        title={`Section ${index + 1}: ${section.heading || ""}`}
                      >
                        {completedSections.includes(index) ? <I.Check size={10} /> : index + 1}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="lesson-jump-compact" ref={sectionPickerRef}>
                    <span className="lesson-counter-tag">
                      {activeSection + 1} / {sections.length}
                    </span>
                    <div className="lesson-jump-popover-anchor">
                      <button
                        type="button"
                        className={`lesson-popover-trigger-btn ${sectionMenuOpen ? "active" : ""}`}
                        onClick={() => setSectionMenuOpen((prev) => !prev)}
                        aria-label="Choose section"
                        aria-expanded={sectionMenuOpen}
                      >
                        <span className="lesson-popover-trigger-text">
                          {completedSections.includes(activeSection) ? "✓ " : ""}
                          {activeSection + 1}. {cleanHeading(sections[activeSection]?.heading, sections[activeSection]?.paragraph, activeSection + 1)}
                        </span>
                        <I.ChevronUp size={13} className={`lesson-popover-chevron ${sectionMenuOpen ? "open" : ""}`} />
                      </button>

                      {sectionMenuOpen && (
                        <div className="lesson-section-popover-menu" role="menu">
                          <div className="lesson-popover-header">
                            <span className="lesson-popover-header-title">SECTIONS ({sections.length})</span>
                            <span className="lesson-popover-header-progress">
                              {completedSections.length}/{sections.length} completed
                            </span>
                          </div>
                          <div className="lesson-popover-scroll">
                            {sections.map((section, index) => {
                              const headingText = cleanHeading(section.heading, section.paragraph, index + 1);
                              const isDone = completedSections.includes(index);
                              const isCurrent = index === activeSection;
                              const tier = section.meta?.difficulty_tier || resolveSectionDifficulty(section, index, sections.length);
                              const tierColor =
                                tier === "foundational" ? "#10b981" :
                                tier === "advanced" ? "#f59e0b" : "#fce072";

                              return (
                                <button
                                  key={section.id}
                                  type="button"
                                  role="menuitem"
                                  className={`lesson-popover-item ${isCurrent ? "current" : ""} ${isDone ? "done" : ""}`}
                                  onClick={() => {
                                    setActiveSection(index);
                                    setSectionMenuOpen(false);
                                  }}
                                >
                                  <div className="popover-item-left">
                                    <span className={`popover-num-badge ${isDone ? "done" : ""} ${isCurrent ? "current" : ""}`}>
                                      {isDone ? <I.Check size={11} /> : index + 1}
                                    </span>
                                    <span className="popover-item-text" title={headingText}>
                                      {headingText}
                                    </span>
                                  </div>
                                  <span
                                    className="popover-diff-chip"
                                    style={{
                                      color: tierColor === "#fce072" ? "#713f12" : tierColor,
                                      backgroundColor: tierColor === "#fce072" ? "#fef9c3" : `${tierColor}15`,
                                      borderColor: tierColor === "#fce072" ? "#fce072" : `${tierColor}35`,
                                    }}
                                  >
                                    {tier.toUpperCase()}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Next */}
                <button
                  className="lesson-tool-btn"
                  disabled={activeSection === sections.length - 1}
                  onClick={() => setActiveSection((i) => i + 1)}
                  aria-label="Next section"
                >
                  <span>Next</span>
                  <I.ChevronRight size={15} />
                </button>
              </div>

              {/* Action Cluster: Concept Visual + Mark Complete */}
              <div className="lesson-actions-cluster">
                {(() => {
                  const isVisualGenerating = busy === "visual" || (busy && busy.startsWith("visual"));
                  const hasActiveVisual = activeCluster
                    ? Boolean(session.clusterVisuals?.[activeCluster?.cluster_id])
                    : Boolean(session.visual);

                  return (
                    <button
                      type="button"
                      className={`lesson-action-pill ${hasActiveVisual ? "ready" : ""} ${showVisualPanel ? "panel-active" : ""}`}
                      disabled={isVisualGenerating}
                      onClick={() => {
                        setShowVisualPanel(true);
                        if (!hasActiveVisual) {
                          if (activeCluster) {
                            loadClusterVisual(activeCluster, sections);
                          } else {
                            getVisual(sections, activeSection);
                          }
                        }
                        setTimeout(() => {
                          const el = document.querySelector(".visual-understanding-panel");
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 80);
                      }}
                      title={
                        showVisualPanel
                          ? "Visual concept maps are open below"
                          : "Generate and open visual concept maps"
                      }
                    >
                      {isVisualGenerating ? (
                        <I.Loader2 size={13} className="spinner" />
                      ) : (
                        <I.Sparkles size={13} />
                      )}
                      <span>
                        {isVisualGenerating
                          ? "Generating visual…"
                          : hasActiveVisual
                          ? (showVisualPanel ? "Visuals Active ↓" : "View Concept Visual ↓")
                          : "Generate Visual"}
                      </span>
                    </button>
                  );
                })()}

                <button
                  className="lesson-complete-btn"
                  onClick={markSectionComplete}
                >
                  <span>
                    {isComplete
                      ? activeSection === sections.length - 1
                        ? "Completed"
                        : "Next Section"
                      : "Mark Complete"}
                  </span>
                  <I.Check size={14} />
                </button>
              </div>
            </div>

            {/* ── Visual Understanding Panel (Opens when learner clicks Generate Visual) ── */}
            {showVisualPanel && (
              <section className="visual-understanding-panel card" style={{ marginTop: 22, padding: 22 }}>
                <div className="visual-panel-header">
                  <div className="visual-panel-header-left">
                    <div className="visual-panel-icon-badge">
                      <I.Eye size={20} />
                    </div>
                    <div>
                      <h3 className="visual-panel-title">
                        Visual Concept Maps
                      </h3>
                      <span className="visual-panel-subtitle">
                        {clusters.length > 0
                          ? `${clusters.length} visual cluster${clusters.length > 1 ? "s" : ""} synthesized for this lesson`
                          : "Lesson Infographic"}
                      </span>
                    </div>
                  </div>

                  <div className="visual-panel-header-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {activeCluster && currentSectionCluster && activeCluster.cluster_id !== currentSectionCluster.cluster_id && (
                      <button
                        type="button"
                        className="text-action visual-sync-btn"
                        onClick={() => setSelectedClusterId(null)}
                        title={`Sync back to current reading section ${activeSection + 1}`}
                      >
                        <I.Crosshair size={14} />
                        <span>Back to Section {activeSection + 1} Visual ({currentSectionCluster.covers_label})</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="visual-hide-panel-btn"
                      onClick={() => setShowVisualPanel(false)}
                      title="Hide Visual Concept Maps"
                    >
                      <I.EyeOff size={13} style={{ marginRight: 4 }} />
                      <span>Hide Visuals</span>
                    </button>
                  </div>
                </div>

                {/* Horizontal Cluster Tabs */}
                {clusters.length > 0 && (
                  <div className="visual-cluster-strip" role="tablist" aria-label="Visual Concept Clusters">
                    {clusters.map((cluster, cIdx) => {
                      const isCurrentMatch = currentSectionCluster?.cluster_id === cluster.cluster_id;
                      const isSelected = activeCluster?.cluster_id === cluster.cluster_id;
                      const isLoaded = Boolean(session.clusterVisuals?.[cluster.cluster_id]);
                      return (
                        <button
                          key={cluster.cluster_id}
                          type="button"
                          role="tab"
                          aria-selected={isSelected}
                          className={`visual-cluster-tab ${isSelected ? "selected" : ""} ${isCurrentMatch ? "current-match" : ""}`}
                          onClick={() => setSelectedClusterId(cluster.cluster_id)}
                        >
                          <div className="cluster-tab-top">
                            <span className={`cluster-number ${isSelected ? "selected" : ""}`}>Visual {cIdx + 1}</span>
                            {isSelected ? (
                              <span className="cluster-viewing-tag">
                                <I.Eye size={11} /> Viewing Now
                              </span>
                            ) : isCurrentMatch ? (
                              <span className="cluster-match-tag" title={`Matches lesson Section ${activeSection + 1}`}>
                                <I.Bookmark size={11} /> Section {activeSection + 1}
                              </span>
                            ) : isLoaded ? (
                              <span className="cluster-loaded-tag">
                                <I.Check size={11} /> Ready
                              </span>
                            ) : (
                              <span className="cluster-idle-tag">Click to view</span>
                            )}
                          </div>
                          <div className="cluster-tab-title" title={cleanHeading(cluster.title, cluster.subtitle, cIdx + 1)}>
                            {cleanHeading(cluster.title, cluster.subtitle, cIdx + 1)}
                          </div>
                          <div className="cluster-tab-coverage">
                            {cluster.covers_label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Loading state for clusters discovery */}
                {busy === "clusters" && clusters.length === 0 && (
                  <div className="visual-loading-box">
                    <I.Loader2 className="spinner" size={24} />
                    <p style={{ marginTop: 10, fontWeight: 600, color: "var(--ink)" }}>
                      Analyzing lesson concepts and creating visual clusters…
                    </p>
                  </div>
                )}

                {/* Visual Card / Loading / Preview for active cluster */}
                <div className="visual-cluster-content">
                  {busy === `visual-${activeCluster?.cluster_id}` || (busy === "visual" && !session.visual) ? (
                    <div className="visual-loading-box">
                      <I.Loader2 className="spinner" size={26} />
                      <p style={{ marginTop: 12, fontWeight: 700, color: "var(--ink)" }}>
                        Synthesizing concept visual{activeCluster ? ` for ${activeCluster.title}` : ""}…
                      </p>
                      <span style={{ fontSize: 13, color: "var(--muted)" }}>
                        {activeCluster
                          ? `Covering ${activeCluster.covers_label} (${activeCluster.sections_count} sections) into a unified visual`
                          : "Generating visual concept diagram and mental model for this lesson"}
                      </span>
                    </div>
                  ) : activeCluster && session.clusterVisuals?.[activeCluster.cluster_id] ? (
                    <VisualCard
                      visual={session.clusterVisuals[activeCluster.cluster_id]}
                      cluster={activeCluster}
                      sections={sections}
                      onReadAloud={(text) => readAloud(text)}
                      clusterIndex={clusters.findIndex((c) => c.cluster_id === activeCluster.cluster_id)}
                      clusterTotal={clusters.length}
                    />
                  ) : activeCluster ? (
                    <div className="visual-preview-card">
                      <div className="visual-preview-header">
                        <span className="pill visual-coverage-pill">
                          <I.Layers size={12} style={{ marginRight: 4 }} />
                          {activeCluster.covers_label}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                          {activeCluster.sections_count} sections in this visual
                        </span>
                      </div>

                      <h4 className="visual-preview-title">
                        {activeCluster.title}
                      </h4>
                      <p className="visual-preview-subtitle">
                        {activeCluster.subtitle}
                      </p>

                      <div className="covered-sections-preview">
                        <span className="covered-sections-preview-label">
                          Sections Synthesized in this Visual:
                        </span>
                        <div className="covered-sections-chips">
                          {sections
                            .slice(activeCluster.start_section_index, activeCluster.end_section_index + 1)
                            .map((sec, sIdx) => {
                              const secNum = activeCluster.start_section_index + sIdx + 1;
                              return (
                                <div key={sIdx} className="covered-section-chip">
                                  <span className="chip-num">#{secNum}</span>
                                  <span className="chip-text">{sec.heading || `Concept Part ${sIdx + 1}`}</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>

                      <div className="visual-preview-footer">
                        <button
                          type="button"
                          className="visual-generate-cluster-btn"
                          disabled={Boolean(busy)}
                          onClick={() => loadClusterVisual(activeCluster, sections)}
                        >
                          <I.Sparkles size={14} />
                          <span>Generate Concept Visual</span>
                        </button>
                        <span className="visual-preview-footer-note">
                          Synthesizes {activeCluster.covers_label} into an interactive diagram
                        </span>
                      </div>
                    </div>
                  ) : session.visual ? (
                    <VisualCard
                      visual={session.visual}
                      sections={sections}
                      onReadAloud={(text) => readAloud(text)}
                    />
                  ) : (
                    <div className="visual-preview-card" style={{ textAlign: "center", padding: "32px 20px" }}>
                      <I.Eye size={36} style={{ color: "var(--primary)", margin: "0 auto 12px" }} />
                      <h4 className="visual-preview-title">Lesson Concept Visual</h4>
                      <p className="visual-preview-subtitle">
                        Generate an interactive visual concept map for this lesson to build a quick mental model.
                      </p>
                      <button
                        type="button"
                        className="primary-action"
                        style={{ marginTop: 16, marginInline: "auto" }}
                        disabled={Boolean(busy)}
                        onClick={() => getVisual(sections, activeSection)}
                      >
                        <I.Sparkles size={14} />
                        <span>Generate Visual Now</span>
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}

            <ErrorNotice />

            {/* ── SCALE dot (collapsed telemetry) ─────────────────────── */}            <div
              className="scale-dot-bar"
              title={`SCALE: ${(struggleScore * 100).toFixed(0)}% struggle`}
            >
              <span
                className={`gauge-dot ${
                  struggleScore >= 0.6 ? "critical" : struggleScore >= 0.4 ? "warning" : "normal"
                }`}
              />
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                SCALE {(struggleScore * 100).toFixed(0)}%
                {struggleScore >= 0.6 && (
                  <span style={{ color: "#1f5e63", marginLeft: 4 }}>· REWIRE Active</span>
                )}
              </span>
            </div>

            {/* ── Floating Voice Bubble ───────────────────────────────── */}
            <button
              className="voice-fab"
              onClick={() => setVoiceOpen((o) => !o)}
              aria-label="Open voice assistant"
              title="Voice & In-Context Assistant"
            >
              {voiceOpen ? <I.X size={22} /> : <I.MessageCircle size={22} />}
              <span
                className="voice-fab-dot"
                style={{ background: voiceOpen ? "#ef4444" : "#10b981" }}
              />
            </button>

            {/* ── Floating Voice Panel ────────────────────────────────── */}
            {voiceOpen && (
              <div className="voice-float-panel">
                <div className="voice-float-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="voice-float-icon">
                      <I.Mic size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>
                        Voice &amp; In-Context Assistant
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        Speech-to-Text · Lesson Grounded
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      onClick={() => setVoiceOpen(false)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}
                    >
                      <I.X size={16} />
                    </button>
                  </div>
                </div>

                <div className="voice-float-body">
                  <VoiceAssistant
                    hideHeader={true}
                    autoPrompt={voiceAutoPrompt}
                    showQuickPrompts={false}
                    currentSection={currentSection}
                    onAsk={ask}
                    busy={busy}
                    onVoiceHelp={recordVoiceHelpAction}
                  />
                </div>
              </div>
            )}
          </>
        )}

      </main>

      {showQuizPrompt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 480,
              width: "100%",
              padding: "36px 32px 30px",
              textAlign: "center",
              boxShadow: "0 25px 60px -12px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(16, 185, 129, 0.18)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              background: "#ffffff",
              borderRadius: 24,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                border: "2px solid #f59e0b",
                boxShadow: "0 8px 24px -4px rgba(245, 158, 11, 0.35), 0 0 0 6px rgba(245, 158, 11, 0.12)",
                margin: "0 auto 18px",
                display: "grid",
                placeItems: "center",
                color: "#b45309",
              }}
            >
              <I.Trophy size={32} />
            </div>
            <h2
              style={{
                fontSize: 23,
                fontWeight: 800,
                color: "var(--ink)",
                marginBottom: 8,
                fontFamily: "var(--font-heading)",
                letterSpacing: "-0.02em",
              }}
            >
              All Sections Complete!
            </h2>
            <p style={{ fontSize: 14.5, color: "var(--muted)", lineHeight: 1.6, marginBottom: 26 }}>
              Fantastic job completing every section of this lesson. Would you like to take the{" "}
              <strong style={{ color: "var(--ink)" }}>Practice Quiz</strong> now? The AI will generate relevant questions from your lesson to test your mastery.
            </p>
            <div style={{ display: "flex", gap: 12, flexDirection: "column" }}>
              <button
                id="take-practice-quiz-btn"
                className="primary-action"
                style={{
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 15.5,
                  padding: "13px 22px",
                  borderRadius: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: "0 6px 20px rgba(16, 185, 129, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.25)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                }}
                onClick={() => {
                  setShowQuizPrompt(false);
                  if (webcamHook?.mediaStream) {
                    webcamHook.mediaStream.getTracks().forEach((track) => track.stop());
                  }
                  if (webcamHook?.setWebcamEnabled) {
                    webcamHook.setWebcamEnabled(false);
                  }
                  navigate("/practice");
                }}
              >
                Take Practice Quiz Now <I.ChevronRight size={18} />
              </button>
              <button
                className="secondary-action"
                style={{
                  padding: "11px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 12,
                  border: "1px solid var(--border-color)",
                  background: "rgba(248, 250, 252, 0.95)",
                }}
                onClick={() => setShowQuizPrompt(false)}
              >
                Stay and Review Sections
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Learn;
export { Learn };
