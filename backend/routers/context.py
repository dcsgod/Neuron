"""
Context router — project indexing, memory, and context planning.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel
from typing import Optional

from services.indexer import index_project, search_code, get_index_stats
from services.memory_service import (
    read_all_memory, write_memory_file, read_memory_file,
    get_project_context_summary
)
from services.context_planner import plan_context
from services.dataset_profiler import profile_dataset
from services.memory_service import update_dataset_profile

router = APIRouter(prefix="/api/context", tags=["context"])


class WriteMemoryRequest(BaseModel):
    project_root: str
    filename: str
    content: str


class ProfileDatasetRequest(BaseModel):
    project_root: str
    file_path: str


class PlanContextRequest(BaseModel):
    project_root: str
    query: str
    active_file: Optional[str] = None


# ─── Indexing ──────────────────────────────────────────────────
@router.post("/index")
async def trigger_index(project_root: str, background_tasks: BackgroundTasks):
    """Start background indexing of a project."""
    if not project_root:
        raise HTTPException(status_code=400, detail="project_root is required")
    background_tasks.add_task(_do_index, project_root)
    return {"status": "indexing_started", "project_root": project_root}


async def _do_index(project_root: str):
    try:
        await index_project(project_root)
    except Exception as e:
        print(f"Indexing error: {e}")


@router.get("/index/stats")
async def get_index_stats_endpoint(project_root: str = Query(...)):
    """Return indexing statistics for a project."""
    try:
        return get_index_stats(project_root)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/search")
async def search_project(
    project_root: str = Query(...),
    query: str = Query(...),
    n: int = Query(5, ge=1, le=20),
):
    """Semantic search over indexed project code."""
    try:
        results = search_code(project_root, query, n_results=n)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Memory ────────────────────────────────────────────────────
@router.get("/memory")
async def get_all_memory(project_root: str = Query(...)):
    """Return all .neuron/memory/ files."""
    try:
        return {"memory": read_all_memory(project_root)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/memory/summary")
async def get_memory_summary(project_root: str = Query(...)):
    """Return compact project context summary."""
    try:
        return {"summary": get_project_context_summary(project_root)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/memory/write")
async def write_memory(request: WriteMemoryRequest):
    """Write a memory file."""
    try:
        write_memory_file(request.project_root, request.filename, request.content)
        return {"status": "ok", "filename": request.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Context Planning ──────────────────────────────────────────
@router.post("/plan")
async def plan_request_context(request: PlanContextRequest):
    """Plan context for an agent request. Returns selected context pieces and stats."""
    try:
        result = plan_context(
            project_root=request.project_root,
            user_query=request.query,
            active_file=request.active_file,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Dataset Profiling ──────────────────────────────────────────
@router.post("/dataset/profile")
async def profile_dataset_endpoint(request: ProfileDatasetRequest):
    """Profile a dataset file and return analysis."""
    try:
        profile = profile_dataset(request.file_path)
        # Save to project memory
        update_dataset_profile(request.project_root, {
            "name": profile["name"],
            "path": profile["path"],
            "rows": profile["rows"],
            "columns": len(profile["columns"]),
            "task_type": profile["task_type"],
            "target_column": profile["target_column"],
            "issues_count": len(profile["issues"]),
        })
        return profile
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
