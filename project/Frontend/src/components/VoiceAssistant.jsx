import React, { useState, useEffect, useRef } from "react";
import * as I from "lucide-react";
import { speakFemaleVoice, stopSpeech } from "../utils/speechVoice";
import "./VoiceAssistant.css";

/**
 * PRISM Voice Assistant & Speech-to-Text (STT) Component
 * 
 * Provides:
 * 1. Web Speech API Speech-to-Text (STT) with live microphone capture,
 *    pulsing recording animations, and real-time transcription feedback.
 * 2. Text-to-Speech (TTS) read-aloud playback for generated answers using natural female voice.
 * 3. Quick-action voice prompt chips for accessible one-click questions.
 * 4. Full integration with the PRISM SCALE cognitive struggle engine.
 */
export default function VoiceAssistant({
  currentSection,
  onAsk,
  busy,
  onVoiceHelp,
  hideHeader = true,
  autoPrompt = null,
  showQuickPrompts = false,
}) {
  const [question, setQuestion] = useState("");
  const [askedQuestion, setAskedQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voiceError, setVoiceError] = useState(null);
  const [interimText, setInterimText] = useState("");

  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognition) {
      setVoiceSupported(false);
    }
  }, []);

  // Cleanup speech synthesis and recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
      stopSpeech();
    };
  }, []);

  function startListening() {
    setVoiceError(null);
    setInterimText("");

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceSupported(false);
      setVoiceError("Speech recognition is not supported in this browser. Please use Chrome or Edge, or type your question below.");
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceError(null);
        if (onVoiceHelp) onVoiceHelp();
      };

      recognition.onresult = (event) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            final += item[0].transcript;
          } else {
            interim += item[0].transcript;
          }
        }

        const recognized = (final || interim).trim();
        if (recognized) {
          setQuestion(recognized);
          setInterimText(interim);
        }
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed" || event.error === "permission-denied") {
          setVoiceError("Microphone access was denied. Please allow microphone permissions in your browser URL bar.");
        } else if (event.error === "no-speech") {
          setVoiceError("Didn't catch that. Please click the mic and speak clearly.");
        } else if (event.error !== "aborted") {
          setVoiceError(`Voice input issue (${event.error}). You can type your question directly.`);
        }
        setIsListening(false);
        setInterimText("");
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimText("");
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setVoiceError("Could not initialize microphone. Please check browser permissions or type your question.");
      setIsListening(false);
    }
  }

  function stopListening() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    setIsListening(false);
    setInterimText("");
  }

  function toggleListening() {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  async function executeAsk(promptText) {
    const textToAsk = (promptText || question).trim();
    if (!textToAsk || !currentSection) return;

    // Stop listening if currently active
    stopListening();

    setAskedQuestion(textToAsk);
    setAnswer("");
    if (onVoiceHelp) onVoiceHelp();

    try {
      const result = await onAsk(textToAsk, currentSection.paragraph);
      if (result && result.answer) {
        setAnswer(result.answer);
      }
    } catch (err) {
      console.error("Voice question error:", err);
    }
  }

  // Automatically trigger question generation when an external quick-prompt is clicked
  const lastAutoPromptRef = useRef(null);
  useEffect(() => {
    if (autoPrompt && autoPrompt.query && autoPrompt.timestamp !== lastAutoPromptRef.current) {
      lastAutoPromptRef.current = autoPrompt.timestamp;
      setQuestion(autoPrompt.query);
      executeAsk(autoPrompt.query);
    }
  }, [autoPrompt, currentSection]);

  function speakText(textToSpeak) {
    if (!textToSpeak) return;
    speakFemaleVoice(textToSpeak, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }

  function stopSpeaking() {
    stopSpeech();
    setIsSpeaking(false);
  }

  const quickPrompts = [
    { label: "Explain simply", query: "Explain this section in very simple terms." },
    { label: "Key takeaway", query: "What is the single most important point in this section?" },
    { label: "Real-world example", query: "Give me an intuitive, real-world example of this concept." },
  ];

  return (
    <section className="card voice-assistant-card" style={{ marginTop: 0, padding: "12px 14px 14px" }}>
      {/* Optional Header (hidden by default when inside float panel) */}
      {!hideHeader && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #1f5e63 0%, #8faf9a 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)",
            }}
          >
            <I.Mic size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--ink)", letterSpacing: "-0.01em" }}>
              Voice & In-Context Assistant
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>
              Speech-to-Text enabled • Grounded in the active lesson section
            </div>
          </div>
        </div>
      )}

      {/* Mode Indicator & Quick Actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 700,
              background: isListening
                ? "#fee2e2"
                : voiceSupported
                ? "rgba(252, 224, 114, 0.4)"
                : "#f1f5f9",
              color: isListening
                ? "#dc2626"
                : voiceSupported
                ? "#17464a"
                : "#64748b",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: isListening ? "#ef4444" : voiceSupported ? "#10b981" : "#94a3b8",
                animation: isListening ? "pulseGlow 1.2s infinite" : "none",
              }}
            />
            {isListening
              ? "Listening Live..."
              : voiceSupported
              ? "Voice STT Active"
              : "Text-Only Mode"}
          </span>

          <button
            type="button"
            onClick={() => {
              if (isSpeaking) {
                stopSpeaking();
              } else if (answer) {
                speakText(answer);
              } else {
                speakFemaleVoice(
                  "Please ask a question or click one of the quick prompt chips below to hear an explanation.",
                  {
                    onStart: () => setIsSpeaking(true),
                    onEnd: () => setIsSpeaking(false),
                    onError: () => setIsSpeaking(false),
                  }
                );
              }
            }}
            className="secondary-action"
            style={{
              padding: "4px 10px",
              fontSize: 11,
              borderRadius: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: isSpeaking ? "#fee2e2" : undefined,
              borderColor: isSpeaking ? "#fca5a5" : undefined,
              color: isSpeaking ? "#dc2626" : undefined,
            }}
            title={
              isSpeaking
                ? "Stop audio"
                : answer
                ? "Read aloud tutor response"
                : "Ask a question to hear tutor response"
            }
          >
            {isSpeaking ? (
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
        </div>
      </div>

      {/* Live Voice-to-Text Banner when listening */}
      {isListening && (
        <div
          style={{
            background: "linear-gradient(135deg, rgba(254, 242, 242, 0.95), rgba(255, 237, 213, 0.9))",
            border: "1px solid #fecaca",
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            animation: "fadeInUp 0.25s ease-out",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#ef4444",
                boxShadow: "0 0 0 4px rgba(239, 68, 68, 0.25)",
                animation: "pulseGlow 1s infinite",
              }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#991b1b" }}>
                Listening to your voice...
              </div>
              <div style={{ fontSize: 12, color: "#7f1d1d", marginTop: 2 }}>
                {interimText || question ? (
                  <span style={{ fontStyle: "italic", fontWeight: 600 }}>
                    "{interimText || question}"
                  </span>
                ) : (
                  "Speak clearly into your microphone..."
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={stopListening}
            style={{
              padding: "6px 12px",
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <I.Square size={13} />
            <span>Stop</span>
          </button>
        </div>
      )}

      {/* Voice Warning or Fallback Message */}
      {voiceError && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 12,
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <I.AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{voiceError}</span>
        </div>
      )}

      {/* Voice Input Controls: Text Bar + Big Mic Button + Submit */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          executeAsk();
        }}
        style={{ display: "flex", gap: 8, alignItems: "stretch" }}
      >
        {/* Dedicated Voice-to-Text Microphone Button */}
        <button
          type="button"
          onClick={toggleListening}
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: isListening ? "2px solid #ef4444" : "1px solid var(--border-color)",
            background: isListening
              ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
              : "linear-gradient(135deg, #dfeae5 0%, #e8e6df 100%)",
            color: isListening ? "#ffffff" : "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            transition: "all 0.2s ease",
            boxShadow: isListening
              ? "0 0 16px rgba(239, 68, 68, 0.4)"
              : "0 2px 6px rgba(99, 102, 241, 0.12)",
          }}
          title={isListening ? "Stop listening" : "Click to speak your question"}
          aria-label="Toggle voice input"
        >
          {isListening ? <I.MicOff size={17} /> : <I.Mic size={17} />}
        </button>

        {/* Text Input synced with Speech Transcription */}
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={
            isListening
              ? "Transcribing your speech live..."
              : "Ask or click mic to speak..."
          }
          style={{
            flex: 1,
            height: 38,
            padding: "0 12px",
            fontSize: 13,
            borderRadius: 10,
            border: isListening ? "2px solid #1f5e63" : "1px solid var(--border-color)",
            background: isListening ? "#fafafa" : "#ffffff",
          }}
        />

        {/* Submit Button */}
        <button
          type="submit"
          className="primary-action"
          disabled={!question.trim() || Boolean(busy)}
          style={{
            width: "auto",
            height: 38,
            padding: "0 14px",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {busy === "voice" ? (
            <>
              <I.Radio size={14} className="animate-spin" />
              <span>Thinking...</span>
            </>
          ) : (
            <>
              <I.Sparkles size={14} />
              <span>Ask</span>
            </>
          )}
        </button>
      </form>

      {/* Quick Voice Prompt Chips (only if showQuickPrompts is true; prompts moved to lesson page) */}
      {showQuickPrompts && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Quick prompts:
          </span>
          {quickPrompts.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setQuestion(item.query);
                executeAsk(item.query);
              }}
              disabled={Boolean(busy)}
              style={{
                background: "rgba(241, 245, 249, 0.8)",
                border: "1px solid rgba(203, 213, 225, 0.8)",
                borderRadius: 20,
                padding: "4px 12px",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--secondary-ink)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--primary-light)";
                e.currentTarget.style.color = "var(--primary)";
                e.currentTarget.style.borderColor = "rgba(199, 210, 254, 0.8)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(241, 245, 249, 0.8)";
                e.currentTarget.style.color = "var(--secondary-ink)";
                e.currentTarget.style.borderColor = "rgba(203, 213, 225, 0.8)";
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Answer Box with Text-to-Speech Read Aloud */}
      {askedQuestion && (
        <div
          className="answer-box"
          style={{
            marginTop: 12,
            padding: 12,
            background: "linear-gradient(135deg, rgba(248, 250, 252, 0.95), rgba(241, 245, 249, 0.9))",
            borderRadius: 12,
            border: "1px solid rgba(226, 232, 240, 0.9)",
            animation: "fadeInUp 0.3s ease-out",
          }}
        >
          {/* Question Display */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em" }}>
              Your Question
            </span>
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 10, lineHeight: 1.4 }}>
            "{askedQuestion}"
          </p>

          {/* Answer Display */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, borderTop: "1px solid rgba(226, 232, 240, 0.8)", paddingTop: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--primary)", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 5 }}>
              <I.Sparkles size={11} /> Tutor Response
            </span>

            {/* Read Aloud Button for the Answer */}
            {answer && (
              <button
                type="button"
                onClick={() => (isSpeaking ? stopSpeaking() : speakText(answer))}
                style={{
                  background: isSpeaking ? "#fee2e2" : "var(--primary-light)",
                  border: isSpeaking ? "1px solid #fca5a5" : "1px solid rgba(199, 210, 254, 0.8)",
                  color: isSpeaking ? "#dc2626" : "var(--primary)",
                  padding: "3px 8px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  transition: "all 0.15s ease",
                }}
                title={isSpeaking ? "Stop audio" : "Read aloud response"}
              >
                {isSpeaking ? (
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
            )}
          </div>

          {answer ? (
            <p style={{ fontSize: 13, lineHeight: 1.55, color: "#1e293b", margin: 0 }}>
              {answer}
            </p>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--primary)", fontSize: 13, padding: "8px 0" }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--primary)",
                  animation: "pulseGlow 1s infinite",
                }}
              />
              <span>Synthesizing grounded explanation from lesson context...</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
