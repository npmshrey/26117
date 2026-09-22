import asyncio
import json
import threading
import time
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..db import get_db, log_audit
from ..core.agent_graph import run as run_agent

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


class TaskCreate(BaseModel):
    prompt: str
    doc_context: str | None = None


@router.post("")
def create_task(payload: TaskCreate):
    task_id = str(uuid.uuid4())
    now = time.time()
    with get_db() as db:
        db.execute(
            "INSERT INTO tasks (id, prompt, status, created_at, updated_at) VALUES (%s,%s,%s,%s,%s)",
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
        task = db.execute("SELECT * FROM tasks WHERE id=%s", (task_id,)).fetchone()
        if not task:
            raise HTTPException(404, "task not found")
        steps = db.execute("SELECT * FROM task_steps WHERE task_id=%s ORDER BY id", (task_id,)).fetchall()
        citations = db.execute("SELECT * FROM citations WHERE task_id=%s", (task_id,)).fetchall()
        deliverable = db.execute("SELECT * FROM deliverables WHERE task_id=%s", (task_id,)).fetchone()
    return {
        "task": dict(task),
        "steps": [dict(s) for s in steps],
        "citations": [dict(c) for c in citations],
        "deliverable": dict(deliverable) if deliverable else None,
    }


@router.get("")
def list_tasks(limit: int = 20):
    with get_db() as db:
        rows = db.execute("SELECT * FROM tasks ORDER BY created_at DESC LIMIT %s", (limit,)).fetchall()
    return [dict(r) for r in rows]


@router.get("/{task_id}/stream")
async def stream_task(task_id: str):
    async def event_gen():
        last_step_id = 0
        while True:
            with get_db() as db:
                task = db.execute("SELECT status FROM tasks WHERE id=%s", (task_id,)).fetchone()
                new_steps = db.execute(
                    "SELECT * FROM task_steps WHERE task_id=%s AND id>%s ORDER BY id", (task_id, last_step_id)
                ).fetchall()
            for s in new_steps:
                last_step_id = s["id"]
                yield f"data: {json.dumps(dict(s))}\n\n"
            if not task or task["status"] != "running":
                yield f"event: done\ndata: {json.dumps({'status': task['status'] if task else 'unknown'})}\n\n"
                break
            await asyncio.sleep(0.35)

    return StreamingResponse(event_gen(), media_type="text/event-stream")
