import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAppStore,
  DEFAULT_CONTROLS,
  BADGE_CATALOGUE,
} from "../../store/useAppStore";
import "./ProfilePage.css";

/* ── helpers ────────────────────────────────────────── */
function joinedLabel(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function focusPct(focusMinsToday, goal) {
  if (!goal) return 0;
  return Math.min(100, Math.round((focusMinsToday / goal) * 100));
}

/* ── Onboarding / Edit form ─────────────────────────── */
function ProfileForm({ existing, onSave, onCancel }) {
  const [name, setName] = useState(existing?.name || "");
  const [handle, setHandle] = useState(existing?.handle || "");
  const [goal, setGoal] = useState(existing?.focusGoalMins || 15);
  const [err, setErr] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setErr("Name is required."); return; }
    onSave({
      name: name.trim(),
      handle: handle.trim() || name.trim().toLowerCase().replace(/\s+/g, ""),
      focusGoalMins: Number(goal) || 15,
    });
  }

  return (
    <div className="pf-form-wrap">
      {/* Hero illustration / brand */}
      <div className="pf-form-brand">
        <img src="/logo.png" alt="AdaptLearn Logo" className="pf-form-logo" />
        <h2 className="pf-form-title">
          {existing ? "Edit your profile" : "Welcome to AdaptLearn"}
        </h2>
        <p className="pf-form-subtitle">
          {existing
            ? "Update your details below."
            : "Set up your profile to get started. No data leaves your device."}
        </p>
      </div>

      <form className="card pf-form" onSubmit={handleSubmit} noValidate>
        <label className="pf-field">
          <span className="pf-field-label">Your name *</span>
          <input
            className="pf-input"
            type="text"
            placeholder="e.g. Alex Rivera"
            value={name}
            maxLength={50}
            onChange={(e) => { setName(e.target.value); setErr(""); }}
            autoFocus
          />
        </label>

        <label className="pf-field">
          <span className="pf-field-label">Username (optional)</span>
          <div className="pf-input-prefix-wrap">
            <span className="pf-input-prefix">@</span>
            <input
              className="pf-input pf-input--prefix"
              type="text"
              placeholder="yourusername"
              value={handle}
              maxLength={30}
              onChange={(e) =>
                setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())
              }
            />
          </div>
        </label>

        <label className="pf-field">
          <span className="pf-field-label">Daily focus goal (minutes)</span>
          <input
            className="pf-input"
            type="number"
            min={5}
            max={120}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </label>

        {err && <p className="pf-form-err">{err}</p>}

        <button type="submit" className="pf-form-submit">
          {existing ? "Save changes" : "Create Profile →"}
        </button>

        {onCancel && (
          <button type="button" className="pf-form-cancel" onClick={onCancel}>
            Cancel
          </button>
        )}
      </form>

      {!existing && (
        <p className="pf-form-note">
          All data is stored only on this device via localStorage.
          No account or server required.
        </p>
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────── */
export default function ProfilePage() {
  const nav = useNavigate();
  const {
    profile,
    hasProfile,
    preferences,
    activity,
    earnedBadges,
    hasActivity,
    toggleControl,
    setPreferences,
    setProfile,
    clearProfile,
    activeModeName,
  } = useAppStore();

  const [editing, setEditing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  /* controls array merged with saved on/off state */
  const controls = DEFAULT_CONTROLS.map((c) => ({
    ...c,
    on: preferences.controls[c.label] ?? false,
  }));

  const focusPct_ = focusPct(activity.focusMinsToday, preferences.focusGoalMins);

  /* ── Onboarding state ───────────────────────────────── */
  if (!hasProfile || editing) {
    return (
      <div className="page">
        <ProfileForm
          existing={editing ? { ...profile, focusGoalMins: preferences.focusGoalMins } : null}
          onSave={(data) => {
            setProfile(data);
            setPreferences({ focusGoalMins: data.focusGoalMins });
            setEditing(false);
            if (!hasProfile) nav("/upload");
          }}
          onCancel={editing ? () => setEditing(false) : null}
        />
      </div>
    );
  }

  /* ── Profile view ───────────────────────────────────── */
  const initials = profile.name.trim().split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="page">

      {/* ── Hero card ── */}
      <div className="card pf-hero">
        <div className="pf-hero-inner">
          <div className="pf-avatar-col">
            <div className="pf-avatar pf-avatar--initials">{initials}</div>
          </div>
          <div className="pf-info">
            <b className="pf-name">{profile.name}</b>
            <div className="pf-handle">
              @{profile.handle} · Joined {joinedLabel(profile.joinedAt)}
            </div>
            {activeModeName && (
              <span className="pill pf-mode-pill">{activeModeName} Active</span>
            )}
          </div>
          <button className="pf-edit-btn" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>

        {/* Daily focus pace */}
        <div className="pf-focus">
          <div className="pf-focus-top">
            <span className="pf-focus-icon">📋</span>
            <b className="pf-focus-label">Daily Focus Pace</b>
            <span className="pf-focus-count">
              {activity.focusMinsToday} / {preferences.focusGoalMins} mins
            </span>
          </div>
          <div className="progressbar pf-focus-bar">
            <div className="pf-focus-fill" style={{ width: `${focusPct_}%` }} />
          </div>
          {focusPct_ >= 100 ? (
            <div className="pf-focus-note">✓ Daily goal reached!</div>
          ) : (
            <div className="pf-focus-note">
              {preferences.focusGoalMins - activity.focusMinsToday} mins remaining to reach today's goal.
            </div>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="pf-section-row">
        <b className="pf-section-title">Progress &amp; Badges</b>
      </div>

      <div className="pf-stats-grid">
        <div className="card pf-stat">
          <div className="pf-stat-icon">🔥</div>
          {activity.streakDays > 0 ? (
            <>
              <b className="pf-stat-val pf-stat-val--orange">{activity.streakDays} {activity.streakDays === 1 ? "Day" : "Days"}</b>
              <div className="pf-stat-label">Current Streak</div>
            </>
          ) : (
            <>
              <b className="pf-stat-val pf-stat-val--muted">—</b>
              <div className="pf-stat-label">No streak yet</div>
            </>
          )}
        </div>

        <div className="card pf-stat">
          <div className="pf-stat-icon">⚡</div>
          <b className="pf-stat-val">{activity.xp.toLocaleString()}</b>
          <div className="pf-stat-label">Total Adaptive XP</div>
          {activity.xpToday > 0 && (
            <div className="pf-stat-gain">+{activity.xpToday} today</div>
          )}
        </div>

        <div className="card pf-stat pf-stat--full">
          <div className="pf-stat-icon">⚙</div>
          <div>
            <b className="pf-stat-val">
              {activity.chunksCleared > 0 ? `${activity.chunksCleared} Chunks Cleared` : "No chunks yet"}
            </b>
            {activity.chunksCleared > 0 && (
              <div className="pf-stat-meta">{activity.sessionsCompleted} session{activity.sessionsCompleted !== 1 ? "s" : ""} completed</div>
            )}
            {activity.chunksClearedThisWeek > 0 && (
              <div className="pf-stat-gain">+{activity.chunksClearedThisWeek} this week</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mastery badges ── */}
      <div className="pf-section-row" style={{ marginTop: 22 }}>
        <b className="pf-section-title">Mastery Badges</b>
        {earnedBadges.length > 0 && (
          <button className="pf-view-all" onClick={() => nav("/progress")}>
            View All ({earnedBadges.length})
          </button>
        )}
      </div>

      {earnedBadges.length === 0 ? (
        <div className="card pf-empty-state">
          <div className="pf-empty-icon">🏅</div>
          <b className="pf-empty-title">No badges yet</b>
          <p className="pf-empty-desc">
            Complete learning sessions to earn your first badge.
          </p>
        </div>
      ) : (
        <div className="pf-badges-grid">
          {earnedBadges.map((b) => (
            <div key={b.id} className="card pf-badge" style={{ background: b.color, border: 0 }}>
              <div className="pf-badge-icon">{b.icon}</div>
              <b className="pf-badge-name">{b.name}</b>
              <p className="pf-badge-desc">{b.desc}</p>
              <div className="pf-badge-tier">✓ {b.tier} Complete</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Cognitive & Sensory Controls ── */}
      <div className="card pf-controls">
        <div className="pf-controls-header">
          <b className="pf-controls-title">Cognitive &amp; Sensory Controls</b>
          <span className="pf-controls-live">Live Realtime</span>
        </div>

        {controls.map((c) => (
          <div key={c.label} className="pf-control-row">
            <div className="pf-ctrl-icon">{c.icon}</div>
            <div className="pf-ctrl-info">
              <b className="pf-ctrl-label">
                {c.label}
                {c.tag && <span className="pf-ctrl-tag">{c.tag}</span>}
              </b>
              <div className="pf-ctrl-sub">{c.sub}</div>
            </div>
            <button
              className={"pf-toggle" + (c.on ? " pf-toggle--on" : "")}
              onClick={() => toggleControl(c.label)}
              aria-label={c.on ? `Turn off ${c.label}` : `Turn on ${c.label}`}
            >
              <div className="pf-toggle-thumb" />
            </button>
          </div>
        ))}

        {/* Mastery gate selector */}
        <div className="pf-mastery-section">
          <b className="pf-mastery-title">Mastery Gate Requirement</b>
          <p className="pf-mastery-desc">
            Number of successful comprehension checks before unlocking next chunk:
          </p>
          <div className="pf-mastery-btns">
            {["1 Check", "2 Checks\n(Paced)", "3 Checks"].map((label, i) => (
              <button
                key={i}
                className={"pf-mastery-btn" + (preferences.masteryLevel === i ? " pf-mastery-btn--on" : "")}
                onClick={() => setPreferences({ masteryLevel: i })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Reset / sign out */}
        {confirmClear ? (
          <div className="pf-confirm-clear">
            <p className="pf-confirm-text">This will erase all your data on this device. Are you sure?</p>
            <div className="pf-confirm-row">
              <button className="pf-confirm-yes" onClick={() => { clearProfile(); setConfirmClear(false); }}>
                Yes, reset everything
              </button>
              <button className="pf-confirm-no" onClick={() => setConfirmClear(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="pf-signout" onClick={() => setConfirmClear(true)}>
            <span>↗ Reset &amp; Clear Device Data</span>
            <span>›</span>
          </button>
        )}

        <div className="pf-version">AdaptLearn v2.4.1 · Paced for cognitive agency</div>
      </div>

      <button className="pf-continue-btn" onClick={() => nav("/learn")}>
        Continue Learning →
      </button>

    </div>
  );
}
