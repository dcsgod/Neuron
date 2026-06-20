from fastapi import APIRouter, HTTPException, Query
from models.schemas import FileNode, FileSaveRequest
from services.file_service import build_file_tree, read_file_content, save_file_content
from typing import List

router = APIRouter(prefix="/api/files", tags=["files"])


@router.get("/tree", response_model=List[FileNode])
async def get_file_tree(root: str = Query(..., description="Absolute path to root directory")):
    """Return recursive file tree for a given root directory."""
    try:
        return build_file_tree(root)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/content")
async def get_file_content(path: str = Query(..., description="Absolute path to file")):
    """Return file content as text."""
    try:
        content = read_file_content(path)
        return {"path": path, "content": content}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/save")
async def save_file(request: FileSaveRequest):
    """Save content to a file."""
    try:
        save_file_content(request.path, request.content)
        return {"success": True, "path": request.path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
