# PRISM — Tech Stack

## Architecture Summary

PRISM uses a **cache-first AI architecture** with a deterministic live path. Every layer has ONE primary choice with a free/open-source fallback. Stack optimized for 24-hour hackathon velocity.

---

## Tech Stack by Layer

### Frontend

| Component | Primary Choice | Why | Free Fallback |
|-----------|---------------|-----|---------------|
| **Framework** | React 18 + Vite | Component-based, hot reload, vast ecosystem | Preact (lighter, API-compatible) |
| **Styling** | Tailwind CSS v3 (CDN) | Utility-first, zero-config for MVP, fast iteration | Plain CSS with BEM |
| **State Management** | React Context + useReducer | Built-in, no dependency, sufficient for MVP | Zustand |
| **Form Handling** | Controlled inputs | Native HTML + React state, minimal forms | React Hook Form |

### Backend

| Component | Primary Choice | Why | Free Fallback |
|-----------|---------------|-----|---------------|
| **Runtime** | Node.js 20 LTS | Same language as frontend, async I/O | Deno |
| **Framework** | Express.js 4.x | Minimal, mature, fast setup | Fastify |
| **API Style** | REST (JSON) | Simple endpoints, sufficient for MVP | — |

### Database

| Component | Primary Choice | Why | Free Fallback |
|-----------|---------------|-----|---------------|
| **Database** | SQLite (better-sqlite3) | Embedded, zero-config, single file, no infra | localStorage (browser-only fallback) |

**Why SQLite:** Stores the content graph, cached LLM outputs, learner profiles, session data, and adaptation history. Embedded in the Node.js process — no separate database server. Single `.db` file.

### AI / LLM

| Component | Primary Choice | Why | Free Fallback |
|-----------|---------------|-----|---------------|
| **Model** | GPT-4o-mini (OpenAI) | Fast (1–2s), low cost (~$0.15/1M tokens), strong at content tasks | Groq (Llama 3, free tier) |
| **Prompt Strategy** | Few-shot + JSON mode | Template-based, no fine-tuning needed | Same |
| **Fallback** | Deterministic heuristics | Dictionary word replacement, sentence splitting, no cost | — |

**Important:** LLM is used ONLY at upload time for content structuring and pre-generation. Never in the live adaptation hot path.

### PDF Extraction

| Component | Primary Choice | Why | Free Fallback |
|-----------|---------------|-----|---------------|
| **Text-based PDFs** | PDF.js (Mozilla) | Open-source, well-maintained, server-side via `pdfjs-dist` | pdf-parse |
| **OCR Fallback** | Tesseract.js | Open-source, runs in Node.js, handles image-based PDFs | None (return error, suggest text paste) |

### Voice

| Component | Primary Choice | Why | Free Fallback |
|-----------|---------------|-----|---------------|
| **Speech-to-Text (STT)** | Web Speech Recognition API | Free, built into Chrome/Edge, no API key | Text input fallback |
| **Text-to-Speech (TTS)** | Web Speech Synthesis API | Free, built into all modern browsers, no API key | Text-only display |

**Important:** Voice is a Day-1 feature, not a stretch goal. Browser-native APIs ensure zero cost and instant availability.

### Validation

| Component | Primary Choice | Why | Free Fallback |
|-----------|---------------|-----|---------------|
| **Schema Validation** | Zod | TypeScript-first, great DX, validates LLM outputs | Joi |

### Testing

| Component | Primary Choice | Why | Free Fallback |
|-----------|---------------|-----|---------------|
| **Unit Tests** | Vitest | Fast, Vite-native, Jest-compatible API | Jest |
| **E2E / Accessibility** | Playwright | Cross-browser, built-in accessibility testing | Cypress |
| **API Tests** | Supertest | Express-native, simple HTTP assertions | — |

### Deployment

| Component | Primary Choice | Why | Free Fallback |
|-----------|---------------|-----|---------------|
| **Frontend Hosting** | Vercel (Free Tier) | One-click deploy from git, automatic SSL/CDN | Netlify |
| **Backend Hosting** | Render (Free Tier) | Free web services, supports Node.js + SQLite | Railway |
| **CI/CD** | GitHub Actions | Free for public repos, automatic deploy on push | GitLab CI |

---

## Complete Stack Table

| Layer | Choice | Version | Cost | Notes |
|-------|--------|---------|------|-------|
| Frontend | React + Vite | 18.x + 5.x | ✅ Free | — |
| Styling | Tailwind CSS | 3.x (CDN) | ✅ Free | — |
| State | Context + useReducer | Built-in | ✅ Free | — |
| Backend | Node.js + Express | 20 LTS + 4.x | ✅ Free | — |
| Database | SQLite | better-sqlite3 | ✅ Free | Embedded, single file |
| AI/LLM | GPT-4o-mini | OpenAI API | ⚠️ ~$0.15/1M tokens | Free tier credits available |
| PDF Extraction | PDF.js | pdfjs-dist | ✅ Free | — |
| OCR | Tesseract.js | 5.x | ✅ Free | Best-effort for image PDFs |
| STT | Web Speech Recognition | Browser API | ✅ Free | Chrome/Edge |
| TTS | Web Speech Synthesis | Browser API | ✅ Free | All modern browsers |
| Validation | Zod | 3.x | ✅ Free | — |
| Unit Tests | Vitest | 1.x | ✅ Free | — |
| E2E Tests | Playwright | 1.x | ✅ Free | — |
| API Tests | Supertest | 6.x | ✅ Free | — |
| Frontend Hosting | Vercel | Free tier | ✅ Free | — |
| Backend Hosting | Render | Free tier | ✅ Free | — |
| CI/CD | GitHub Actions | Free tier | ✅ Free | — |

---

## Cost Estimate (24-Hour Build)

| Service | Free Tier Limit | Estimated Usage | Cost |
|---------|----------------|-----------------|------|
| OpenAI API | $5 credit | ~200 structuring calls | **$0** (within credit) |
| Vercel | Unlimited sites | 1 site | **$0** |
| Render | Free web service | 1 service | **$0** |
| GitHub Actions | 2,000 min/month | ~30 min | **$0** |
| Web Speech APIs | Free | Unlimited | **$0** |
| **Total** | | | **$0** |

---

## Project Setup Commands

```bash
# Frontend
npx -y create-vite@latest ./ -- --template react
npm install
npm install -D tailwindcss@3
npm run dev

# Backend
mkdir server && cd server
npm init -y
npm install express cors better-sqlite3 pdfjs-dist tesseract.js zod openai uuid
npm install -D vitest supertest
node server.js

# Full project dependencies
npm install @anthropic-ai/sdk  # Only if using Anthropic as fallback
```

---

## Dependency Summary

### Frontend (`package.json`)
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "vitest": "^1.0.0",
    "@playwright/test": "^1.40.0"
  }
}
```

### Backend (`server/package.json`)
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "better-sqlite3": "^9.0.0",
    "pdfjs-dist": "^4.0.0",
    "tesseract.js": "^5.0.0",
    "zod": "^3.22.0",
    "openai": "^4.0.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "supertest": "^6.3.0"
  }
}
```