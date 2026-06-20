import os
import sys
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

sys.path.insert(0, str(Path(__file__).parent))

from routers import chat, files, health
from routers import context, projects, agents
from routers import experiments, arena, cloud
from routers import research, optimizer, notebooks

app = FastAPI(
    title="Neuron IDE Backend",
    description="Local AI-native IDE backend for Data Scientists & ML Engineers",
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "tauri://localhost",
        "http://tauri.localhost",
        "http://localhost:1420",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:1420",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Phase 1 — IDE shell
app.include_router(chat.router)
app.include_router(files.router)
app.include_router(health.router)

# Phase 2 — Context engine
app.include_router(context.router)
app.include_router(projects.router)

# Phase 3 — Agent runtime
app.include_router(agents.router)

# Phase 4 — ML features
app.include_router(experiments.router)
app.include_router(arena.router)

# Phase 5 — Cloud integrations
app.include_router(cloud.router)

# Phase 6 — Optimization + new features
app.include_router(research.router)
app.include_router(optimizer.router)
app.include_router(notebooks.router)


@app.get("/")
async def root():
    # Serve index.html if the React build exists (Docker/web mode)
    dist = _dist_path()
    if dist:
        return FileResponse(str(dist / "index.html"))
    return {"name": "Neuron IDE Backend", "version": "0.3.0", "status": "running"}


# ─── SPA static file serving (Docker / web mode) ──────────────────
# When the React build exists next to the backend, serve it.
# All non-API paths return index.html so client-side routing works.

def _dist_path() -> Path | None:
    candidates = [
        Path(__file__).parent.parent / "dist",   # repo layout
        Path("/app/dist"),                         # Docker layout
    ]
    for p in candidates:
        if (p / "index.html").exists():
            return p
    return None


_dist = _dist_path()

if _dist:
    # Serve /assets/* as static files (JS, CSS, fonts, etc.)
    assets_dir = _dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str, request: Request):
        # Never intercept API routes (they're registered above)
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404)
        file_path = _dist / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(_dist / "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=False,
        log_level="info",
    )
