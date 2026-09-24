# Forge — Project Context

**SIH 2026 · PS ID 26117 · "Sovereign On-Premise Agentic AI Workbench using
Open-Weight Multimodal LLMs for Confidential Industrial Work" · Team LexCorps**

Repo: https://github.com/npmshrey/26117 (branch `main`, 3 commits as of this writing)

This file is the handoff/status document — what exists, what's been verified
to actually work (not assumed), what's stubbed or deferred, and what's left
before this is demo-ready against the PS's judging criteria. Written so a
new session (human or agent) can pick this up cold.

---

## 1. The problem statement, in one paragraph

Industrial orgs (refineries, PSUs, defence manufacturing) generate confidential
knowledge work — P&IDs, inspection reports, financials, internal
correspondence — that can't go through cloud AI (Claude/GPT/etc.) due to data
sovereignty policy. The ask: a self-hosted, air-gapped AI workbench that (a)
routes tasks across multiple open-weight local models rather than locking to
one, (b) acts agentically — plans, calls tools, iterates, produces real
deliverables (DOCX/XLSX/PPTX/code) — not just chat, (c) handles multimodal
input (scans, photos, drawings) via on-device OCR/vision, (d) grounds itself
in the org's own documents via local RAG, and (e) can *prove* zero external
network calls were made, not just claim it.

The four things the judges will want demonstrated:
1. Model auto-selection across ≥2 task types.
2. An agentic task carried end-to-end (e.g. scanned report → approval note).
3. A coding task run and verified in a sandbox.
4. A multimodal task (image/scan understanding).
5. Proof (logs/network monitor) of zero external calls throughout.

---

## 2. What we actually built (verified working, not aspirational)

### Architecture

```
frontend/   React + TypeScript + Tailwind v4 (Vite dev server, port 5173)
backend/    FastAPI (Python, .venv), port 8000
```

The frontend has **no mock data**. Every page polls or streams live from the
backend (`src/lib/api.ts` + `usePoll` hook + one SSE stream for task
execution). Empty/offline states are real — e.g. if Ollama isn't running, the
Model Router page says so with the exact fix command, rather than showing
fabricated models.

### Stack, and how it maps to the PS's own architecture diagram

| Layer | What's running | Verified? |
|---|---|---|
| Model serving | **Ollama** (real, installed), 4 models pulled: `llama3.2:1b`, `qwen2.5:3b-instruct`, `qwen2.5-coder:1.5b`, `llava:7b` | ✅ generation tested end-to-end |
| Agent orchestration | **LangGraph** `StateGraph` (`backend/app/core/agent_graph.py`) — classify → select_model → retrieve → generate → score → artifact → audit, each node logs a step row consumed by SSE | ✅ full run tested, steps stream live to UI |
| RAG / vector DB | **Qdrant** in embedded/local mode (no server process, on-disk at `backend/storage/qdrant/`) + **FastEmbed** (`BAAI/bge-small-en-v1.5`, 384-dim) for real semantic embeddings | ✅ tested — real cosine similarity scores (0.75–0.84 on relevant matches) |
| Metadata / structured store | **PostgreSQL 16.4**, running as a *portable* (no-installer, no admin) binary at `C:\pgsql2\pgsql`, data dir `C:\pgsql2\data`, DB `forge`, user `postgres`, port 5432 | ✅ schema created, seeded users confirmed via psql |
| Document intelligence | **PyMuPDF** (native PDF text) + **RapidOCR** (`rapidocr-onnxruntime` — ONNX, no Tesseract binary needed) for scans/images | ✅ tested on a synthetic scanned image — real OCR text extracted and indexed |
| Code sandbox | **Docker** `--network none` when the daemon is reachable; honest **subprocess fallback** (labelled as such, not disguised) when it isn't | ⚠️ Docker Desktop installed but its daemon has been unreliable in this headless dev session — see §4 |
| Audit / zero-egress proof | `psutil`-based live connection inspection (`backend/app/core/network.py`) — classifies every real OS-level connection as loopback/LAN/external | ✅ genuinely dynamic; on this dev laptop it correctly shows external connections (browser etc.) — on an actual isolated deployment box it would read zero |
| Deliverables | `python-docx` generates real `.docx` approval notes from agent output | ✅ tested, files land in `backend/storage/artifacts/` |
| Frontend | React 19 + TS + Tailwind v4 (Vite), 7 pages, dark industrial design system | ✅ all pages live-wired |

### What a real end-to-end run looks like (this was executed, not simulated)

```
POST /api/tasks {"prompt": "Review the pressure vessel corrosion findings
                  against SOP thresholds and draft an approval note"}
→ Classify task          → "document" (keyword-scored)
→ Select model            → routed to qwen2.5:3b-instruct (live from Ollama)
→ Retrieve grounding      → Qdrant semantic search, 2-3 chunks, cosine 0.52–0.84
→ Generate response       → real local LLM call via Ollama, 200-1000 chars
→ Score confidence        → computed from citation count + response depth
→ Generate artifact       → real .docx written to disk
→ Audit + egress check    → real psutil connection count logged
```
Confirmed with multiple prompts, correctly routing "document" prompts to
`qwen2.5:3b-instruct` and "coding" prompts to `qwen2.5-coder:1.5b` — i.e.
task-aware routing across ≥2 task types is genuinely demonstrated (PS
requirement #1 and #2 are functionally done, modulo the DOCX/approval-note
task needing a scanned *document* as the trigger for the full "PS demo
script" — see §3).

### Frontend pages (all live-data, `frontend/src/pages/`)

- **Workspace** — task composer, live SSE-streamed agent step timeline, model
  router panel, RAG citations panel, confidence/deliverable card.
- **Documents** (Document Intelligence) — upload/drag-drop, live ingest stats,
  knowledge base list, embedding model info.
- **Model Router** — live Ollama registry table, capability tags inferred
  from real model metadata, honest offline state.
- **Sandbox** (Code Sandbox) — editable code, run button hits real backend,
  shows real isolation mode (docker vs subprocess-fallback) and output.
- **Audit** (Audit & Network Monitor) — live external-connection count,
  live interface stats, tamper-evident audit log table.
- **Outputs** (Deliverables) — real generated `.docx` files, downloadable.
- **Admin** (Admin & Governance) — seeded RBAC directory (Postgres-backed),
  policy list, live host telemetry (CPU/RAM via psutil, GPU via nvidia-smi
  if present).

Design: dark industrial theme (amber/teal/blue accents, monospace for
logs/code), deliberately avoiding the generic purple-gradient "AI app" look.
Sidebar/topbar "zero-egress" badge is wired to the same live network data as
the Audit page (fixed an earlier inconsistency).

---

## 3. Gaps against the PS's exact demo script

The PS wants, specifically: *"reading a scanned inspection report, pulling
out key findings and drafting an approval note as a Word file."* We have all
the pieces (OCR ✅, RAG ✅, LLM generation ✅, DOCX generation ✅, LangGraph
orchestration ✅) but they haven't been chained in one single demo run with a
**real scanned inspection report** (we tested OCR on a synthetic test image
and the agent pipeline on plain-text SOPs separately). **Next step: do one
full run with an actual scanned-looking PDF/image as input, uploaded through
the Workspace attach-document flow, producing a DOCX with real cited
findings.**

The coding-task sandbox requirement (#3) is only *partially* proven — the
code execution and result capture work, but real Docker network isolation
(`--network none`) has not been confirmed running in this environment; only
the honest subprocess fallback has been exercised. Need Docker's daemon
actually up for a true isolation demo (see §4).

The multimodal/vision requirement (#4) — `llava:7b` is pulled and available,
and RapidOCR extraction works, but no end-to-end test has driven an image
through `llava` for vision-language understanding (as opposed to OCR text
extraction). Worth doing at least one `llava` generate() call to prove
vision-model inference, not just OCR.

---

## 4. Known issues / environment quirks (be aware, don't re-discover)

- **Docker Desktop is flaky in this headless dev session.** The installer
  needed a UAC prompt (can't be granted non-interactively), so Docker
  Desktop.exe was launched directly instead of through a normal interactive
  install. Its Linux-side engine comes up and responds to internal pings, but
  the Windows named pipe (`dockerDesktopLinuxEngine`) that the `docker` CLI
  needs to talk to it sometimes doesn't attach. If Docker is needed for a
  demo, **open Docker Desktop's GUI window once interactively** and confirm
  it says "Engine running" before relying on it headlessly again.
- **The user has been using the live dev site directly in their own
  browser** while this was being built (visible from real uploaded content in
  the `documents` table, e.g. the actual PS PDF, that wasn't part of any test
  script) — so the app has already had at least one round of real hands-on use,
  not just scripted verification.
- **Backend/Postgres do not auto-start.** Every new session/reboot needs:
  ```powershell
  # Postgres (portable, not a service)
  C:\pgsql2\pgsql\bin\pg_ctl.exe -D C:\pgsql2\data -l C:\pgsql2\logfile.txt start
  ```
  ```bash
  # Backend
  cd backend && ./.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000
  ```
  ```bash
  # Frontend (often already running from a prior session — check port 5173 first)
  cd frontend && npm run dev
  ```
  Ollama runs as a persistent background service once installed (it was
  still up across the session gap that killed backend/Postgres).
- **A stray mojibake bug was found and fixed** (arrow character `→` in a
  step-label string was round-tripping through an encoding that mangled it
  to `â†'`). Fixed by using plain ASCII (`->`) in that string. If new
  non-ASCII characters show up mangled in step details, check
  `backend/app/core/agent_graph.py` first.
- **A UI bug was found and fixed**: the role-switcher dropdown in the topbar
  rendered blank rows in the user's browser (Chromium `backdrop-blur`
  interacting badly with a nested absolutely-positioned dropdown). Fixed by
  removing `backdrop-blur` from the header and giving the dropdown an
  explicit opaque background + higher z-index.
- **`backend/storage/qdrant/`** is a real on-disk DB (gitignored) — deleting
  it while the backend process holds it open will fail with "resource busy".
  Stop the backend first if you need to reset it.
- Postgres data (`C:\pgsql2\data`) and the binaries (`C:\pgsql2\pgsql`) live
  **outside** the repo (moved there during setup, not part of the project
  directory) — they will not travel with a `git clone`. Anyone else running
  this needs to redo the portable-Postgres setup (documented in `README.md`).

---

## 5. Deferred — named in the PS architecture diagram, not implemented, and why

| Component | Why deferred |
|---|---|
| Redis (session cache) | No good no-admin-install path on Windows found yet; WSL Ubuntu (already present for Docker) could host it via `apt install redis-server` — untried. |
| MinIO (object store) | Single-binary, should be easy (download `minio.exe`, run) — just not gotten to yet. Genuinely low-effort if picked up next. |
| Prometheus + Grafana | Native Windows zips exist; lower priority than the core agent/RAG/sandbox pipeline for judging purposes. |
| Nginx gateway / TLS | More of a production-deployment concern; Vite's dev proxy currently stands in for routing `/api`. |
| gVisor | Linux-only; would need to run inside Docker's Linux backend, which itself isn't reliably up here. |
| Real LDAP/SSO / RBAC enforcement | `users` table is seeded (Postgres) and displayed, but there's no actual auth/session layer gating API access by role yet — anyone can hit any endpoint. |
| CrewAI | PPT lists both LangGraph and CrewAI; we picked LangGraph only (redundant to run two orchestration frameworks) — worth noting to judges as a deliberate simplification, not an oversight. |
| FAISS (PPT says "Qdrant primary + FAISS") | Qdrant alone is sufficient; FAISS was framed as a fallback/secondary index in the PPT, treated as optional. |

---

## 6. Concrete next steps, roughly in priority order for a strong demo

1. **Docker**: get the daemon reliably up (open the GUI once, confirm
   "Engine running", maybe restart the whole VM/session) so the sandbox
   isolation demo is real, not fallback.
2. **Full PS demo script, one real run**: upload an actual scanned-looking
   inspection report (PDF or image) through the Workspace, let RapidOCR
   extract it, let the agent cite it and draft a DOCX approval note — record
   this as the canonical demo.
3. **Vision-model test**: drive one real prompt through `llava:7b` on an
   image (P&ID-style diagram or photo) to prove the multimodal task type
   isn't just OCR-backed.
4. **RBAC enforcement**: at minimum, gate a couple of endpoints by role
   using the seeded `users` table, so "RBAC" isn't purely cosmetic.
5. **MinIO**, then **Redis** (via WSL), if time remains — these are the
   cheapest of the deferred items.
6. Consider a short screen recording of the full demo flow as a fallback in
   case live infra (Ollama/Postgres/Docker) misbehaves at presentation time.
7. Re-verify everything after any machine restart — nothing here
   auto-starts except Ollama; see §4 for the exact commands.

---

## 7. File map (backend)

```
backend/
  app/
    core/
      agent_graph.py   # LangGraph StateGraph — the agent orchestrator
      rag.py            # Qdrant + FastEmbed — index_chunks(), search(), stats()
      ollama.py         # Ollama discovery (list_models, pick_model, generate)
      ocr.py            # PyMuPDF + RapidOCR text/OCR extraction
      sandbox.py        # Docker (--network none) / subprocess fallback exec
      network.py        # psutil-based live egress/connection snapshot
      docgen.py         # python-docx approval-note generation
      system.py         # host telemetry (CPU/RAM/disk/GPU)
    routers/
      tasks.py           # POST /api/tasks, GET .../stream (SSE), get/list
      documents.py       # upload/list/stats/search
      models.py          # GET /api/models (live Ollama registry)
      sandbox.py         # POST /api/sandbox/run, status, runs
      audit.py           # GET /api/audit, /api/audit/network
      outputs.py         # GET /api/outputs, download
      admin.py           # users, policies, nodes (host telemetry)
      system.py          # GET /api/system/status
    db.py                # Postgres schema (psycopg3) + log_audit()
    main.py               # FastAPI app, CORS, router wiring
  requirements.txt
  storage/
    uploads/, artifacts/, qdrant/   (gitignored contents, dirs tracked via .gitkeep)
```

## 8. File map (frontend)

```
frontend/src/
  pages/            Workspace, Documents, ModelRouterPage, Sandbox, Audit, Outputs, Admin
  components/
    layout/          Sidebar.tsx, Topbar.tsx, AppLayout.tsx
    ui/               Badge, Card, EmptyState
  lib/
    api.ts            typed fetch client for every backend endpoint
    usePoll.ts         generic polling hook (used by nearly every page)
    RoleContext.tsx    role-switcher state (UI-only, not real auth)
    types.ts, mock.ts  ROLES config only — no fake data left in here
```
