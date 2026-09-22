from fastapi import APIRouter

from ..core import system as system_core

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/status")
def status():
    return system_core.snapshot()
