from fastapi import APIRouter

from ..db import get_db
from ..core import system as system_core
from ..core import sandbox as sandbox_core

router = APIRouter(prefix="/api/admin", tags=["admin"])

POLICIES = [
    "Deny all outbound traffic except intra-cluster",
    "No document leaves the classified network boundary",
    "Sandbox containers spawn with --network none",
    "All artifacts encrypted at rest (AES-256)",
    "Session data purged after 30 days unless flagged",
]


@router.get("/users")
def list_users():
    with get_db() as db:
        rows = db.execute("SELECT * FROM users ORDER BY created_at").fetchall()
    return [dict(r) for r in rows]


@router.get("/policies")
def list_policies():
    return {"policies": POLICIES}


@router.get("/nodes")
def cluster_nodes():
    """Reports the actual node this backend is running on, plus the
    sandbox execution node's real isolation capability — genuine
    telemetry rather than a fabricated multi-node cluster."""
    snap = system_core.snapshot()
    docker_ok = sandbox_core.docker_available()
    return {
        "nodes": [
            {
                "name": snap["hostname"],
                "role": "FastAPI · orchestrator · RAG index",
                "detail": f"{snap['cpu_cores']} vCPU · {snap['memory_total_gb']} GB RAM",
                "status": "healthy",
            },
            {
                "name": f"{snap['hostname']} (sandbox)",
                "role": "Code execution",
                "detail": "Docker network-isolated" if docker_ok else "Subprocess fallback — Docker daemon unreachable",
                "status": "healthy" if docker_ok else "degraded",
            },
        ],
        "gpus": snap["gpus"],
    }
