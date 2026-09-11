# PRISM Tech Stack Document

## Architecture Summary

PRISM is designed for **maximum development velocity with minimal dependencies**. The stack prioritizes free-tier or open-source options that are well-documented, actively maintained, and can be implemented in 24 hours by a small team.

## Tech Stack by Layer

### Frontend

**Framework: React 18 + Vite**

- **Why this, why fast:** React provides component-based architecture with extensive ecosystem support. Vite delivers instant server start and hot module replacement. Together they enable rapid prototyping and component iteration. Both are free, open-source, and require no build server.

- **Alternative (free):** Next.js 14 (SSR capability, but overkill for MVP; Vite is lighter and faster for pure client-side app)

**Styling: Tailwind CSS (via CDN for MVP)**

- **Why this, why fast:** Utility-first CSS with zero configuration for MVP. Can be switched to CSS-in-JS or SCSS later. CDN version requires no build step, perfect for 24-hour sprint.

- **Alternative (free):** CSS Modules or plain CSS with BEM naming. Tailwind is faster for initial development.

**State Management: React Context + useReducer**

- **Why this, why fast:** Built into React. No external dependency. Sufficient for MVP state needs (learner profile, content chunks, session state).

- **Alternative (free):** Zustand (lightweight, but adds dependency) or Jotai (similar). Context is sufficient for MVP.

**Form Handling: Controlled inputs + simple state**

- **Why this, why fast:** Native HTML form elements with React state. No form library needed for MVP forms (profile settings, text input).

- **Alternative (free):** React Hook Form (overkill for MVP forms with <10 fields)

**Date/Time: Native Date API**

- **Why this, why fast:** Built into JavaScript. No external library needed for timestamp tracking.

- **Alternative (free):** Day.js or date-fns (overkill for simple timestamp storage)

---

### Backend

**Runtime: Node.js 20+**

- **Why this, why fast:** Async I/O model fits AI inference pattern (wait for LLM, return result). Same language as frontend reduces context switching. Free, open-source, and widely available.

- **Alternative (free):** Deno (modern, but smaller ecosystem). Python (FastAPI) is excellent but would require separate runtime environment.

**Web Framework: Express.js**

- **Why this, why fast:** Minimal, unopinionated framework. Simple to set up single API endpoint for adaptation service. Mature ecosystem.

- **Alternative (free):** Fastify (faster, but more setup) or Hono (modern, serverless-ready but overkill for MVP)

**API Style: REST**

- **Why this, why fast:** Simple POST /api/adapt endpoint. No complex routing needed for MVP.

- **Alternative (free):** GraphQL (Apollo Server) - adds complexity for no benefit at MVP scale

**Queue/Task Processing: None (synchronous for MVP)**

- **Why this, why fast:** Single LLM call per adaptation, no batching needed for 24-hour build. Synchronous request/response is sufficient.

- **Alternative (free):** Bull (Redis queue) or Agenda (MongoDB-based) - for future scale

---

### AI/Model

**Model Provider: OpenAI GPT-4o-mini**

- **Why this, why fast:** Fastest available model with strong performance on content simplification tasks. Low cost (~$0.15/1M tokens). Well-documented API. Free tier available via credits.

- **Free-tier alternative (open-source):** Mistral 7B (via免费 host like Hugging Face Inference API or Groq)
  - **Tradeoff:** Slower inference (~3-5 seconds vs ~1-2 seconds for GPT-4o-mini), needs optimization

- **Fully self-hosted alternative (open-source):** TinyLlama or Phi-2 (quantized 4-bit)
  - **Tradeoff:** Requires GPU or CPU optimization; Hugging Face Transformers setup adds complexity

**Prompt Engineering Strategy: Few-shot + chain-of-thought**

- **Why this, why fast:** Template-based prompts with examples. No fine-tuning needed. Can iterate prompts during MVP build.

**Fallback Mechanism: Heuristic simplification**

- **Why this, why fast:** If LLM fails, apply deterministic rules: replace complex words from dictionary, limit sentence length to 20 words, break paragraphs >5 sentences into 2-3 sentences.

---

### Database

**No database for MVP**

- **Why this, why fast:** localStorage covers all MVP needs (learner profile, session progress, question answers). No user accounts = no database required.

- **Free-tier alternative (for future):** Supabase (PostgreSQL + Auth + Storage, free tier 500MB storage)
  - **When to adopt:** When adding user accounts, cloud sync, or multi-device persistence

- **Open-source alternative (self-hosted):** SQLite with better-sqlite3 (for local file storage)

---

### Hosting/Deployment

**Frontend: Vercel (Free Tier)**

- **Why this, why fast:** One-click deploy from git. Automatic SSL, CDN, and edge functions. Free tier sufficient for MVP traffic (unlimited sites, 100GB bandwidth/month).

- **Alternative (free):** Netlify (similar, 300 build minutes/month free)

**Backend: Vercel Serverless Functions or Render (Free Tier)**

- **Why this, why fast:** Vercel Serverless Functions let you deploy Express API alongside frontend. Render offers free web services with PostgreSQL option.

- **Alternative (free):** Fly.io (free tier, good for simple Node.js apps)

---

### PDF Processing

**PDF.js (Mozilla)**

- **Why this, why fast:** Open-source, client-side PDF text extraction. No backend needed for MVP.

- **Alternative (free):** pdf-lib (for PDF manipulation, not text extraction)

---

### Text-to-Speech (TTS)

**Web Speech API (Native Browser TTS)**

- **Why this, why fast:** Built into modern browsers (Chrome, Edge, Safari). No external dependency. Free and unlimited.

- **Tradeoff:** Quality varies by browser. For consistent quality, need paid service.

- **Free-tier paid alternative:** Google Cloud Text-to-Speech (free tier 4M characters/month)

- **Open-source alternative:**marytts (self-hosted, more setup required)

---

### Audio Playback

**Native HTML5 Audio API**

- **Why this, why fast:** Built-in. Supports playback control, events, and simple waveform analysis for highlighting sync.

- **Alternative (free):** Howler.js (for complex audio scenarios, overkill for MVP)

---

### Logging/Monitoring

**Console logging (MVP)**

- **Why this, why fast:** No logging infrastructure needed for MVP debugging.

- **Free-tier alternative:** Sentry (free tier for error tracking)

---

### CI/CD

**GitHub Actions (Free for public repos)**

- **Why this, why fast:** Automatic deploy to Vercel on push to main branch. Zero configuration needed.

---

## Complete Tech Stack Table

| Layer | Component | Choice | Why | Free Alternative | Status |
|-------|-----------|--------|-----|------------------|--------|
| **Frontend Framework** | React | 18 + Vite | Fast iteration, hot reload | Next.js | ✅ Free |
| **Styling** | Tailwind CSS | CDN + config | Zero-config MVP | Plain CSS | ✅ Free |
| **State Management** | React Context | Built-in | No dependency | Zustand | ✅ Free |
| **Backend Runtime** | Node.js | 20+ | Async I/O, same lang as FE | Deno | ✅ Free |
| **Backend Framework** | Express | 4.x | Minimal, mature | Fastify | ✅ Free |
| **API Style** | REST | Simple POST | Sufficient for MVP | GraphQL | ✅ Free |
| **AI Model** | GPT-4o-mini | OpenAI | Fast, reliable, low cost | Mistral 7B (Hugging Face) | ⚠️ Free tier available |
| **Fallback AI** | Heuristic rules | Deterministic | No cost, always available | N/A | ✅ Free |
| **PDF Processing** | PDF.js | Mozilla | Client-side, open-source | N/A | ✅ Free |
| **Database** | None | localStorage | No accounts needed | Supabase (PostgreSQL) | ⚠️ Free tier |
| **Hosting (FE)** | Vercel | Free tier | One-click deploy | Netlify | ✅ Free |
| **Hosting (BE)** | Vercel Serverless | Free tier | Same platform, simple | Render | ✅ Free |
| **TTS** | Web Speech API | Native | Free, no config | Google Cloud TTS | ⚠️ Free tier |
| **Audio** | HTML5 Audio | Native | Built-in | Howler.js | ✅ Free |
| **Logging** | Console | Built-in | MVP only | Sentry | ⚠️ Free tier |
| **CI/CD** | GitHub Actions | Public repos | Automatic deploy | GitLab CI | ✅ Free |

---

## Cost Estimate (24-hour build, no users)

| Service | Free Tier Limit | Estimated Usage | Cost |
|---------|----------------|-----------------|------|
| OpenAI API | $5 credit | ~100 adaptations (1k tokens each) | **$0** (within credit) |
| Vercel | Unlimited sites | 1 site | **$0** |
| GitHub Actions | 2,000 min/month | ~30 min for deploy | **$0** |
| Web Speech API | Free | 100% free | **$0** |
| PDF.js | Open-source | Free | **$0** |
| **Total** | | | **$0** |

---

## Single-Command Setup (Developer Experience)

```bash
# Frontend
npx create-vite@latest prism-fe -- --template react
cd prism-fe && npm install
npm run dev  # Instant server start

# Backend
mkdir prism-be && cd prism-be
npm init -y && npm install express cors
# Create server.js with /api/adapt endpoint
node server.js  # Instant API
```

Both frontend and backend run locally with **no configuration files required** for MVP.