# Forge — Sovereign On-Premise Agentic AI Workbench

**SIH 2026 · Problem Statement ID 26117 · Team LexCorps**

An on-premise, agentic AI workbench for confidential industrial work — built for
organizations (refineries, PSUs, defence-linked manufacturing) that cannot send
P&IDs, financials, inspection reports, or internal correspondence to public cloud
AI tools. Everything here — model inference, document indexing, code execution,
audit logging — runs on the local machine. Nothing is hardcoded or mocked: every
number and status shown in the UI is read live from a running backend.

## What it does

- **Task-aware model routing** — classifies each task (document / coding /
  multimodal / general) and routes it to the best locally available open-weight
  model, live from [Ollama](https://ollama.com)'s registry. New models become
  available the moment you `ollama pull` them — no code changes needed.
- **Agentic execution** — a [LangGraph](https://langchain-ai.github.io/langgraph)
  state machine takes a task through classify → route → retrieve (RAG) →
  generate → score confidence → produce a deliverable → audit, with every
  step streamed to the UI in real time over SSE.
- **Private document grounding (RAG)** — PDFs, scans, and text files are
  ingested, OCR'd on-device (RapidOCR, no external service), chunked, embedded
  (FastEmbed / BGE-small), and indexed in [Qdrant](https://qdrant.tech) running
  in embedded/local mode (no separate server process). Retrieved chunks are
  cited with source, page, and cosine similarity score.
- **Real deliverables** — completed tasks generate actual `.docx` approval
  notes (via `python-docx`), not just chat replies.
- **Code sandbox** — arbitrary code runs in a Docker container with
  `--network none` when Docker is available; falls back to a restricted local
  subprocess (and says so honestly) when it isn't.
- **Zero-egress proof** — a live network monitor (`psutil`) reports actual
  external connections on the host, not a static claim. The UI reflects this
  in real time in the sidebar, topbar, and Audit page.

## Architecture

```
frontend/   React + TypeScript + Tailwind v4 (Vite) — SPA, polls/streams the API
backend/    FastAPI (Python) — model router, agent orchestrator, RAG, sandbox, audit
```

| Layer                 | Implementation                                                |
|-----------------------|----------------------------------------------------------------|
| Model serving          | [Ollama](https://ollama.com) (OpenAI-compatible local API)    |
| Agent orchestration    | [LangGraph](https://langchain-ai.github.io/langgraph) explicit state machine |
| Document intelligence  | PyMuPDF (native PDF text) + RapidOCR (scanned pages/images)   |
| Vector DB / RAG        | [Qdrant](https://qdrant.tech) (embedded/local mode) + FastEmbed (BGE-small) |
| Metadata / structured store | PostgreSQL (documents, tasks, steps, citations, audit log, users) |
| Code sandbox           | Docker (`--network none`) with subprocess fallback             |
| Audit & network proof  | `psutil`-based live connection/interface inspection             |
| Deliverables           | `python-docx` — generates real `.docx` approval notes          |

This follows the problem statement's stack (React, FastAPI, Tailwind, Ollama,
LangGraph, Qdrant, PostgreSQL, Docker, Python) as closely as this dev machine
allows headlessly. **Deferred** — need infra this box doesn't reliably provide
in an unattended environment: Redis (session cache), MinIO (object store),
Prometheus/Grafana (observability), Nginx gateway/TLS, gVisor (Docker itself
is already flaky here without a GUI session to finish its first-run setup),
and real LDAP/SSO (RBAC is currently a seeded directory table, not a live
auth layer).

## Running it locally

### Backend

```bash
cd backend
python -m venv .venv
./.venv/Scripts/activate        # Windows; use `source .venv/bin/activate` on Linux/macOS
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend proxies `/api` to `http://localhost:8000` (see `frontend/vite.config.ts`).

### PostgreSQL

The backend expects Postgres reachable at `127.0.0.1:5432`, database `forge`,
user `postgres` (see `backend/app/db.py:DSN`). If you don't already run
Postgres as a Windows service, a portable (no-install) runtime works:

```powershell
# one-time: download & extract the EDB binaries zip, then
initdb -D <data-dir> -U postgres --auth=trust -E UTF8
pg_ctl -D <data-dir> -l logfile start
createdb -U postgres forge
```

### Enabling live generation

Install [Ollama](https://ollama.com/download) and pull at least one model per
task type used in the demo:

```bash
ollama pull llama3.2:1b          # general / fast fallback
ollama pull qwen2.5:3b-instruct  # document reasoning
ollama pull qwen2.5-coder:1.5b   # coding
ollama pull llava:7b             # multimodal / vision
```

The Model Router page reflects whatever is actually pulled — no restart needed.

### Enabling isolated code execution

Start Docker Desktop (or any Docker daemon reachable at the default socket/pipe).
The Sandbox page detects this live and switches from the subprocess fallback to
a true `--network none` container automatically.

## Current known limitations (reported honestly in the UI, not hidden)

- If Ollama isn't running, the Model Router and Workspace show an explicit
  "offline" state with the exact command to fix it — they never fabricate models.
- If Docker's daemon isn't reachable, the Sandbox falls back to a local
  subprocess and labels the run `subprocess (docker daemon unreachable)`
  instead of claiming network isolation it didn't provide.
- RBAC/SSO is illustrative (a seeded directory table) — there is no real
  authentication layer yet.
- Redis, MinIO, Prometheus/Grafana, Nginx, and gVisor from the original
  architecture diagram are not wired up — see "Deferred" above.

## Project layout

```
backend/
  app/
    core/         # ollama.py, ocr.py, rag.py, sandbox.py, network.py, docgen.py, system.py, agent_graph.py
    routers/      # models, documents, tasks, sandbox, audit, outputs, admin, system
    db.py         # PostgreSQL schema + audit logging
    main.py       # FastAPI app wiring
  storage/        # uploads/, artifacts/, qdrant/ (gitignored except structure)
frontend/
  src/
    pages/        # Workspace, Documents, ModelRouterPage, Sandbox, Audit, Outputs, Admin
    components/   # layout (Sidebar, Topbar) + ui primitives
    lib/          # api.ts client, usePoll hook, role context
```
