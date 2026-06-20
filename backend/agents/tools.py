"""
Agent tools — functions available to all LangGraph agents.
Each tool is a plain Python function decorated with @tool.
"""
import subprocess
import sys
from pathlib import Path
from typing import Optional

from langchain_core.tools import tool
from services.file_service import read_file_content, save_file_content, build_file_tree
from services.indexer import search_code
from services.memory_service import (
    read_memory_file, write_memory_file, append_to_memory,
    update_dataset_profile, read_dataset_profile,
)


# ─── File tools ────────────────────────────────────────────────
@tool
def read_file(path: str) -> str:
    """Read the content of a file. Returns the file content as text."""
    try:
        return read_file_content(path)
    except Exception as e:
        return f"ERROR: {e}"


@tool
def write_file(path: str, content: str) -> str:
    """Write content to a file, creating parent directories if needed."""
    try:
        save_file_content(path, content)
        return f"Successfully wrote {len(content)} characters to {path}"
    except Exception as e:
        return f"ERROR: {e}"


@tool
def list_project_files(project_root: str) -> str:
    """List all files in a project directory as a tree."""
    try:
        tree = build_file_tree(project_root, depth=0)
        lines = []
        def _fmt(nodes, indent=0):
            for n in nodes:
                prefix = "  " * indent
                lines.append(f"{prefix}{'📁' if n.type == 'directory' else '📄'} {n.name}")
                if n.children:
                    _fmt(n.children, indent + 1)
        _fmt(tree)
        return "\n".join(lines) or "(empty directory)"
    except Exception as e:
        return f"ERROR: {e}"


# ─── Code search ───────────────────────────────────────────────
@tool
def semantic_search_code(project_root: str, query: str) -> str:
    """Search the project codebase semantically. Returns relevant code snippets."""
    results = search_code(project_root, query, n_results=4)
    if not results:
        return "No relevant code found in index. Make sure the project is indexed."
    lines = []
    for r in results:
        lines.append(f"### {r['source']} (score: {r['score']})")
        lines.append(f"```\n{r['content'][:600]}\n```")
    return "\n\n".join(lines)


# ─── Memory tools ──────────────────────────────────────────────
@tool
def read_project_memory(project_root: str, filename: str = "project_summary.md") -> str:
    """Read a file from .neuron/memory/. Valid files: project_summary.md, decisions.md, failures.md, experiment_history.md, architecture.md"""
    content = read_memory_file(project_root, filename)
    return content if content.strip() else f"{filename} is empty."


@tool
def write_project_memory(project_root: str, filename: str, content: str) -> str:
    """Write to a .neuron/memory/ file to persist project knowledge."""
    try:
        write_memory_file(project_root, filename, content)
        return f"Memory saved to {filename}"
    except Exception as e:
        return f"ERROR: {e}"


@tool
def append_project_memory(project_root: str, filename: str, entry: str) -> str:
    """Append a timestamped entry to a .neuron/memory/ file."""
    try:
        append_to_memory(project_root, filename, entry)
        return f"Entry appended to {filename}"
    except Exception as e:
        return f"ERROR: {e}"


# ─── Code execution ────────────────────────────────────────────
@tool
def run_python_snippet(code: str, timeout: int = 30) -> str:
    """Execute a Python code snippet and return stdout + stderr. Limited to 30s."""
    try:
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        output = []
        if result.stdout:
            output.append(f"STDOUT:\n{result.stdout[:2000]}")
        if result.stderr:
            output.append(f"STDERR:\n{result.stderr[:500]}")
        if result.returncode != 0:
            output.append(f"Exit code: {result.returncode}")
        return "\n".join(output) or "(no output)"
    except subprocess.TimeoutExpired:
        return f"ERROR: Timed out after {timeout}s"
    except Exception as e:
        return f"ERROR: {e}"


@tool
def run_shell_command(command: str, cwd: Optional[str] = None) -> str:
    """Run a shell command (PowerShell on Windows). Use cautiously."""
    try:
        result = subprocess.run(
            ["powershell", "-Command", command],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=cwd,
        )
        out = result.stdout[:2000] if result.stdout else ""
        err = result.stderr[:500] if result.stderr else ""
        return f"{out}\n{err}".strip() or "(no output)"
    except subprocess.TimeoutExpired:
        return "ERROR: Command timed out after 60s"
    except Exception as e:
        return f"ERROR: {e}"


# ─── Dataset tools ─────────────────────────────────────────────
@tool
def get_dataset_info(project_root: str) -> str:
    """Get information about datasets registered in this project."""
    profile = read_dataset_profile(project_root)
    datasets = profile.get("datasets", [])
    if not datasets:
        return "No datasets registered. Import a CSV/Parquet file first."
    import json
    return json.dumps(datasets, indent=2)


# Tool registry for each agent type
CODE_TOOLS = [read_file, write_file, list_project_files, semantic_search_code,
              read_project_memory, write_project_memory, append_project_memory,
              run_python_snippet]

DATA_TOOLS = [read_file, list_project_files, semantic_search_code,
              read_project_memory, write_project_memory, append_project_memory,
              get_dataset_info, run_python_snippet]

ML_TOOLS = [read_file, write_file, list_project_files, semantic_search_code,
            read_project_memory, write_project_memory, append_project_memory,
            get_dataset_info, run_python_snippet, run_shell_command]

RESEARCH_TOOLS = [read_file, write_file, semantic_search_code,
                  read_project_memory, write_project_memory, append_project_memory]
