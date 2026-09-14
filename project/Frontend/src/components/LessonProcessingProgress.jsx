import React, { useState, useEffect } from "react";
import * as I from "lucide-react";
import { ProgressiveFluxLoader } from "./ui/progressive-flux-loader";
import "./LessonProcessingProgress.css";

const FLUX_PHASES = [
  { at: 0, label: "READING DOCUMENT" },
  { at: 20, label: "EXTRACTING CONTENT" },
  { at: 50, label: "STRUCTURING LESSON" },
  { at: 75, label: "ADAPTING FOR PROFILE" },
  { at: 92, label: "PREPARING EXPERIENCE" },
  { at: 100, label: "ALL DONE" },
];

export function LessonProcessingProgress({
  isProcessing,
  error,
  onRetry,
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isProcessing) {
      setElapsed(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isProcessing]);

  if (!isProcessing && !error) return null;

  // Smooth progressive pacing according to typical Groq processing lifecycle
  let progressValue = 12;
  if (elapsed >= 18) {
    progressValue = Math.min(96, 90 + (elapsed - 18) * 0.7);
  } else if (elapsed >= 10) {
    progressValue = Math.min(88, 75 + (elapsed - 10) * 1.6);
  } else if (elapsed >= 4) {
    progressValue = Math.min(72, 50 + (elapsed - 4) * 3.6);
  } else if (elapsed >= 1) {
    progressValue = 28;
  } else {
    progressValue = 12;
  }

  // Refined warm theme brown/amber signature gradient and sleek glow
  const WARM_BROWN_GRADIENT =
    "linear-gradient(90deg, #78350f 0%, #b45309 30%, #fbbf24 55%, #d97706 78%, #78350f 100%)";
  const WARM_BROWN_SHADOW =
    "0 0 14px rgba(245, 158, 11, 0.5), 0 0 24px rgba(217, 119, 6, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.6), inset 0 -1.5px 2px rgba(60, 20, 5, 0.5)";

  return (
    <>
      {/* Ultra-Minimal Fullscreen Blur Overlay with Compact Center Progress Bar */}
      {isProcessing && (
        <div
          role="status"
          aria-live="polite"
          id="lesson-processing-card"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15, 12, 10, 0.75)",
            backdropFilter: "blur(20px) saturate(150%)",
            WebkitBackdropFilter: "blur(20px) saturate(150%)",
            padding: "20px",
            animation: "fadeIn 0.3s ease-out",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "320px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ProgressiveFluxLoader
              value={progressValue}
              phases={FLUX_PHASES}
              showLabel={true}
              textClassName="text-white font-bold tracking-widest text-lg sm:text-xl text-center uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              barClassName="bg-[#18110a]/95 border border-[#d97706]/35 shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.85)] h-2.5"
              gradient={WARM_BROWN_GRADIENT}
              shadow={WARM_BROWN_SHADOW}
            />
          </div>
        </div>
      )}

      {/* Minimal Error Modal */}
      {error && !isProcessing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15, 12, 10, 0.75)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            padding: "20px",
          }}
        >
          <div
            style={{
              maxWidth: 380,
              width: "100%",
              background: "#1c1008",
              border: "1.5px solid #d97706",
              borderRadius: 14,
              padding: 22,
              color: "#ffffff",
              textAlign: "center",
              boxShadow: "0 24px 48px rgba(0, 0, 0, 0.6)",
            }}
          >
            <I.AlertCircle
              size={32}
              color="#fbbf24"
              style={{ margin: "0 auto 10px" }}
            />
            <h3
              style={{
                fontSize: 16,
                fontWeight: 800,
                margin: "0 0 6px",
                color: "#ffffff",
              }}
            >
              Transformation paused
            </h3>
            <p
              style={{
                fontSize: 12.5,
                color: "#d1d5db",
                margin: "0 0 18px",
                lineHeight: 1.5,
              }}
            >
              {error}
            </p>
            <button
              type="button"
              onClick={onRetry}
              style={{
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                padding: "9px 20px",
                fontWeight: 700,
                fontSize: 12.5,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)",
              }}
            >
              <I.RotateCcw size={14} />
              <span>Retry Transformation</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default LessonProcessingProgress;
