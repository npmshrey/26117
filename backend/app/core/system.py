"""Real host telemetry — CPU, memory, disk, and GPU when discoverable."""
import platform
import shutil
import socket
import subprocess

import psutil


def gpu_info() -> list[dict]:
    if not shutil.which("nvidia-smi"):
        return []
    try:
        out = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,memory.total,memory.used,utilization.gpu,temperature.gpu",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True, text=True, timeout=5,
        )
        if out.returncode != 0:
            return []
        gpus = []
        for line in out.stdout.strip().splitlines():
            name, mem_total, mem_used, util, temp = [p.strip() for p in line.split(",")]
            gpus.append({
                "name": name,
                "vram_total_mb": int(mem_total),
                "vram_used_mb": int(mem_used),
                "utilization_pct": int(util),
                "temperature_c": int(temp),
            })
        return gpus
    except (subprocess.TimeoutExpired, ValueError):
        return []


def snapshot() -> dict:
    vm = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    return {
        "hostname": socket.gethostname(),
        "platform": f"{platform.system()} {platform.release()}",
        "cpu_percent": psutil.cpu_percent(interval=0.2),
        "cpu_cores": psutil.cpu_count(logical=True),
        "memory_total_gb": round(vm.total / (1024 ** 3), 1),
        "memory_used_gb": round(vm.used / (1024 ** 3), 1),
        "memory_percent": vm.percent,
        "disk_total_gb": round(disk.total / (1024 ** 3), 1),
        "disk_used_gb": round(disk.used / (1024 ** 3), 1),
        "gpus": gpu_info(),
        "process_count": len(psutil.pids()),
    }
