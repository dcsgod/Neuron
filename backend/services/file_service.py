import os
import json
import platform
from pathlib import Path
from typing import List, Optional
from models.schemas import FileNode


IGNORED_DIRS = {".git", "__pycache__", "node_modules", ".venv", "venv", "dist", "build", ".next"}
IGNORED_FILES = {".DS_Store", "Thumbs.db"}

MAX_TREE_DEPTH = 6


def build_file_tree(root: str, depth: int = 0) -> List[FileNode]:
    """Recursively build a file tree from a directory path."""
    if depth > MAX_TREE_DEPTH:
        return []

    root_path = Path(root)
    if not root_path.exists():
        return []

    nodes: List[FileNode] = []
    try:
        entries = sorted(root_path.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
    except PermissionError:
        return []

    for entry in entries:
        if entry.name in IGNORED_DIRS or entry.name in IGNORED_FILES:
            continue
        if entry.name.startswith(".") and entry.name != ".neuron":
            continue

        if entry.is_dir():
            children = build_file_tree(str(entry), depth + 1)
            nodes.append(FileNode(
                name=entry.name,
                path=str(entry),
                type="directory",
                children=children,
            ))
        else:
            ext = entry.suffix.lower()
            try:
                size = entry.stat().st_size
            except Exception:
                size = 0
            nodes.append(FileNode(
                name=entry.name,
                path=str(entry),
                type="file",
                extension=ext,
                size=size,
            ))

    return nodes


def read_file_content(path: str) -> str:
    """Read a file and return its content as string."""
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    if not file_path.is_file():
        raise ValueError(f"Path is not a file: {path}")

    # Limit to 5MB for safety
    size = file_path.stat().st_size
    if size > 5 * 1024 * 1024:
        raise ValueError(f"File too large to display ({size // 1024}KB). Max 5MB.")

    try:
        return file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return file_path.read_text(encoding="latin-1", errors="replace")


def save_file_content(path: str, content: str) -> None:
    """Write content to a file, creating parent dirs if needed."""
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")


def init_neuron_dir(project_root: str) -> str:
    """Initialize the .neuron/ project intelligence folder."""
    neuron_path = Path(project_root) / ".neuron"
    
    subdirs = [
        "memory",
        "index",
        "agent",
    ]
    for sub in subdirs:
        (neuron_path / sub).mkdir(parents=True, exist_ok=True)

    # Create default memory files if they don't exist
    defaults = {
        "memory/project_summary.md": "# Project Summary\n\n*No summary yet. The agent will populate this.*\n",
        "memory/decisions.md": "# Key Decisions\n\n*Decisions will be tracked here.*\n",
        "memory/failures.md": "# Known Failures\n\n*Failed experiments will be logged here.*\n",
        "memory/experiment_history.md": "# Experiment History\n\n*Experiments will be tracked here.*\n",
        "memory/dataset_profile.json": json.dumps({"datasets": []}, indent=2),
        "memory/model_registry.json": json.dumps({"models": []}, indent=2),
        "memory/architecture.md": "# Architecture\n\n*Architecture notes will be recorded here.*\n",
        "agent/traces.json": json.dumps({"traces": []}, indent=2),
        "agent/rewards.json": json.dumps({"rewards": []}, indent=2),
    }

    for rel_path, content in defaults.items():
        full_path = neuron_path / rel_path
        if not full_path.exists():
            full_path.write_text(content, encoding="utf-8")

    return str(neuron_path)
