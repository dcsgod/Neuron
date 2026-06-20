"""
MLflow Service — manages a local MLflow tracking server and
exposes helpers for experiment/run management.
"""
import subprocess
import sys
import time
import os
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

_mlflow_process: Optional[subprocess.Popen] = None


def start_mlflow_server(project_root: str, port: int = 5001) -> dict:
    """
    Start a local MLflow tracking server inside the project.
    Stores artifacts in .neuron/mlflow/
    """
    global _mlflow_process

    if _mlflow_process and _mlflow_process.poll() is None:
        return {"status": "already_running", "port": port, "url": f"http://localhost:{port}"}

    mlflow_dir = Path(project_root) / ".neuron" / "mlflow"
    mlflow_dir.mkdir(parents=True, exist_ok=True)
    artifacts_dir = mlflow_dir / "artifacts"
    artifacts_dir.mkdir(exist_ok=True)
    db_path = mlflow_dir / "mlflow.db"

    cmd = [
        sys.executable, "-m", "mlflow", "server",
        "--backend-store-uri", f"sqlite:///{db_path}",
        "--default-artifact-root", str(artifacts_dir),
        "--host", "127.0.0.1",
        "--port", str(port),
    ]
    try:
        _mlflow_process = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        time.sleep(2)  # give it a moment to bind
        return {"status": "started", "port": port, "url": f"http://localhost:{port}"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def stop_mlflow_server() -> dict:
    global _mlflow_process
    if _mlflow_process and _mlflow_process.poll() is None:
        _mlflow_process.terminate()
        _mlflow_process = None
        return {"status": "stopped"}
    return {"status": "not_running"}


def get_mlflow_status(port: int = 5001) -> dict:
    import httpx
    try:
        r = httpx.get(f"http://localhost:{port}/api/2.0/mlflow/experiments/list", timeout=2.0)
        return {"running": r.status_code == 200, "port": port, "url": f"http://localhost:{port}"}
    except Exception:
        return {"running": False, "port": port, "url": f"http://localhost:{port}"}


def list_experiments(project_root: str) -> List[Dict[str, Any]]:
    """List MLflow experiments using the Python tracking API."""
    try:
        import mlflow
        db = Path(project_root) / ".neuron" / "mlflow" / "mlflow.db"
        if not db.exists():
            return []
        mlflow.set_tracking_uri(f"sqlite:///{db}")
        client = mlflow.tracking.MlflowClient()
        exps = client.search_experiments()
        return [
            {
                "experiment_id": e.experiment_id,
                "name": e.name,
                "lifecycle_stage": e.lifecycle_stage,
                "artifact_location": e.artifact_location,
                "tags": dict(e.tags),
            }
            for e in exps
        ]
    except Exception as e:
        return []


def list_runs(project_root: str, experiment_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """List runs for an experiment."""
    try:
        import mlflow
        db = Path(project_root) / ".neuron" / "mlflow" / "mlflow.db"
        mlflow.set_tracking_uri(f"sqlite:///{db}")
        client = mlflow.tracking.MlflowClient()
        runs = client.search_runs(
            experiment_ids=[experiment_id],
            max_results=limit,
            order_by=["attributes.start_time DESC"],
        )
        result = []
        for r in runs:
            result.append({
                "run_id": r.info.run_id,
                "run_name": r.info.run_name,
                "status": r.info.status,
                "start_time": r.info.start_time,
                "end_time": r.info.end_time,
                "duration_ms": (r.info.end_time or 0) - (r.info.start_time or 0),
                "metrics": dict(r.data.metrics),
                "params": dict(r.data.params),
                "tags": {k: v for k, v in r.data.tags.items() if not k.startswith("mlflow.")},
            })
        return result
    except Exception as e:
        return []


def get_run_detail(project_root: str, run_id: str) -> Optional[Dict[str, Any]]:
    """Get full run detail including metric history."""
    try:
        import mlflow
        db = Path(project_root) / ".neuron" / "mlflow" / "mlflow.db"
        mlflow.set_tracking_uri(f"sqlite:///{db}")
        client = mlflow.tracking.MlflowClient()
        run = client.get_run(run_id)
        # Metric history for each metric
        metric_history = {}
        for metric_key in run.data.metrics:
            history = client.get_metric_history(run_id, metric_key)
            metric_history[metric_key] = [{"step": h.step, "value": h.value, "timestamp": h.timestamp} for h in history]
        return {
            "run_id": run.info.run_id,
            "run_name": run.info.run_name,
            "status": run.info.status,
            "metrics": dict(run.data.metrics),
            "params": dict(run.data.params),
            "tags": dict(run.data.tags),
            "metric_history": metric_history,
        }
    except Exception as e:
        return None


def compare_runs(project_root: str, run_ids: List[str]) -> Dict[str, Any]:
    """Compare multiple runs side by side."""
    runs = []
    for rid in run_ids:
        detail = get_run_detail(project_root, rid)
        if detail:
            runs.append(detail)
    if not runs:
        return {"runs": [], "diff": {}}

    # Find param/metric differences
    all_metrics = set()
    all_params = set()
    for r in runs:
        all_metrics.update(r["metrics"].keys())
        all_params.update(r["params"].keys())

    diff_metrics = {}
    for m in all_metrics:
        vals = [r["metrics"].get(m) for r in runs]
        if len(set(str(v) for v in vals)) > 1:
            diff_metrics[m] = vals

    diff_params = {}
    for p in all_params:
        vals = [r["params"].get(p) for r in runs]
        if len(set(str(v) for v in vals)) > 1:
            diff_params[p] = vals

    return {
        "runs": runs,
        "diff": {"metrics": diff_metrics, "params": diff_params},
    }
