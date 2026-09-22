from fastapi import APIRouter

from ..db import get_db
from ..core.network import snapshot as network_snapshot

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("")
def list_audit(limit: int = 100):
    with get_db() as db:
        rows = db.execute("SELECT * FROM audit_log ORDER BY time DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]


@router.get("/network")
def network():
    return network_snapshot()
