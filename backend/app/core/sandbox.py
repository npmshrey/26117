"""Code execution sandbox.

Uses a real, network-isolated Docker container when the Docker daemon is
reachable on this host. When it isn't (e.g. Docker Desktop not running),
falls back to a restricted local subprocess and reports that honestly in
`isolation_mode` rather than pretending containers were used.
"""
import shutil
import subprocess
import tempfile
import time
import uuid
from pathlib import Path

DOCKER_IMAGE = "python:3.11-slim"
TIMEOUT_S = 20


def docker_available() -> bool:
    if not shutil.which("docker"):
        return False
    try:
        r = subprocess.run(
            ["docker", "info"], capture_output=True, timeout=5, text=True
        )
        return r.returncode == 0
    except (subprocess.TimeoutExpired, OSError):
        return False


def run_code(code: str) -> dict:
    started = time.time()
    run_id = str(uuid.uuid4())[:8]
    tmp_dir = Path(tempfile.mkdtemp(prefix=f"forge-sandbox-{run_id}-"))
    script_path = tmp_dir / "task.py"
    script_path.write_text(code, encoding="utf-8")

    if docker_available():
        mode = "docker --network none"
        try:
            proc = subprocess.run(
                [
                    "docker", "run", "--rm",
                    "--network", "none",
                    "--memory", "256m",
                    "--cpus", "1",
                    "-v", f"{tmp_dir}:/sandbox:ro",
                    "-w", "/sandbox",
                    DOCKER_IMAGE,
                    "python", "task.py",
                ],
                capture_output=True, text=True, timeout=TIMEOUT_S,
            )
            stdout, stderr, code_ = proc.stdout, proc.stderr, proc.returncode
        except subprocess.TimeoutExpired:
            stdout, stderr, code_ = "", f"Execution timed out after {TIMEOUT_S}s", -1
        except FileNotFoundError:
            mode = "subprocess (docker image unavailable)"
            stdout, stderr, code_ = _run_subprocess(script_path)
    else:
        mode = "subprocess (docker daemon unreachable — fallback, not network-isolated)"
        stdout, stderr, code_ = _run_subprocess(script_path)

    shutil.rmtree(tmp_dir, ignore_errors=True)

    return {
        "stdout": stdout,
        "stderr": stderr,
        "exit_code": code_,
        "duration_ms": int((time.time() - started) * 1000),
        "isolation_mode": mode,
    }


def _run_subprocess(script_path: Path) -> tuple[str, str, int]:
    try:
        proc = subprocess.run(
            ["python", str(script_path)],
            capture_output=True, text=True, timeout=TIMEOUT_S,
            cwd=script_path.parent,
        )
        return proc.stdout, proc.stderr, proc.returncode
    except subprocess.TimeoutExpired:
        return "", f"Execution timed out after {TIMEOUT_S}s", -1
