import json
import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from models.schemas import ChatRequest
from services.ollama_client import stream_chat, list_local_models

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("")
async def chat_stream(request: ChatRequest):
    """Stream a chat completion from local Ollama."""

    async def event_generator():
        async for chunk in stream_chat(
            messages=request.messages,
            model=request.model,
            temperature=request.temperature or 0.7,
            max_tokens=request.max_tokens or 4096,
        ):
            yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/models")
async def get_models():
    """List locally available Ollama models."""
    models = await list_local_models()
    return {"models": models}
