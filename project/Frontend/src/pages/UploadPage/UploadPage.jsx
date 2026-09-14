import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as I from "lucide-react";
import { useSession } from "../../context/SessionContext";
import { Layout } from "../../components/Layout/Layout";
import { chatTopicAssistant } from "../../api/client";
import "./UploadPage.css";

function ErrorNotice() {
  const { session } = useSession();
  return session.error ? (
    <div
      style={{
        background: "var(--amber-light)",
        border: "1px solid #fde68a",
        color: "#92400e",
        padding: "12px 16px",
        borderRadius: 12,
        marginTop: 14,
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <I.AlertCircle size={18} style={{ flexShrink: 0 }} />
      <span>{session.error}</span>
    </div>
  ) : null;
}

function TopicChatAssistant({ onStartLearning, busy }) {
  const { session } = useSession();
  const [topicInput, setTopicInput] = useState("");
  const [currentTopic, setCurrentTopic] = useState("");
  const [step, setStep] = useState("ask"); // "ask" | "clarify" | "building"
  const [clarifyQuestion, setClarifyQuestion] = useState("");
  const [clarifyOptions, setClarifyOptions] = useState([]);
  const [buildStatus, setBuildStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const suggestedTopics = [
    { label: "🚀 Teach me JavaScript from scratch", topic: "JavaScript Fundamentals & DOM" },
    { label: "🐍 Python for Beginners", topic: "Python Basics & Data Structures" },
    { label: "⚛️ Modern React & State Management", topic: "Modern React & State Management" },
    { label: "🧠 Neural Networks & Deep Learning", topic: "Neural Networks & Deep Learning" },
  ];

  const handleStartClarification = (topicStr) => {
    const topic = topicStr || topicInput.trim();
    if (!topic) return;

    setCurrentTopic(topic);
    setErrorMsg("");
    setStep("clarify");
    setClarifyQuestion(`Great choice! To build the best lesson for "${topic}", choose your experience level or focus:`);
    setClarifyOptions([
      `🌱 Complete Beginner (Start from scratch with clear analogies)`,
      `💡 Practical & Hands-on (Code examples & real-world use cases)`,
      `⚡ Quick Crash Course (Core concepts, syntax & takeaways)`,
    ]);
  };

  const handleBuildAndLearn = async (topicStr, contextDetail = "") => {
    const finalTopic = topicStr || currentTopic || topicInput.trim();
    if (!finalTopic) return;

    setCurrentTopic(finalTopic);
    setStep("building");
    setBuildStatus(`Consulting Groq AI to design your curriculum for "${finalTopic}"...`);
    setErrorMsg("");

    try {
      const messages = [
        {
          role: "user",
          content: `I want to learn: ${finalTopic}. ${contextDetail ? `Level / Focus: ${contextDetail}.` : ""} Please build a comprehensive, multi-section lesson for me with clear sections.`,
        },
      ];

      setBuildStatus(`Groq AI is generating your structured interactive modules...`);
      const response = await chatTopicAssistant(messages, finalTopic, session.profile, true);

      const lessonText = response.ready_lesson_text;
      const topicTitle = response.topic || finalTopic;

      if (!lessonText) {
        throw new Error("Could not generate curriculum text. Please try again.");
      }

      setBuildStatus(`Adapting sections for ${session.profile || "your learning profile"} & launching Learn page...`);

      // Store generated text, adapt into sections, and automatically navigate to /learn
      await onStartLearning(lessonText, topicTitle);
    } catch (err) {
      console.error("Build lesson error:", err);
      setErrorMsg(err.message || "Failed to generate lesson with Groq. Please try again.");
      setStep("ask");
    }
  };

  const handleReset = () => {
    setStep("ask");
    setCurrentTopic("");
    setTopicInput("");
    setErrorMsg("");
    setBuildStatus("");
  };

  if (step === "building") {
    return (
      <div
        style={{
          padding: "36px 20px",
          textAlign: "center",
          background: "linear-gradient(135deg, rgba(252, 224, 114, 0.15) 0%, rgba(252, 224, 114, 0.25) 100%)",
          border: "2px solid #fce072",
          borderRadius: 16,
          marginTop: 14,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "var(--primary-gradient)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 8px 20px rgba(252, 224, 114, 0.5)",
          }}
        >
          <I.Sparkles size={26} className="spin-slow" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)" }}>
            Building Your Lesson: {currentTopic}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
            {buildStatus}
          </div>
        </div>
        <div className="progressbar" style={{ width: "80%", maxWidth: 360, marginTop: 4 }}>
          <div className="progressfill" style={{ width: "85%", animation: "pulse 1.5s infinite" }} />
        </div>
        <div style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700 }}>
          🚀 Automatically taking you to the Learn page once ready...
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
      {/* Topic status bar (only when topic is selected in clarification step) */}
      {step !== "ask" && currentTopic && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(252, 224, 114, 0.15)",
            border: "1px solid #fce072",
            borderRadius: 12,
            padding: "8px 14px",
            fontSize: 13,
          }}
        >
          <span
            style={{
              background: "var(--primary-light)",
              color: "var(--primary)",
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            Topic: {currentTopic}
          </span>
          <button
            type="button"
            onClick={handleReset}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <I.RotateCcw size={13} /> Change Topic
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            color: "#991b1b",
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => handleBuildAndLearn(currentTopic)}
            style={{
              background: "none",
              border: "none",
              color: "#991b1b",
              fontWeight: 700,
              cursor: "pointer",
              textDecoration: "underline",
              fontSize: 12,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {step === "ask" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--border-color)",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 4 }}>
              What would you like to learn today?
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>
              Don't have a document or PDF? Tell Groq AI any skill or concept (e.g. <i>"Can you teach me JavaScript?"</i>), and we'll generate the full lesson in interactive sections and take you straight into the Learn page!
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (topicInput.trim()) {
                  handleBuildAndLearn(topicInput.trim());
                }
              }}
              style={{ display: "flex", gap: 8, alignItems: "center" }}
            >
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder="e.g. Can you teach me JavaScript from scratch?"
                style={{
                  flex: 1,
                  padding: "11px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border-color)",
                  fontSize: 13,
                  outline: "none",
                  background: "#fafbfc",
                }}
              />
              <button
                type="button"
                disabled={!topicInput.trim()}
                onClick={() => handleStartClarification(topicInput.trim())}
                style={{
                  background: "var(--secondary-bg)",
                  color: "var(--secondary-ink)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 12,
                  padding: "11px 14px",
                  cursor: !topicInput.trim() ? "not-allowed" : "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                Customize
              </button>
              <button
                type="submit"
                disabled={!topicInput.trim()}
                style={{
                  background: !topicInput.trim() ? "var(--secondary-bg)" : "var(--primary-gradient)",
                  color: !topicInput.trim() ? "var(--muted)" : "#ffffff",
                  border: "none",
                  borderRadius: 12,
                  padding: "11px 16px",
                  cursor: !topicInput.trim() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 700,
                  fontSize: 13,
                  whiteSpace: "nowrap",
                  boxShadow: topicInput.trim() ? "0 4px 12px rgba(252, 224, 114, 0.45)" : "none",
                }}
              >
                <span>Build & Learn</span>
                <I.ArrowRight size={15} />
              </button>
            </form>
          </div>

          {/* Quick topic suggestion pills */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Or choose a popular topic:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {suggestedTopics.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleBuildAndLearn(item.topic)}
                  style={{
                    background: "#ffffff",
                    border: "1px solid rgba(252, 224, 114, 0.6)",
                    color: "var(--primary)",
                    borderRadius: 999,
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 2px 4px rgba(15, 23, 42, 0.03)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--primary-light)";
                    e.currentTarget.style.borderColor = "var(--primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#ffffff";
                    e.currentTarget.style.borderColor = "rgba(252, 224, 114, 0.6)";
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Clarification Step */
        <div
          style={{
            background: "#ffffff",
            border: "1.5px solid #fce072",
            borderRadius: 14,
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--primary-gradient)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <I.Bot size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
                {clarifyQuestion}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Click an option below to immediately generate your lesson and launch into the Learn page.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {clarifyOptions.map((opt, oIdx) => (
              <button
                key={oIdx}
                type="button"
                onClick={() => handleBuildAndLearn(currentTopic, opt)}
                style={{
                  background: "#f8fafc",
                  border: "1px solid var(--border-color)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--ink)",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--primary-light)";
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.color = "var(--primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#f8fafc";
                  e.currentTarget.style.borderColor = "var(--border-color)";
                  e.currentTarget.style.color = "var(--ink)";
                }}
              >
                <span>{opt}</span>
                <I.ArrowRight size={14} />
              </button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
            <button
              type="button"
              onClick={() => setStep("ask")}
              style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 12 }}
            >
              Back
            </button>
            <button
              type="button"
              className="primary-action"
              style={{ padding: "8px 16px", fontSize: 12 }}
              onClick={() => handleBuildAndLearn(currentTopic)}
            >
              <I.Zap size={14} /> Build Lesson & Start Learning Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Upload() {
  const { session, busy, upload, setText, startLearningFromTopic, removeDocument } = useSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState("upload");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const ready = Boolean(session.text && session.text.trim());
  const hasDoc = Boolean(session.fileName || session.text);

  function handleLessonReady(lessonText, topicTitle) {
    setText(lessonText, topicTitle);
  }

  async function handleStartLearning(lessonText, topicTitle) {
    await startLearningFromTopic(lessonText, topicTitle);
    navigate("/profile");
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      upload(file);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      upload(file);
    }
  }

  function handleRemoveDoc(e) {
    e.preventDefault();
    e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    removeDocument();
  }

  return (
    <Layout section="Upload">
      <main className="page">
        <div className="eyebrow">
          <b>Step 1 of 3</b>
          <span>Document Extraction & Setup</span>
        </div>
        <h1 className="page-title">Add learning material</h1>

        <div className="segmented">
          {[
            ["upload", "Upload File"],
            ["chat", "AI Topic Assistant"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={tab === value ? "selected" : ""}
            >
              {value === "chat" ? (
                <I.Bot size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
              ) : (
                <I.UploadCloud size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
              )}
              {label}
            </button>
          ))}
        </div>

        <section className="card" style={{ marginTop: 16, padding: 20 }}>
          {(tab === "upload" || ready) && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              {tab === "upload" ? (
                <span className="pill">
                  <I.Zap size={13} /> OCR Fallback & Intelligent Extractor
                </span>
              ) : <div />}
              {ready && (
                <span className="pill" style={{ background: "var(--emerald-light)", color: "#047857" }}>
                  <I.Check size={13} /> Content Loaded ({session.fileName || "Ready"})
                </span>
              )}
            </div>
          )}

          {tab === "upload" ? (
            !hasDoc ? (
              <label
                className={`dropzone ${isDragging ? "dragover" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  border: isDragging ? "2px dashed var(--primary)" : "1px dashed #9eb9aa",
                  background: isDragging ? "#eaf2ee" : "#f4f3ed",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.epub,.txt"
                  onChange={handleFileChange}
                />
                <I.UploadCloud size={40} />
                <b>Choose or drag doc</b>
                <span>Supports PDF, DOCX, EPUB, or TXT (up to 45MB)</span>
                <strong>Select from device</strong>
              </label>
            ) : (
              <div
                className="dropzone"
                style={{
                  border: "1px solid var(--border-color)",
                  background: "#ffffff",
                  padding: "24px 20px",
                  cursor: "default",
                }}
              >
                <I.FileText size={42} style={{ color: "var(--primary)" }} />
                <b style={{ fontSize: 16, color: "var(--ink)" }}>{session.fileName || "Uploaded Document"}</b>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {session.wordCount ? `${session.wordCount.toLocaleString()} words loaded` : "Ready for learning adaptation"}
                </span>
                <button
                  type="button"
                  id="remove-doc-btn"
                  onClick={handleRemoveDoc}
                  style={{
                    marginTop: 8,
                    background: "rgba(220, 38, 38, 0.08)",
                    border: "1.5px solid #dc2626",
                    color: "#dc2626",
                    fontWeight: 700,
                    padding: "9px 20px",
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#dc2626";
                    e.currentTarget.style.color = "#ffffff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(220, 38, 38, 0.08)";
                    e.currentTarget.style.color = "#dc2626";
                  }}
                >
                  <I.Trash2 size={16} /> Remove doc
                </button>
              </div>
            )
          ) : (
            <TopicChatAssistant
              onLessonReady={handleLessonReady}
              onStartLearning={handleStartLearning}
              busy={busy}
            />
          )}

          <div
            style={{
              background: "#f3f1eb",
              border: "1px solid var(--border-color)",
              borderRadius: 14,
              padding: 14,
              fontSize: 12,
              marginTop: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span style={{ color: busy === "extract" || busy === "transform" ? "var(--primary)" : "var(--ink)" }}>
                {busy === "extract"
                  ? "Extracting document content..."
                  : busy === "transform"
                    ? "Generating adaptive lesson sections..."
                    : ready
                      ? `Ready: ${session.fileName || "Curriculum loaded"}`
                      : "Waiting for content"}
              </span>
              <span style={{ color: "var(--muted)" }}>{session.wordCount} words</span>
            </div>

            <div className="progressbar" style={{ marginTop: 10 }}>
              <div
                className="progressfill"
                style={{
                  width: busy === "extract" || busy === "transform" ? "65%" : ready ? "100%" : "0%",
                }}
              />
            </div>

            {session.text && (
              <div
                style={{
                  marginTop: 12,
                  background: "#ffffff",
                  border: "1px solid var(--border-color)",
                  padding: 12,
                  borderRadius: 10,
                  maxHeight: 100,
                  overflow: "auto",
                  lineHeight: 1.5,
                  color: "#475569",
                }}
              >
                {session.text.slice(0, 600)}
                {session.text.length > 600 ? "..." : ""}
              </div>
            )}
          </div>
        </section>

        <ErrorNotice />

        <button
          className="primary-action"
          disabled={!ready || Boolean(busy)}
          onClick={() => navigate("/profile")}
          style={{ marginTop: 20 }}
        >
          Continue to learner profile <I.ArrowRight size={18} />
        </button>
      </main>
    </Layout>
  );
}

export default Upload;
export { Upload };
