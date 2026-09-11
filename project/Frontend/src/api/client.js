const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.detail || "The backend request failed.");
  }
  return result;
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

export function generateVisual(lessonText, profile) {
  return request("/api/visual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lesson_text: lessonText, profile, include_image: true }),
  });
}

export function generateQuiz(chunk, profile) {
  return request("/api/quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chunk, profile }),
  });
}

export { API_BASE_URL };
