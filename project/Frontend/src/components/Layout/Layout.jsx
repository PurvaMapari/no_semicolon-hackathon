import React, { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import * as I from "lucide-react";
import { useSession, PROFILE_LABELS } from "../../context/SessionContext";
import { useWebcam } from "../../hooks/WebcamContext";

export function Layout({ children, section, onNavIntercept }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, setHasStartedLearning } = useSession();
  const { mediaStream, setWebcamEnabled } = useWebcam();
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [pendingNavPath, setPendingNavPath] = useState(null);

  const items = [
    ["/upload", "Upload", I.CloudUpload],
    ["/learn", "Learn", I.BookOpen],
    ["/practice", "Practice", I.BadgeHelp],
    ["/progress", "Progress", I.BarChart3],
  ];

  // 1. Has an actual learning session started with loaded lesson content?
  const hasStartedLearning = Boolean(session.hasStartedLearning && session.transformed);

  // 2. Is the user currently on the /learn route in an active learning session?
  const isLeavingActiveLearning = Boolean(
    location.pathname === "/learn" &&
    hasStartedLearning
  );

  function handleNavClick(e, to) {
    // If an actual lesson session has started and user is navigating away from /learn:
    // Show Quit Learning confirmation
    if (isLeavingActiveLearning && to !== "/learn") {
      e.preventDefault();
      setPendingNavPath(to);
      setShowExitConfirm(true);
      return;
    }

    // Allow child pages (e.g. PracticePage during quiz) to intercept navigation
    if (onNavIntercept && to !== location.pathname) {
      const intercepted = onNavIntercept(to);
      if (intercepted) {
        e.preventDefault();
        return;
      }
    }

    // If user clicks "Learn" from another page, route through /profile (Step 2)
    // so they can re-enable camera and resume properly
    if (to === "/learn" && location.pathname !== "/learn" && session.transformed) {
      e.preventDefault();
      navigate("/profile");
      return;
    }
  }

  function confirmQuitLearning() {
    try {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
      if (setWebcamEnabled) {
        setWebcamEnabled(false);
      }
    } catch (err) {
      console.warn("Error turning off camera:", err);
    }
    // Reset learning state so re-entering goes through Step 2 (Profile) first
    setHasStartedLearning(false);
    const dest = pendingNavPath || "/upload";
    setShowExitConfirm(false);
    setPendingNavPath(null);
    navigate(dest);
  }

  function cancelQuitLearning() {
    setShowExitConfirm(false);
    setPendingNavPath(null);
  }

  return (
    <div className="app-container">
      <div className="desktop-layout">
        <aside className="desktop-sidebar">
          <NavLink
            to="/upload"
            className="brand"
            style={{ marginBottom: 12 }}
            onClick={(e) => handleNavClick(e, "/upload")}
          >
            <img src="/logo.png" alt="AdaptLearn Logo" className="logo" />
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
                onClick={(e) => handleNavClick(e, to)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <NavLink
            to="/profile"
            onClick={(e) => handleNavClick(e, "/profile")}
            style={{
              display: "block",
              textDecoration: "none",
              padding: "14px 16px",
              background: location.pathname === "/profile"
                ? "linear-gradient(135deg, rgba(31, 94, 99, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)"
                : "linear-gradient(135deg, rgba(31, 94, 99, 0.04) 0%, rgba(255, 255, 255, 0.8) 100%)",
              borderRadius: 16,
              border: location.pathname === "/profile"
                ? "1.5px solid var(--primary)"
                : "1px solid rgba(31, 94, 99, 0.16)",
              marginTop: "auto",
              boxShadow: location.pathname === "/profile"
                ? "0 4px 16px rgba(31, 94, 99, 0.12)"
                : "0 2px 8px rgba(15, 23, 42, 0.02)",
              transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: "var(--primary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Active Profile
              </span>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "var(--emerald)",
                  boxShadow: "0 0 6px var(--emerald)",
                }}
              />
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
              {PROFILE_LABELS[session.profile]}
            </div>
            {session.fileName && (
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <I.FileText size={13} style={{ color: "var(--primary)", flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.fileName}</span>
              </div>
            )}
          </NavLink>
        </aside>

        <div className="main-content">
          {children}
        </div>
      </div>

      <nav className="bottom-nav">
        {items.map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            className={`nav-item ${location.pathname === to ? "active" : ""}`}
            onClick={(e) => handleNavClick(e, to)}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── Quit Learning Confirmation Modal ── */}
      {showExitConfirm && (
        <div
          className="exit-learn-modal-backdrop"
          onClick={cancelQuitLearning}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            backgroundColor: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "grid",
            placeItems: "center",
            padding: 20,
            animation: "fadeInBackdrop 0.18s ease-out",
          }}
        >
          <div
            className="exit-learn-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 440,
              width: "100%",
              padding: "32px 28px",
              background: "#ffffff",
              borderRadius: 22,
              boxShadow: "0 25px 60px -15px rgba(15, 23, 42, 0.35)",
              border: "1.5px solid rgba(31, 94, 99, 0.18)",
              textAlign: "center",
              animation: "scaleUpModal 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(245, 158, 11, 0.08))",
                border: "1.5px solid rgba(245, 158, 11, 0.35)",
                margin: "0 auto 18px",
                display: "grid",
                placeItems: "center",
                color: "#b45309",
              }}
            >
              <I.CameraOff size={28} strokeWidth={2.2} />
            </div>

            <h3
              style={{
                fontSize: 21,
                fontWeight: 800,
                color: "var(--ink, #203438)",
                marginBottom: 8,
                letterSpacing: "-0.01em",
              }}
            >
              Quit learning session?
            </h3>

            <p
              style={{
                fontSize: 14,
                color: "var(--muted, #607477)",
                lineHeight: 1.55,
                marginBottom: 24,
              }}
            >
              You are currently in an active learning session. Switching tabs will pause your lesson and <strong>turn off your camera</strong>.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                className="exit-learn-confirm-btn"
                onClick={confirmQuitLearning}
                style={{
                  width: "100%",
                  padding: "12px 18px",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 14.5,
                  background: "linear-gradient(135deg, #1f5e63 0%, #17464a 100%)",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: "0 4px 14px rgba(31, 94, 99, 0.3)",
                }}
              >
                <I.PowerOff size={16} />
                <span>Quit Learning &amp; Turn Off Camera</span>
              </button>

              <button
                type="button"
                className="exit-learn-stay-btn"
                onClick={cancelQuitLearning}
                style={{
                  width: "100%",
                  padding: "11px 18px",
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 14,
                  background: "#f1f5f3",
                  color: "var(--ink, #203438)",
                  border: "1px solid rgba(31, 94, 99, 0.14)",
                  cursor: "pointer",
                }}
              >
                Stay &amp; Continue Learning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Layout;
