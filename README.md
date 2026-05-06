# Mockingbird — AI Interview Practice

A web app that runs realistic mock interviews powered by an LLM. You give it your
resume + job description, pick the type (behavioral / technical / system design / coding)
and seniority, and it drills you with questions, scores each answer, and produces a final
report.

This is **Phase 1 + 2** of a larger plan — the text-only Q&A loop. Voice (mic + TTS) lands
in Phase 3.

## What's in here

- Next.js 15 (App Router, Turbopack) + React 19 + Tailwind v4
- OpenAI Chat Completions with structured outputs (JSON Schema) for reliable parsing
- In-memory session store (single user, resets on server restart — fine for local use)
- PDF/TXT resume upload via `pdf-parse`

## Quick start

```bash
cp .env.example .env.local
# edit .env.local and paste your OpenAI key

npm install
npm run dev
```

Open <http://localhost:3000>.

## Required env vars

| Var | Required | Default |
|---|---|---|
| `OPENAI_API_KEY` | yes | — |
| `OPENAI_MODEL` | no | `gpt-4o-mini` |

Get a key at <https://platform.openai.com/api-keys>. The default model is intentionally
cheap (`gpt-4o-mini`) — a 5-question session usually costs well under $0.05.

## How it works

```text
                ┌──────────────┐
   /setup ─────►│ POST start   │── generateNextQuestion ──► OpenAI
                └──────┬───────┘
                       ▼
                  sessionId
                       │
                       ▼
            /interview/[id]
                       │
        type answer ──►│
                       ▼
                ┌──────────────┐
                │ POST answer  │── evaluateAnswer ────────► OpenAI
                │              │── generateNextQuestion ──► OpenAI
                └──────┬───────┘
                       ▼
        feedback + next question (or final report)
                       │
                       ▼
                /report/[id]
```

### Files of interest

- `src/lib/llm.ts` — all OpenAI calls + JSON-Schema structured outputs. Three functions:
  `generateNextQuestion`, `evaluateAnswer`, `generateFinalReport`.
- `src/lib/store.ts` — in-memory session store (uses `globalThis` so it survives Next.js
  HMR in dev).
- `src/lib/types.ts` — shared types: `Session`, `Turn`, `Feedback`, `FinalReport`.
- `src/app/api/interview/*` — the three API routes (start, get, answer).
- `src/app/setup/page.tsx` — config form + resume upload.
- `src/app/interview/[id]/page.tsx` — the live Q&A loop.
- `src/app/report/[id]/page.tsx` — end-of-session report with per-question detail.

## What's NOT here yet (next phases)

- **Phase 3 — Voice:** real-time STT (Deepgram or Whisper) + TTS for the interviewer.
- **Phase 4 — Persistence:** Supabase for accounts + session history (right now sessions
  live in memory and disappear when the server restarts).
- **Phase 5 — Polish:** charts (filler word trend, score over time), PDF export, model
  switcher, prompt-tuning UI.

## Why this exists

This tool is for practicing **before** an interview, not assistance **during** one.
Faking a live interview hurts the candidate (job mismatch), the company (bad hire), and
the industry (more invasive proctoring for everyone). Practice hard, then go in honest.

## License

MIT.
