# PRISM — Deployment

---

## Architecture

```
[Browser] ←→ [Vercel CDN (Frontend)] ←→ [Render (Backend + SQLite)]
```

---

## Frontend Deployment

### Platform: Vercel (Free Tier)

**Steps:**

1. Connect GitHub repository to Vercel
2. Set build settings:
   - **Framework:** Vite
   - **Root directory:** `client`
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
3. Set environment variable:
   - `VITE_API_URL` = backend URL (e.g., `https://prism-api.onrender.com`)
4. Deploy

### Build Command

```bash
cd client
npm run build
# Output: client/dist/
```

### Vercel Configuration (`client/vercel.json`)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

---

## Backend Deployment

### Platform: Render (Free Tier)

**Steps:**

1. Connect GitHub repository to Render
2. Create a new **Web Service**
3. Set configuration:
   - **Root directory:** `server`
   - **Build command:** `npm install`
   - **Start command:** `node server.js`
   - **Runtime:** Node.js 20
4. Set environment variables:
   - `OPENAI_API_KEY` = your key
   - `NODE_ENV` = `production`
   - `PORT` = `10000` (Render default)
   - `CORS_ORIGIN` = frontend URL (e.g., `https://prism-app.vercel.app`)
   - `DB_PATH` = `/data/prism.db`
5. Add a **Persistent Disk** (if available on free tier):
   - Mount path: `/data`
   - Size: 1 GB
6. Deploy

**Note:** Render free tier spins down after 15 minutes of inactivity. First request after sleep takes ~30 seconds. For demo, visit the URL 1 minute before presenting.

---

## Database

### SQLite in Production

SQLite runs embedded in the Node.js process. No separate database server.

**Persistent storage:**
- Render persistent disk at `/data/prism.db`
- If persistent disk not available, database resets on each deploy (acceptable for MVP demo)

**Schema initialization:**
```javascript
// server/server.js
const db = require('./db');
const fs = require('fs');
const schema = fs.readFileSync('./db/schema.sql', 'utf-8');
db.exec(schema);
```

---

## Environment Variables (Production)

### Frontend (Vercel)

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://prism-api.onrender.com` |

### Backend (Render)

| Variable | Value |
|----------|-------|
| `OPENAI_API_KEY` | `sk-proj-...` |
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `CORS_ORIGIN` | `https://prism-app.vercel.app` |
| `DB_PATH` | `/data/prism.db` |
| `LLM_MODEL` | `gpt-4o-mini` |
| `LLM_TIMEOUT` | `10000` |
| `MAX_UPLOAD_SIZE` | `10485760` |

---

## CORS

```javascript
// server/server.js
const cors = require('cors');

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: false
}));
```

**Development:** `http://localhost:5173`
**Production:** Vercel frontend URL (e.g., `https://prism-app.vercel.app`)

---

## Health Check

### Endpoint

```
GET /api/health
```

### Response

```json
{
  "status": "ok",
  "version": "1.0.0",
  "database": "connected",
  "timestamp": "2026-09-11T14:00:00.000Z"
}
```

### Render Health Check Configuration

- **Health Check Path:** `/api/health`
- **Expected status:** 200

---

## Production Smoke Test

Run after every deployment:

```bash
# 1. Health check
curl https://prism-api.onrender.com/api/health
# Expected: { "status": "ok", "database": "connected" }

# 2. Upload test text
curl -X POST https://prism-api.onrender.com/api/upload \
  -H "Content-Type: application/json" \
  -d '{"text": "Test paragraph for PRISM.", "title": "Test"}'
# Expected: { "success": true, "documentId": "..." }

# 3. Frontend loads
curl -s -o /dev/null -w "%{http_code}" https://prism-app.vercel.app
# Expected: 200
```

---

## Fallback Behavior

| Failure | Behavior |
|---------|----------|
| Backend down | Frontend shows error: "Backend unavailable. Check connection." |
| Database corrupted | Server recreates schema on restart (data lost) |
| OpenAI API down | Deterministic fallback mode (reduced adaptation quality) |
| Render cold start | ~30s delay on first request after sleep |
| Vercel build failure | Previous deployment stays live |

---

## Deployment Checklist

- [ ] Frontend builds without errors (`npm run build`)
- [ ] Backend starts without errors (`node server.js`)
- [ ] Environment variables set on both platforms
- [ ] CORS_ORIGIN matches frontend URL
- [ ] Health check returns 200
- [ ] Upload endpoint works
- [ ] Content retrieval works
- [ ] SCALE evaluate endpoint works
- [ ] Frontend connects to backend (no CORS errors)
- [ ] Golden-path demo works end-to-end
- [ ] Voice works on Chrome/Edge (HTTPS required for microphone)
