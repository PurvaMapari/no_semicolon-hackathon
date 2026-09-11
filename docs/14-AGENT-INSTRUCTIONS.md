# PRISM — Agent Instructions

> **Strict rules for all AI coding agents working on PRISM.**

---

## Before Writing ANY Code

### Step 1: Read Phase Status
```
READ docs/00-PHASE-STATUS.md
```
- Check which phases are complete, in progress, or blocked
- Check which files already exist
- Check known issues and blockers
- **Do NOT re-implement completed work**

### Step 2: Read Context
```
READ docs/13-CONTEXT.md
```
- Understand product, architecture, SCALE, REWIRE, voice
- Understand team responsibilities and critical rules

### Step 3: Read Relevant Spec
Read the specific document for your task:

| Task Area | Read |
|-----------|------|
| Content extraction/structuring | `02-ARCHITECTURE.md` §1–2, `06-AI-RULES-AND-SYSTEM-PROMPTS.md` |
| AI prompts/LLM integration | `06-AI-RULES-AND-SYSTEM-PROMPTS.md` |
| Adaptive engine/SCALE | `07-ADAPTIVE-ENGINE-LOGIC.md` |
| Frontend components | `09-DESIGN-SYSTEM.md` |
| API endpoints | `04-API-CONTRACT.md` |
| Database/schemas | `05-DATA-MODEL.md` |
| Voice features | `15-VOICE-INTERACTION.md` |
| Accessibility | `16-ACCESSIBILITY-QA.md` |
| Testing | `17-TESTING.md` |

### Step 4: Inspect Only Necessary Files
- **Do NOT scan the entire repository** — read only files relevant to your task
- Use the owned folders from `10-TEAM-PLAN.md` to know where to look
- Check `00-PHASE-STATUS.md` for the list of existing files

---

## Before Changing an API

1. Read `04-API-CONTRACT.md`
2. Check endpoint ownership (which member owns it)
3. Make the change
4. **Update `04-API-CONTRACT.md`** with the new request/response structure
5. Update `00-PHASE-STATUS.md` noting the API change

---

## Before Changing a Schema

1. Read `05-DATA-MODEL.md`
2. Check which tables/fields are affected
3. Make the change
4. **Update `05-DATA-MODEL.md`** with the new schema
5. Update `00-PHASE-STATUS.md` noting the schema change

---

## Before Changing Adaptive Logic

1. Read `07-ADAPTIVE-ENGINE-LOGIC.md`
2. Understand signal weights, thresholds, and cooldown rules
3. Make the change
4. **Update `07-ADAPTIVE-ENGINE-LOGIC.md`** if thresholds or rules changed
5. Run adaptive engine unit tests

---

## Before Changing Voice

1. Read `15-VOICE-INTERACTION.md`
2. Check intent routing table
3. Make the change
4. **Update `15-VOICE-INTERACTION.md`** if intents or routing changed
5. Ensure text fallbacks exist for all voice actions

---

## Before Changing Accessibility

1. Read `16-ACCESSIBILITY-QA.md`
2. Check the acceptance criteria for the component you're modifying
3. Make the change
4. Run accessibility checks (keyboard, focus, ARIA, contrast)

---

## After Completing Work

### Step 1: Test It
- Run relevant unit tests
- Run integration tests if applicable
- Test manually if automated tests don't exist yet
- For UI changes: verify keyboard navigation, focus, contrast

### Step 2: Update Phase Status
```
EDIT docs/00-PHASE-STATUS.md
```
Update:
- Phase completion percentage
- Move tasks from "Remaining" to "Completed"
- Record files created/modified
- Record APIs created/changed
- Record schemas created/changed
- Add known issues (if any)
- Add handoff notes for the next phase

### Step 3: Record Changes
Add to `00-PHASE-STATUS.md`:
- **Files changed:** List of files created, modified, or deleted
- **APIs changed:** Any endpoint changes (method, path, request, response)
- **Known issues:** Any bugs, edge cases, or incomplete features
- **Handoff notes:** What the next developer needs to know

---

## Prohibited Actions

### Do NOT:
1. **Rewrite working code** for stylistic preferences — if it works, leave it
2. **Duplicate existing functionality** — check what exists first
3. **Add LLM calls to the live adaptation path** — SCALE is deterministic
4. **Remove accessibility features** — keyboard nav, ARIA, focus management
5. **Add a chatbot or avatar** — PRISM is not a conversational agent
6. **Add gamification** — no points, badges, leaderboards
7. **Build native mobile** — web-only
8. **Build LMS integration** — standalone application
9. **Train a custom model** — use existing LLM with prompts
10. **Make clinical/diagnostic claims** — behavioral terminology only
11. **Create unnecessary microservices** — monolithic backend
12. **Change API contracts without updating `04-API-CONTRACT.md`**
13. **Mark a phase complete unless implementation exists and is tested**
14. **Scan the entire repository** — inspect only necessary files
15. **Ignore fallback paths** — every feature must degrade gracefully

### Do:
1. **Read before writing** — understand context before changing code
2. **Update docs after changes** — keep `00-PHASE-STATUS.md` current
3. **Write tests** — at least unit tests for core logic
4. **Use shared contracts** — match the JSON shapes in `10-TEAM-PLAN.md`
5. **Preserve facts** — never alter numbers, dates, names, formulas in content
6. **Handle errors gracefully** — always provide fallback behavior
7. **Keep it simple** — prefer simple modules over clever abstractions

---

## Architecture Quick Rules

| Rule | Why |
|------|-----|
| Structured content graph is source of truth | Enables deterministic adaptation |
| Learner profile = starting preferences, not diagnosis | Behavioral signals drive adaptation |
| Cache AI outputs at upload time | Live path must be instant |
| SCALE = deterministic rules | No ML, no LLM, pure computation |
| REWIRE = visible + explainable | Core demo feature |
| Voice = Day-1 | Not a stretch goal |
| Always have fallbacks | Never block the learner |
