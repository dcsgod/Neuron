from fastapi import APIRouter
from services.health_service import get_health, get_full_health

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
async def health_check():
    """Basic environment doctor check."""
    health = await get_health()
    return health


@router.get("/full")
async def full_health_check():
    """Extended health report with packages, GPU memory, and MLflow status."""
    return await get_full_health()
