# PRISM — Git and Contribution

---

## Branch Strategy

### Main Branches

| Branch | Purpose | Protected |
|--------|---------|-----------|
| `main` | Production-ready code | ✅ Yes — no direct pushes |
| `dev` | Integration branch | ✅ Yes — merge from feature branches |

### Feature Branches

**Naming convention:** `<member>/<area>/<short-description>`

| Examples |
|----------|
| `m1/extraction/pdf-parser` |
| `m1/ai/content-structuring-prompt` |
| `m2/scale/signal-normalization` |
| `m2/scale/cooldown-mechanism` |
| `m3/frontend/reader-component` |
| `m3/rewire/transition-animation` |
| `m4/voice/stt-integration` |
| `m4/assessment/question-display` |

**Rules:**
- Always branch from `dev`
- One feature per branch
- Keep branches short-lived (merge within 2–4 hours)

---

## Commit Messages

### Format

```
<type>(<scope>): <description>

[optional body]
```

### Types

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation change |
| `refactor` | Code change that doesn't add feature or fix bug |
| `test` | Adding or updating tests |
| `chore` | Build, config, or tooling changes |

### Scope

| Scope | Area |
|-------|------|
| `extraction` | PDF extraction, text cleaning |
| `ai` | LLM prompts, content structuring |
| `scale` | SCALE engine, signal processing |
| `rewire` | REWIRE visual behavior |
| `reader` | Reader component, chunk navigation |
| `voice` | STT, TTS, voice intents |
| `assessment` | Questions, answers, scoring |
| `profile` | Learner profile |
| `db` | Database schema, SQLite |
| `api` | API endpoints |
| `a11y` | Accessibility |
| `docs` | Documentation |

### Examples

```
feat(extraction): add PDF.js text extraction with fallback
fix(scale): correct inverted normalization for questionAccuracy
docs(api): update /api/upload response schema
test(scale): add unit tests for struggle score computation
feat(rewire): implement fade-out/fade-in transition
feat(voice): add STT intent routing for 10 commands
fix(a11y): add aria-label to voice button
```

---

## Pull Requests

### PR Title Format

Same as commit message format:
```
feat(scale): implement cooldown mechanism
```

### PR Template

```markdown
## What
Brief description of what this PR does.

## Why
Why this change is needed.

## Changes
- List of files changed
- APIs added/modified
- Schemas added/modified

## Testing
- [ ] Unit tests pass
- [ ] Manual testing done
- [ ] Golden-path still works (if applicable)

## Docs Updated
- [ ] 00-PHASE-STATUS.md updated
- [ ] API contract updated (if API changed)
- [ ] Data model updated (if schema changed)

## Screenshots (if UI change)
```

### PR Rules

1. **Self-review** before requesting review — check your own diff
2. **Minimum 1 reviewer** from another team member
3. **Tests pass** — all existing tests must pass
4. **Docs updated** — `00-PHASE-STATUS.md` must reflect changes
5. **No merge conflicts** — rebase on `dev` before merging

---

## Ownership

| Area | Owner | Can Merge |
|------|-------|-----------|
| `server/skills/extraction/` | M1 | M1 |
| `server/skills/structuring/` | M1 | M1 |
| `server/skills/simplification/` | M1 | M1 |
| `server/prompts/` | M1 | M1 |
| `server/routes/upload.js` | M1 | M1 |
| `server/routes/content.js` | M1 | M1 |
| `server/routes/scale.js` | M2 | M2 |
| `server/skills/signal-processing/` | M2 | M2 |
| `server/skills/adaptation-reasoning/` | M2 | M2 |
| `client/src/components/` | M3 | M3 |
| `client/src/hooks/useSignalCapture.js` | M3 | M3 |
| `client/src/styles/` | M3 | M3 |
| `server/routes/voice.js` | M4 | M4 |
| `server/routes/session.js` | M4 | M4 |
| `server/routes/profile.js` | M4 | M4 |
| `client/src/hooks/useVoiceInput.js` | M4 | M4 |
| `client/src/hooks/useVoiceOutput.js` | M4 | M4 |
| `docs/` | All | All |
| `server/db/` | M4 (primary) | M1, M4 |

---

## Merge Rules

1. **Feature → `dev`:** Squash merge. Requires 1 approval.
2. **`dev` → `main`:** Merge commit. Requires all members' approval at integration checkpoint.
3. **Hotfix → `main`:** Only for critical bugs during demo prep. Cherry-pick after fixing on `dev`.

### Merge to `main` Checkpoints

| Checkpoint | Hour | Condition |
|------------|------|-----------|
| Checkpoint 1 | 6 | Upload → content → render pipeline works |
| Checkpoint 2 | 14 | Full SCALE → REWIRE loop works |
| Checkpoint 3 | 20 | Deployed and demo-ready |

---

## Conflict Handling

1. **Same file, different sections:** Merge normally (Git handles it)
2. **Same file, same lines:** The member who owns the file resolves
3. **Shared file (e.g., `docs/00-PHASE-STATUS.md`):** Latest writer resolves conflicts, preserving all updates
4. **API contract conflict:** Both members re-read `04-API-CONTRACT.md`, agree on resolution, update doc

---

## API/Schema Change Procedure

### Changing an API Endpoint

1. **Read** `04-API-CONTRACT.md` — understand current contract
2. **Discuss** with the endpoint owner and any dependent members
3. **Make the change** in code
4. **Update** `04-API-CONTRACT.md` with new request/response
5. **Notify** all team members (message in chat)
6. **Update** `00-PHASE-STATUS.md` noting the API change

### Changing a Database Schema

1. **Read** `05-DATA-MODEL.md` — understand current schema
2. **Make the change** in `server/db/schema.sql`
3. **Update** `05-DATA-MODEL.md` with new schema
4. **Test** that existing data migration works (or note that DB reset is needed)
5. **Update** `00-PHASE-STATUS.md` noting the schema change

---

## .gitignore

```gitignore
# Dependencies
node_modules/

# Build output
dist/
build/

# Environment
.env
.env.local

# Database
*.db
server/data/

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Logs
*.log

# Test coverage
coverage/
```

---

## Quick Reference

```bash
# Start new feature
git checkout dev
git pull origin dev
git checkout -b m1/extraction/pdf-parser

# Work...commit...

# Push and create PR
git push -u origin m1/extraction/pdf-parser
# Create PR on GitHub: m1/extraction/pdf-parser → dev

# After PR approved and merged
git checkout dev
git pull origin dev
git branch -d m1/extraction/pdf-parser
```
