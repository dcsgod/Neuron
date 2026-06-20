"""
Research router — import papers/docs, extract insights, generate starter code.
"""
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from services.research_service import fetch_url_content, extract_metadata, build_extraction_prompt
from services.ollama_client import stream_chat as ollama_stream
from services.memory_service import append_to_memory
from models.schemas import ChatMessage, MessageRole

router = APIRouter(prefix="/api/research", tags=["research"])


class ExtractRequest(BaseModel):
    url: Optional[str] = None
    text: Optional[str] = None
    project_root: str = ""
    task: str = "summarize"          # summarize | extract_algorithm | generate_code
    save_to_memory: bool = True


@router.post("/extract")
async def extract_insights(request: ExtractRequest):
    """Stream AI extraction from a URL or pasted text."""

    async def event_gen():
        try:
            # ── 1. Get raw content ──────────────────────────────────
            if request.url:
                yield f"data: {json.dumps({'type': 'status', 'message': f'Fetching {request.url}…'})}\n\n"
                try:
                    content = await fetch_url_content(request.url)
                except Exception as exc:
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Fetch failed: {exc}'})}\n\n"
                    yield "data: [DONE]\n\n"
                    return
            elif request.text:
                content = request.text
            else:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Provide url or text'})}\n\n"
                yield "data: [DONE]\n\n"
                return

            meta = extract_metadata(content, request.url or "")
            yield f"data: {json.dumps({'type': 'metadata', 'data': meta})}\n\n"

            # ── 2. Build prompt and stream LLM response ─────────────
            prompt = build_extraction_prompt(request.task, content)
            yield f"data: {json.dumps({'type': 'status', 'message': 'Analyzing with AI…'})}\n\n"

            messages = [
                ChatMessage(
                    role=MessageRole.system,
                    content=(
                        "You are an expert ML researcher. Extract structured, actionable insights "
                        "from papers and technical documents. Be precise and practical."
                    ),
                ),
                ChatMessage(role=MessageRole.user, content=prompt),
            ]

            full_response = ""
            async for chunk in ollama_stream(messages):
                if chunk.get("type") == "token":
                    full_response += chunk.get("content", "")
                    yield f"data: {json.dumps(chunk)}\n\n"

            # ── 3. Save to project memory ────────────────────────────
            saved = False
            if request.project_root and request.save_to_memory and full_response:
                title = meta.get("title", request.url or "manual input")[:60]
                entry = f"\n## [{request.task}] {title}\nSource: {request.url or 'pasted text'}\n{full_response[:600]}\n"
                try:
                    append_to_memory(request.project_root, "decisions.md", entry)
                    saved = True
                except Exception:
                    pass

            yield f"data: {json.dumps({'type': 'done', 'saved': saved})}\n\n"

        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
