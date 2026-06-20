"""
Optimizer router — Phase 6 model routing optimization endpoints.
"""
from fastapi import APIRouter, HTTPException
from services.optimizer import get_optimization_report, get_optimal_model

router = APIRouter(prefix="/api/optimizer", tags=["optimizer"])


@router.get("/report")
async def get_report(project_root: str):
    """Full optimization report: recommendations, context efficiency, per-agent stats."""
    try:
        return get_optimization_report(project_root)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/recommend")
async def recommend_model(project_root: str, agent_type: str = "code"):
    """Get the learned optimal model for a given agent type."""
    try:
        model = get_optimal_model(project_root, agent_type)
        return {"agent_type": agent_type, "recommended_model": model}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
