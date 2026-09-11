# PRISM — Environment and Configuration

---

## Runtime Versions

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | 20 LTS (≥20.0.0) | Use `nvm use 20` if available |
| npm | ≥9.0.0 | Ships with Node 20 |
| React | 18.x | Via Vite template |
| Vite | 5.x | Dev server + build |

---

## Environment Variables

### Required

| Variable | Purpose | Example | Where Used |
|----------|---------|---------|-----------|
| `OPENAI_API_KEY` | GPT-4o-mini access for content structuring | `sk-proj-...` | Server: LLM calls |

### Optional

| Variable | Purpose | Default | Where Used |
|----------|---------|---------|-----------|
| `PORT` | Backend server port | `3001` | Server |
| `VITE_API_URL` | Backend URL for frontend | `http://localhost:3001` | Client |
| `NODE_ENV` | Environment mode | `development` | Server |
| `DB_PATH` | SQLite database file path | `./data/prism.db` | Server |
| `LLM_MODEL` | OpenAI model name | `gpt-4o-mini` | Server |
| `LLM_TIMEOUT` | LLM request timeout (ms) | `15000` | Server |
| `LLM_MAX_RETRIES` | LLM retry count on failure | `2` | Server |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:5173` | Server |
| `MAX_UPLOAD_SIZE` | Maximum upload file size (bytes) | `10485760` (10MB) | Server |
| `MAX_TEXT_LENGTH` | Maximum pasted text length (chars) | `25000` | Server |

---

## .env File Template

```env
# Required
OPENAI_API_KEY=sk-proj-your-key-here

# Optional — defaults work for local development
PORT=3001
VITE_API_URL=http://localhost:3001
NODE_ENV=development
DB_PATH=./data/prism.db
LLM_MODEL=gpt-4o-mini
LLM_TIMEOUT=15000
LLM_MAX_RETRIES=2
CORS_ORIGIN=http://localhost:5173
MAX_UPLOAD_SIZE=10485760
MAX_TEXT_LENGTH=25000
```

**Important:** `.env` is in `.gitignore`. Never commit API keys.

---

## Ports

| Service | Port | Purpose |
|---------|------|---------|
| Vite dev server (frontend) | 5173 | React app |
| Express server (backend) | 3001 | API endpoints |

---

## Local Setup

### Prerequisites

```bash
# Install Node.js 20 LTS
# https://nodejs.org/en/download/

node --version  # Should be v20.x.x
npm --version   # Should be ≥9.x.x
```

### Quick Start

```bash
# Clone repository
git clone <repo-url>
cd no_semicolon-hackathon

# Backend setup
cd server
npm install
cp .env.example .env
# Edit .env — add OPENAI_API_KEY
npm run dev

# Frontend setup (in new terminal)
cd client
npm install
npm run dev

# Open browser: http://localhost:5173
```

### Database Initialization

SQLite database is auto-created on first server start:

```bash
# Database file created at:
server/data/prism.db

# Schema applied automatically from:
server/db/schema.sql
```

---

## API Keys

### OpenAI

1. Go to https://platform.openai.com/api-keys
2. Create a new key with GPT-4o-mini access
3. Add to `.env` as `OPENAI_API_KEY`

**Free tier:** $5 credit for new accounts. Sufficient for ~200 structuring calls.

### Missing-Key Behavior

If `OPENAI_API_KEY` is not set:
- Content structuring falls back to **deterministic paragraph splitting**
- Simplification falls back to **dictionary word replacement + sentence splitting**
- Question generation falls back to **generic self-assessment questions**
- Visual descriptions are **not generated** (empty)
- A warning is logged: `"OPENAI_API_KEY not set — using deterministic fallback mode"`
- The application remains fully functional with reduced adaptation quality

---

## Optional Dependencies

| Dependency | Required For | Fallback If Missing |
|-----------|-------------|-------------------|
| OpenDyslexic font | Dyslexia profile | Arial, sans-serif |
| Atkinson Hyperlegible font | Low Vision profile | Verdana, sans-serif |
| Tesseract.js trained data | OCR (image-based PDFs) | Return error, suggest text paste |

---

## Database Configuration

```javascript
// server/db/index.js
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'prism.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
```

---

## Development vs Production

| Setting | Development | Production |
|---------|------------|------------|
| `NODE_ENV` | `development` | `production` |
| CORS | `http://localhost:5173` | Deployed frontend URL |
| DB_PATH | `./data/prism.db` | `/data/prism.db` (persistent volume) |
| Frontend | Vite dev server (HMR) | Static build (`npm run build`) |
| Logging | Console (verbose) | Console (errors only) |
| LLM_TIMEOUT | 15000 | 10000 |

---

## Directory Structure

```
no_semicolon-hackathon/
├── docs/                    # Documentation (24 files)
├── client/                  # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── styles/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── tests/
│   ├── package.json
│   └── vite.config.js
├── server/                  # Express backend
│   ├── routes/
│   ├── skills/
│   ├── prompts/
│   ├── db/
│   │   ├── schema.sql
│   │   └── index.js
│   ├── data/                # SQLite database (gitignored)
│   ├── tests/
│   ├── server.js
│   └── package.json
├── .env.example
├── .gitignore
└── README.md
```
