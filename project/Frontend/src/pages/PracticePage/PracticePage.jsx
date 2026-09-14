import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as I from "lucide-react";
import { useSession } from "../../context/SessionContext";
import { Layout } from "../../components/Layout/Layout";
import ErrorNotice from "../../components/ErrorNotice";
import "./PracticePage.css";

function PracticePage() {
  const {
    session,
    busy,
    getQuiz,
    evaluateAnswer,
    getPracticeQuiz,
    getAdaptiveQuizAction,
    recordQuizAnswerAction,
    recordPracticeResult,
    completeChunk,
    completeSection,
  } = useSession();
  const navigate = useNavigate();

  const chunks =
    Array.isArray(session.transformed?.chunks)
      ? session.transformed.chunks
      : [session.transformed?.text || session.text];

  const isRewireActive = session.rewireState.active;
  const chunk = chunks[0] || "";

  // ── Adaptive (REWIRE) quiz state ─────────────────────────────────────────
  const [adaptiveQuiz, setAdaptiveQuiz] = useState(null);
  const [adaptiveSelected, setAdaptiveSelected] = useState("");
  const [adaptiveSubmitted, setAdaptiveSubmitted] = useState(false);

  // ── Per-section quiz state ───────────────────────────────────────────────
  const [sectionIndex, setSectionIndex] = useState(0);
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState("");
  const [report, setReport] = useState(null);

  // ── Practice Quiz state (full-lesson, post-completion) ───────────────────
  const [practicePhase, setPracticePhase] = useState("idle"); // "idle" | "loading" | "quiz" | "done"
  const [practiceQuestions, setPracticeQuestions] = useState([]);

  const sectionText = chunks[sectionIndex] || "";

  // Detect if all sections are complete (learner came from Learn after finishing)
  const totalSectionsCount =
    Array.isArray(session.transformed?.sections) && session.transformed.sections.length > 0
      ? session.transformed.sections.length
      : Array.isArray(session.transformed?.chunks) && session.transformed.chunks.length > 0
        ? session.transformed.chunks.length
        : 1;

  const completedSections = session.completedSections || [];
  const completedCount = completedSections.length;
  const allSectionsComplete = Boolean(
    session.transformed &&
    completedCount >= totalSectionsCount
  );

  async function loadAdaptiveQuiz() {
    const result = await getAdaptiveQuizAction(chunk);
    if (result) {
      setAdaptiveQuiz(result);
      setAdaptiveSelected("");
      setAdaptiveSubmitted(false);
    }
  }

  function handleAdaptiveSubmit() {
    if (!adaptiveSelected || adaptiveSubmitted) return;
    setAdaptiveSubmitted(true);
    const isCorrect = adaptiveSelected === adaptiveQuiz.answer;
    recordPracticeResult({
      question: adaptiveQuiz.question,
      selected: adaptiveSelected,
      answer: adaptiveQuiz.answer,
      explanation: adaptiveQuiz.explanation,
      is_correct: isCorrect,
      section_index: 0,
      latency_ms: 4000,
    });
    if (isCorrect) {
      completeChunk();
      completeSection(0);
    }
  }

  async function loadSectionQuestion() {
    const result = await getQuiz(sectionText);
    if (result) {
      setQuiz(result);
      setSelected("");
      setReport(null);
    }
  }

  async function submitSectionAnswer() {
    if (!quiz || !selected) return;
    const result = await evaluateAnswer({
      question: quiz.question,
      options: quiz.options,
      correct_answer: quiz.answer,
      selected_answer: selected,
      explanation: quiz.explanation,
      section_index: sectionIndex,
    });
    setReport(result);
    if (result.is_correct) {
      completeSection(sectionIndex);
    }
  }

  async function startPracticeQuiz() {
    if (!session.text) return;
    setPracticePhase("loading");
    try {
      const questions = await getPracticeQuiz();
      if (questions && questions.length > 0) {
        setPracticeQuestions(questions);
        setPracticePhase("quiz");
      } else {
        setPracticePhase("idle");
      }
    } catch (err) {
      console.error("Practice quiz generation error:", err);
      setPracticePhase("idle");
    }
  }

  function resetPracticeQuiz() {
    setPracticeQuestions([]);
    setPracticePhase("idle");
  }

  // ── Quit quiz confirmation for sidebar navigation ─────────────────────
  const [showNavQuitConfirm, setShowNavQuitConfirm] = useState(false);
  const [pendingNavDest, setPendingNavDest] = useState(null);

  // Called by Layout when user clicks a sidebar link during an active quiz
  function handleNavIntercept(to) {
    if (practicePhase === "quiz") {
      setPendingNavDest(to);
      setShowNavQuitConfirm(true);
      return true; // intercepted
    }
    return false; // allow navigation
  }

  function confirmNavQuit() {
    setShowNavQuitConfirm(false);
    resetPracticeQuiz();
    if (pendingNavDest) navigate(pendingNavDest);
    setPendingNavDest(null);
  }

  function cancelNavQuit() {
    setShowNavQuitConfirm(false);
    setPendingNavDest(null);
  }

  return (
    <Layout section="Practice" onNavIntercept={handleNavIntercept}>
      <main className="page">
        <div className="eyebrow">
          <b>Mastery Practice</b>
          <span>{completedCount}/{totalSectionsCount} sections done</span>
        </div>
        <h1 className="page-title">Check your understanding</h1>

        {/* ── Practice Quiz (full-lesson, AI generated) ─────────── */}
        {practicePhase === "loading" ? (
          <section className="card" style={{ padding: 48, textAlign: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                border: "4px solid #e2e8f0", borderTop: "4px solid var(--primary)",
                animation: "spin 0.8s linear infinite"
              }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)" }}>Generating your practice quiz…</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
                  Extracting and formulating the most important and relevant questions from your lesson.
                </div>
              </div>
            </div>
          </section>
        ) : practicePhase === "quiz" ? (
          <PracticeQuizView
            questions={practiceQuestions}
            onDone={startPracticeQuiz}
            onExit={resetPracticeQuiz}
          />
        ) : (
          <>
            {!session.text ? (
              <section className="card" style={{ padding: 36, textAlign: "center", marginBottom: 16 }}>
                <I.BookOpen size={36} style={{ color: "var(--muted)", margin: "0 auto 12px", display: "block" }} />
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)", marginBottom: 6 }}>No lesson content loaded</div>
                <p style={{ fontSize: 13, color: "var(--muted)", maxWidth: 460, margin: "0 auto 16px" }}>
                  To take a practice quiz, add learning material by uploading a document or asking the AI Course Builder on the Upload page.
                </p>
                <button className="primary-action" onClick={() => navigate("/")} style={{ maxWidth: 220, margin: "0 auto" }}>
                  Add Learning Material <I.ArrowRight size={15} />
                </button>
              </section>
            ) : allSectionsComplete ? (
              /* ── Start card shown when all sections done ───────────────── */
              <section className="card" style={{
                marginBottom: 16, padding: "28px 28px 24px",
                background: "linear-gradient(135deg, rgba(236, 253, 245, 0.95) 0%, rgba(240, 253, 250, 0.8) 100%)",
                border: "1.5px solid rgba(16, 185, 129, 0.35)",
                boxShadow: "0 10px 28px -6px rgba(16, 185, 129, 0.15), 0 0 0 1px rgba(16, 185, 129, 0.1)",
                borderRadius: 20,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%",
                    background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                    border: "2px solid #f59e0b",
                    boxShadow: "0 4px 14px rgba(245, 158, 11, 0.28)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#b45309",
                    flexShrink: 0,
                  }}>
                    <I.Trophy size={24} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)", fontFamily: "var(--font-heading)" }}>All Sections Complete!</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>Ready to test your full knowledge of: <strong>{session.fileName || session.lessonTitle || "the lesson"}</strong></div>
                  </div>
                </div>
                <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, marginBottom: 18 }}>
                  Great work completing every section. Now take the <strong>Practice Quiz</strong> — AI will formulate important questions from your lesson material to evaluate your mastery.
                </p>
                <button
                  id="start-practice-quiz-btn"
                  className="primary-action"
                  disabled={busy === "practiceQuiz" || !session.text}
                  onClick={startPracticeQuiz}
                  style={{
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: 15,
                    padding: "12px 22px",
                    borderRadius: 12,
                    boxShadow: "0 6px 18px rgba(16, 185, 129, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                  }}
                >
                  {busy === "practiceQuiz" ? "Generating quiz…" : "Start Practice Quiz"}
                  <I.ClipboardCheck size={18} />
                </button>
              </section>
            ) : (
              <section className="card" style={{
                marginBottom: 16, padding: 24,
                background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                border: "1.5px solid #cbd5e1"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: "#64748b",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <I.BookOpen size={20} style={{ color: "#fff" }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>Practice Quiz Available</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      Topic: <strong>{session.fileName || session.lessonTitle || "Active Lesson"}</strong> • {completedCount} of {totalSectionsCount} sections completed in Learn
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, marginBottom: 16 }}>
                  You can finish all sections in Learn to unlock the full mastery review, or start a practice quiz right now covering key concepts in this lesson.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    id="start-practice-quiz-btn"
                    className="primary-action"
                    disabled={busy === "practiceQuiz" || !session.text}
                    onClick={startPracticeQuiz}
                    style={{ flex: 1 }}
                  >
                    {busy === "practiceQuiz" ? "Generating quiz…" : "Start Practice Quiz Now"}
                    <I.ClipboardCheck size={16} />
                  </button>
                  <button
                    className="secondary-action"
                    onClick={() => navigate("/learn")}
                    style={{ flex: 1 }}
                  >
                    Back to Learn <I.ArrowRight size={15} />
                  </button>
                </div>
              </section>
            )}

        {/* ── REWIRE Adaptive Question Card ─────────────────────────────── */}
        {isRewireActive && (
          <section className="card" style={{
            marginBottom: 16, padding: 22,
            border: "1.5px solid var(--amber-border)",
            background: "linear-gradient(135deg, #fffdfa 0%, #fffbeb 100%)",
            boxShadow: "0 6px 18px rgba(245, 158, 11, 0.08)",
            borderRadius: 18,
          }}>
            <div style={{
              background: "var(--amber-light)", color: "var(--amber-text)", border: "1px solid var(--amber-border)",
              padding: "6px 14px", borderRadius: 9999,
              fontSize: 12.5, fontWeight: 700,
              display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14,
            }}>
              <I.Zap size={14} />
              <span>Adaptive Question: Calibrated to Simplified Level</span>
            </div>

            {!adaptiveQuiz ? (
              <div>
                <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>
                  Generate an adaptive question calibrated to your learning recovery.
                </p>
                <button className="primary-action" disabled={Boolean(busy)} onClick={loadAdaptiveQuiz}
                  style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "#ffffff", fontWeight: 700, borderRadius: 12, boxShadow: "0 4px 14px rgba(245, 158, 11, 0.3)" }}
                >
                  {busy === "quiz" ? "Generating..." : "Generate Adaptive Question"}
                  <I.HelpCircle size={18} />
                </button>
              </div>
            ) : (
              <div className="practice-card" style={{ padding: 0 }}>
                <h2 style={{ fontSize: 18, marginBottom: 14, color: "var(--ink)", fontWeight: 700 }}>{adaptiveQuiz.question}</h2>
                <div className="option-list">
                  {adaptiveQuiz.options.map((option, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    return (
                      <button key={option} className={adaptiveSelected === option ? "selected" : ""}
                        onClick={() => !adaptiveSubmitted && setAdaptiveSelected(option)}>
                        <span style={{ width: 24, height: 24, borderRadius: 6, background: adaptiveSelected === option ? "var(--primary)" : "#e2e8f0", color: adaptiveSelected === option ? "#fff" : "var(--muted)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{letter}</span>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>
                <button className="primary-action" disabled={!adaptiveSelected || adaptiveSubmitted} onClick={handleAdaptiveSubmit}
                  style={{ marginTop: 14, borderRadius: 12 }}
                >
                  {adaptiveSubmitted ? (adaptiveSelected === adaptiveQuiz.answer ? "Correct" : "Review Answer") : "Submit Answer"}
                </button>
                {adaptiveSubmitted && (
                  <div className={`feedback ${adaptiveSelected === adaptiveQuiz.answer ? "correct-feedback" : "failed-feedback"}`} style={{ marginTop: 14, borderRadius: 12 }}>
                    <b style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      {adaptiveSelected === adaptiveQuiz.answer ? <><I.CheckCircle2 size={16} /> Correct</> : <><I.AlertCircle size={16} /> Answer: {adaptiveQuiz.answer}</>}
                    </b>
                    <p>{adaptiveQuiz.explanation}</p>
                  </div>
                )}
                {adaptiveSubmitted && session.latestOutcome && (
                  <div className="outcome-card" style={{ marginTop: 14, borderRadius: 14 }}>
                    <div className="outcome-title">
                      <span className="outcome-delta-badge">+{((session.latestOutcome.outcomeDelta || 1) * 100).toFixed(0)}%</span>
                      <span>SCALE Outcome: Struggle Successfully Resolved</span>
                    </div>
                    <button className="primary-action" style={{ background: "#059669", fontSize: 12, padding: "8px 14px", width: "auto", marginTop: 10, borderRadius: 10 }} onClick={() => navigate("/progress")}>
                      View in Progress Dashboard <I.ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        <section className="card practice-report" style={{ padding: 20, borderRadius: 18 }}>
          <b style={{ fontSize: 15, color: "var(--ink)", fontFamily: "var(--font-heading)" }}>Section Report</b>
          <div className="practice-stats-grid" style={{ marginTop: 14 }}>
            <div className="stat practice-stat-card">
              <div className="practice-stat-header">
                <div className="practice-stat-icon" style={{ background: "rgba(31, 94, 99, 0.08)", color: "var(--primary)", borderColor: "rgba(31, 94, 99, 0.18)" }}>
                  <I.FileEdit size={16} />
                </div>
              </div>
              <b>{session.practiceReport.answered.length}</b>
              <span>Answered</span>
            </div>
            <div className="stat practice-stat-card">
              <div className="practice-stat-header">
                <div className="practice-stat-icon" style={{ background: "#fff1f2", color: "#e11d48", borderColor: "#fecdd3" }}>
                  <I.RotateCcw size={16} />
                </div>
              </div>
              <b>{session.practiceReport.failed.length}</b>
              <span>Need Review</span>
            </div>
            <div className="stat practice-stat-card">
              <div className="practice-stat-header">
                <div className="practice-stat-icon" style={{ background: "#ecfdf5", color: "#059669", borderColor: "#a7f3d0" }}>
                  <I.Trophy size={16} />
                </div>
              </div>
              <b>{session.practiceReport.masteredSections.length}</b>
              <span>Mastered</span>
            </div>
            <div className="stat practice-stat-card">
              <div className="practice-stat-header">
                <div className="practice-stat-icon" style={{ background: "#eef2ff", color: "#4f46e5", borderColor: "#c7d2fe" }}>
                  <I.BookOpen size={16} />
                </div>
              </div>
              <b>{chunks.length}</b>
              <span>Total Sections</span>
            </div>
          </div>
        </section>

        {/* ── Per-section quiz ─────────────────────────────────────────── */}
        {!sectionText ? (
          <section className="card empty-state" style={{ marginTop: 16 }}>
            <I.BadgeHelp size={36} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 15, color: "var(--ink)", fontWeight: 600 }}>Adapt a lesson first to generate section questions.</p>
          </section>
        ) : (
          <section className="card practice-card" style={{ marginTop: 16 }}>
            <span className="pill">Section {sectionIndex + 1} of {chunks.length}</span>
            <p className="practice-context" style={{ marginTop: 8 }}>Section-by-section comprehension check.</p>
            {!quiz ? (
              <div style={{ marginTop: 16, textAlign: "center" }}>
                <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>Test your understanding of this section before moving on.</p>
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
                      <button key={option} className={selected === option ? "selected" : ""} onClick={() => !report && setSelected(option)}>
                        <span style={{ width: 24, height: 24, borderRadius: 6, background: selected === option ? "var(--primary)" : "#e2e8f0", color: selected === option ? "#fff" : "var(--muted)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{letter}</span>
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
                    <b style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      {report.is_correct ? <><I.CheckCircle2 size={16} /> Correct! Section mastered.</> : <><I.AlertCircle size={16} /> Review this topic</>}
                    </b>
                    <p>{report.explanation}</p>
                    <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                      {!report.is_correct && (<button className="secondary-action" onClick={loadSectionQuestion}>Retry this topic</button>)}
                      {report.is_correct && sectionIndex < chunks.length - 1 && (
                        <button className="primary-action" onClick={() => { setSectionIndex((i) => i + 1); setQuiz(null); setReport(null); }}>
                          Continue to next section <I.ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}
          </>
        )}

        <ErrorNotice />
      </main>

      {/* ── Sidebar Nav Quit Quiz Confirmation Modal ── */}
      {showNavQuitConfirm && (
        <div
          onClick={cancelNavQuit}
          style={{
            position: "fixed", inset: 0, zIndex: 99999,
            backgroundColor: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            display: "grid", placeItems: "center", padding: 20,
            animation: "fadeInBackdrop 0.18s ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 420, width: "100%", padding: "32px 28px",
              background: "#ffffff", borderRadius: 22,
              boxShadow: "0 25px 60px -15px rgba(15, 23, 42, 0.35)",
              border: "1.5px solid rgba(31, 94, 99, 0.18)",
              textAlign: "center",
              animation: "scaleUpModal 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(245, 158, 11, 0.08))",
              border: "1.5px solid rgba(245, 158, 11, 0.35)",
              margin: "0 auto 18px", display: "grid", placeItems: "center", color: "#b45309",
            }}>
              <I.AlertTriangle size={28} strokeWidth={2.2} />
            </div>

            <h3 style={{ fontSize: 21, fontWeight: 800, color: "var(--ink, #203438)", marginBottom: 8, letterSpacing: "-0.01em" }}>
              Quit the quiz?
            </h3>
            <p style={{ fontSize: 14, color: "var(--muted, #607477)", lineHeight: 1.55, marginBottom: 24 }}>
              You have an active practice quiz in progress. Leaving now will discard your current answers.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                onClick={confirmNavQuit}
                style={{
                  width: "100%", padding: "12px 18px", borderRadius: 12,
                  fontWeight: 700, fontSize: 14.5,
                  background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                  color: "#ffffff", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: "0 4px 14px rgba(220, 38, 38, 0.3)",
                }}
              >
                <I.LogOut size={16} />
                <span>Yes, Quit Quiz</span>
              </button>
              <button
                type="button"
                onClick={cancelNavQuit}
                style={{
                  width: "100%", padding: "11px 18px", borderRadius: 12,
                  fontWeight: 600, fontSize: 14,
                  background: "#f1f5f3", color: "var(--ink, #203438)",
                  border: "1px solid rgba(31, 94, 99, 0.14)", cursor: "pointer",
                }}
              >
                Continue Quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function PracticeQuizView({ questions, onDone, onExit }) {
  const { recordPracticeResult } = useSession();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [finished, setFinished] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [pendingQuitAction, setPendingQuitAction] = useState(null);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState(null);
  const autoAdvanceTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    setCurrentIndex(0);
    setSelected("");
    setRevealed(false);
    setAnswers([]);
    setFinished(false);
  }, [questions]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  const q = questions[currentIndex] || {};
  const total = questions.length;
  const progress = total > 0 ? ((currentIndex) / total) * 100 : 0;

  const handleNext = useCallback(() => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setAutoAdvanceCountdown(null);
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
      setSelected("");
      setRevealed(false);
    } else {
      setFinished(true);
    }
  }, [currentIndex, total]);

  function handleReveal() {
    if (!selected || revealed) return;
    setRevealed(true);
    const isCorrect = selected === q.answer;
    setAnswers((prev) => [...prev, { question: q.question, selected, answer: q.answer, explanation: q.explanation, correct: isCorrect }]);

    // Persist question answer to session practiceReport and update struggle/telemetry signals
    recordPracticeResult({
      question: q.question,
      selected,
      answer: q.answer,
      explanation: q.explanation,
      is_correct: isCorrect,
      section_index: typeof q.section_index === "number" ? q.section_index : currentIndex,
      latency_ms: 3000,
    });

    // Auto-advance to next question after 2 seconds
    setAutoAdvanceCountdown(2);
    countdownTimerRef.current = setInterval(() => {
      setAutoAdvanceCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    autoAdvanceTimerRef.current = setTimeout(() => {
      handleNext();
    }, 2000);
  }

  // Quit confirmation handlers
  function requestQuit(action) {
    setShowQuitConfirm(true);
    setPendingQuitAction(() => action);
    // Pause auto-advance while modal is open
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setAutoAdvanceCountdown(null);
  }

  function confirmQuit() {
    setShowQuitConfirm(false);
    if (pendingQuitAction) pendingQuitAction();
    setPendingQuitAction(null);
  }

  function cancelQuit() {
    setShowQuitConfirm(false);
    setPendingQuitAction(null);
  }

  if (finished) {
    const correct = answers.filter((a) => a.correct).length;
    const wrong = answers.filter((a) => !a.correct);
    const pct = Math.round((correct / total) * 100);
    const grade = pct >= 80 ? "Excellent" : pct >= 60 ? "Good" : "Keep Practising";
    const gradeColor = pct >= 80 ? "#059669" : pct >= 60 ? "#2563eb" : "#dc2626";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Score hero */}
        <section className="card" style={{ padding: 28, textAlign: "center", background: "linear-gradient(135deg,#f0fdf4 0%,#eff6ff 100%)", border: "2px solid #bbf7d0" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Practice Quiz Complete</div>
          <div style={{ position: "relative", width: 110, height: 110, margin: "0 auto 14px" }}>
            <svg viewBox="0 0 110 110" style={{ width: 110, height: 110, transform: "rotate(-90deg)" }}>
              <circle cx="55" cy="55" r="46" fill="none" stroke="#e2e8f0" strokeWidth="10" />
              <circle cx="55" cy="55" r="46" fill="none" stroke={gradeColor} strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 46}`}
                strokeDashoffset={`${2 * Math.PI * 46 * (1 - pct / 100)}`}
                style={{ transition: "stroke-dashoffset 1s ease" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: gradeColor, fontFamily: "var(--font-heading)" }}>{pct}%</div>
              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>SCORE</div>
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: gradeColor, fontFamily: "var(--font-heading)", marginBottom: 4 }}>{grade}!</div>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>
            <span style={{ fontWeight: 700, color: "#059669" }}>{correct} correct</span>
            {" "}·{" "}
            <span style={{ fontWeight: 700, color: "#dc2626" }}>{wrong.length} wrong</span>
            {" "}out of {total} questions
          </div>
        </section>

        {/* Correct answers */}
        {answers.filter((a) => a.correct).length > 0 && (
          <section className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <I.CheckCircle2 size={18} style={{ color: "#059669", flexShrink: 0 }} />
              <b style={{ fontSize: 14, color: "#065f46" }}>Correct ({answers.filter((a) => a.correct).length})</b>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {answers.filter((a) => a.correct).map((a, i) => (
                <div key={i} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 2 }}>{a.question}</div>
                  <div style={{ fontSize: 12, color: "#059669", fontWeight: 700 }}>✓ {a.answer}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Wrong answers */}
        {wrong.length > 0 && (
          <section className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <I.AlertCircle size={18} style={{ color: "#dc2626", flexShrink: 0 }} />
              <b style={{ fontSize: 14, color: "#7f1d1d" }}>Needs Review ({wrong.length})</b>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {wrong.map((a, i) => (
                <div key={i} style={{ background: "#fff7f7", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>{a.question}</div>
                  <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, marginBottom: 2 }}>✗ You answered: {a.selected}</div>
                  <div style={{ fontSize: 12, color: "#059669", fontWeight: 700, marginBottom: 4 }}>✓ Correct: {a.answer}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{a.explanation}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="secondary-action" style={{ flex: 1 }} onClick={onDone}>
            <I.RefreshCw size={15} /> Retake Quiz
          </button>
          {onExit && (
            <button className="secondary-action" style={{ flex: 1 }} onClick={onExit}>
              <I.BookOpen size={15} /> Practice Overview
            </button>
          )}
          <button className="primary-action" style={{ flex: 1 }} onClick={() => navigate("/progress")}>
            View Progress <I.BarChart3 size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Progress bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 6, background: "#e2e8f0", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,#6366f1,#818cf8)", borderRadius: 99, transition: "width 0.4s ease" }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>{currentIndex + 1} / {total}</span>
      </div>

      {/* Question card */}
      <section className="card practice-card" style={{ padding: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
          Question {currentIndex + 1}
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", marginBottom: 18, lineHeight: 1.45 }}>{q.question}</h2>

        <div className="option-list">
          {q.options.map((option, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const isSelected = selected === option;
            const isCorrect = option === q.answer;
            let bg = isSelected ? "var(--primary)" : "#e2e8f0";
            let color = isSelected ? "#fff" : "var(--muted)";
            let rowBorder = "";
            let rowBg = "";
            if (revealed) {
              if (isCorrect) { bg = "#059669"; color = "#fff"; rowBorder = "1px solid #bbf7d0"; rowBg = "#f0fdf4"; }
              else if (isSelected && !isCorrect) { bg = "#dc2626"; color = "#fff"; rowBorder = "1px solid #fecaca"; rowBg = "#fff7f7"; }
              else { bg = "#e2e8f0"; color = "var(--muted)"; }
            }
            return (
              <button
                key={option}
                className={isSelected ? "selected" : ""}
                style={revealed ? { border: rowBorder, background: rowBg, cursor: "default", opacity: (!isCorrect && !isSelected) ? 0.55 : 1 } : {}}
                onClick={() => !revealed && setSelected(option)}
              >
                <span style={{ width: 24, height: 24, borderRadius: 6, background: bg, color, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, transition: "background 0.2s" }}>{letter}</span>
                <span>{option}</span>
                {revealed && isCorrect && <I.CheckCircle2 size={16} style={{ marginLeft: "auto", color: "#059669", flexShrink: 0 }} />}
                {revealed && isSelected && !isCorrect && <I.XCircle size={16} style={{ marginLeft: "auto", color: "#dc2626", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>

        {/* Explanation after reveal */}
        {revealed && (
          <div className={`feedback ${selected === q.answer ? "correct-feedback" : "failed-feedback"}`} style={{ marginTop: 14 }}>
            <b style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              {selected === q.answer ? <><I.CheckCircle2 size={15} /> Correct!</> : <><I.AlertCircle size={15} /> Incorrect — correct answer: {q.answer}</>}
            </b>
            <p style={{ fontSize: 13, margin: 0 }}>{q.explanation}</p>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          {!revealed ? (
            <button className="primary-action" disabled={!selected} onClick={handleReveal} style={{ flex: 1 }}>
              Check Answer
            </button>
          ) : (
            <button className="primary-action" onClick={handleNext} style={{ flex: 1, position: "relative" }}>
              {currentIndex < total - 1 ? (
                <>
                  {autoAdvanceCountdown > 0 ? `Next in ${autoAdvanceCountdown}s…` : "Next Question"}
                  <I.ChevronRight size={16} />
                </>
              ) : (
                <>
                  {autoAdvanceCountdown > 0 ? `Results in ${autoAdvanceCountdown}s…` : "See Results"}
                  <I.Award size={16} />
                </>
              )}
            </button>
          )}
          {revealed && (
            <button
              className="secondary-action"
              onClick={() => requestQuit(onExit)}
              style={{ flexShrink: 0, padding: "10px 14px" }}
              title="Quit quiz"
            >
              <I.LogOut size={15} />
            </button>
          )}
        </div>
      </section>

      {/* ── Quit Quiz Confirmation Modal ── */}
      {showQuitConfirm && (
        <div
          onClick={cancelQuit}
          style={{
            position: "fixed", inset: 0, zIndex: 99999,
            backgroundColor: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            display: "grid", placeItems: "center", padding: 20,
            animation: "fadeInBackdrop 0.18s ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 420, width: "100%", padding: "32px 28px",
              background: "#ffffff", borderRadius: 22,
              boxShadow: "0 25px 60px -15px rgba(15, 23, 42, 0.35)",
              border: "1.5px solid rgba(31, 94, 99, 0.18)",
              textAlign: "center",
              animation: "scaleUpModal 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(239, 68, 68, 0.18), rgba(239, 68, 68, 0.08))",
              border: "1.5px solid rgba(239, 68, 68, 0.35)",
              margin: "0 auto 18px", display: "grid", placeItems: "center", color: "#b91c1c",
            }}>
              <I.AlertTriangle size={28} strokeWidth={2.2} />
            </div>

            <h3 style={{ fontSize: 21, fontWeight: 800, color: "var(--ink, #203438)", marginBottom: 8, letterSpacing: "-0.01em" }}>
              Quit the quiz?
            </h3>
            <p style={{ fontSize: 14, color: "var(--muted, #607477)", lineHeight: 1.55, marginBottom: 24 }}>
              You've answered <strong>{answers.length}</strong> of <strong>{total}</strong> questions.
              Your progress will not be saved if you leave now.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                onClick={confirmQuit}
                style={{
                  width: "100%", padding: "12px 18px", borderRadius: 12,
                  fontWeight: 700, fontSize: 14.5,
                  background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                  color: "#ffffff", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: "0 4px 14px rgba(220, 38, 38, 0.3)",
                }}
              >
                <I.LogOut size={16} />
                <span>Yes, Quit Quiz</span>
              </button>
              <button
                type="button"
                onClick={cancelQuit}
                style={{
                  width: "100%", padding: "11px 18px", borderRadius: 12,
                  fontWeight: 600, fontSize: 14,
                  background: "#f1f5f3", color: "var(--ink, #203438)",
                  border: "1px solid rgba(31, 94, 99, 0.14)", cursor: "pointer",
                }}
              >
                Continue Quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── XP system ── pure function, retune the multipliers here ─────────────── */
function computeXP({ questionsAnswered, chunksCompleted, sectionsMastered }) {
  return (questionsAnswered * 10) + (chunksCompleted * 15) + (sectionsMastered * 50);
}

// Triangular level scale: level N costs N×100 XP (so L2=100, L3=300, L4=600…)
function xpToLevel(totalXP) {
  let xp = totalXP;
  let level = 1;
  while (xp >= level * 100) { xp -= level * 100; level++; }
  return { level, xpInLevel: xp, xpForNext: level * 100 };
}

/* ── Expressive Mascot Face Icons for Struggle Tiers ─────────── */
function StruggleFaceIcon({ tierKey, color, size = 16 }) {
  if (tierKey === "smooth_sailing") {
    // Calm, half-closed-eyes "chill" face (zen smile)
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill={`${color}18`} />
        {/* Zen happy curved eyes */}
        <path d="M 6.5 10.5 Q 8.5 8, 10.5 10.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M 13.5 10.5 Q 15.5 8, 17.5 10.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
        {/* Chill smile */}
        <path d="M 8.5 14.5 Q 12 17.5, 15.5 14.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (tierKey === "some_friction") {
    // Furrowed brow, thinking face
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill={`${color}18`} />
        {/* Thinking brows: one raised, one furrowed */}
        <path d="M 6.5 7.5 L 10.5 8.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M 13.5 8.5 L 17.5 6.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        {/* Curious dot eyes */}
        <circle cx="8.5" cy="11" r="1.5" fill={color} />
        <circle cx="15.5" cy="11" r="1.5" fill={color} />
        {/* Thoughtful line mouth */}
        <path d="M 9 15.5 Q 12 14, 15 15.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (tierKey === "struggling") {
    // Sweating / strained face
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill={`${color}18`} />
        {/* Strained squinting eyes */}
        <path d="M 7 12 L 10 10 L 7 8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 17 12 L 14 10 L 17 8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {/* Sweat drop on brow */}
        <path d="M 19 3.5 C 19 3.5, 17 6, 17 7.5 C 17 8.6, 17.9 9.5, 19 9.5 C 20.1 9.5, 21 8.6, 21 7.5 C 21 6, 19 3.5, 19 3.5 Z" fill="#0284c7" stroke="#0284c7" strokeWidth="0.8" />
        {/* Wavy nervous mouth */}
        <path d="M 8.5 15.5 Q 10.5 17.5, 12 15.5 Q 13.5 13.5, 15.5 15.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (tierKey === "high_strain") {
    // Wide-eyed overwhelmed face
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill={`${color}18`} />
        {/* Wide overwhelmed eyes */}
        <circle cx="8" cy="9.5" r="3" stroke={color} strokeWidth="1.6" fill="#ffffff" />
        <circle cx="8" cy="9.5" r="1.2" fill={color} />
        <circle cx="16" cy="9.5" r="3" stroke={color} strokeWidth="1.6" fill="#ffffff" />
        <circle cx="16" cy="9.5" r="1.2" fill={color} />
        {/* Open 'o' overwhelmed mouth */}
        <ellipse cx="12" cy="16" rx="2.8" ry="2.4" stroke={color} strokeWidth="2" fill={`${color}25`} />
        {/* Stress sparks */}
        <path d="M 6 4 L 7.5 5.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M 18 4 L 16.5 5.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  // "not_started" / default: sleepy neutral dot-eyed face
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill={`${color}18`} />
      {/* Sleepy resting horizontal eyes */}
      <path d="M 6.5 10.5 L 10.5 10.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M 13.5 10.5 L 17.5 10.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Calm neutral line mouth */}
      <path d="M 9.5 15 L 14.5 15" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ── Struggle Score Tier Helper ───────────────────────────────────────────── */
function getStruggleTier(score, isTransformed = true) {
  if (!isTransformed) {
    return {
      key: "not_started",
      name: "Not started",
      color: "#6b7280",
      bg: "#f3f4f6",
      border: "#e5e7eb",
    };
  }

  const pct = (score || 0) * 100;
  if (pct >= 80) {
    return {
      key: "high_strain",
      name: "High Strain",
      color: "#dc2626",
      bg: "#fef2f2",
      border: "#fecaca",
    };
  } else if (pct >= 60) {
    return {
      key: "struggling",
      name: "Struggling",
      color: "#ea580c",
      bg: "#fff7ed",
      border: "#fed7aa",
    };
  } else if (pct >= 30) {
    return {
      key: "some_friction",
      name: "Some Friction",
      color: "#d97706",
      bg: "#fffbeb",
      border: "#fde68a",
    };
  } else {
    return {
      key: "smooth_sailing",
      name: "Smooth Sailing",
      color: "#16a34a",
      bg: "#f0fdf4",
      border: "#bbf7d0",
    };
  }
}

/* ── Gamified HUD Cognitive Mood Helper ──────────────────────── */
function getCognitiveMood(score = 0, isTransformed = true) {
  if (!isTransformed) {
    return {
      label: "CALM",
      emoji: "🧘",
      color: "#1f5e63",
      glow: "rgba(252, 224, 114, 0.45)",
    };
  }

  const pct = (score || 0) * 100;
  if (pct >= 80) {
    return {
      label: "STRAIN",
      emoji: "🔥",
      color: "#dc2626",
      glow: "rgba(220, 38, 38, 0.55)",
    };
  } else if (pct >= 60) {
    return {
      label: "STRUGGLING",
      emoji: "😅",
      color: "#ea580c",
      glow: "rgba(234, 88, 12, 0.5)",
    };
  } else if (pct >= 35) {
    return {
      label: "FOCUS",
      emoji: "🎯",
      color: "#d97706",
      glow: "rgba(217, 119, 6, 0.45)",
    };
  } else {
    return {
      label: "CALM",
      emoji: "🧘",
      color: "#1f5e63",
      glow: "rgba(252, 224, 114, 0.45)",
    };
  }
}

/* ── Reactive Mascot Orb ─────────────────────────────────────── */
function ReactiveOrb({ struggleScore = 0 }) {
  const isHighStruggle = struggleScore >= 0.7;
  const isMediumStruggle = struggleScore >= 0.35 && struggleScore < 0.7;
  const mood = isHighStruggle ? "tense" : isMediumStruggle ? "alert" : "calm";

  return (
    <div
      className={`reactive-orb-container reactive-orb--${mood}`}
      title={`Cognitive State: ${mood === "tense" ? "High Strain" : mood === "alert" ? "Focusing" : "Calm & In the Zone"}`}
    >
      <svg className="reactive-orb-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="orb-grad-calm" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fce072" />
            <stop offset="50%" stopColor="#1f5e63" />
            <stop offset="100%" stopColor="#fbbf24" />
          </radialGradient>
          <radialGradient id="orb-grad-alert" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="50%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </radialGradient>
          <radialGradient id="orb-grad-tense" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fca5a5" />
            <stop offset="50%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#991b1b" />
          </radialGradient>
        </defs>

        {/* Ambient aura */}
        <circle cx="50" cy="50" r="32" className="orb-aura" />

        {/* Dynamic morphing blob */}
        {isHighStruggle ? (
          <path
            d="M 50 16 C 68 14, 82 26, 84 44 C 86 60, 74 76, 58 82 C 42 88, 24 82, 18 64 C 12 48, 20 28, 34 20 Z"
            fill="url(#orb-grad-tense)"
            className="orb-blob"
          />
        ) : isMediumStruggle ? (
          <path
            d="M 50 18 C 66 18, 78 30, 78 48 C 78 66, 64 78, 48 78 C 32 78, 22 66, 22 48 C 22 30, 34 18, 50 18 Z"
            fill="url(#orb-grad-alert)"
            className="orb-blob"
          />
        ) : (
          <path
            d="M 50 20 C 66 20, 78 32, 78 50 C 78 68, 64 80, 50 80 C 34 80, 22 68, 22 50 C 22 32, 34 20, 50 20 Z"
            fill="url(#orb-grad-calm)"
            className="orb-blob"
          />
        )}

        {/* Mascot eye sparkles */}
        <circle cx="43" cy="47" r="2.5" fill="#ffffff" opacity="0.9" />
        <circle cx="57" cy="47" r="2.5" fill="#ffffff" opacity="0.9" />
      </svg>
    </div>
  );
}

/* ── Struggle Slider Face SVGs ────────────────────────────── */
function SliderFace({ tierKey, size = 44 }) {
  // All faces: soft round head, increasingly sad/discouraged expression
  // Never angry — droopy eyes/mouth, not furrowed brows
  const s = size;
  const half = s / 2;
  const eyeY = half - 3;
  const mouthY = half + 7;

  if (tierKey === "smooth_sailing") {
    // 😊 Content calm smiling face
    return (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <circle cx="22" cy="22" r="20" fill="#dcfce7" stroke="#16a34a" strokeWidth="2" />
        {/* Happy eyes - slight upward curve */}
        <path d="M13 18 Q15 15, 17 18" stroke="#15803d" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M27 18 Q29 15, 31 18" stroke="#15803d" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Eye sparkles */}
        <circle cx="15" cy="17" r="1" fill="#15803d" />
        <circle cx="29" cy="17" r="1" fill="#15803d" />
        {/* Cheerful smile */}
        <path d="M15 27 Q22 34, 29 27" stroke="#15803d" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Rosy cheeks */}
        <circle cx="12" cy="25" r="3" fill="#bbf7d0" opacity="0.7" />
        <circle cx="32" cy="25" r="3" fill="#bbf7d0" opacity="0.7" />
      </svg>
    );
  }

  if (tierKey === "some_friction") {
    // 🙂 Slightly neutral/content — mild concern creeping in
    return (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <circle cx="22" cy="22" r="20" fill="#fef9c3" stroke="#d97706" strokeWidth="2" />
        {/* Neutral round eyes */}
        <circle cx="15" cy="19" r="2.5" fill="#92400e" />
        <circle cx="29" cy="19" r="2.5" fill="#92400e" />
        {/* Inner eye highlight */}
        <circle cx="16" cy="18" r="0.8" fill="#ffffff" />
        <circle cx="30" cy="18" r="0.8" fill="#ffffff" />
        {/* Flat/slightly upturned mouth */}
        <path d="M16 28 Q22 30, 28 28" stroke="#92400e" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        {/* Mild brow furrow (gentle, not angry) */}
        <path d="M12 14 Q15 13, 18 14.5" stroke="#b45309" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        <path d="M26 14.5 Q29 13, 32 14" stroke="#b45309" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      </svg>
    );
  }

  if (tierKey === "struggling") {
    // 🙁 Worried/downturned — subtle sadness, droopy
    return (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <circle cx="22" cy="22" r="20" fill="#ffedd5" stroke="#ea580c" strokeWidth="2" />
        {/* Worried round eyes — slightly larger, looking down */}
        <ellipse cx="15" cy="19" rx="2.8" ry="3" fill="#9a3412" />
        <ellipse cx="29" cy="19" rx="2.8" ry="3" fill="#9a3412" />
        <circle cx="16" cy="18.5" r="0.9" fill="#ffffff" />
        <circle cx="30" cy="18.5" r="0.9" fill="#ffffff" />
        {/* Worried brows — inner ends raised */}
        <path d="M11 14 Q14.5 11.5, 18 13.5" stroke="#c2410c" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M26 13.5 Q29.5 11.5, 33 14" stroke="#c2410c" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        {/* Subtle frown — turned down at edges */}
        <path d="M15 29 Q22 25, 29 29" stroke="#9a3412" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Sweat drop */}
        <ellipse cx="34" cy="14" rx="1.5" ry="2.2" fill="#fce072" opacity="0.8" />
      </svg>
    );
  }

  // high_strain or default: 😔 Sad, droopy-eyed, downcast
  return (
    <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
      <circle cx="22" cy="22" r="20" fill="#fef2f2" stroke="#991b1b" strokeWidth="2" />
      {/* Sad droopy eyes — half-lidded, looking down */}
      <ellipse cx="15" cy="20" rx="3" ry="2.5" fill="#7f1d1d" />
      <ellipse cx="29" cy="20" rx="3" ry="2.5" fill="#7f1d1d" />
      {/* Heavy eyelids drooping over top of eyes */}
      <path d="M11.5 19 Q15 17, 18.5 19" stroke="#991b1b" strokeWidth="1.8" strokeLinecap="round" fill="#fef2f2" />
      <path d="M25.5 19 Q29 17, 32.5 19" stroke="#991b1b" strokeWidth="1.8" strokeLinecap="round" fill="#fef2f2" />
      <circle cx="14" cy="19.5" r="0.7" fill="#ffffff" opacity="0.6" />
      <circle cx="28" cy="19.5" r="0.7" fill="#ffffff" opacity="0.6" />
      {/* Sad eyebrows — drooping at outer edges */}
      <path d="M11 15 Q14 13.5, 18 15.5" stroke="#991b1b" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M26 15.5 Q30 13.5, 33 15" stroke="#991b1b" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Deep frown — downcast sadness */}
      <path d="M14 31 Q22 26, 30 31" stroke="#7f1d1d" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Tear drop */}
      <ellipse cx="12" cy="25" rx="1.3" ry="2" fill="#fce072" opacity="0.8" />
    </svg>
  );
}

/* ── Struggle Slider (replaces HeartbeatLine) ───────────────── */
function HeartbeatLine({ struggleScore = 0, isTransformed = false }) {
  const [animPct, setAnimPct] = React.useState(0);

  const pct = Math.round((struggleScore || 0) * 100);
  const targetPct = Math.max(3, Math.min(97, pct));

  // Animate slider from 0 → target on mount/change with silky smooth quartic ease-out
  React.useEffect(() => {
    if (!isTransformed) return;

    let animId = null;
    let start = null;
    const duration = 1200;

    setAnimPct(0);

    const step = (ts) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      // Quartic ease-out for organic, butter-smooth deceleration
      const eased = 1 - Math.pow(1 - t, 4);
      setAnimPct(eased * targetPct);
      if (t < 1) animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => { if (animId) cancelAnimationFrame(animId); };
  }, [isTransformed, targetPct]);

  if (!isTransformed) {
    return (
      <div className="slider-track-card slider-track-card--idle">
        <div className="slider-track-rail">
          <div className="slider-track-empty" />
        </div>
        <span className="slider-idle-label">Waiting for lesson telemetry…</span>
      </div>
    );
  }

  const tier = getStruggleTier(struggleScore);
  const color = tier.color;

  return (
    <div
      className={`slider-track-card ${struggleScore >= 0.8 ? "slider-track-card--strained" : ""}`}
      style={{
        borderColor: struggleScore >= 0.8 ? "#fca5a5" : undefined,
        backgroundColor: struggleScore >= 0.8 ? "#fff5f5" : undefined,
      }}
    >
      {/* Track rail */}
      <div className="slider-track-rail">
        {/* Filled portion behind marker */}
        <div
          className="slider-track-filled"
          style={{
            width: `${animPct}%`,
            background: `linear-gradient(90deg, ${color}50, ${color})`,
          }}
        />
        {/* Empty portion ahead */}
        <div
          className="slider-track-empty"
          style={{ left: `${animPct}%`, width: `${100 - animPct}%` }}
        />
      </div>

      {/* Emoji face marker */}
      <div
        className="slider-face-marker"
        style={{ left: `${animPct}%` }}
      >
        {/* % label above the face */}
        <div
          className="slider-face-label"
          style={{
            color: color,
            background: `${color}14`,
            borderColor: `${color}35`,
          }}
        >
          {pct}%
        </div>
        {/* The actual face */}
        <div className="slider-face-circle">
          <SliderFace tierKey={tier.key} size={44} />
        </div>
      </div>
    </div>
  );
}


/* ── Mastery Ring ─────────────────────────────────────────────────────────── */
const MASTERY_LEGEND = [
  { color: "#1f5e63", strokeColor: "#1f5e63", bg: "#dfeae5", label: "Getting Started" },
  { color: "#713f12", strokeColor: "#fce072", bg: "#fef9c3", border: "1px solid #fce072", label: "Building Momentum" },
  { color: "#34D399", strokeColor: "#34D399", bg: "#d1fae5", label: "Almost Mastered" },
  { color: "#FBBF24", strokeColor: "#FBBF24", bg: "#fef3c7", label: "Mastered" },
];

function MasteryRing({ masteryPct = 0, xpTotal = 0, struggleScore = 0 }) {
  const SIZE = 160;
  const STROKE = 14;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;

  // Local animation progress (0 -> 1) resetting on every mount
  const [animFraction, setAnimFraction] = React.useState(0);

  React.useEffect(() => {
    let animId = null;
    let startTime = null;
    const duration = 1200; // ~1200ms silky ease-out fill on mount

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(1, elapsed / duration);
      // Ease-out quart for smooth deceleration without sudden stop
      const eased = 1 - Math.pow(1 - t, 4);
      setAnimFraction(eased);

      if (t < 1) {
        animId = requestAnimationFrame(step);
      }
    };

    setAnimFraction(0);
    animId = requestAnimationFrame(step);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [masteryPct, xpTotal]);

  const currentMastery = (masteryPct || 0) * animFraction;
  const filled = (currentMastery / 100) * CIRC;

  const tier =
    masteryPct >= 100 ? MASTERY_LEGEND[3] :
      masteryPct >= 70 ? MASTERY_LEGEND[2] :
        masteryPct >= 40 ? MASTERY_LEGEND[1] :
          MASTERY_LEGEND[0];

  const { level, xpInLevel, xpForNext } = xpToLevel(xpTotal);
  const xpBarPct = Math.min(100, Math.round((xpInLevel / xpForNext) * 100));
  const currentXpBarPct = xpBarPct * animFraction;
  const currentXpTotal = Math.round(xpTotal * animFraction);
  const currentXpInLevel = Math.round(xpInLevel * animFraction);

  // +XP toast: compare to localStorage-cached previous value (frontend-only)
  const [toast, setToast] = React.useState(null);
  React.useEffect(() => {
    const CACHE_KEY = "adaptlearn_last_xp";
    const prev = parseInt(localStorage.getItem(CACHE_KEY) || "0", 10);
    const diff = xpTotal - prev;
    if (diff > 0) setToast(`+${diff} XP`);
    localStorage.setItem(CACHE_KEY, String(xpTotal));
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mastery-ring-wrap">
      {toast && <div className="mastery-xp-toast">{toast}</div>}

      <div className={`mastery-ring-svg-wrap${masteryPct >= 100 && animFraction >= 0.9 ? " mastery-ring--gold" : ""}`}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mastery-ring-svg" style={{ width: "100%", height: "100%", shapeRendering: "geometricPrecision" }}>
          {/* Track */}
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none" stroke="#E5E7EB" strokeWidth={STROKE} />
          {/* Filled arc */}
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none"
            stroke={tier.strokeColor || tier.color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={CIRC - filled}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            className="mastery-ring-arc"
          />
        </svg>
        <div className="mastery-ring-center">
          <span className="mastery-ring-level">Lvl {level}</span>
          <span className="mastery-ring-xp">{currentXpTotal.toLocaleString()} XP</span>
          <span className="mastery-ring-pct">{Math.round(currentMastery)}%</span>
        </div>
      </div>

      {/* XP progress bar to next level */}
      <div className="mastery-xp-bar-wrap">
        <div className="mastery-xp-bar-label">
          <span>{currentXpInLevel.toLocaleString()} / {xpForNext.toLocaleString()} XP</span>
          <span>to Level {level + 1}</span>
        </div>
        <div className="progressbar mastery-xp-bar-track">
          <div className="progressfill mastery-xp-bar-fill"
            style={{ width: `${currentXpBarPct}%` }} />
        </div>
      </div>

      {/* Tier legend */}
      <div className="mastery-legend">
        {MASTERY_LEGEND.map((l) => (
          <span key={l.label} className="mastery-legend-pill"
            style={{ background: l.bg, color: l.color, border: l.border || "none" }}>
            <span className="mastery-legend-dot" style={{ background: l.strokeColor || l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProgressStats({ chunks, qAnswered, mastered }) {
  const [animFraction, setAnimFraction] = React.useState(0);

  React.useEffect(() => {
    let animId = null;
    let startTime = null;
    const duration = 1000;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setAnimFraction(eased);

      if (t < 1) {
        animId = requestAnimationFrame(step);
      }
    };

    setAnimFraction(0);
    animId = requestAnimationFrame(step);
    return () => { if (animId) cancelAnimationFrame(animId); };
  }, [chunks, qAnswered, mastered]);

  const formatAnimatedChunks = (chunksStr, fraction) => {
    if (typeof chunksStr === "string" && chunksStr.includes("/")) {
      const parts = chunksStr.split("/").map((s) => s.trim());
      const current = parseInt(parts[0], 10);
      const total = parts[1];
      if (!isNaN(current)) {
        return `${Math.round(current * fraction)} / ${total}`;
      }
    }
    return chunksStr;
  };

  const animQAnswered = Math.round((Number(qAnswered) || 0) * animFraction);
  const animMastered = Math.round((Number(mastered) || 0) * animFraction);

  const stats = [
    {
      id: "chunks",
      title: "Learning Chunks",
      value: formatAnimatedChunks(chunks, animFraction),
      icon: I.Layers,
      color: "#1f5e63",
      bgColor: "#dfeae5",
      borderColor: "#a9c4b2",
    },
    {
      id: "questions",
      title: "Questions Answered",
      value: animQAnswered,
      icon: I.HelpCircle,
      color: "#0284c7",
      bgColor: "#e0f2fe",
      borderColor: "#bae6fd",
    },
    {
      id: "mastered",
      title: "Sections Mastered",
      value: animMastered,
      icon: I.Trophy,
      color: "#d97706",
      bgColor: "#fef3c7",
      borderColor: "#fde68a",
    },
  ];

  return (
    <div className="progress-stats-grid">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.id} className="progress-stat-card">
            <div
              className="progress-stat-icon-wrap"
              style={{
                background: stat.bgColor,
                color: stat.color,
                borderColor: stat.borderColor,
              }}
            >
              <Icon size={24} />
            </div>
            <div className="progress-stat-info">
              <b className="progress-stat-value">{stat.value}</b>
              <span className="progress-stat-label">{stat.title}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default PracticePage;
export { PracticePage };
