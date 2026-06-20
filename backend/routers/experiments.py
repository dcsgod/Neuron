"""
Experiments router — MLflow integration endpoints.
"""
import json
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

from services.mlflow_service import (
    start_mlflow_server, stop_mlflow_server, get_mlflow_status,
    list_experiments, list_runs, get_run_detail, compare_runs
)

router = APIRouter(prefix="/api/experiments", tags=["experiments"])


class StartServerRequest(BaseModel):
    project_root: str
    port: int = 5001


class CompareRunsRequest(BaseModel):
    project_root: str
    run_ids: List[str]


@router.post("/server/start")
async def start_server(request: StartServerRequest):
    result = start_mlflow_server(request.project_root, request.port)
    return result


@router.post("/server/stop")
async def stop_server():
    return stop_mlflow_server()


@router.get("/server/status")
async def server_status(port: int = 5001):
    return get_mlflow_status(port)


@router.get("/list")
async def get_experiments(project_root: str = Query(...)):
    return {"experiments": list_experiments(project_root)}


@router.get("/runs")
async def get_runs(
    project_root: str = Query(...),
    experiment_id: str = Query(...),
    limit: int = Query(50),
):
    return {"runs": list_runs(project_root, experiment_id, limit)}


@router.get("/run")
async def get_run(project_root: str = Query(...), run_id: str = Query(...)):
    detail = get_run_detail(project_root, run_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Run not found")
    return detail


@router.post("/compare")
async def compare(request: CompareRunsRequest):
    return compare_runs(request.project_root, request.run_ids)
