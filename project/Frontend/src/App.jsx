import React, { createContext, useContext, useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import * as I from "lucide-react";
import {
  askLessonQuestion,
  detectProfile,
  extractDocument,
  generateQuiz,
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
    }));
  }

  async function chooseProfile(profile) {
    setSession((current) => ({ ...current, profile, transformed: null, quizzes: [], visual: null }));
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
      setSession((current) => ({ ...current, transformed: result, quizzes: [], visual: null }));
      return result;
    });
  }

  async function getQuiz(chunk) {
    return run("quiz", async () => {
      const result = await generateQuiz(chunk, session.profile);
      setSession((current) => ({ ...current, quizzes: [...current.quizzes, result] }));
      return result;
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
    return run("voice", () => askLessonQuestion(question, session.text, sectionText, session.profile));
  }

  function completeSection(sectionIndex) {
    setSession((current) => {
      if (current.completedSections.includes(sectionIndex)) return current;
      return { ...current, completed: current.completed + 1, completedSections: [...current.completedSections, sectionIndex] };
    });
  }

  return (
    <SessionContext.Provider value={{ session, busy, upload, setText, chooseProfile, detect, adapt, getQuiz, getVisual, ask, completeSection }}>
      {children}
    </SessionContext.Provider>
  );
}

function Header({ section }) {
  return <header className="topbar"><div className="brand"><div className="logo">A</div><div><div className="brandname">AdaptLearn</div><div className="subtitle">{section}</div></div></div><div className="access">{PROFILE_LABELS[useSession().session.profile]}</div><div className="avatar" /></header>;
}

function Layout({ children, section }) {
  const location = useLocation();
  const items = [["/upload", "Upload", I.CloudUpload], ["/learn", "Learn", I.BookOpen], ["/practice", "Practice", I.BadgeHelp], ["/progress", "Progress", I.BarChart3]];
  return <div className="app"><div className="phone"><Header section={section} />{children}<nav className="bottom">{items.map(([to, label, Icon]) => <NavLink key={to} to={to} className={`nav ${location.pathname === to ? "active" : ""}`}><Icon /><span>{label}</span></NavLink>)}</nav></div></div>;
}

function ErrorNotice() {
  const { session } = useSession();
  return session.error ? <div style={{ background: "#fff0f0", color: "#a12929", padding: 10, borderRadius: 8, marginTop: 12, fontSize: 12 }}>{session.error}</div> : null;
}

function Upload() {
  const { session, busy, upload, setText } = useSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState("upload");
  const [draft, setDraft] = useState(session.text);
  const ready = Boolean(session.text.trim());
  return <Layout section="Upload"><main className="page">
    <div className="eyebrow"><b>Step 1 of 3</b><span>Setup and adapt engine</span></div>
    <section className="card" style={{ marginTop: 15, padding: 17, background: "#f0f1ff", border: 0 }}><b style={{ fontSize: 16 }}>Add learning material</b><p style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 0 }}>Upload a document or paste a lesson. The backend extracts and prepares it for your learning profile.</p></section>
    <div className="segmented" style={{ marginTop: 15 }}>{[["upload", "Upload document"], ["text", "Paste raw text"]].map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={tab === value ? "selected" : ""}>{label}</button>)}</div>
    <section className="card" style={{ marginTop: 14, padding: 14 }}>
      <span className="pill" style={{ background: "#eefcf7" }}>Backend extraction with OCR fallback</span>
      {tab === "upload" ? <label className="dropzone"><input type="file" className="hidden" accept=".pdf,.docx,.epub,.txt" onChange={(event) => upload(event.target.files?.[0])} /><I.UploadCloud size={32} /><b>{session.fileName || "Choose a document"}</b><span>PDF, DOCX, EPUB, or TXT up to 45MB</span><strong>Select from device</strong></label> : <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => setText(draft)} placeholder="Paste raw text here..." style={{ width: "100%", minHeight: 180, marginTop: 14 }} />}
      <div style={{ background: "#eef0ff", borderRadius: 7, padding: 10, fontSize: 11, marginTop: 12 }}><div style={{ display: "flex", justifyContent: "space-between" }}><b>{busy === "extract" ? "Extracting..." : ready ? "Ready for adaptation" : "Waiting for content"}</b><span>{session.wordCount} words</span></div><div className="progressbar" style={{ marginTop: 8 }}><div className="progressfill" style={{ width: busy === "extract" ? "55%" : ready ? "100%" : "0%" }} /></div>{session.text && <div style={{ marginTop: 8, background: "#fff", padding: 8, borderRadius: 5, maxHeight: 84, overflow: "auto" }}>{session.text.slice(0, 600)}{session.text.length > 600 ? "..." : ""}</div>}</div>
    </section>
    <ErrorNotice />
    <button className="primary-action" disabled={!ready || Boolean(busy)} onClick={() => navigate("/profile")} style={{ marginTop: 15 }}>Continue to learner profile <I.ArrowRight size={16} /></button>
  </main></Layout>;
}

function Profile() {
  const { session, busy, chooseProfile, detect, adapt } = useSession();
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const cards = [["dyslexia", "Shorter sentences, clearer wording, and less visual crowding."], ["cognitive_load", "Digestible chunks with one idea at a time."], ["low_vision", "High-contrast display guidance and larger readable text."]];
  return <Layout section="Profile"><main className="page"><div className="eyebrow"><b>Step 2 of 3</b><span>Choose your learning mode</span></div><h1 className="page-title">How should this lesson feel?</h1><div className="profile-grid">{cards.map(([profile, descriptionText]) => <button key={profile} className={`profile-option ${session.profile === profile ? "active" : ""}`} onClick={() => chooseProfile(profile)}><span className="radio" /> <span><b>{PROFILE_LABELS[profile]}</b><small>{descriptionText}</small></span></button>)}</div><section className="card" style={{ marginTop: 15, padding: 14 }}><b>Describe your needs</b><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="For example: long paragraphs are hard for me to follow" style={{ width: "100%", minHeight: 70, marginTop: 9 }} /><button className="secondary-action" disabled={!description.trim() || Boolean(busy)} onClick={() => detect(description)}>Detect profile</button></section><ErrorNotice /><button className="primary-action" disabled={!session.text || Boolean(busy)} onClick={async () => { await adapt(); navigate("/learn"); }} style={{ marginTop: 15 }}>{busy === "transform" ? "Adapting lesson..." : "Transform lesson"}<I.Sparkles size={16} /></button></main></Layout>;
}

function LearnLegacy() {
  const { session, busy, adapt, ask, getVisual, completeChunk } = useSession();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [playing, setPlaying] = useState(false);
  const transformed = session.transformed;
  const chunks = transformed?.profile === "cognitive_load" ? transformed.chunks : [transformed?.text || session.text];
  const sections = chunks.filter(Boolean).flatMap((chunk, chunkIndex) => {
    const paragraphs = chunk.split(/\n\s*\n|(?<=[.!?])\s+(?=[A-Z])/).map((part) => part.trim()).filter(Boolean);
    return paragraphs.map((paragraph, paragraphIndex) => ({
      id: `${chunkIndex}-${paragraphIndex}`,
      number: chunkIndex + 1,
      paragraph,
    }));
  });
  const lessonText = sections.map((section) => section.paragraph).join("\n\n");
  const formatting = transformed?.formatting || {};
  const lessonClass = transformed?.profile === "dyslexia" ? "lesson-card dyslexia-lesson" : transformed?.profile === "low_vision" ? "lesson-card low-vision-lesson" : "lesson-card";
  function readAloud(text) { if ("speechSynthesis" in window) { window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.rate = 0.95; window.speechSynthesis.speak(utterance); setPlaying(true); utterance.onend = () => setPlaying(false); } }
  async function submitQuestion(event) { event.preventDefault(); const result = await ask(question); if (result) setAnswer(result.answer); }
  return <Layout section="Learn"><main className="page"><div className="eyebrow"><b>{PROFILE_LABELS[session.profile]}</b><span>{session.wordCount} words</span></div><div className="lesson-heading"><div><h1 className="page-title">Your adapted lesson</h1><p className="lesson-subtitle">{sections.length} readable sections · {session.wordCount} source words</p></div><button className="icon-action" onClick={() => readAloud(lessonText)} title="Read the full lesson aloud">{playing ? "Stop" : "Read all"}</button></div>{!transformed ? <section className="card empty-state"><p>This lesson has not been adapted yet.</p><button className="primary-action" onClick={adapt}>Adapt now <I.Sparkles size={16} /></button></section> : <><nav className="section-map" aria-label="Lesson sections">{sections.map((section, index) => <a key={section.id} href={`#lesson-section-${section.id}`}><span>{String(index + 1).padStart(2, "0")}</span><small>{section.paragraph.slice(0, 38)}{section.paragraph.length > 38 ? "..." : ""}</small></a>)}</nav><div className={`lesson-sections ${lessonClass}`}><div className="lesson-sections-header"><span className="pill">{sections.length} sections</span><span className="reading-note">Read at your pace</span></div>{sections.map((section, index) => <article id={`lesson-section-${section.id}`} key={section.id} className="lesson-section"><div className="section-number">{String(index + 1).padStart(2, "0")}</div><div className="section-content"><div className="section-label">{section.number > 1 ? `Learning chunk ${section.number}` : "Core idea"}</div><p style={{ fontSize: formatting.font_size_multiplier ? `${formatting.font_size_multiplier}em` : undefined, lineHeight: formatting.line_height, letterSpacing: formatting.letter_spacing }}>{section.paragraph}</p><button className="text-action" onClick={() => readAloud(section.paragraph)}>Read this section <I.Volume2 size={13} /></button></div></article>)}</div><div className="action-row"><button className="secondary-action" disabled={Boolean(busy)} onClick={getVisual}>{busy === "visual" ? "Building visual..." : "Generate visual"}</button><button className="primary-action" onClick={completeChunk}>Mark lesson complete <I.Check size={16} /></button></div>{session.visual?.image_base64 && <section className="card visual-result" style={{ marginTop: 14, padding: 14 }}><span className="section-label">Visual support</span><h3>{session.visual.spec.title}</h3><p>{session.visual.spec.description}</p><img src={`data:image/png;base64,${session.visual.image_base64}`} alt={session.visual.spec.title} /><small>{session.visual.spec.why_helpful}</small></section>}<section className="card ask-card" style={{ marginTop: 14, padding: 14 }}><b>Ask about this lesson</b><form onSubmit={submitQuestion} style={{ display: "flex", gap: 8, marginTop: 9 }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Type a question" style={{ flex: 1 }} /><button className="primary-action" disabled={!question.trim() || Boolean(busy)}>{busy === "voice" ? "..." : "Ask"}</button></form>{answer && <p style={{ background: "#f0f1ff", padding: 10, borderRadius: 8, marginBottom: 0 }}>{answer}</p>}</section></>}</main></Layout>;
}

function Learn() {
  const { session, busy, adapt, ask, getVisual, completeSection } = useSession();
  const [activeSection, setActiveSection] = useState(0);
  const [question, setQuestion] = useState("");
  const [askedQuestion, setAskedQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [playing, setPlaying] = useState(false);
  const transformed = session.transformed;
  const chunks = transformed?.profile === "cognitive_load" ? transformed.chunks : [transformed?.text || session.text];
  const sections = chunks.filter(Boolean).flatMap((chunk, chunkIndex) => chunk.split(/\n\s*\n|(?<=[.!?])\s+(?=[A-Z])/).map((part) => part.trim()).filter(Boolean).map((paragraph, paragraphIndex) => ({ id: `${chunkIndex}-${paragraphIndex}`, paragraph, chunk: chunkIndex + 1 })));
  const currentSection = sections[activeSection];
  const formatting = transformed?.formatting || {};
  const isComplete = session.completedSections.includes(activeSection);
  const readAloud = (text) => { if ("speechSynthesis" in window) { window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.rate = 0.95; window.speechSynthesis.speak(utterance); setPlaying(true); utterance.onend = () => setPlaying(false); } };
  async function submitQuestion(event) { event.preventDefault(); const prompt = question.trim(); if (!prompt || !currentSection) return; setAskedQuestion(prompt); setAnswer(""); const result = await ask(prompt, currentSection.paragraph); if (result) setAnswer(result.answer); }
  function markSectionComplete() { completeSection(activeSection); if (activeSection < sections.length - 1) setActiveSection((index) => index + 1); }
  const lessonClass = transformed?.profile === "dyslexia" ? "dyslexia-lesson" : transformed?.profile === "low_vision" ? "low-vision-lesson" : "";
  return <Layout section="Learn"><main className="page"><div className="eyebrow"><b>{PROFILE_LABELS[session.profile]}</b><span>{session.completedSections.length}/{sections.length} completed</span></div><div className="lesson-heading"><div><h1 className="page-title">Your adapted lesson</h1><p className="lesson-subtitle">One section at a time · {session.wordCount} source words</p></div><button className="icon-action" onClick={() => readAloud(sections.map((section) => section.paragraph).join("\n\n"))}>{playing ? "Stop" : "Read all"}</button></div>{!transformed ? <section className="card empty-state"><p>This lesson has not been adapted yet.</p><button className="primary-action" onClick={adapt}>Adapt now <I.Sparkles size={16} /></button></section> : <><div className="section-progress"><div><b>Section {activeSection + 1} of {sections.length}</b><span>{isComplete ? "Completed" : "In progress"}</span></div><div className="progressbar"><div className="progressfill" style={{ width: `${((activeSection + (isComplete ? 1 : 0)) / sections.length) * 100}%` }} /></div></div><section className={`lesson-sections active-section ${lessonClass}`}><div className="lesson-sections-header"><span className="pill">{currentSection?.chunk > 1 ? `Learning chunk ${currentSection.chunk}` : "Core idea"}</span><span className="reading-note">Read at your pace</span></div>{currentSection && <article className="lesson-section"><div className="section-number">{String(activeSection + 1).padStart(2, "0")}</div><div className="section-content"><div className="section-label">Section {activeSection + 1}</div><p style={{ fontSize: formatting.font_size_multiplier ? `${formatting.font_size_multiplier}em` : undefined, lineHeight: formatting.line_height, letterSpacing: formatting.letter_spacing }}>{currentSection.paragraph}</p><button className="text-action" onClick={() => readAloud(currentSection.paragraph)}>Read this section <I.Volume2 size={13} /></button></div></article>}</section><div className="section-actions"><button className="secondary-action" disabled={activeSection === 0} onClick={() => setActiveSection((index) => index - 1)}><I.ArrowLeft size={15} /> Previous</button><button className="primary-action" onClick={markSectionComplete}>{isComplete ? activeSection === sections.length - 1 ? "All sections complete" : "Next section" : "Mark section complete"}<I.Check size={16} /></button></div><div className="section-jump">{sections.map((section, index) => <button key={section.id} className={`${index === activeSection ? "current" : ""} ${session.completedSections.includes(index) ? "done" : ""}`} onClick={() => setActiveSection(index)}>{session.completedSections.includes(index) ? <I.Check size={12} /> : index + 1}</button>)}</div><button className="secondary-action" disabled={Boolean(busy)} onClick={getVisual} style={{ width: "100%" }}>{busy === "visual" ? "Building visual..." : "Generate visual support"}</button>{session.visual?.image_base64 && <section className="card visual-result" style={{ marginTop: 14, padding: 14 }}><span className="section-label">Visual support</span><h3>{session.visual.spec.title}</h3><p>{session.visual.spec.description}</p><img src={`data:image/png;base64,${session.visual.image_base64}`} alt={session.visual.spec.title} /><small>{session.visual.spec.why_helpful}</small></section>}<section className="card ask-card" style={{ marginTop: 14, padding: 14 }}><b>Ask about this lesson</b><p className="ask-context">Your question is sent to the assistant with the extracted lesson as context.</p><form onSubmit={submitQuestion} style={{ display: "flex", gap: 8, marginTop: 9 }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a question about the lesson" style={{ flex: 1 }} /><button className="primary-action" disabled={!question.trim() || Boolean(busy)}>{busy === "voice" ? "Thinking..." : "Ask"}</button></form>{askedQuestion && <div className="answer-box"><span className="section-label">Your question</span><p className="asked-question">{askedQuestion}</p><span className="section-label">Answer</span>{answer ? <p>{answer}</p> : <p>Generating an answer from your lesson...</p>}</div>}</section></>}</main></Layout>;
}

function Practice() {
  const { session, busy, getQuiz, completeSection } = useSession();
  const chunks = session.transformed?.profile === "cognitive_load" ? session.transformed.chunks : [session.transformed?.text || session.text];
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const chunk = chunks[0] || "";
  async function loadQuiz() { const result = await getQuiz(chunk); if (result) { setQuiz(result); setSelected(""); setSubmitted(false); } }
  return <Layout section="Practice"><main className="page"><div className="eyebrow"><b>Practice</b><span>{session.completedSections.length} sections completed</span></div><h1 className="page-title">Check your understanding</h1>{!chunk ? <section className="card empty-state">Adapt a lesson first to generate practice questions.</section> : !quiz ? <section className="card empty-state"><p>Generate a question from your current lesson.</p><button className="primary-action" disabled={Boolean(busy)} onClick={loadQuiz}>{busy === "quiz" ? "Generating..." : "Generate question"}<I.HelpCircle size={16} /></button></section> : <section className="card practice-card"><span className="pill">{session.profile}</span><h2>{quiz.question}</h2><div className="option-list">{quiz.options.map((option) => <button key={option} className={selected === option ? "selected" : ""} onClick={() => !submitted && setSelected(option)}>{option}</button>)}</div><button className="primary-action" disabled={!selected || submitted} onClick={() => { setSubmitted(true); if (selected === quiz.answer) completeSection(0); }}>{submitted ? (selected === quiz.answer ? "Correct" : "Review answer") : "Submit answer"}</button>{submitted && <div className="feedback"><b>{selected === quiz.answer ? "Correct." : `Answer: ${quiz.answer}`}</b><p>{quiz.explanation}</p></div>}<button className="text-action" onClick={loadQuiz}>Generate another question</button></section>}<ErrorNotice /></main></Layout>;
}

function Progress() {
  const { session } = useSession();
  const transformed = Boolean(session.transformed);
  const chunks = session.transformed?.profile === "cognitive_load" ? session.transformed.chunks.length : transformed ? 1 : 0;
  return <Layout section="Progress"><main className="page"><div className="eyebrow"><b>Session progress</b><span>{session.fileName || "No lesson loaded"}</span></div><h1 className="page-title">Your learning session</h1><div className="stats-grid"><div className="card stat"><b>{session.wordCount}</b><span>Source words</span></div><div className="card stat"><b>{chunks}</b><span>Learning chunks</span></div><div className="card stat"><b>{session.quizzes.length}</b><span>Questions made</span></div><div className="card stat"><b>{session.completedSections.length}</b><span>Sections completed</span></div></div><section className="card" style={{ marginTop: 15, padding: 16 }}><span className="pill" style={{ background: "#e7e9fb" }}>{PROFILE_LABELS[session.profile]}</span><h2 style={{ marginBottom: 6 }}>{transformed ? `${session.completedSections.length} of ${chunks} sections completed` : "Ready to begin"}</h2><p style={{ marginTop: 0, color: "#4e5265" }}>{transformed ? "Your completed sections are recorded for this learning session." : "Upload a document and choose a profile to start."}</p></section></main></Layout>;
}

function App() {
  return <SessionProvider><Routes><Route path="/" element={<Progress />} /><Route path="/upload" element={<Upload />} /><Route path="/profile" element={<Profile />} /><Route path="/learn" element={<Learn />} /><Route path="/practice" element={<Practice />} /><Route path="/progress" element={<Progress />} /></Routes></SessionProvider>;
}

export default App;
