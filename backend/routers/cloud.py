"""
Cloud Control Center router.
"""
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List

from services.cloud_service import (
    detect_installed_clis, stream_command,
    parse_safe_command, check_cloud_connections
)

router = APIRouter(prefix="/api/cloud", tags=["cloud"])


class RunCommandRequest(BaseModel):
    command: str
    cwd: Optional[str] = None
    timeout: int = 120


@router.get("/clis")
async def get_cli_status():
    """Detect which cloud CLIs are installed and their versions."""
    return {"clis": detect_installed_clis()}


@router.get("/connections")
async def get_connections():
    """Check active cloud connections (Git, Docker, AWS, Azure)."""
    return await check_cloud_connections()


@router.post("/run")
async def run_cloud_command(request: RunCommandRequest):
    """Run a cloud CLI command and stream output as SSE."""
    tokens, error = parse_safe_command(request.command)
    if error:
        raise HTTPException(status_code=400, detail=error)

    async def event_gen():
        async for event in stream_command(tokens, cwd=request.cwd, timeout=request.timeout):
            yield f"data: {json.dumps(event)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
