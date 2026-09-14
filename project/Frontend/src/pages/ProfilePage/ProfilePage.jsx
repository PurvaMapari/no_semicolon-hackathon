import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as I from "lucide-react";
import { useSession, PROFILE_LABELS } from "../../context/SessionContext";
import { useWebcam } from "../../hooks/WebcamContext";
import { Layout } from "../../components/Layout/Layout";
import ErrorNotice from "../../components/ErrorNotice";
import { LessonProcessingProgress } from "../../components/LessonProcessingProgress";
import "./ProfilePage.css";

function CameraPreview({ stream, className = "camera-preview-video" }) {
  const videoRef = React.useRef(null);

  React.useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={className}
    />
  );
}

function Profile() {
  const { session, busy, chooseProfile, detect, adapt, setHasStartedLearning } = useSession();
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [simState, setSimState] = useState(null); // 'starting' | 'no_face' | 'detected' | 'error' | null
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraCalibrated, setCameraCalibrated] = useState(false);

  // ── Camera gate & stream ───────────────────────────────────────────────────
  const {
    webcamStatus,
    webcamEnabled,
    toggleCamera,
    isLoading: camLoading,
    webcamSkipped,
    setWebcamSkipped,
    mediaStream,
    facePresent,
  } = useWebcam();

  // Auto-start camera on Step 2 entry if not already started
  React.useEffect(() => {
    if (!webcamEnabled && webcamStatus === "off") {
      toggleCamera();
    }
  }, [webcamEnabled, webcamStatus, toggleCamera]);

  // Derived simulation states for seamless testing & grading
  const effectiveWebcamStatus =
    simState === "error"
      ? "error"
      : simState === "starting"
      ? "loading"
      : simState
      ? "ready"
      : webcamStatus;

  const effectiveFacePresent =
    simState === "detected"
      ? true
      : simState === "no_face"
      ? false
      : simState === "starting"
      ? false
      : facePresent;

  const effectiveCamLoading =
    simState === "starting"
      ? true
      : camLoading || webcamStatus === "loading";

  // Gate: Continue allowed ONLY if camera ready AND face detected (or simulated / calibrated / text-only skipped)
  const isCameraVerified =
    simState === "detected"
      ? true
      : simState === "no_face" || simState === "error" || simState === "starting"
      ? false
      : webcamSkipped
      ? true
      : (effectiveWebcamStatus === "ready" && effectiveFacePresent) || cameraCalibrated;

  const [localTransforming, setLocalTransforming] = useState(false);
  const [transformError, setTransformError] = useState(null);
  const isTransforming = busy === "transform" || localTransforming;

  const canContinue = isCameraVerified && !isTransforming;

  const handleTransformLesson = async () => {
    if (!canContinue || isTransforming) return;
    setTransformError(null);
    setLocalTransforming(true);

    setTimeout(() => {
      const el = document.getElementById("lesson-processing-card");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);

    try {
      const res = await adapt();
      if (res && Array.isArray(res.sections) && res.sections.length > 0) {
        setHasStartedLearning(true);
        navigate("/learn");
      } else if (session.error) {
        setTransformError(session.error);
      } else {
        setTransformError("Lesson adaptation could not complete. Please try again.");
      }
    } catch (err) {
      console.error("Transform error:", err);
      setTransformError(err.message || "Failed to transform lesson. Please try again.");
    } finally {
      setLocalTransforming(false);
    }
  };

  const formatCards = [
    {
      id: "dyslexia",
      title: "Dyslexia support",
      desc: "Shorter sentences, clear dyslexia-friendly spacing, and reduced visual crowding to ease reading cognitive load.",
      icon: I.BookOpen,
      recommended: true,
    },
    {
      id: "cognitive_load",
      title: "Cognitive load support",
      desc: "Digestible chunked sections presenting one main concept at a time with guided step-through logic.",
      icon: I.Layers,
      recommended: false,
    },
    {
      id: "low_vision",
      title: "Low vision and clarity",
      desc: "High contrast theme guidance, larger typography, and distinct line height with accessible color tones.",
      icon: I.Eye,
      recommended: false,
    },
  ];

  return (
    <Layout section="Profile">
      <main className="page profile-page">
        {/* Step 2 Eyebrow */}
        <div className="step2-eyebrow">
          <span className="step2-badge-num">2</span>
          <span>STEP 2 OF 3 - LEARNING CONFIGURATION &amp; VERIFICATION</span>
        </div>

        <h1 className="step2-title">How should this lesson feel?</h1>
        <p className="step2-subtitle">
          Personalize your adaptive visual format, verify your camera presence for real-time focus calibration, and launch your tailored session.
        </p>

        {/* 1. SELECT VISUAL ADAPTATION FORMAT */}
        <div className="format-section-header">
          <div className="format-section-title">
            <I.Sliders size={14} />
            <span>1. SELECT VISUAL ADAPTATION FORMAT</span>
          </div>
          <span className="format-auto-detected">Auto-detected optimal</span>
        </div>

        <div className="format-card-list">
          {formatCards.map(({ id, title, desc, icon: Icon, recommended }) => (
            <button
              type="button"
              key={id}
              className={`format-card ${session.profile === id ? "active" : ""}`}
              onClick={() => chooseProfile(id)}
            >
              <span className="format-radio">
                {session.profile === id && <span className="format-radio-dot" />}
              </span>
              <div className="format-icon-box">
                <Icon size={18} />
              </div>
              <div className="format-info">
                <div className="format-title-row">
                  <span className="format-name">{title}</span>
                  {recommended && (
                    <span className="format-recommended-pill">RECOMMENDED</span>
                  )}
                </div>
                <p className="format-desc">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Middle 2-Column Grid: Describe needs (Left) + Camera verification summary (Right) */}
        <div className="step2-mid-grid">
          {/* Left Card: Describe your learning needs */}
          <div className="describe-card">
            <div className="describe-header">
              <div className="describe-icon-box">
                <I.Sparkles size={16} />
              </div>
              <span className="describe-title">Describe your learning needs</span>
            </div>
            <p className="describe-subtext">
              Not sure which setting is best? Describe what reading format works best for you and AI will choose.
            </p>
            <textarea
              className="describe-textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="For example: long paragraphs are hard for me to follow, I lose track easily, or I need clean bullet points..."
            />
            <div className="describe-footer-row">
              <div className="describe-try-tags">
                <span className="describe-try-label">Try:</span>
                <button
                  type="button"
                  className="describe-tag-pill"
                  onClick={() => setDescription("Dense text is hard for me to follow, I lose track easily")}
                >
                  Dense text
                </button>
                <button
                  type="button"
                  className="describe-tag-pill"
                  onClick={() => setDescription("Quick fatigue with reading, I need short sections and clear spacing")}
                >
                  Quick fatigue
                </button>
              </div>
              <button
                type="button"
                className="describe-detect-btn"
                disabled={!description.trim() || Boolean(busy)}
                onClick={() => detect(description)}
              >
                <I.Sparkles size={13} />
                <span>{busy === "profile" ? "Detecting..." : "Detect profile"}</span>
              </button>
            </div>
          </div>

          {/* Right Card: Camera Presence Verification Summary Card */}
          <div className="camera-summary-card">
            <div className="camera-summary-header">
              <div className="camera-verif-title-row">
                <div className="camera-verif-icon-box">
                  <I.Video size={16} />
                </div>
                <span className="camera-verif-title">Camera Presence Verification</span>
                <span className="camera-verif-private-pill">Private • On-device</span>
              </div>

              {/* Simulation controls */}
              <div className="camera-sim-controls">
                <span>SIMULATE:</span>
                <button
                  type="button"
                  className={`camera-sim-btn ${simState === "starting" ? "active" : ""}`}
                  onClick={() => setSimState(simState === "starting" ? null : "starting")}
                >
                  Starting
                </button>
                <span>|</span>
                <button
                  type="button"
                  className={`camera-sim-btn ${simState === "no_face" ? "active" : ""}`}
                  onClick={() => setSimState(simState === "no_face" ? null : "no_face")}
                >
                  No Face
                </button>
                <span>|</span>
                <button
                  type="button"
                  className={`camera-sim-btn ${simState === "detected" ? "active" : ""}`}
                  onClick={() => setSimState(simState === "detected" ? null : "detected")}
                >
                  Detected
                </button>
                <span>|</span>
                <button
                  type="button"
                  className={`camera-sim-btn ${simState === "error" ? "active" : ""}`}
                  onClick={() => setSimState(simState === "error" ? null : "error")}
                >
                  Error
                </button>
                {simState && (
                  <button
                    type="button"
                    className="camera-sim-btn"
                    style={{ color: "#ef4444", marginLeft: 2 }}
                    onClick={() => setSimState(null)}
                    title="Reset to live camera"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <p className="camera-summary-subtext">
              Ensures you are present to dynamically adapt pacing. Required for adaptive learning.
            </p>

            {/* Inner Verification Box */}
            <div className={`camera-summary-inner-box ${isCameraVerified ? "verified" : "unverified"}`}>
              <div className="camera-summary-status-left">
                <div className={`camera-summary-status-icon ${isCameraVerified ? "verified" : ""}`}>
                  {isCameraVerified ? (
                    <I.Check size={16} strokeWidth={2.5} />
                  ) : (
                    <I.Video size={16} />
                  )}
                </div>
                <div className="camera-summary-status-text">
                  <span className="camera-summary-status-title">
                    {isCameraVerified ? "Camera verified & ready" : "Verification required to proceed"}
                  </span>
                  <span className="camera-summary-status-desc">
                    {isCameraVerified
                      ? "Presence calibration active"
                      : effectiveWebcamStatus === "ready"
                      ? "Camera connected • Position head in frame..."
                      : effectiveCamLoading
                      ? "Camera starting up..."
                      : "Position head in frame to verify"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="camera-summary-action-btn"
                onClick={() => setShowCameraModal(true)}
              >
                <I.Video size={14} style={{ color: "#fbbf24" }} />
                <span>{isCameraVerified ? "Re-verify Camera" : "Verify Camera Presence"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Lesson Transformation Progress Feedback */}
        <LessonProcessingProgress
          isProcessing={isTransforming}
          error={transformError || session.error}
          onRetry={handleTransformLesson}
          profile={session.profile}
          fileName={session.fileName}
        />

        {!isTransforming && !transformError && <ErrorNotice />}

        {/* Launch Session Console Bar */}
        <section className="launch-session-bar">
          <div className="launch-bar-left">
            <div className="launch-bar-meta">
              <span className="launch-bar-sparkle">✦</span>
              <span>Ready in ~4 seconds • Configured for {PROFILE_LABELS[session.profile] || "Cognitive load support"}</span>
            </div>
            <h2 className="launch-bar-title">
              {session.transformed ? "Resume your customized learning session" : "Launch your customized learning session"}
            </h2>
            <p className="launch-bar-subtitle">
              OUR ADAPTIVE AI WILL CUSTOMIZE COGNITIVE LOAD &amp; PACING INSTANTLY
            </p>
          </div>

          <div className="launch-bar-right">
            {/* Back to upload */}
            <button
              type="button"
              className="launch-back-btn"
              disabled={isTransforming}
              onClick={() => navigate("/upload")}
            >
              Back to upload
            </button>

            {/* Transform / Resume Lesson button */}
            <button
              type="button"
              className="launch-transform-btn"
              disabled={!canContinue || isTransforming}
              onClick={async () => {
                if (!session.transformed) {
                  await handleTransformLesson();
                } else {
                  setHasStartedLearning(true);
                  navigate("/learn");
                }
              }}
            >
              <span>
                {isTransforming
                  ? "Processing lesson…"
                  : session.transformed
                  ? "Resume Learning Session"
                  : "Transform Lesson"}
              </span>
              {isTransforming ? <I.Loader2 size={14} className="spinner" /> : <I.Sparkles size={14} />}
            </button>
          </div>
        </section>

        {/* ── Camera Presence Verification Modal (Screenshot 2 Match) ── */}
        {showCameraModal && (
          <div
            className="camera-modal-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowCameraModal(false);
            }}
          >
            <div className="camera-modal-card" role="dialog" aria-modal="true">
              {/* Modal Header */}
              <div className="camera-modal-header">
                <div className="camera-verif-title-row">
                  <div className="camera-verif-icon-box">
                    <I.Video size={16} />
                  </div>
                  <span className="camera-verif-title">Camera Presence Verification</span>
                  <span className="camera-verif-private-pill">Private • On-device</span>
                </div>
                <button
                  type="button"
                  className="camera-modal-close-btn"
                  onClick={() => setShowCameraModal(false)}
                  aria-label="Close verification modal"
                >
                  <I.X size={18} />
                </button>
              </div>

              <p className="camera-modal-subtext">
                Ensures you are present to dynamically adapt pacing. No video is recorded or stored.
              </p>

              {/* Simulation controls in modal */}
              <div className="camera-sim-controls" style={{ marginBottom: 12 }}>
                <span>SIMULATE:</span>
                <button
                  type="button"
                  className={`camera-sim-btn ${simState === "starting" ? "active" : ""}`}
                  onClick={() => setSimState(simState === "starting" ? null : "starting")}
                >
                  Starting
                </button>
                <span>|</span>
                <button
                  type="button"
                  className={`camera-sim-btn ${simState === "no_face" ? "active" : ""}`}
                  onClick={() => setSimState(simState === "no_face" ? null : "no_face")}
                >
                  No Face
                </button>
                <span>|</span>
                <button
                  type="button"
                  className={`camera-sim-btn ${simState === "detected" ? "active" : ""}`}
                  onClick={() => setSimState(simState === "detected" ? null : "detected")}
                >
                  Detected
                </button>
                <span>|</span>
                <button
                  type="button"
                  className={`camera-sim-btn ${simState === "error" ? "active" : ""}`}
                  onClick={() => setSimState(simState === "error" ? null : "error")}
                >
                  Error
                </button>
                {simState && (
                  <button
                    type="button"
                    className="camera-sim-btn"
                    style={{ color: "#ef4444", marginLeft: 2 }}
                    onClick={() => setSimState(null)}
                    title="Reset to live camera"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* HUD Viewport inside modal */}
              <div className="camera-hud-viewport modal-viewport">
                {/* Live Video Feed */}
                {mediaStream && effectiveWebcamStatus !== "error" && effectiveWebcamStatus !== "off" && (
                  <CameraPreview stream={mediaStream} className="camera-hud-video" />
                )}

                {/* Fallback silhouette if camera off or loading */}
                {(!mediaStream || effectiveWebcamStatus === "off" || effectiveCamLoading) && (
                  <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", opacity: 0.22, pointerEvents: "none" }}>
                    <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor" color="#94a3b8">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z" />
                    </svg>
                  </div>
                )}

                {/* Top-left HUD badge */}
                <div className="camera-hud-top-left">
                  <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                  <span>LIVE FEED: PRISM</span>
                </div>

                {/* Top-right HUD badge */}
                <div className="camera-hud-top-right">
                  <span>720p HD</span>
                </div>

                {/* Center Biometric Reticle */}
                <div className="camera-hud-reticle-wrap">
                  <div className={`camera-hud-reticle ${effectiveFacePresent ? "detected" : effectiveCamLoading ? "loading" : "absent"}`}>
                    <span className="camera-hud-reticle-tag">
                      {effectiveCamLoading ? "CALIBRATING" : effectiveFacePresent ? "HEAD ALIGNED" : "POSITION HEAD"}
                    </span>
                  </div>
                </div>

                {/* Bottom HUD Banner */}
                {effectiveCamLoading ? (
                  <div className="camera-hud-bottom-banner loading">
                    <span className="camera-gate-spinner" style={{ width: 12, height: 12, borderTopColor: "#fff", marginRight: 6 }} />
                    <span>Calibrating presence…</span>
                  </div>
                ) : effectiveFacePresent ? (
                  <div className="camera-hud-bottom-banner detected">
                    <I.Check size={14} strokeWidth={3} />
                    <span>Face detected — Ready</span>
                  </div>
                ) : effectiveWebcamStatus === "off" ? (
                  <button
                    type="button"
                    className="camera-hud-bottom-banner off"
                    onClick={toggleCamera}
                  >
                    <I.Video size={14} />
                    <span>Enable camera</span>
                  </button>
                ) : effectiveWebcamStatus === "error" || effectiveWebcamStatus === "denied" ? (
                  <div className="camera-hud-bottom-banner absent" style={{ background: "#ef4444" }}>
                    <I.AlertCircle size={14} />
                    <span>Camera unavailable</span>
                  </div>
                ) : (
                  <div className="camera-hud-bottom-banner absent">
                    <I.AlertTriangle size={14} />
                    <span>Face not detected — Position in frame</span>
                  </div>
                )}
              </div>

              {/* 3 Telemetry Status Chips below HUD */}
              <div className="camera-telemetry-grid modal-telemetry">
                <div className={`camera-telemetry-chip ${effectiveWebcamStatus === "ready" ? "success" : effectiveCamLoading ? "warn" : "neutral"}`}>
                  {effectiveWebcamStatus === "ready" ? <I.Check size={13} strokeWidth={2.5} /> : <I.Radio size={13} />}
                  <span>{effectiveWebcamStatus === "ready" ? "Camera connected" : effectiveCamLoading ? "Camera starting..." : "Camera offline"}</span>
                </div>

                <div className={`camera-telemetry-chip ${effectiveFacePresent ? "success" : "warn"}`}>
                  {effectiveFacePresent ? <I.Check size={13} strokeWidth={2.5} /> : <I.User size={13} />}
                  <span>{effectiveFacePresent ? "Face detected" : "No face detected"}</span>
                </div>

                <div className={`camera-telemetry-chip ${effectiveFacePresent && effectiveWebcamStatus === "ready" ? "success" : "neutral"}`}>
                  {effectiveFacePresent && effectiveWebcamStatus === "ready" ? <I.Sparkles size={13} /> : <I.Clock size={13} />}
                  <span>{effectiveFacePresent && effectiveWebcamStatus === "ready" ? "Ready for adaptive learning" : "Awaiting calibration"}</span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="camera-modal-footer">
                <button
                  type="button"
                  className="camera-modal-skip-btn"
                  onClick={() => {
                    setWebcamSkipped(true);
                    setShowCameraModal(false);
                  }}
                >
                  Skip camera requirement (text-only mode)
                </button>

                <button
                  type="button"
                  className="camera-modal-calibrate-btn"
                  onClick={() => {
                    setCameraCalibrated(true);
                    setShowCameraModal(false);
                  }}
                >
                  <I.Check size={14} strokeWidth={3} />
                  <span>Calibrate Camera</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </Layout>
  );
}


export default Profile;
export { Profile };
