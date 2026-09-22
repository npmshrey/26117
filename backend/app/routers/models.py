from fastapi import APIRouter

from ..core import ollama

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
def list_models():
    online = ollama.is_online()
    models = ollama.list_models() if online else []
    return {
        "ollama_online": online,
        "count": len(models),
        "models": models,
    }
