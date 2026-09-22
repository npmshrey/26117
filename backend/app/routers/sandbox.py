import time
import uuid

from fastapi import APIRouter
from pydantic import BaseModel

from ..db import get_db, log_audit
from ..core import sandbox as sandbox_core

router = APIRouter(prefix="/api/sandbox", tags=["sandbox"])


class RunRequest(BaseModel):
    code: str


@router.post("/run")
def run(payload: RunRequest):
    result = sandbox_core.run_code(payload.code)
    run_id = str(uuid.uuid4())
    with get_db() as db:
        db.execute(
            "INSERT INTO sandbox_runs (id, code, stdout, stderr, exit_code, duration_ms, isolation_mode, created_at) VALUES (?,?,?,?,?,?,?,?)",
            (run_id, payload.code, result["stdout"], result["stderr"], result["exit_code"],
             result["duration_ms"], result["isolation_mode"], time.time()),
        )
        db.commit()
    log_audit("sandbox", "Container run", f"exit={result['exit_code']} · {result['isolation_mode']} · {result['duration_ms']}ms")
    return {"id": run_id, **result}


@router.get("/status")
def status():
    return {"docker_available": sandbox_core.docker_available()}


@router.get("/runs")
def list_runs(limit: int = 20):
    with get_db() as db:
        rows = db.execute("SELECT * FROM sandbox_runs ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]
