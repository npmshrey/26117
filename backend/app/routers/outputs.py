from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..db import get_db

router = APIRouter(prefix="/api/outputs", tags=["outputs"])


@router.get("")
def list_outputs():
    with get_db() as db:
        rows = db.execute("SELECT * FROM deliverables ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


@router.get("/{deliverable_id}/download")
def download(deliverable_id: str):
    with get_db() as db:
        row = db.execute("SELECT * FROM deliverables WHERE id=%s", (deliverable_id,)).fetchone()
    if not row:
        raise HTTPException(404, "deliverable not found")
    path = Path(row["path"])
    if not path.exists():
        raise HTTPException(410, "file no longer on disk")
    return FileResponse(path, filename=row["name"])
