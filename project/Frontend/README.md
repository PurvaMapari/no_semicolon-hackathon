# AdaptLearn — Exact Screen Recreation

This version is rebuilt from the supplied PDF reference screens rather than from the flow diagram alone.

Implemented reference screens:
1. Content Ingest & Profile Selection
2. Adaptive Reader with Web Speech
3. Practice / Mastery Gate
4. Learner Profile / Progress & Badges
5. Struggle Score & Adaptation Analytics

The layout is intentionally mobile-first at the same narrow visual proportion as the supplied references, with matching:
- header and bottom navigation
- spacing and card hierarchy
- typography scale
- lavender/blue/green/orange palette
- labels and copy from the references
- progress bars, pills, controls and interaction states
- learning, practice and adaptation flows

Run:
npm install
npm run dev

This is a frontend recreation. Backend functionality such as PDF.js/OCR, Groq, SQLite and real telemetry is not connected yet.
