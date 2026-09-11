# Pramaan.AI — Proof of Skill for India's Workforce

A real full-stack app: **React frontend + Express backend + SQLite database**,
with an AI engine doing the skill grading, training-capsule writing, resume
generation, and candidate matching. Built for the "AI-Based National Skill
Matching and MSME Workforce Platform" problem statement.

The AI engine is **pluggable**: run it on the Anthropic cloud API, or on your
own fine-tuned local model (see `ai-engine/README.md`) with zero code changes
to the routes — just a `.env` switch.

```
pramaan-ai/
├── backend/         Express API + SQLite database
│   ├── src/
│   │   ├── db.js              schema + connection
│   │   ├── server.js          app entry point
│   │   ├── middleware/auth.js JWT auth + role guards
│   │   ├── lib/ai.js          provider switch: cloud vs local
│   │   ├── lib/claude.js      Anthropic API wrapper (+ optional training-data logging)
│   │   ├── lib/localAI.js     client for your own fine-tuned model (via Ollama)
│   │   └── routes/            auth, workers, jobs, applications, trials
│   ├── scripts/seed.js        sample data: workers, jobs, applications, a trial
│   ├── .env.example
│   └── package.json
├── ai-engine/       Fine-tuning pipeline for your own local model ("setu-ai" in Ollama)
│   ├── README.md              full walkthrough: data → training → serving
│   ├── data/                  seed dataset + real-usage logs → train.jsonl
│   ├── train.py                QLoRA fine-tune (runs on your GPU)
│   └── export_gguf.sh          quantize + load into Ollama
└── frontend/        React (Vite) single-page app
    ├── src/
    │   ├── App.jsx             session + routing
    │   ├── api.js              fetch client for the backend
    │   ├── i18n.js              English / Hindi / Tamil dictionary
    │   ├── components/         Sidebar, shared UI atoms
    │   └── pages/               Auth, Overview, WorkerAssessment, Resume,
    │                            BrowseJobs, MsmePost, Postings, Match, Passport
    └── package.json
```

## Architecture

```
 React (Vite)  ── fetch ──▶  Express API  ── SQL ──▶  SQLite (setu.db)
      │                          │
      │                          └── AI_PROVIDER=cloud ──HTTPS──▶ Anthropic API
      │                          └── AI_PROVIDER=local ──HTTP───▶ Ollama (your
      │                                                            own fine-tuned model)
      └── JWT stored in localStorage, sent as Authorization: Bearer <token>
```

- **Frontend** never talks to the AI provider directly — every AI call goes
  through the backend, so no credentials (or, in local mode, no data at all)
  reach the browser or leave your infrastructure.
- **Auth** is real: bcrypt-hashed passwords, JWT sessions, role-gated routes
  (`worker` vs `msme`) enforced server-side, not just hidden in the UI.
- **Database** is SQLite via `better-sqlite3` — a single file
  (`backend/data/setu.db`), zero external services to stand up. Swappable for
  Postgres/MySQL later since all access goes through `db.js`.

## Quick start

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Default is AI_PROVIDER=cloud — paste a real ANTHROPIC_API_KEY to enable the
# AI features (skill grading, training capsules, resumes, matching).
# Everything else (signup, login, posting, browsing, applying) works without it.
# Want your own model instead of the cloud? See ai-engine/README.md, then set
# AI_PROVIDER=local here.
npm start
```

Runs on `http://localhost:4000`. `GET /api/health` reports whether the key is
configured.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173` and proxies `/api/*` to the backend
automatically (see `vite.config.js`) — no CORS setup needed in dev.

### 3. Load sample data (optional, but the fastest way to test)

```bash
cd backend
node scripts/seed.js          # adds sample data, safe to re-run
node scripts/seed.js --reset  # wipes all tables first, then reseeds
```

This creates 3 MSME accounts (each with a live job posting), 5 worker
accounts (each with a verified Skill Credit Score profile), a couple of
applications, and one trial already in progress — so every screen has
something real to show immediately. Log in with any of these usernames,
password `setu123` for all of them:

| MSME owners | Workers |
|---|---|
| `shantimetal` | `ravi.kumar` |
| `rajgarments` | `suresh.yadav` |
| `coastalelectric` | `muthu.raman`, `priya.devi`, `anil.mestri` |

Try: log in as `shantimetal` → **My postings → Run AI match** to see it rank
the seeded welders; or log in as `ravi.kumar` → **Skill passport / My
resume** to see an already-issued credential.

### 4. Try the full loop from scratch

1. Sign up as a **Worker**, run a skill check, issue the credential, generate
   a resume in Hindi or Tamil.
2. Sign up again (different username) as an **MSME owner**, describe a
   machine/task, post the need.
3. As the worker, go to **Browse jobs** and apply.
4. As the MSME, go to **My postings → Run AI match** and watch it rank the
   worker you just created, with a plain-English rationale.
5. Start a 3-day trial from the match card — the micro-apprenticeship /
   trial-to-hire step before a full offer.

## Production build

To serve everything from one process (what you'd actually deploy):

```bash
cd frontend && npm run build      # writes frontend/dist
cd ../backend && npm start        # now also serves the built frontend
```

Visit `http://localhost:4000` — the backend detects `frontend/dist` and
serves it directly, so the whole app runs from a single Node process and a
single port.

## Notes for judges / graders

- `backend/src/routes/*.js` map 1:1 to the "3 killer differentiators" from
  the pitch: `workers.js` → Skill Credit Score + anti-generic grading,
  `jobs.js` → reverse skilling (capsule generation) + Beckn-style matching,
  `workers.js` resume route → portable, multilingual credentials.
- The database schema in `db.js` is the ledger described in the pitch:
  `workers` (passport), `jobs` (network demand), `applications` +
  `trials` (the hiring funnel between them).
- Passwords are bcrypt-hashed and JWTs are short-lived-configurable; this is
  still a hackathon prototype, so don't point it at production traffic
  without a security review (rate limiting, HTTPS termination, secret
  rotation, etc.).
