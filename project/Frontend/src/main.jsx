import React from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  useLocation,
  Routes,
  Route,
  Link,
  Navigate,
} from "react-router-dom";
import { CloudUpload, BookOpen, BadgeHelp, BarChart3 } from "lucide-react";
import "./styles.css";

import { AppStoreProvider, useAppStore } from "./store/useAppStore";

import UploadPage from "./component/UploadPage/UploadPage";
import LearnerProfile from "./component/DashboardPage/DashboardPage";
import ProfilePage from "./component/ProfilePage/ProfilePage";
import LearnPage from "./component/LearnPage/LearnPage";
import PracticePage from "./component/PracticePage/PracticePage";
import ProgressPage from "./component/ProgressPage/ProgressPage";

/* ── Header ───────────────────────────────────────────── */
function Header({ section }) {
  const { profile, hasProfile } = useAppStore();

  return (
    <div className="topbar">
      <div className="brand">
        <div className="logo">▧</div>
        <div>
          <div className="brandname">AdaptLearn</div>
          <div className="subtitle">{section}</div>
        </div>
      </div>
      <div className="access">☀︎</div>
      <Link to="/profile" style={{ display: "flex", alignItems: "center" }}>
        {hasProfile && profile?.name ? (
          <div
            className="avatar"
            style={{
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg,#4157dc,#2440c6)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {profile.name.trim().split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
        ) : (
          <div className="avatar" style={{ cursor: "pointer", background: "#e0e2f1" }} />
        )}
      </Link>
    </div>
  );
}

/* ── Bottom navigation ────────────────────────────────── */
const NAV_ITEMS = [
  { to: "/upload", label: "Upload", Icon: CloudUpload },
  { to: "/learn", label: "Learn", Icon: BookOpen },
  { to: "/practice", label: "Practice", Icon: BadgeHelp },
  { to: "/progress", label: "Progress", Icon: BarChart3 },
];

function BottomNav() {
  const { pathname } = useLocation();
  return (
    <div className="bottom">
      {NAV_ITEMS.map(({ to, label, Icon }) => (
        <Link
          key={to}
          to={to}
          className={"nav" + (pathname === to ? " active" : "")}
        >
          <Icon />
          <span>{label}</span>
        </Link>
      ))}
    </div>
  );
}

/* ── Layout ───────────────────────────────────────────── */
const SECTION_MAP = {
  "/upload": "Upload",
  "/learner-profile": "Upload",
  "/learn": "Learn",
  "/practice": "Practice",
  "/progress": "Progress",
  "/profile": "Profile",
};

function Layout({ children }) {
  const { pathname } = useLocation();
  const section = SECTION_MAP[pathname] ?? "AdaptLearn";
  return (
    <div className="app">
      <div className="phone">
        <Header section={section} />
        <main>{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}

/* ── Route guard: first-time users go to profile setup ── */
function RequireProfile({ children }) {
  const { hasProfile } = useAppStore();
  const { pathname } = useLocation();
  if (!hasProfile && pathname !== "/profile") {
    return <Navigate to="/profile" replace />;
  }
  return children;
}

/* ── App ──────────────────────────────────────────────── */
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/upload" replace />} />
      <Route path="/profile" element={<Layout><ProfilePage /></Layout>} />
      <Route path="/upload" element={<Layout><RequireProfile><UploadPage /></RequireProfile></Layout>} />
      <Route path="/learner-profile" element={<Layout><RequireProfile><LearnerProfile /></RequireProfile></Layout>} />
      <Route path="/learn" element={<Layout><RequireProfile><LearnPage /></RequireProfile></Layout>} />
      <Route path="/practice" element={<Layout><RequireProfile><PracticePage /></RequireProfile></Layout>} />
      <Route path="/progress" element={<Layout><RequireProfile><ProgressPage /></RequireProfile></Layout>} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppStoreProvider>
        <AppRoutes />
      </AppStoreProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")).render(<App />);
