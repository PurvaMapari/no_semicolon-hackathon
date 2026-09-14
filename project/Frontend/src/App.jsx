import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SessionProvider } from "./context/SessionContext";
import { WebcamProvider } from "./hooks/WebcamContext";
import { ToastProvider, ToastContainer } from "./components/PrismToast";

// Lazy-loaded route pages for code-splitting and instant page transitions
const UploadPage = lazy(() => import("./pages/UploadPage/UploadPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage/ProfilePage"));
const LearnPage = lazy(() => import("./pages/LearnPage/LearnPage"));
const PracticePage = lazy(() => import("./pages/PracticePage/PracticePage"));
const ProgressPage = lazy(() => import("./pages/ProgressPage/ProgressPage"));
const DemoPage = lazy(() => import("./components/ui/demo"));

function RouteLoadingFallback() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg-app, #f8fbfb)",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "3.5px solid #e2e8f0",
          borderTop: "3.5px solid var(--primary, #1f5e63)",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--muted, #64748b)",
          letterSpacing: "0.02em",
        }}
      >
        Loading module…
      </span>
    </div>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <WebcamProvider>
        <ToastProvider>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/upload" replace />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/learn" element={<LearnPage />} />
              <Route path="/practice" element={<PracticePage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/demo" element={<DemoPage />} />
            </Routes>
          </Suspense>
          <ToastContainer />
        </ToastProvider>
      </WebcamProvider>
    </SessionProvider>
  );
}
