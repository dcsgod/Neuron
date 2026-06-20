"""
Model Arena router — streams model benchmarking results.
"""
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from services.model_arena import run_arena

router = APIRouter(prefix="/api/arena", tags=["arena"])


class ArenaRequest(BaseModel):
    file_path: str
    target_col: str
    task_type: str = "classification"  # or "regression"
    test_size: float = 0.2


@router.post("/run")
async def run_model_arena(request: ArenaRequest):
    """Stream model arena benchmark results."""

    async def event_gen():
        try:
            async for event in run_arena(
                file_path=request.file_path,
                target_col=request.target_col,
                task_type=request.task_type,
                test_size=request.test_size,
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
