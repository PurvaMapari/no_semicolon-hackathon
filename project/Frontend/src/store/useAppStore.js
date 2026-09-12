/**
 * useAppStore — localStorage-backed application state.
 *
 * Shape of persisted data (key: "adaptlearn_store"):
 * {
 *   profile: null | {
 *     name: string,
 *     handle: string,       // @username
 *     joinedAt: string,     // ISO date string
 *   },
 *   preferences: {
 *     cognitiveMode: number,   // index 0-3 into COGNITIVE_MODES
 *     controls: { [label]: boolean },
 *     masteryLevel: number,    // 0=1check 1=2checks 2=3checks
 *     focusGoalMins: number,   // daily focus goal
 *   },
 *   activity: {
 *     xp: number,
 *     xpToday: number,
 *     streakDays: number,
 *     chunksCleared: number,
 *     chunksClearedThisWeek: number,
 *     sessionsCompleted: number,
 *     totalReadingMins: number,
 *     focusMinsToday: number,
 *     badges: [],          // earned badge ids
 *     sessions: [],        // completed session summaries
 *   },
 *   uploads: [],           // { id, name, type, wordCount, chunks, uploadedAt }
 *   currentSession: null | {
 *     uploadId: string,
 *     title: string,
 *     chunkIndex: number,
 *     totalChunks: number,
 *     dwellSeconds: number,
 *     rereads: number,
 *     rewrites: number,
 *     startedAt: string,
 *   },
 * }
 *
 * All write helpers call _save() which persists to localStorage and triggers
 * a storage event so any other open tab stays in sync.
 *
 * To swap in a real backend later:
 *   1. Replace _load() / _save() with API calls.
 *   2. The hook interface (profile, setProfile, activity, …) stays identical.
 */

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import React from "react";

// ── Constant catalogue data (not user-specific) ───────────────────────────────

export const COGNITIVE_MODES = [
  {
    name: "Dyslexia Support Mode",
    desc: "OpenDyslexic optical weighting, +30% letter tracking, syllable color split, and optional bionic reading anchors.",
    tags: ["Heavy-bottom letters", "No crowding"],
    badge: null,
  },
  {
    name: "Low Vision & Clarity",
    desc: "Max optical disambiguation, strict 7:1 contrast boundaries, TTS audio companion, screen-reader optimized landmarks.",
    tags: ["High contrast", "Screen reader sync"],
    badge: { label: "20pt Scalable", color: "#f0f0f7", text: "#333" },
  },
  {
    name: "Cognitive Load Support",
    desc: "Single-concept progressive chunks, plain-language translations, visual memory anchors, zero peripheral clutter.",
    tags: ["1 Concept / Screen", "Memory Anchors"],
    badge: { label: "Recommended", color: "#91efc3", text: "#075f46" },
  },
  {
    name: "ADHD & Executive Focus",
    desc: "Interactive horizontal reading ruler line, 10-minute micro sprints, ambient pink noise soundbed, micro-checklists.",
    tags: ["Interactive Ruler", "Micro-sprints"],
    badge: { label: "Focus Ruler", color: "#ffdbc9", text: "#7a3a14" },
  },
];

export const DEFAULT_CONTROLS = [
  { icon: "A",  label: "Dyslexic Letterforms",   sub: "OpenDyslexic weighting + Bionic word anchors",                               tag: null,          on: false },
  { icon: "♧",  label: "Web Speech Pacing",       sub: "Deliberately decelerates synthesized playback to support processing speed.", tag: "0.9x (Calm)", on: false },
  { icon: "🎵", label: "Pink Noise & 40Hz Audio", sub: "Masks room noise to sustain ADHD executive focus",                          tag: null,          on: false },
  { icon: "⏳", label: "Struggle Shield (>45s)",  sub: "Auto-simplifies vocabulary and offers audio hints",                         tag: null,          on: false },
];

export const BADGE_CATALOGUE = [
  { id: "deep_diver",      icon: "🔍", name: "Deep Diver",      desc: "Complete 5 chunks with zero struggle pauses.",          tier: "Tier I",  threshold: 5,  field: "chunksCleared",    color: "#d9f5e9" },
  { id: "relentless_grit", icon: "🔨", name: "Relentless Grit", desc: "Master 3 rewired analogies after initial struggle.",    tier: "Tier II", threshold: 3,  field: "rewrites",         color: "#fde8d8" },
  { id: "voice_explorer",  icon: "🔊", name: "Voice Explorer",  desc: "Use audio playback in 3 or more sessions.",            tier: "Tier I",  threshold: 3,  field: "sessionsCompleted", color: "#e1eeff" },
  { id: "streak_champion", icon: "📅", name: "Streak Champion", desc: "Maintain a 3-day learning streak.",                    tier: "Tier I",  threshold: 3,  field: "streakDays",        color: "#eefce0" },
];

// ── Default state ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "adaptlearn_store";

function defaultState() {
  return {
    profile: null,
    preferences: {
      cognitiveMode: null,   // null = not chosen yet
      controls: Object.fromEntries(DEFAULT_CONTROLS.map((c) => [c.label, false])),
      masteryLevel: 1,
      focusGoalMins: 15,
    },
    activity: {
      xp: 0,
      xpToday: 0,
      streakDays: 0,
      chunksCleared: 0,
      chunksClearedThisWeek: 0,
      sessionsCompleted: 0,
      totalReadingMins: 0,
      focusMinsToday: 0,
      badges: [],
      sessions: [],
      rewrites: 0,
    },
    uploads: [],
    currentSession: null,
  };
}

// ── Persistence helpers ───────────────────────────────────────────────────────

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    // Deep-merge so new fields from defaultState() are always present
    const saved = JSON.parse(raw);
    const base = defaultState();
    return {
      ...base,
      ...saved,
      preferences: { ...base.preferences, ...(saved.preferences || {}) },
      activity: { ...base.activity, ...(saved.activity || {}) },
    };
  } catch {
    return defaultState();
  }
}

function _save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage quota exceeded — fail silently
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const AppStoreContext = createContext(null);

export function AppStoreProvider({ children }) {
  const [store, setStore] = useState(() => _load());

  // Persist on every change
  useEffect(() => {
    _save(store);
  }, [store]);

  // Helper: merge partial update and persist
  const update = useCallback((partial) => {
    setStore((prev) => {
      const next = { ...prev, ...partial };
      return next;
    });
  }, []);

  // ── Profile ────────────────────────────────────────────────────────────────

  const setProfile = useCallback((profileData) => {
    update({
      profile: {
        ...profileData,
        joinedAt: profileData.joinedAt || new Date().toISOString(),
      },
    });
  }, [update]);

  const clearProfile = useCallback(() => {
    setStore(defaultState());
  }, []);

  // ── Preferences ───────────────────────────────────────────────────────────

  const setPreferences = useCallback((prefs) => {
    setStore((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, ...prefs },
    }));
  }, []);

  const toggleControl = useCallback((label) => {
    setStore((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        controls: {
          ...prev.preferences.controls,
          [label]: !prev.preferences.controls[label],
        },
      },
    }));
  }, []);

  // ── Uploads ───────────────────────────────────────────────────────────────

  const addUpload = useCallback((uploadData) => {
    const entry = {
      id: Date.now().toString(),
      uploadedAt: new Date().toISOString(),
      ...uploadData,
    };
    setStore((prev) => ({
      ...prev,
      uploads: [entry, ...prev.uploads].slice(0, 20), // keep last 20
    }));
    return entry;
  }, []);

  const removeUpload = useCallback((id) => {
    setStore((prev) => ({
      ...prev,
      uploads: prev.uploads.filter((u) => u.id !== id),
    }));
  }, []);

  // ── Session ───────────────────────────────────────────────────────────────

  const startSession = useCallback((uploadId, title, totalChunks) => {
    setStore((prev) => ({
      ...prev,
      currentSession: {
        uploadId,
        title,
        chunkIndex: 1,
        totalChunks,
        dwellSeconds: 0,
        rereads: 0,
        rewrites: 0,
        startedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const recordDwell = useCallback((seconds) => {
    setStore((prev) => {
      if (!prev.currentSession) return prev;
      return {
        ...prev,
        currentSession: {
          ...prev.currentSession,
          dwellSeconds: prev.currentSession.dwellSeconds + seconds,
          rereads: prev.currentSession.rereads + 1,
        },
      };
    });
  }, []);

  // ── Complete a practice question ──────────────────────────────────────────

  const completeQuestion = useCallback((xpEarned) => {
    setStore((prev) => {
      const activity = { ...prev.activity };
      activity.xp += xpEarned;
      activity.xpToday += xpEarned;
      return { ...prev, activity };
    });
  }, []);

  // ── Complete a full session ───────────────────────────────────────────────

  const completeSession = useCallback((sessionResult) => {
    // sessionResult: { title, comprehensionGain, readingMins, rewrites, adaptations }
    setStore((prev) => {
      const activity = { ...prev.activity };
      activity.chunksCleared += 1;
      activity.chunksClearedThisWeek += 1;
      activity.sessionsCompleted += 1;
      activity.totalReadingMins += sessionResult.readingMins || 0;
      activity.focusMinsToday += sessionResult.readingMins || 0;
      activity.rewrites += sessionResult.rewrites || 0;

      // Streak: increment if last session was yesterday or today
      const today = new Date().toDateString();
      const lastSession = activity.sessions[0];
      if (!lastSession) {
        activity.streakDays = 1;
      } else {
        const lastDate = new Date(lastSession.completedAt).toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (lastDate === today) {
          // same day, streak unchanged
        } else if (lastDate === yesterday) {
          activity.streakDays += 1;
        } else {
          activity.streakDays = 1; // streak broken
        }
      }

      // Check for new badges
      const earned = new Set(activity.badges);
      BADGE_CATALOGUE.forEach((b) => {
        if (!earned.has(b.id) && activity[b.field] >= b.threshold) {
          earned.add(b.id);
        }
      });
      activity.badges = [...earned];

      // Prepend session summary
      activity.sessions = [
        {
          id: Date.now().toString(),
          title: sessionResult.title || "Untitled Session",
          comprehensionGain: sessionResult.comprehensionGain || 0,
          readingMins: sessionResult.readingMins || 0,
          rewrites: sessionResult.rewrites || 0,
          adaptations: sessionResult.adaptations || [],
          completedAt: new Date().toISOString(),
        },
        ...activity.sessions,
      ].slice(0, 50);

      return {
        ...prev,
        activity,
        currentSession: null,
      };
    });
  }, []);

  const value = {
    // Raw state (read-only; use helpers to mutate)
    profile: store.profile,
    preferences: store.preferences,
    activity: store.activity,
    uploads: store.uploads,
    currentSession: store.currentSession,

    // Derived helpers
    hasProfile: !!store.profile,
    earnedBadges: BADGE_CATALOGUE.filter((b) => store.activity.badges.includes(b.id)),
    hasActivity: store.activity.sessionsCompleted > 0,
    activeModeName: store.preferences.cognitiveMode !== null
      ? COGNITIVE_MODES[store.preferences.cognitiveMode]?.name
      : null,

    // Write helpers
    setProfile,
    clearProfile,
    setPreferences,
    toggleControl,
    addUpload,
    removeUpload,
    startSession,
    recordDwell,
    completeQuestion,
    completeSession,
  };

  return React.createElement(AppStoreContext.Provider, { value }, children);
}

export function useAppStore() {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore must be used inside <AppStoreProvider>");
  return ctx;
}
