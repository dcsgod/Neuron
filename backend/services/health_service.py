import sys
import shutil
import subprocess
from typing import List, Dict, Any
from models.schemas import HealthStatus
from services.ollama_client import list_local_models


async def get_health() -> HealthStatus:
    """Full environment doctor check."""
    issues: List[str] = []

    # Python version
    py_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"

    # Ollama
    models = await list_local_models()
    ollama_running = len(models) > 0 or await _check_ollama_process()
    if not ollama_running:
        issues.append("Ollama is not running. Start it with: ollama serve")
    if ollama_running and len(models) == 0:
        issues.append("No Ollama models found. Pull one: ollama pull qwen2.5-coder")

    # GPU / CUDA
    cuda_available, cuda_version = _check_cuda()
    gpu_info = _check_gpu_info()

    # Disk space
    disk_free_gb = _check_disk()
    if disk_free_gb < 5:
        issues.append(f"Low disk space: {disk_free_gb}GB free. At least 5GB recommended.")

    status = "ok" if not issues else "degraded"

    return HealthStatus(
        status=status,
        python_version=py_version,
        ollama_running=ollama_running,
        ollama_models=models,
        cuda_available=cuda_available,
        cuda_version=cuda_version,
        disk_free_gb=disk_free_gb,
        issues=issues,
    )


async def get_full_health() -> Dict[str, Any]:
    """Extended health report including packages and GPU memory."""
    base = await get_health()
    packages = _check_packages()
    gpu_info = _check_gpu_info()
    mlflow_running = _check_mlflow()

    return {
        **base.model_dump(),
        "packages": packages,
        "gpu_info": gpu_info,
        "mlflow_running": mlflow_running,
    }


# ─── Internal helpers ──────────────────────────────────────────────


def _check_cuda() -> tuple[bool, str | None]:
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=driver_version", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            return True, result.stdout.strip().split("\n")[0]
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return False, None


def _check_gpu_info() -> Dict[str, Any]:
    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            rows = []
            for line in result.stdout.strip().split("\n"):
                parts = [p.strip() for p in line.split(",")]
                if len(parts) == 5:
                    rows.append({
                        "name": parts[0],
                        "memory_total_mb": int(parts[1]),
                        "memory_used_mb": int(parts[2]),
                        "memory_free_mb": int(parts[3]),
                        "utilization_pct": int(parts[4]),
                    })
            return {"gpus": rows}
    except Exception:
        pass
    return {"gpus": []}


def _check_disk() -> float:
    try:
        disk = shutil.disk_usage("/")
        return round(disk.free / (1024 ** 3), 2)
    except Exception:
        try:
            disk = shutil.disk_usage("C:/")
            return round(disk.free / (1024 ** 3), 2)
        except Exception:
            return 0.0


def _check_packages() -> List[Dict[str, Any]]:
    """Check versions of key ML/data science packages."""
    package_names = [
        ("torch", "PyTorch"),
        ("sklearn", "scikit-learn"),
        ("pandas", "Pandas"),
        ("numpy", "NumPy"),
        ("mlflow", "MLflow"),
        ("xgboost", "XGBoost"),
        ("lightgbm", "LightGBM"),
        ("duckdb", "DuckDB"),
        ("chromadb", "ChromaDB"),
    ]
    results = []
    for mod, display in package_names:
        try:
            m = __import__(mod)
            version = getattr(m, "__version__", "installed")
            results.append({"name": display, "module": mod, "version": version, "installed": True})
        except ImportError:
            results.append({"name": display, "module": mod, "version": None, "installed": False})
    return results


def _check_mlflow() -> bool:
    import httpx
    try:
        import httpx as _httpx
        resp = _httpx.get("http://localhost:5001/health", timeout=1.0)
        return resp.status_code == 200
    except Exception:
        return False


async def _check_ollama_process() -> bool:
    import httpx
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get("http://localhost:11434/api/tags")
            return resp.status_code == 200
    except Exception:
        return False
