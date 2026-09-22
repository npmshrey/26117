import asyncio
import json
import re
import threading
import time
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..db import get_db, log_audit
from ..core import ollama, docgen
from ..core.network import snapshot as network_snapshot
from .documents import chunk_text  # noqa: F401 (kept import path stable)

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

TASK_TYPE_KEYWORDS = {
    "coding": ["code", "script", "function", "sandbox", "python", "calculate", "compute", "algorithm"],
    "multimodal": ["image", "scan", "photo", "drawing", "p&id", "pid", "diagram", "picture", "handwritten"],
    "document": ["report", "note", "document", "sop", "manual", "summary", "approval", "docx", "memo"],
}


class TaskCreate(BaseModel):
    prompt: str
    doc_context: str | None = None


def classify_task(prompt: str) -> str:
    lower = prompt.lower()
    scores = {t: sum(1 for kw in kws if kw in lower) for t, kws in TASK_TYPE_KEYWORDS.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "general"


def add_step(task_id: str, label: str, detail: str, tool: str, status: str, duration_ms: int | None = None):
    with get_db() as db:
        db.execute(
            "INSERT INTO task_steps (task_id, label, detail, tool, status, started_at, duration_ms) VALUES (?,?,?,?,?,?,?)",
            (task_id, label, detail, tool, status, time.time(), duration_ms),
        )
        db.commit()


def set_task(task_id: str, **fields):
    fields["updated_at"] = time.time()
    cols = ", ".join(f"{k}=?" for k in fields)
    with get_db() as db:
        db.execute(f"UPDATE tasks SET {cols} WHERE id=?", (*fields.values(), task_id))
        db.commit()


def run_agent(task_id: str, prompt: str):
    t0 = time.time()

    # Step 1: classify
    s0 = time.time()
    task_type = classify_task(prompt)
    add_step(task_id, "Classify task", f"Keyword-scored task profile -> {task_type}", "Task Classifier", "done",
              int((time.time() - s0) * 1000))
    set_task(task_id, task_type=task_type)

    # Step 2: route model
    s1 = time.time()
    online = ollama.is_online()
    models = ollama.list_models() if online else []
    chosen = ollama.pick_model(models, task_type)
    if chosen:
        add_step(task_id, "Select model", f"Routed to {chosen['name']} ({chosen['params']}, {chosen['quant']})",
                  "Model Router", "done", int((time.time() - s1) * 1000))
        set_task(task_id, model_id=chosen["id"])
    else:
        add_step(task_id, "Select model",
                 "No local model reachable — start Ollama and pull a model (e.g. `ollama pull llama3`) to enable generation.",
                 "Model Router", "error", int((time.time() - s1) * 1000))

    # Step 3: retrieve grounding context
    s2 = time.time()
    citations = []
    with get_db() as db:
        terms = [w for w in re.findall(r"[a-zA-Z]{4,}", prompt)][:6]
        query = " OR ".join(terms) if terms else prompt
        try:
            rows = db.execute(
                "SELECT doc_name, page, content FROM doc_chunks WHERE doc_chunks MATCH ? LIMIT 3",
                (query,),
            ).fetchall()
        except Exception:
            rows = []
    if rows:
        for r in rows:
            citations.append({"doc_name": r["doc_name"], "page": r["page"], "snippet": r["content"][:280]})
            with get_db() as db:
                db.execute(
                    "INSERT INTO citations (task_id, doc_name, page, snippet) VALUES (?,?,?,?)",
                    (task_id, r["doc_name"], r["page"], r["content"][:500]),
                )
                db.commit()
        add_step(task_id, "Retrieve grounding context", f"Private RAG (SQLite FTS5) — {len(rows)} chunk(s) matched",
                  "Local RAG", "done", int((time.time() - s2) * 1000))
    else:
        add_step(task_id, "Retrieve grounding context", "No matching indexed chunks — proceeding without grounding",
                  "Local RAG", "done", int((time.time() - s2) * 1000))

    # Step 4: generate
    s3 = time.time()
    response_text = ""
    if chosen:
        context_block = "\n\n".join(f"[{c['doc_name']} p.{c['page']}] {c['snippet']}" for c in citations)
        full_prompt = (
            f"Context from internal documents:\n{context_block}\n\nTask: {prompt}\n\n"
            "Respond with concrete findings as short bullet points."
        ) if context_block else prompt
        result = ollama.generate(chosen["id"], full_prompt,
                                  system="You are an on-premise industrial analysis assistant. Be concise and factual.")
        if result["ok"]:
            response_text = result["text"]
            add_step(task_id, "Generate response", f"{len(response_text)} chars generated",
                      chosen["name"], "done", result["latency_ms"])
        else:
            add_step(task_id, "Generate response", f"Model call failed: {result.get('error', 'unknown error')}",
                      chosen["name"], "error", result["latency_ms"])
    else:
        add_step(task_id, "Generate response", "Skipped — no model available", "Model Router", "error", 0)

    # Step 5: confidence scoring (computed, not fixed)
    s4 = time.time()
    confidence = 0.0
    if response_text:
        confidence = min(0.99, 0.5 + 0.1 * len(citations) + min(0.25, len(response_text) / 2000))
    add_step(task_id, "Score confidence", f"Confidence {confidence:.2f} — derived from citation count & response depth",
              "Safety & Risk Engine", "done", int((time.time() - s4) * 1000))

    # Step 6: generate deliverable if response exists
    s5 = time.time()
    deliverable = None
    if response_text:
        out_path = docgen.build_approval_note(task_id, prompt, response_text, citations, chosen["name"] if chosen else "n/a")
        size_kb = round(out_path.stat().st_size / 1024, 1)
        deliverable_id = str(uuid.uuid4())
        with get_db() as db:
            db.execute(
                "INSERT INTO deliverables (id, task_id, name, kind, path, size_kb, source_model, created_at) VALUES (?,?,?,?,?,?,?,?)",
                (deliverable_id, task_id, out_path.name, "docx", str(out_path), size_kb,
                 chosen["name"] if chosen else "n/a", time.time()),
            )
            db.commit()
        deliverable = {"id": deliverable_id, "name": out_path.name, "size_kb": size_kb}
        add_step(task_id, "Generate artifact", f"{out_path.name} ({size_kb} KB)", "Document Synthesizer", "done",
                  int((time.time() - s5) * 1000))
    else:
        add_step(task_id, "Generate artifact", "Skipped — no generated content", "Document Synthesizer", "error", 0)

    # Step 7: audit + egress check
    s6 = time.time()
    net = network_snapshot()
    egress_state = "blocked" if net["zero_egress"] else "warn"
    add_step(task_id, "Audit + egress check",
              f"{net['external_connections']} external connection(s) observed during run", "Audit & Governance",
              "done", int((time.time() - s6) * 1000))
    log_audit("agent", "Task completed", f"task {task_id} · type={task_type} · model={chosen['name'] if chosen else 'none'}",
               egress="blocked" if net["zero_egress"] else "n/a")

    set_task(task_id, status="done", confidence=confidence)


@router.post("")
def create_task(payload: TaskCreate):
    task_id = str(uuid.uuid4())
    now = time.time()
    with get_db() as db:
        db.execute(
            "INSERT INTO tasks (id, prompt, status, created_at, updated_at) VALUES (?,?,?,?,?)",
            (task_id, payload.prompt, "running", now, now),
        )
        db.commit()
    log_audit("user", "Task submitted", payload.prompt[:200])
    thread = threading.Thread(target=run_agent, args=(task_id, payload.prompt), daemon=True)
    thread.start()
    return {"id": task_id, "status": "running"}


@router.get("/{task_id}")
def get_task(task_id: str):
    with get_db() as db:
        task = db.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
        if not task:
            raise HTTPException(404, "task not found")
        steps = db.execute("SELECT * FROM task_steps WHERE task_id=? ORDER BY id", (task_id,)).fetchall()
        citations = db.execute("SELECT * FROM citations WHERE task_id=?", (task_id,)).fetchall()
        deliverable = db.execute("SELECT * FROM deliverables WHERE task_id=?", (task_id,)).fetchone()
    return {
        "task": dict(task),
        "steps": [dict(s) for s in steps],
        "citations": [dict(c) for c in citations],
        "deliverable": dict(deliverable) if deliverable else None,
    }


@router.get("")
def list_tasks(limit: int = 20):
    with get_db() as db:
        rows = db.execute("SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]


@router.get("/{task_id}/stream")
async def stream_task(task_id: str):
    async def event_gen():
        last_step_id = 0
        while True:
            with get_db() as db:
                task = db.execute("SELECT status FROM tasks WHERE id=?", (task_id,)).fetchone()
                new_steps = db.execute(
                    "SELECT * FROM task_steps WHERE task_id=? AND id>? ORDER BY id", (task_id, last_step_id)
                ).fetchall()
            for s in new_steps:
                last_step_id = s["id"]
                yield f"data: {json.dumps(dict(s))}\n\n"
            if not task or task["status"] != "running":
                yield f"event: done\ndata: {json.dumps({'status': task['status'] if task else 'unknown'})}\n\n"
                break
            await asyncio.sleep(0.35)

    return StreamingResponse(event_gen(), media_type="text/event-stream")
