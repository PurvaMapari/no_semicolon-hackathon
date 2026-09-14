/**
 * Universal Text-to-Speech (TTS) Engine for AdaptLearn
 * Automatically selects a natural, high-clarity female voice across
 * Windows (Edge/Chrome), macOS/iOS (Safari), and Android.
 */

let cachedFemaleVoice = null;

export function getFemaleVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return cachedFemaleVoice;

  // 1. High-priority known natural female voice identifiers
  const priorityFemalePatterns = [
    // Windows Edge Natural female voices
    /natural.*(jenny|aria|sonia|libby|natasha|clara|emma|ava)/i,
    // Standard Windows Desktop female voice
    /zira/i,
    // Google Chrome female voices
    /google.*(us english|uk english female)/i,
    // Apple macOS / iOS high quality female voices
    /samantha|victoria|karen|moira|fiona|tessa|allison/i,
    // Explicit female keywords
    /female/i,
  ];

  for (const pattern of priorityFemalePatterns) {
    const match = voices.find(
      (v) => (v.lang.startsWith("en") || !v.lang) && pattern.test(v.name)
    );
    if (match) {
      cachedFemaleVoice = match;
      return match;
    }
  }

  // 2. Fallback: Any English voice that is NOT explicitly male (David, Mark, George, Guy, etc.)
  const nonMaleVoice = voices.find(
    (v) =>
      v.lang.startsWith("en") &&
      !/david|mark|george|guy|james|richard|male|boy/i.test(v.name)
  );
  if (nonMaleVoice) {
    cachedFemaleVoice = nonMaleVoice;
    return nonMaleVoice;
  }

  // 3. Fallback to any English voice
  const fallbackEn = voices.find((v) => v.lang.startsWith("en"));
  if (fallbackEn) return fallbackEn;

  return voices[0] || null;
}

// Warm up voices cache as soon as voices are loaded by the browser
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      getFemaleVoice();
    };
  }
}

/**
 * Speaks the given text using the selected female voice.
 */
export function speakFemaleVoice(text, { onStart, onEnd, onError, rate = 0.96, pitch = 1.05 } = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;

  window.speechSynthesis.cancel();
  if (!text || !text.trim()) return null;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = pitch;

  const voice = getFemaleVoice();
  if (voice) {
    utterance.voice = voice;
  }

  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;
  if (onError) utterance.onerror = onError;

  window.speechSynthesis.speak(utterance);
  return utterance;
}

/**
 * Stops any ongoing speech immediately.
 */
export function stopSpeech() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
