# Mockingbird — AI Interview Practice

A web app that runs realistic mock interviews powered by an LLM. You give it your
resume + job description, pick the type (behavioral / technical / system design / coding)
and seniority, and it drills you with questions, scores each answer, and produces a final
report.

**Phases 1–5 complete.** All planned functionality shipped:

- ✅ Phase 1 — Setup form + scaffolding
- ✅ Phase 2 — Question generation, per-answer feedback, final report
- ✅ Phase 3 — Voice mode (browser-native TTS + STT, hands-free)
- ✅ Phase 4 — File-backed persistence + sessions history page
- ✅ Phase 5 — Streaming feedback (token-by-token) + Print/PDF export

## What's in the stack

- Next.js 16 (App Router, Turbopack) + React 19 + Tailwind v4
- OpenAI Chat Completions with **JSON Schema structured outputs** (reliable parsing)
- **Streaming** via Server-Sent Events + a forgiving partial-JSON parser so feedback
  appears word-by-word
- **File-backed session store** (`./.data/sessions.json`, atomic writes) — sessions
  survive restarts
- **Browser-native voice**: `SpeechSynthesisUtterance` for TTS, `SpeechRecognition`
  for STT. No API keys, no extra costs. Works in Chrome / Edge / Safari (Firefox
  has TTS but no STT).
- PDF/TXT resume upload via `pdf-parse`
- Print/Save-as-PDF for reports via browser-native `window.print()` + print stylesheet

## Quick start

```bash
cp .env.example .env.local
# paste your OpenAI key into .env.local

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
   type/speak answer ─►│
                       ▼
        ┌──────────────────────────┐
        │ POST answer/stream (SSE) │
        │  • evaluateAnswer        │── streaming JSON ──► OpenAI
        │  • generateNextQuestion  │
        │  OR                      │
        │  • generateFinalReport   │
        └──────────┬───────────────┘
                   │
   stream of SSE events flowing back:
       feedback-delta (live partial JSON) →
       feedback-complete (parsed Feedback) →
       next-question OR final-report →
       done
                   │
                   ▼
              UI updates live
                   │
                   ▼
            /report/[id]   (or /sessions for history)
```

## Voice mode

Toggle "Voice mode" on the setup page (or the Voice button on the interview page).
What changes:

1. The interviewer's question is **spoken aloud** via the OS's best English voice
   (we prefer Samantha / Daniel on macOS, Microsoft Zira on Windows).
2. The mic auto-starts after the question finishes speaking.
3. Your speech is transcribed live into the answer textarea — you can still edit
   before submitting.
4. Submit normally. The next question speaks automatically.

Because we use the browser's built-in speech APIs, there's **zero extra cost** and
**no extra API keys** beyond OpenAI. The trade-off: STT goes through Google's
cloud service in Chrome/Edge (audio leaves the device but no key required), and
quality depends on your browser.

| Browser | TTS | STT |
|---|---|---|
| Chrome | ✅ | ✅ (best quality) |
| Edge | ✅ | ✅ |
| Safari | ✅ | ✅ macOS 14.5+ |
| Firefox | ✅ | ❌ (no implementation) |

## Files of interest

```text
src/
├── app/
│   ├── page.tsx                       # landing
│   ├── setup/page.tsx                 # form + voice-mode toggle
│   ├── sessions/page.tsx              # history list
│   ├── interview/[id]/page.tsx        # streaming + voice Q&A loop
│   ├── report/[id]/page.tsx           # final report (printable)
│   └── api/
│       ├── interview/start/           # POST: create session, gen Q1
│       ├── interview/[id]/            # GET session
│       ├── interview/[id]/answer/     # POST (legacy non-stream)
│       ├── interview/[id]/answer/stream/  # POST → SSE (streaming)
│       ├── interview/[id]/delete/     # POST
│       ├── sessions/                  # GET list
│       └── upload/resume/             # POST PDF/TXT → text
└── lib/
    ├── types.ts        # Session, Turn, Feedback, FinalReport
    ├── store.ts        # file-backed sessions store
    ├── llm.ts          # OpenAI calls (incl. evaluateAnswerStream)
    ├── partial-json.ts # forgiving streaming JSON parser
    ├── sse.ts          # tiny SSE client (fetch-based)
    └── voice.ts        # TTS + STT browser wrappers
```

## What's still possible (future polish)

- Charts on the report (filler-word trend, score-over-time across multiple sessions)
- Multi-user auth (currently single-user, file-store)
- True local STT (Whisper.cpp via WebAssembly) for privacy
- A "company-specific question bank" trained on Glassdoor data
- Mobile-first PWA so you can practice on the train

## Why this exists

This tool is for practicing **before** an interview, not assistance **during** one.
Faking a live interview hurts the candidate (job mismatch), the company (bad hire), and
the industry (more invasive proctoring for everyone). Practice hard, then go in honest.

## License

MIT.
