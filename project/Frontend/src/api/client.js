const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request(path, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.detail || "The backend request failed.");
    }
    return result;
  } catch (error) {
    if (error.message === "Failed to fetch" || error.name === "TypeError") {
      throw new Error(`Unable to connect to the backend server at ${API_BASE_URL}. Please verify FastAPI is running on port 8000.`);
    }
    throw error;
  }
}

export function extractDocument(file) {
  const body = new FormData();
  body.append("file", file);
  return request("/api/extract/document", { method: "POST", body });
}

export function detectProfile(text) {
  return request("/api/profile/detect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

export function transformText(text, profile) {
  return request("/api/transform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, profile }),
  });
}

export function askVoice(question, lessonText) {
  return request("/api/voice/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, lesson_text: lessonText }),
  });
}

export function askLessonQuestion(question, lessonText, sectionText, profile) {
  return request("/api/lesson/question", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      lesson_text: lessonText,
      section_text: sectionText,
      profile,
    }),
  });
}

export function generateVisual(lessonText, profile, sourcePdfPath = null) {
  return request("/api/visual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lesson_text: lessonText,
      profile,
      include_image: true,
      source_pdf_path: sourcePdfPath,
    }),
  });
}

export function getVisualClusters(sections, profile = "cognitive_load", docId = null) {
  return request("/api/visual/clusters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sections,
      profile,
      doc_id: docId,
    }),
  });
}

export function getClusterVisualCard(cluster, sections, profile = "cognitive_load", docId = null) {
  return request("/api/visual/cluster-card", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cluster,
      sections,
      profile,
      doc_id: docId,
    }),
  });
}

export function generateQuiz(chunk, profile) {
  return request("/api/quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chunk, profile }),
  });
}

export function rewireContent({
  chunkText,
  profile,
  variantLevel = 2,
  actions = ["increase_simplification"],
  struggleExplanation = "",
}) {
  return request("/api/rewire", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chunk_text: chunkText,
      profile,
      variant_level: variantLevel,
      actions,
      struggle_explanation: struggleExplanation,
    }),
  });
}

export function generateAdaptiveQuiz({
  chunkText,
  profile,
  difficulty = "easier",
  struggleScore = 0.0,
  previousQuestion = null,
  previousAnswerCorrect = null,
}) {
  return request("/api/adaptive-quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chunk_text: chunkText,
      profile,
      difficulty,
      struggle_score: struggleScore,
      previous_question: previousQuestion,
      previous_answer_correct: previousAnswerCorrect,
    }),
  });
}

export function evaluateQuizAnswer(payload) {
  return request("/api/quiz/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function generateLessonTest(text, profile, questionCount = 5) {
  return request("/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, profile, question_count: questionCount }),
  });
}

export { API_BASE_URL };
