"""
Projects router — manage the active project root,
initialize .neuron/ structure, and start incremental file-watching index.
"""
import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path

from services.file_service import init_neuron_dir
from services.indexer import index_file, INDEXABLE_EXTENSIONS, SKIP_DIRS

router = APIRouter(prefix="/api/projects", tags=["projects"])

_active_project: dict = {"root": "", "name": ""}
_watcher_task: asyncio.Task | None = None


class OpenProjectRequest(BaseModel):
    root: str


@router.post("/open")
async def open_project(request: OpenProjectRequest):
    """Set the active project root, init .neuron/, and start file watcher."""
    global _watcher_task

    root = request.root.strip()
    path = Path(root)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Path does not exist: {root}")
    if not path.is_dir():
        raise HTTPException(status_code=400, detail=f"Path is not a directory: {root}")

    neuron_path = init_neuron_dir(root)
    _active_project["root"] = root
    _active_project["name"] = path.name

    # Cancel previous watcher if any
    if _watcher_task and not _watcher_task.done():
        _watcher_task.cancel()

    # Start incremental file watcher in background
    _watcher_task = asyncio.create_task(_watch_and_index(root))

    return {
        "status": "ok",
        "root": root,
        "name": path.name,
        "neuron_dir": neuron_path,
    }


@router.get("/active")
async def get_active_project():
    """Return the currently active project."""
    return _active_project


async def _watch_and_index(project_root: str) -> None:
    """Watch project directory and re-index changed files using watchfiles."""
    try:
        from watchfiles import awatch
        async for changes in awatch(project_root, watch_filter=_should_watch):
            for change_type, file_path in changes:
                p = Path(file_path)
                if p.suffix in INDEXABLE_EXTENSIONS and _is_indexable_path(p, project_root):
                    try:
                        index_file(project_root, str(p))
                    except Exception:
                        pass
    except asyncio.CancelledError:
        pass
    except Exception:
        pass


def _should_watch(change_type, file_path: str) -> bool:
    p = Path(file_path)
    if not p.is_file():
        return False
    if p.suffix not in INDEXABLE_EXTENSIONS:
        return False
    return True


def _is_indexable_path(p: Path, root: str) -> bool:
    parts = set(p.parts)
    for skip in SKIP_DIRS:
        if skip in parts:
            return False
    return True
