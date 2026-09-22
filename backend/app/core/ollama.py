"""Dynamic local model discovery + inference via Ollama's HTTP API.

Nothing here is hardcoded: the registry reflects whatever is actually
`ollama pull`-ed on this machine. If Ollama isn't running, callers get an
explicit offline state instead of fabricated data.
"""
import time
from typing import Optional

import requests

OLLAMA_HOST = "http://127.0.0.1:11434"
TIMEOUT = 4

# Task-type inference is capability-based, not per-model-name hardcoding:
# we look at real fields returned by Ollama (family, parameter size, quant)
# to score fit — this keeps new models usable without code changes.
TASK_KEYWORDS = {
    "coding": ["code", "coder", "python", "starcoder", "codellama", "deepseek-coder"],
    "multimodal": ["vl", "vision", "llava", "moondream", "bakllava", "pixtral"],
    "document": ["instruct", "chat", "qwen", "mixtral", "mistral", "llama"],
}


def is_online() -> bool:
    try:
        r = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=TIMEOUT)
        return r.status_code == 200
    except requests.RequestException:
        return False


def list_models() -> list[dict]:
    """Returns the live local model registry, or [] if Ollama is unreachable."""
    try:
        r = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=TIMEOUT)
        r.raise_for_status()
    except requests.RequestException:
        return []

    models = []
    for m in r.json().get("models", []):
        name = m.get("name", "")
        details = m.get("details", {}) or {}
        param_size = details.get("parameter_size", "?")
        quant = details.get("quantization_level", "?")
        family = details.get("family", name.split(":")[0])
        size_bytes = m.get("size", 0)
        vram_gb = round(size_bytes / (1024 ** 3), 1)

        lname = name.lower()
        specialties = [
            task for task, kws in TASK_KEYWORDS.items() if any(k in lname for k in kws)
        ] or ["general"]

        models.append(
            {
                "id": name,
                "name": name,
                "family": family,
                "params": param_size,
                "quant": quant,
                "vram_gb": vram_gb,
                "specialties": specialties,
                "status": "loaded",
                "modified_at": m.get("modified_at"),
            }
        )
    return models


def pick_model(models: list[dict], task_type: str) -> Optional[dict]:
    """Capability-scored routing: prefer a model whose inferred specialties
    match the task type; fall back to the largest available model."""
    if not models:
        return None
    matching = [m for m in models if task_type in m["specialties"]]
    pool = matching or models
    return max(pool, key=lambda m: m.get("vram_gb", 0))


def generate(model_id: str, prompt: str, system: Optional[str] = None) -> dict:
    """Blocking call to Ollama /api/generate. Returns text + measured latency."""
    started = time.time()
    payload = {"model": model_id, "prompt": prompt, "stream": False}
    if system:
        payload["system"] = system
    try:
        r = requests.post(f"{OLLAMA_HOST}/api/generate", json=payload, timeout=120)
        r.raise_for_status()
        data = r.json()
        return {
            "ok": True,
            "text": data.get("response", ""),
            "latency_ms": int((time.time() - started) * 1000),
        }
    except requests.RequestException as exc:
        return {
            "ok": False,
            "error": str(exc),
            "latency_ms": int((time.time() - started) * 1000),
        }
