"""
Agent router — streams agent execution via SSE.
"""
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List

from agents.specialized import AGENT_REGISTRY, route_agent
from services.trace_service import get_traces, get_reward_stats, save_reward

router = APIRouter(prefix="/api/agents", tags=["agents"])


class AgentRunRequest(BaseModel):
    message: str
    agent_type: Optional[str] = None   # None = auto-route
    project_root: str = ""
    active_file: Optional[str] = None
    model: Optional[str] = None
    conversation_history: Optional[List[dict]] = []


class RewardRequest(BaseModel):
    trace_id: str
    project_root: str
    accepted: bool
    success_score: float = 1.0
    token_cost: int = 0
    latency_ms: float = 0.0
    notes: str = ""


@router.post("/run")
async def run_agent(request: AgentRunRequest):
    """Stream agent execution as SSE."""
    # Select agent
    agent_type = request.agent_type or route_agent(request.message)
    AgentClass = AGENT_REGISTRY.get(agent_type, AGENT_REGISTRY["code"])
    agent = AgentClass(model=request.model)

    async def event_gen():
        # Emit agent selection
        yield f"data: {json.dumps({'type': 'agent_selected', 'agent': agent.name, 'agent_type': agent_type})}\n\n"

        try:
            async for event in agent.run(
                user_message=request.message,
                project_root=request.project_root,
                active_file=request.active_file,
                conversation_history=request.conversation_history,
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/types")
async def get_agent_types():
    """List available agent types."""
    return {
        "agents": [
            {"id": k, "name": v.name, "description": v.description}
            for k, v in AGENT_REGISTRY.items()
        ]
    }


@router.get("/traces")
async def get_agent_traces(project_root: str, limit: int = 20):
    """Get recent agent traces for a project."""
    try:
        traces = get_traces(project_root, limit=limit)
        return {"traces": traces}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/stats")
async def get_agent_stats(project_root: str):
    """Get reward/learning stats for a project."""
    try:
        return get_reward_stats(project_root)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reward")
async def submit_reward(request: RewardRequest):
    """Submit a reward signal for an agent trace."""
    try:
        save_reward(
            project_root=request.project_root,
            trace_id=request.trace_id,
            accepted=request.accepted,
            success_score=request.success_score,
            token_cost=request.token_cost,
            latency_ms=request.latency_ms,
            notes=request.notes,
        )
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
