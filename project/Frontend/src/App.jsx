import React, { createContext, useContext, useEffect, useState } from "react";
import {
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import * as I from "lucide-react";
import {
  askLessonQuestion,
  detectProfile,
  extractDocument,
  evaluateQuizAnswer,
  generateQuiz,
  generateLessonTest,
  generateVisual,
  transformText,
} from "./api/client";

const PROFILE_LABELS = {
  dyslexia: "Dyslexia support",
  cognitive_load: "Cognitive load support",
  low_vision: "Low vision and clarity",
};

const SessionContext = createContext(null);

function useSession() {
  return useContext(SessionContext);
}

function SessionProvider({ children }) {
  const [session, setSession] = useState({
    fileName: "",
    text: "",
    wordCount: 0,
    tables: [],
    profile: "cognitive_load",
    transformed: null,
    quizzes: [],
    visual: null,
    completed: 0,
    completedSections: [],
    practiceReport: { answered: [], failed: [], masteredSections: [] },
    wholeTest: null,
    error: "",
  });
  const [busy, setBusy] = useState("");

  async function run(action, callback) {
    setBusy(action);
    setSession((current) => ({ ...current, error: "" }));
    try {
      return await callback();
    } catch (error) {
      setSession((current) => ({ ...current, error: error.message }));
      return null;
    } finally {
      setBusy("");
    }
  }

  async function upload(file) {
    return run("extract", async () => {
      const result = await extractDocument(file);
      setSession((current) => ({
        ...current,
        fileName: result.filename || file.name,
        text: result.text || "",
        wordCount: result.word_count || 0,
        tables: result.tables || [],
        transformed: null,
        quizzes: [],
        visual: null,
        completed: 0,
        completedSections: [],
        practiceReport: { answered: [], failed: [], masteredSections: [] },
        wholeTest: null,
      }));
      return result;
    });
  }

  function setText(text) {
    setSession((current) => ({
      ...current,
      fileName: "Pasted lesson",
      text,
      wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
      transformed: null,
      quizzes: [],
      visual: null,
      completed: 0,
      completedSections: [],
      practiceReport: { answered: [], failed: [], masteredSections: [] },
      wholeTest: null,
    }));
  }

  async function chooseProfile(profile) {
    setSession((current) => ({
      ...current,
      profile,
      transformed: null,
      quizzes: [],
      visual: null,
    }));
  }

  async function detect(text) {
    return run("profile", async () => {
      const result = await detectProfile(text);
      await chooseProfile(result.profile);
      return result;
    });
  }

  async function adapt() {
    if (!session.text.trim()) return null;
    return run("transform", async () => {
      const result = await transformText(session.text, session.profile);
      setSession((current) => ({
        ...current,
        transformed: result,
        quizzes: [],
        visual: null,
        practiceReport: { answered: [], failed: [], masteredSections: [] },
        wholeTest: null,
      }));
      return result;
    });
  }

  async function getQuiz(chunk) {
    return run("quiz", async () => {
      const result = await generateQuiz(chunk, session.profile);
      setSession((current) => ({
        ...current,
        quizzes: [...current.quizzes, result],
      }));
      return result;
    });
  }

  async function evaluateAnswer(payload) {
    return run("evaluate", async () => {
      const result = await evaluateQuizAnswer(payload);
      setSession((current) => {
        const answered = [...current.practiceReport.answered, result];
        const failed = answered.filter((item) => !item.is_correct);
        const masteredSections = result.is_correct
          ? [...new Set([...current.practiceReport.masteredSections, result.section_index])]
          : current.practiceReport.masteredSections;
        return { ...current, practiceReport: { answered, failed, masteredSections } };
      });
      return result;
    });
  }

  async function getWholeTest() {
    return run("test", async () => {
      const result = await generateLessonTest(session.text, session.profile, 5);
      setSession((current) => ({ ...current, wholeTest: result.questions }));
      return result.questions;
    });
  }

  async function getVisual() {
    return run("visual", async () => {
      const result = await generateVisual(session.text, session.profile);
      setSession((current) => ({ ...current, visual: result }));
      return result;
    });
  }

  async function ask(question, sectionText) {
    return run("voice", () =>
      askLessonQuestion(question, session.text, sectionText, session.profile),
    );
  }

  function completeSection(sectionIndex) {
    setSession((current) => {
      if (current.completedSections.includes(sectionIndex)) return current;
      return {
        ...current,
        completed: current.completed + 1,
        completedSections: [...current.completedSections, sectionIndex],
      };
    });
  }

  return (
    <SessionContext.Provider
      value={{
        session,
        busy,
        upload,
        setText,
        chooseProfile,
        detect,
        adapt,
        getQuiz,
        getVisual,
        ask,
        completeSection,
        evaluateAnswer,
        getWholeTest,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

function Header({ section }) {
  const { session } = useSession();
  return (
    <header className="topbar">
      <NavLink to="/progress" className="brand">
        <div className="logo">A</div>
        <div>
          <div className="brandname">AdaptLearn</div>
          <div className="subtitle">{section}</div>
        </div>
      </NavLink>
      <div className="header-right">
        <div className="access-badge">
          <span className="access-dot" />
          <span>{PROFILE_LABELS[session.profile]}</span>
        </div>
        <div className="avatar">AL</div>
      </div>
    </header>
  );
}

function Layout({ children, section }) {
  const location = useLocation();
  const { session } = useSession();
  const items = [
    ["/upload", "Upload", I.CloudUpload],
    ["/learn", "Learn", I.BookOpen],
    ["/practice", "Practice", I.BadgeHelp],
    ["/progress", "Progress", I.BarChart3],
  ];

  return (
    <div className="app-container">
      <div className="desktop-layout">
        <aside className="desktop-sidebar">
          <NavLink to="/progress" className="brand" style={{ marginBottom: 12 }}>
            <div className="logo">A</div>
            <div>
              <div className="brandname">AdaptLearn</div>
              <div className="subtitle">Adaptive Engine</div>
            </div>
          </NavLink>

          <nav className="sidebar-nav">
            {items.map(([to, label, Icon]) => (
              <NavLink
                key={to}
                to={to}
                className={`sidebar-link ${location.pathname === to ? "active" : ""}`}
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div
            style={{
              padding: 14,
              background: "linear-gradient(135deg, rgba(238, 242, 255, 0.8), rgba(245, 243, 257, 0.8))",
              borderRadius: 14,
              border: "1px solid rgba(199, 210, 254, 0.6)",
              marginTop: "auto",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "var(--primary)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Active Profile
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginTop: 4 }}>
              {PROFILE_LABELS[session.profile]}
            </div>
            {session.fileName && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                📄 {session.fileName}
              </div>
            )}
          </div>
        </aside>

        <div className="main-content">
          <Header section={section} />
          {children}
        </div>
      </div>

      <nav className="bottom-nav">
        {items.map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            className={`nav-item ${location.pathname === to ? "active" : ""}`}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

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

function Upload() {
  const { session, busy, upload, setText } = useSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState("upload");
  const [draft, setDraft] = useState(session.text);
  const ready = Boolean(session.text.trim());

  return (
    <Layout section="Upload">
      <main className="page">
        <div className="eyebrow">
          <b>Step 1 of 3</b>
          <span>Document Extraction & Setup</span>
        </div>
        <h1 className="page-title">Add learning material</h1>

        <section className="hero-card">
          <b>Smart Document Reader</b>
          <p>
            Upload your document or paste lesson text. AdaptLearn automatically extracts content, preserves context, and transforms it according to your accessibility preferences.
          </p>
        </section>

        <div className="segmented">
          {[
            ["upload", "Upload File"],
            ["text", "Paste Raw Text"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={tab === value ? "selected" : ""}
            >
              {label}
            </button>
          ))}
        </div>

        <section className="card" style={{ marginTop: 16, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span className="pill">
              <I.Zap size={13} /> OCR Fallback & Intelligent Extractor
            </span>
            {ready && (
              <span className="pill" style={{ background: "var(--emerald-light)", color: "#047857" }}>
                <I.Check size={13} /> Content Loaded
              </span>
            )}
          </div>

          {tab === "upload" ? (
            <label className="dropzone">
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx,.epub,.txt"
                onChange={(event) => upload(event.target.files?.[0])}
              />
              <I.UploadCloud size={40} />
              <b>{session.fileName || "Choose a document to upload"}</b>
              <span>Supports PDF, DOCX, EPUB, or TXT (up to 45MB)</span>
              <strong>Select from device</strong>
            </label>
          ) : (
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => setText(draft)}
              placeholder="Paste raw text here..."
              style={{ width: "100%", minHeight: 180, marginTop: 14 }}
            />
          )}

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid var(--border-color)",
              borderRadius: 14,
              padding: 14,
              fontSize: 12,
              marginTop: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span style={{ color: busy === "extract" ? "var(--primary)" : "var(--ink)" }}>
                {busy === "extract"
                  ? "Extracting document content..."
                  : ready
                    ? "Ready for adaptation"
                    : "Waiting for content"}
              </span>
              <span style={{ color: "var(--muted)" }}>{session.wordCount} words</span>
            </div>

            <div className="progressbar" style={{ marginTop: 10 }}>
              <div
                className="progressfill"
                style={{
                  width: busy === "extract" ? "55%" : ready ? "100%" : "0%",
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

function Profile() {
  const { session, busy, chooseProfile, detect, adapt } = useSession();
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const cards = [
    [
      "dyslexia",
      "Dyslexia support",
      "Shorter sentences, clear dyslexia-friendly spacing, and reduced visual crowding.",
      I.BookOpen,
    ],
    [
      "cognitive_load",
      "Cognitive load support",
      "Digestible chunked sections presenting one main concept at a time.",
      I.Layers,
    ],
    [
      "low_vision",
      "Low vision and clarity",
      "High contrast theme guidance, larger typography, and distinct line height.",
      I.Eye,
    ],
  ];

  return (
    <Layout section="Profile">
      <main className="page">
        <div className="eyebrow">
          <b>Step 2 of 3</b>
          <span>Choose learning mode</span>
        </div>
        <h1 className="page-title">How should this lesson feel?</h1>

        <div className="profile-grid">
          {cards.map(([profile, title, descriptionText, Icon]) => (
            <button
              key={profile}
              className={`profile-option ${session.profile === profile ? "active" : ""}`}
              onClick={() => chooseProfile(profile)}
            >
              <span className="radio" />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon size={18} style={{ color: session.profile === profile ? "var(--primary)" : "var(--muted)" }} />
                  <b>{title}</b>
                </div>
                <small>{descriptionText}</small>
              </div>
            </button>
          ))}
        </div>

        <section className="card" style={{ marginTop: 20, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <I.Sparkles size={16} style={{ color: "var(--primary)" }} />
            <b style={{ fontSize: 15, color: "var(--ink)" }}>Describe your learning needs</b>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 10px 0" }}>
            Not sure which setting is best? Describe what reading format works best for you and AI will choose.
          </p>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="For example: long paragraphs are hard for me to follow"
            style={{ width: "100%", minHeight: 80 }}
          />
          <button
            className="secondary-action"
            disabled={!description.trim() || Boolean(busy)}
            onClick={() => detect(description)}
            style={{ marginTop: 10, width: "100%" }}
          >
            {busy === "profile" ? "Detecting profile..." : "Detect profile"}
          </button>
        </section>

        <ErrorNotice />

        <button
          className="primary-action"
          disabled={!session.text || Boolean(busy)}
          onClick={async () => {
            await adapt();
            navigate("/learn");
          }}
          style={{ marginTop: 20 }}
        >
          {busy === "transform" ? "Adapting lesson..." : "Transform lesson"}
          <I.Sparkles size={18} />
        </button>
      </main>
    </Layout>
  );
}

function Learn() {
  const { session, busy, adapt, ask, getVisual, completeSection } =
    useSession();
  const [activeSection, setActiveSection] = useState(0);
  const [question, setQuestion] = useState("");
  const [askedQuestion, setAskedQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [playing, setPlaying] = useState(false);
  const transformed = session.transformed;
  const chunks =
    transformed?.profile === "cognitive_load"
      ? transformed.chunks
      : [transformed?.text || session.text];
  const sections = chunks.filter(Boolean).flatMap((chunk, chunkIndex) =>
    chunk
      .split(/\n\s*\n|(?<=[.!?])\s+(?=[A-Z])/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((paragraph, paragraphIndex) => ({
        id: `${chunkIndex}-${paragraphIndex}`,
        paragraph,
        chunk: chunkIndex + 1,
      })),
  );
  const currentSection = sections[activeSection];
  const formatting = transformed?.formatting || {};
  const isComplete = session.completedSections.includes(activeSection);

  const readAloud = (text) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
      setPlaying(true);
      utterance.onend = () => setPlaying(false);
    }
  };

  async function submitQuestion(event) {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || !currentSection) return;
    setAskedQuestion(prompt);
    setAnswer("");
    const result = await ask(prompt, currentSection.paragraph);
    if (result) setAnswer(result.answer);
  }

  function markSectionComplete() {
    completeSection(activeSection);
    if (activeSection < sections.length - 1)
      setActiveSection((index) => index + 1);
  }

  const lessonClass =
    transformed?.profile === "dyslexia"
      ? "dyslexia-lesson"
      : transformed?.profile === "low_vision"
        ? "low-vision-lesson"
        : "";

  return (
    <Layout section="Learn">
      <main className="page">
        <div className="eyebrow">
          <b>{PROFILE_LABELS[session.profile]}</b>
          <span>
            {session.completedSections.length}/{sections.length} completed
          </span>
        </div>
        
        <div className="lesson-heading">
          <div>
            <h1 className="page-title" style={{ margin: "4px 0" }}>Your adapted lesson</h1>
            <p className="lesson-subtitle">
              One section at a time · {session.wordCount} source words
            </p>
          </div>
          <button
            className="icon-action"
            onClick={() =>
              readAloud(
                sections.map((section) => section.paragraph).join("\n\n"),
              )
            }
          >
            <I.Volume2 size={16} />
            {playing ? "Stop reading" : "Read all"}
          </button>
        </div>

        {!transformed ? (
          <section className="card empty-state" style={{ marginTop: 20 }}>
            <I.BookOpen size={36} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>
              This lesson has not been adapted yet.
            </p>
            <button className="primary-action" onClick={adapt} style={{ maxWidth: 220, margin: "0 auto" }}>
              Adapt now <I.Sparkles size={16} />
            </button>
          </section>
        ) : (
          <>
            <div className="section-progress">
              <div>
                <b>
                  Section {activeSection + 1} of {sections.length}
                </b>
                <span>{isComplete ? "✓ Completed" : "In progress"}</span>
              </div>
              <div className="progressbar">
                <div
                  className="progressfill"
                  style={{
                    width: `${((activeSection + (isComplete ? 1 : 0)) / sections.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            <section
              className={`lesson-sections active-section ${lessonClass}`}
            >
              <div className="lesson-sections-header">
                <span className="pill">
                  {currentSection?.chunk > 1
                    ? `Learning chunk ${currentSection.chunk}`
                    : "Core idea"}
                </span>
                <span className="reading-note">Read at your own pace</span>
              </div>

              {currentSection && (
                <article className="lesson-section">
                  <div className="section-number">
                    {String(activeSection + 1).padStart(2, "0")}
                  </div>
                  <div className="section-content">
                    <div className="section-label">
                      Section {activeSection + 1}
                    </div>
                    <p
                      style={{
                        fontSize: formatting.font_size_multiplier
                          ? `${formatting.font_size_multiplier}em`
                          : undefined,
                        lineHeight: formatting.line_height,
                        letterSpacing: formatting.letter_spacing,
                      }}
                    >
                      {currentSection.paragraph}
                    </p>
                    <button
                      className="text-action"
                      onClick={() => readAloud(currentSection.paragraph)}
                    >
                      <I.Volume2 size={15} /> Read this section
                    </button>
                  </div>
                </article>
              )}
            </section>

            <div className="section-actions">
              <button
                className="secondary-action"
                disabled={activeSection === 0}
                onClick={() => setActiveSection((index) => index - 1)}
              >
                <I.ArrowLeft size={16} /> Previous
              </button>
              <button className="primary-action" onClick={markSectionComplete}>
                {isComplete
                  ? activeSection === sections.length - 1
                    ? "All sections complete"
                    : "Next section"
                  : "Mark section complete"}
                <I.Check size={18} />
              </button>
            </div>

            <div className="section-jump">
              {sections.map((section, index) => (
                <button
                  key={section.id}
                  className={`${index === activeSection ? "current" : ""} ${session.completedSections.includes(index) ? "done" : ""}`}
                  onClick={() => setActiveSection(index)}
                >
                  {session.completedSections.includes(index) ? (
                    <I.Check size={14} />
                  ) : (
                    index + 1
                  )}
                </button>
              ))}
            </div>

            <button
              className="secondary-action"
              disabled={Boolean(busy)}
              onClick={getVisual}
              style={{ width: "100%", marginTop: 14 }}
            >
              <I.Sparkles size={16} />
              {busy === "visual"
                ? "Building visual support..."
                : "Generate visual support"}
            </button>

            {session.visual?.image_base64 && (
              <section
                className="card visual-result"
                style={{ marginTop: 16, padding: 18 }}
              >
                <span className="section-label">Visual Support</span>
                <h3 style={{ fontSize: 18, marginTop: 4, fontFamily: "var(--font-heading)" }}>{session.visual.spec.title}</h3>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 12px" }}>{session.visual.spec.description}</p>
                <img
                  src={`data:image/png;base64,${session.visual.image_base64}`}
                  alt={session.visual.spec.title}
                  style={{ borderRadius: 14, border: "1px solid var(--border-color)" }}
                />
                <small style={{ display: "block", marginTop: 8, color: "var(--primary)", fontWeight: 600 }}>{session.visual.spec.why_helpful}</small>
              </section>
            )}

            <section
              className="card ask-card"
              style={{ marginTop: 16, padding: 18 }}
            >
              <b style={{ fontSize: 15, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                <I.HelpCircle size={18} style={{ color: "var(--primary)" }} /> Ask about this lesson
              </b>
              <p className="ask-context">
                Your question is sent to the AI assistant with the extracted lesson as context.
              </p>
              <form
                onSubmit={submitQuestion}
                style={{ display: "flex", gap: 8, marginTop: 10 }}
              >
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask a question about the lesson..."
                  style={{ flex: 1 }}
                />
                <button
                  className="primary-action"
                  disabled={!question.trim() || Boolean(busy)}
                  style={{ width: "auto", padding: "10px 18px" }}
                >
                  {busy === "voice" ? "Thinking..." : "Ask"}
                </button>
              </form>

              {askedQuestion && (
                <div className="answer-box">
                  <span className="section-label">Your question</span>
                  <p className="asked-question">{askedQuestion}</p>
                  <span className="section-label" style={{ display: "block", marginTop: 10 }}>Answer</span>
                  {answer ? (
                    <p style={{ fontSize: 14, lineHeight: 1.6, color: "#1e293b" }}>{answer}</p>
                  ) : session.error && busy !== "voice" ? (
                    <p className="answer-error" style={{ color: "#b91c1c", fontSize: 13 }}>{session.error}</p>
                  ) : busy === "voice" ? (
                    <p style={{ color: "var(--primary)", fontSize: 13 }}>Generating an answer from your lesson...</p>
                  ) : (
                    <p style={{ color: "var(--muted)", fontSize: 13 }}>No answer was returned. Please try again.</p>
                  )}
                </div>
              )}
            </section>

            <ErrorNotice />
          </>
        )}
      </main>
    </Layout>
  );
}

function Practice() {
  const { session, busy, getQuiz, evaluateAnswer, getWholeTest } = useSession();
  const chunks = session.transformed?.profile === "cognitive_load" ? session.transformed.chunks : [session.transformed?.text || session.text];
  const [sectionIndex, setSectionIndex] = useState(0);
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState("");
  const [report, setReport] = useState(null);
  const [testIndex, setTestIndex] = useState(0);
  const [testAnswers, setTestAnswers] = useState([]);
  const [testReport, setTestReport] = useState(null);
  const sectionText = chunks[sectionIndex] || "";
  const allSectionsMastered = chunks.length > 0 && chunks.every((_, index) => session.practiceReport.masteredSections.includes(index));

  async function loadSectionQuestion() {
    const result = await getQuiz(sectionText);
    if (result) { setQuiz(result); setSelected(""); setReport(null); }
  }

  async function submitSectionAnswer() {
    if (!quiz || !selected) return;
    const result = await evaluateAnswer({ question: quiz.question, options: quiz.options, correct_answer: quiz.answer, selected_answer: selected, explanation: quiz.explanation, section_index: sectionIndex });
    setReport(result);
  }

  async function startWholeTest() {
    const questions = await getWholeTest();
    if (questions?.length) { setTestIndex(0); setTestAnswers([]); setTestReport(null); }
  }

  async function submitTestAnswer() {
    if (!session.wholeTest?.[testIndex] || !selected) return;
    const question = session.wholeTest[testIndex];
    const nextAnswers = [...testAnswers, { question: question.question, selected, correct: selected === question.answer }];
    setTestAnswers(nextAnswers);
    setSelected("");
    if (testIndex < session.wholeTest.length - 1) setTestIndex((index) => index + 1);
    else setTestReport({ answered: nextAnswers, correct: nextAnswers.filter((answer) => answer.correct).length, failed: nextAnswers.filter((answer) => !answer.correct) });
  }

  return (
    <Layout section="Practice">
      <main className="page">
        <div className="eyebrow">
          <b>Mastery Practice</b>
          <span>{session.practiceReport.masteredSections.length}/{chunks.length} mastered</span>
        </div>
        <h1 className="page-title">Check your understanding</h1>

        {!sectionText ? (
          <section className="card empty-state" style={{ marginTop: 20 }}>
            <I.BadgeHelp size={36} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 15, color: "var(--ink)", fontWeight: 600 }}>Adapt a lesson first to generate section questions.</p>
          </section>
        ) : (
          <>
            <section className="card practice-report" style={{ padding: 18 }}>
              <b style={{ fontSize: 15, color: "var(--ink)", fontFamily: "var(--font-heading)" }}>Section Report</b>
              <div className="stats-grid" style={{ marginTop: 12 }}>
                <div className="stat">
                  <b>{session.practiceReport.answered.length}</b>
                  <span>Answered</span>
                </div>
                <div className="stat">
                  <b>{session.practiceReport.failed.length}</b>
                  <span>Need Review</span>
                </div>
                <div className="stat">
                  <b>{session.practiceReport.masteredSections.length}</b>
                  <span>Mastered</span>
                </div>
                <div className="stat">
                  <b>{chunks.length}</b>
                  <span>Total Sections</span>
                </div>
              </div>
            </section>

            <section className="card practice-card" style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="pill">Section {sectionIndex + 1} of {chunks.length}</span>
                {session.practiceReport.masteredSections.includes(sectionIndex) && (
                  <span className="pill" style={{ background: "var(--emerald-light)", color: "#047857" }}>✓ Mastered</span>
                )}
              </div>
              <p className="practice-context" style={{ marginTop: 8 }}>Questions are generated from this lesson section.</p>

              {!quiz ? (
                <div style={{ marginTop: 16, textAlign: "center" }}>
                  <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>Complete the section check before moving to the next topic.</p>
                  <button className="primary-action" disabled={Boolean(busy)} onClick={loadSectionQuestion}>
                    {busy === "quiz" ? "Generating question..." : "Start section question"}
                    <I.HelpCircle size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <h2>{quiz.question}</h2>
                  <div className="option-list">
                    {quiz.options.map((option, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      return (
                        <button
                          key={option}
                          className={selected === option ? "selected" : ""}
                          onClick={() => !report && setSelected(option)}
                        >
                          <span style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            background: selected === option ? "var(--primary)" : "#e2e8f0",
                            color: selected === option ? "#fff" : "var(--muted)",
                            display: "grid",
                            placeItems: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            flexShrink: 0
                          }}>{letter}</span>
                          <span>{option}</span>
                        </button>
                      );
                    })}
                  </div>

                  {!report ? (
                    <button className="primary-action" disabled={!selected || Boolean(busy)} onClick={submitSectionAnswer}>
                      {busy === "evaluate" ? "Evaluating answer..." : "Submit answer"}
                    </button>
                  ) : (
                    <div className={`feedback ${report.is_correct ? "correct-feedback" : "failed-feedback"}`}>
                      <b style={{ fontSize: 15, display: "block", marginBottom: 4 }}>
                        {report.is_correct ? "✓ Correct! Section mastered." : "✕ Not quite. Review this topic."}
                      </b>
                      <p>{report.explanation}</p>
                      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                        {!report.is_correct && (
                          <button className="secondary-action" onClick={loadSectionQuestion}>
                            Retry this topic
                          </button>
                        )}
                        {report.is_correct && sectionIndex < chunks.length - 1 && (
                          <button className="primary-action" onClick={() => { setSectionIndex((index) => index + 1); setQuiz(null); setReport(null); }}>
                            Continue to next section <I.ArrowRight size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>

            {allSectionsMastered && !session.wholeTest && (
              <section className="card mastery-unlocked" style={{ marginTop: 16 }}>
                <b style={{ fontSize: 16, color: "#065f46", display: "flex", alignItems: "center", gap: 8 }}>
                  <I.Award size={20} /> All Sections Mastered!
                </b>
                <p style={{ margin: "6px 0 14px" }}>You can now take a comprehensive test covering the entire extracted lesson.</p>
                <button className="primary-action" disabled={Boolean(busy)} onClick={startWholeTest} style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}>
                  {busy === "test" ? "Building test..." : "Take whole-lesson test"}
                  <I.ClipboardCheck size={18} />
                </button>
              </section>
            )}

            {session.wholeTest && !testReport && (
              <section className="card practice-card" style={{ marginTop: 16 }}>
                <span className="pill">Whole-lesson test · {testIndex + 1} of {session.wholeTest.length}</span>
                <h2>{session.wholeTest[testIndex].question}</h2>
                <div className="option-list">
                  {session.wholeTest[testIndex].options.map((option, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    return (
                      <button key={option} className={selected === option ? "selected" : ""} onClick={() => setSelected(option)}>
                        <span style={{
                          width: 24, height: 24, borderRadius: 6,
                          background: selected === option ? "var(--primary)" : "#e2e8f0",
                          color: selected === option ? "#fff" : "var(--muted)",
                          display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0
                        }}>{letter}</span>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>
                <button className="primary-action" disabled={!selected || Boolean(busy)} onClick={submitTestAnswer}>
                  Submit test answer
                </button>
              </section>
            )}

            {testReport && (
              <section className="card feedback correct-feedback" style={{ marginTop: 16, padding: 20 }}>
                <b style={{ fontSize: 16, display: "block", marginBottom: 6 }}>🎉 Whole-lesson test complete</b>
                <p style={{ fontSize: 14 }}>You scored {testReport.correct} of {testReport.answered.length} correct.</p>
                {testReport.failed.length ? (
                  <div style={{ marginTop: 10 }}>
                    <b>Topics to review:</b>
                    <p style={{ marginTop: 4 }}>{testReport.failed.map((item) => item.question).join(" ")}</p>
                  </div>
                ) : (
                  <p style={{ marginTop: 6, fontWeight: 600 }}>Excellent work! You answered every test question correctly.</p>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </Layout>
  );
}

function Progress() {
  const { session } = useSession();
  const transformed = Boolean(session.transformed);
  const chunks =
    session.transformed?.profile === "cognitive_load"
      ? session.transformed.chunks.length
      : transformed
        ? 1
        : 0;

  return (
    <Layout section="Progress">
      <main className="page">
        <div className="eyebrow">
          <b>Session Progress</b>
          <span>{session.fileName || "No lesson loaded"}</span>
        </div>
        <h1 className="page-title">Your learning session</h1>

        <div className="stats-grid">
          <div className="stat">
            <b>{session.wordCount}</b>
            <span>Source Words</span>
          </div>
          <div className="stat">
            <b>{chunks}</b>
            <span>Learning Chunks</span>
          </div>
          <div className="stat">
            <b>{session.quizzes.length}</b>
            <span>Questions Made</span>
          </div>
          <div className="stat">
            <b>{session.completedSections.length}</b>
            <span>Sections Completed</span>
          </div>
        </div>

        <section className="card" style={{ marginTop: 18, padding: 22 }}>
          <span className="pill" style={{ marginBottom: 10 }}>
            {PROFILE_LABELS[session.profile]}
          </span>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 22, margin: "6px 0" }}>
            {transformed
              ? `${session.completedSections.length} of ${chunks} sections completed`
              : "Ready to begin your study session"}
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            {transformed
              ? "Your completed sections and practice scores are recorded for this learning session."
              : "Upload a document or paste lesson notes to start your personalized adaptive learning session."}
          </p>
        </section>
      </main>
    </Layout>
  );
}

function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/" element={<Progress />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/progress" element={<Progress />} />
      </Routes>
    </SessionProvider>
  );
}

export default App;
