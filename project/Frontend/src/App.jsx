import React from "react";
import { Route, Routes } from "react-router-dom";
import { SessionProvider } from "./components/shared/SessionContext";
import Upload from "./components/upload/Upload";
import Profile from "./components/profile/Profile";
import Learn from "./components/learn/Learn";
import Practice from "./components/practice/Practice";
import Progress from "./components/progress/Progress";

export default function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/" element={<Progress />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/progress" element={<Progress />} />
      </Routes>
    </SessionProvider>
  );
}
