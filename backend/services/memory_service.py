"""
Memory Service — reads and writes .neuron/memory/ files.
Persists project intelligence across sessions.
"""
from pathlib import Path
from typing import Optional, Dict, Any
import json
import re
from datetime import datetime

NEURON_DIR = ".neuron"


def _neuron_path(project_root: str) -> Path:
    return Path(project_root) / NEURON_DIR


def _memory_path(project_root: str) -> Path:
    return _neuron_path(project_root) / "memory"


# ─── Read ──────────────────────────────────────────────────────
def read_memory_file(project_root: str, filename: str) -> str:
    path = _memory_path(project_root) / filename
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def read_all_memory(project_root: str) -> Dict[str, str]:
    """Return all memory files as a dict."""
    mem_dir = _memory_path(project_root)
    if not mem_dir.exists():
        return {}
    result = {}
    for f in mem_dir.iterdir():
        if f.is_file():
            try:
                result[f.name] = f.read_text(encoding="utf-8")
            except Exception:
                pass
    return result


def read_dataset_profile(project_root: str) -> Dict[str, Any]:
    path = _memory_path(project_root) / "dataset_profile.json"
    if not path.exists():
        return {"datasets": []}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {"datasets": []}


def read_model_registry(project_root: str) -> Dict[str, Any]:
    path = _memory_path(project_root) / "model_registry.json"
    if not path.exists():
        return {"models": []}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {"models": []}


# ─── Write ─────────────────────────────────────────────────────
def write_memory_file(project_root: str, filename: str, content: str) -> None:
    path = _memory_path(project_root) / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def append_to_memory(project_root: str, filename: str, entry: str) -> None:
    existing = read_memory_file(project_root, filename)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    new_content = f"{existing}\n### {timestamp}\n{entry}\n"
    write_memory_file(project_root, filename, new_content)


def update_dataset_profile(project_root: str, dataset_info: Dict[str, Any]) -> None:
    profile = read_dataset_profile(project_root)
    # Replace or add dataset entry by name
    name = dataset_info.get("name", "unknown")
    profile["datasets"] = [
        d for d in profile["datasets"] if d.get("name") != name
    ]
    profile["datasets"].append(dataset_info)
    path = _memory_path(project_root) / "dataset_profile.json"
    path.write_text(json.dumps(profile, indent=2), encoding="utf-8")


def update_model_registry(project_root: str, model_info: Dict[str, Any]) -> None:
    registry = read_model_registry(project_root)
    name = model_info.get("name", "unknown")
    registry["models"] = [
        m for m in registry["models"] if m.get("name") != name
    ]
    registry["models"].append(model_info)
    path = _memory_path(project_root) / "model_registry.json"
    path.write_text(json.dumps(registry, indent=2), encoding="utf-8")


# ─── Summarise project ─────────────────────────────────────────
def get_project_context_summary(project_root: str) -> str:
    """
    Build a compact context string from memory files.
    Used by the Context Planner to inject project knowledge.
    """
    parts = []

    summary = read_memory_file(project_root, "project_summary.md")
    if summary.strip() and "No summary yet" not in summary:
        parts.append(f"## Project Summary\n{summary.strip()}")

    decisions = read_memory_file(project_root, "decisions.md")
    if decisions.strip() and "Decisions will be tracked" not in decisions:
        # Keep last 500 chars only
        parts.append(f"## Key Decisions\n{decisions.strip()[-500:]}")

    failures = read_memory_file(project_root, "failures.md")
    if failures.strip() and "Failed experiments" not in failures:
        parts.append(f"## Known Failures\n{failures.strip()[-400:]}")

    arch = read_memory_file(project_root, "architecture.md")
    if arch.strip() and "Architecture notes" not in arch:
        parts.append(f"## Architecture\n{arch.strip()[-400:]}")

    profile = read_dataset_profile(project_root)
    if profile["datasets"]:
        ds_summary = json.dumps(profile["datasets"][:3], indent=2)
        parts.append(f"## Known Datasets\n```json\n{ds_summary}\n```")

    registry = read_model_registry(project_root)
    if registry["models"]:
        m_summary = json.dumps(registry["models"][:3], indent=2)
        parts.append(f"## Model Registry\n```json\n{m_summary}\n```")

    return "\n\n".join(parts) if parts else ""
