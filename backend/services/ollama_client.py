import httpx
import json
import time
import asyncio
from typing import AsyncGenerator, List, Optional, Dict, Any
from models.schemas import ChatMessage, TokenStats

import os
OLLAMA_BASE_URL = os.getenv("OLLAMA_HOST", "http://localhost:11434")

# Model routing rules: keyword patterns → preferred model
MODEL_ROUTING_RULES = [
    (["reason", "explain", "why", "analyze", "architecture", "design"], "nemotron-mini"),
    (["code", "function", "debug", "implement", "class", "script"], "qwen2.5-coder"),
    (["quick", "short", "summarize", "list"], "phi3"),
]

DEFAULT_MODEL = "qwen2.5-coder"


async def list_local_models() -> List[str]:
    """Return list of models available in local Ollama."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            resp.raise_for_status()
            data = resp.json()
            return [m["name"] for m in data.get("models", [])]
    except Exception:
        return []


def route_model(messages: List[ChatMessage], preferred: Optional[str] = None) -> str:
    """Auto-select model based on message content."""
    if preferred:
        return preferred
    last_user = next(
        (m.content.lower() for m in reversed(messages) if m.role == "user"), ""
    )
    for keywords, model in MODEL_ROUTING_RULES:
        if any(kw in last_user for kw in keywords):
            return model
    return DEFAULT_MODEL


async def stream_chat(
    messages: List[ChatMessage],
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Stream chat completions from Ollama.
    Yields dicts with keys: type, content, stats
    """
    selected_model = route_model(messages, model)
    payload = {
        "model": selected_model,
        "messages": [{"role": m.role.value, "content": m.content} for m in messages],
        "stream": True,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }

    start_time = time.monotonic()
    completion_tokens = 0
    prompt_tokens = 0

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_BASE_URL}/api/chat",
                json=payload,
            ) as response:
                response.raise_for_status()

                # Yield model selection info
                yield {
                    "type": "model_selected",
                    "model": selected_model,
                }

                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    if chunk.get("done"):
                        # Final stats from Ollama
                        elapsed = time.monotonic() - start_time
                        prompt_tokens = chunk.get("prompt_eval_count", 0)
                        completion_tokens = chunk.get("eval_count", 0)
                        tok_per_sec = completion_tokens / max(elapsed, 0.001)

                        stats = TokenStats(
                            prompt_tokens=prompt_tokens,
                            completion_tokens=completion_tokens,
                            total_tokens=prompt_tokens + completion_tokens,
                            tokens_per_sec=round(tok_per_sec, 1),
                            latency_ms=round(elapsed * 1000, 1),
                            context_used_pct=round(
                                (prompt_tokens + completion_tokens) / 32768 * 100, 1
                            ),
                            context_window=32768,
                            cost_usd=0.0,
                        )
                        yield {"type": "stats", "stats": stats.model_dump()}
                        break

                    message = chunk.get("message", {})
                    content = message.get("content", "")
                    if content:
                        completion_tokens += 1
                        yield {"type": "token", "content": content}

    except httpx.ConnectError:
        yield {
            "type": "error",
            "content": "Cannot connect to Ollama. Make sure it is running: `ollama serve`",
        }
    except httpx.HTTPStatusError as e:
        yield {"type": "error", "content": f"Ollama API error: {e.response.status_code}"}
    except Exception as e:
        yield {"type": "error", "content": f"Unexpected error: {str(e)}"}
