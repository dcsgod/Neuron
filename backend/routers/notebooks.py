"""
Notebooks router — execute individual cells and parse .ipynb files.
"""
import json
import subprocess
import sys
import threading
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/notebooks", tags=["notebooks"])


class ExecuteCellRequest(BaseModel):
    code: str
    project_root: str = ""
    timeout: int = 60


class SaveNotebookRequest(BaseModel):
    path: str
    notebook: dict


@router.post("/execute")
async def execute_cell(request: ExecuteCellRequest):
    """Execute a single code cell and stream its output."""

    async def event_gen():
        yield f"data: {json.dumps({'type': 'start'})}\n\n"
        try:
            proc = subprocess.Popen(
                [sys.executable, "-c", request.code],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=request.project_root or None,
            )

            stdout_lines: list[str] = []
            stderr_lines: list[str] = []

            def _read(pipe, buf):
                for line in pipe:
                    buf.append(line.rstrip())

            t1 = threading.Thread(target=_read, args=(proc.stdout, stdout_lines), daemon=True)
            t2 = threading.Thread(target=_read, args=(proc.stderr, stderr_lines), daemon=True)
            t1.start()
            t2.start()

            try:
                proc.wait(timeout=request.timeout)
            except subprocess.TimeoutExpired:
                proc.kill()
                yield f"data: {json.dumps({'type': 'error', 'text': f'Timed out after {request.timeout}s'})}\n\n"
                yield "data: [DONE]\n\n"
                return

            t1.join()
            t2.join()

            if stdout_lines:
                out_text = "\n".join(stdout_lines)[:5000]
                yield f"data: {json.dumps({'type': 'output', 'text': out_text})}\n\n"
            if stderr_lines:
                err_text = "\n".join(stderr_lines)[:2000]
                yield f"data: {json.dumps({'type': 'stderr', 'text': err_text})}\n\n"

            yield f"data: {json.dumps({'type': 'done', 'exit_code': proc.returncode})}\n\n"

        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'text': str(exc)})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/parse")
async def parse_notebook(path: str):
    """Parse a .ipynb file and return structured cells."""
    try:
        nb_path = Path(path)
        if not nb_path.exists():
            raise HTTPException(status_code=404, detail="Notebook not found")
        data = json.loads(nb_path.read_text(encoding="utf-8"))
        # Normalise cells
        cells = []
        for i, cell in enumerate(data.get("cells", [])):
            source = "".join(cell.get("source", []))
            outputs = []
            for out in cell.get("outputs", []):
                otype = out.get("output_type", "")
                if otype in ("stream", "display_data", "execute_result"):
                    text = "".join(out.get("text", out.get("data", {}).get("text/plain", [])))
                    if text:
                        outputs.append({"type": otype, "text": text[:2000]})
            cells.append({
                "id": cell.get("id", str(i)),
                "cell_type": cell.get("cell_type", "code"),
                "source": source,
                "outputs": outputs,
                "execution_count": cell.get("execution_count"),
            })
        return {
            "cells": cells,
            "metadata": data.get("metadata", {}),
            "nbformat": data.get("nbformat", 4),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/save")
async def save_notebook(request: SaveNotebookRequest):
    """Save a modified notebook back to disk."""
    try:
        nb_path = Path(request.path)
        nb_path.parent.mkdir(parents=True, exist_ok=True)
        nb_path.write_text(json.dumps(request.notebook, indent=2), encoding="utf-8")
        return {"status": "ok"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
