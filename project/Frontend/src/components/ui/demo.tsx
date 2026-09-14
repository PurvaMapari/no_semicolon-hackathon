"use client";

import * as React from "react";
import { ProgressiveFluxLoader } from "./progressive-flux-loader";

const PHASES = [
  { at: 0, label: "READING DOCUMENT" },
  { at: 25, label: "EXTRACTING CONTENT" },
  { at: 55, label: "STRUCTURING LESSON" },
  { at: 80, label: "ADAPTING FOR PROFILE" },
  { at: 100, label: "ALL DONE" },
];

const WARM_BROWN_GRADIENT =
  "linear-gradient(90deg, #78350f 0%, #b45309 30%, #fbbf24 55%, #d97706 78%, #78350f 100%)";
const WARM_BROWN_SHADOW =
  "0 0 14px rgba(245, 158, 11, 0.5), 0 0 24px rgba(217, 119, 6, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.6), inset 0 -1.5px 2px rgba(60, 20, 5, 0.5)";

export default function DemoOne() {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => (p >= 100 ? 0 : Math.min(100, p + 2)));
    }, 200);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1f2937 0%, #111827 100%)",
        overflow: "hidden",
      }}
    >
      {/* Simulated background page elements that get blurred */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          padding: "40px",
          opacity: 0.6,
        }}
      >
        <div style={{ height: 48, background: "#374151", borderRadius: 8, width: "30%" }} />
        <div style={{ height: 200, background: "#1f2937", borderRadius: 12, width: "100%" }} />
        <div style={{ height: 160, background: "#1f2937", borderRadius: 12, width: "100%" }} />
      </div>

      {/* Minimal Fullscreen Blur Overlay with Compact Brown Theme Progress Bar */}
      <div
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
            value={progress}
            phases={PHASES}
            showLabel={true}
            textClassName="text-white font-bold tracking-widest text-lg sm:text-xl text-center uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
            barClassName="bg-[#18110a]/95 border border-[#d97706]/35 shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.85)] h-2.5"
            gradient={WARM_BROWN_GRADIENT}
            shadow={WARM_BROWN_SHADOW}
          />
        </div>
      </div>
    </div>
  );
}
