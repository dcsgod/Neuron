"""
Project Indexer — embeds source files into ChromaDB vector store.
Runs on project open and watches for file changes.
"""
import os
import asyncio
import hashlib
from pathlib import Path
from typing import List, Optional
from datetime import datetime

import chromadb
from chromadb.config import Settings

INDEXABLE_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx",
    ".md", ".txt", ".yaml", ".yml", ".toml",
    ".json", ".sql", ".sh", ".rs", ".go",
    ".ipynb", ".csv",
}

SKIP_DIRS = {
    ".git", "__pycache__", "node_modules", ".venv", "venv",
    "dist", "build", ".next", ".neuron/index",
}

MAX_FILE_BYTES = 100_000  # Skip files > 100KB
CHUNK_SIZE = 1_500        # chars per chunk
CHUNK_OVERLAP = 200

# Singleton Chroma client (file-based, no server needed)
_chroma_client: Optional[chromadb.PersistentClient] = None
_collections: dict = {}


def get_chroma_client(project_root: str) -> chromadb.PersistentClient:
    global _chroma_client
    index_path = str(Path(project_root) / ".neuron" / "index" / "chroma")
    Path(index_path).mkdir(parents=True, exist_ok=True)
    _chroma_client = chromadb.PersistentClient(
        path=index_path,
        settings=Settings(anonymized_telemetry=False),
    )
    return _chroma_client


def get_collection(project_root: str, name: str = "code"):
    client = get_chroma_client(project_root)
    return client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )


def _chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunks.append(text[start:end])
        start += size - overlap
    return chunks


def _file_hash(path: str) -> str:
    try:
        content = Path(path).read_bytes()
        return hashlib.md5(content).hexdigest()
    except Exception:
        return ""


def index_file(project_root: str, file_path: str) -> int:
    """
    Index a single file into the code collection.
    Returns number of chunks added.
    """
    path = Path(file_path)
    if not path.exists() or not path.is_file():
        return 0
    if path.suffix.lower() not in INDEXABLE_EXTENSIONS:
        return 0

    size = path.stat().st_size
    if size > MAX_FILE_BYTES:
        return 0

    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return 0

    if not text.strip():
        return 0

    collection = get_collection(project_root, "code")
    file_hash = _file_hash(file_path)
    rel_path = str(path.relative_to(project_root)) if path.is_absolute() else str(path)

    # Delete existing chunks for this file
    try:
        existing = collection.get(where={"source": rel_path})
        if existing["ids"]:
            collection.delete(ids=existing["ids"])
    except Exception:
        pass

    chunks = _chunk_text(text)
    if not chunks:
        return 0

    ids = [f"{rel_path}::chunk::{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "source": rel_path,
            "file_hash": file_hash,
            "chunk_index": i,
            "extension": path.suffix,
            "indexed_at": datetime.now().isoformat(),
        }
        for i in range(len(chunks))
    ]

    collection.add(documents=chunks, ids=ids, metadatas=metadatas)
    return len(chunks)


async def index_project(project_root: str) -> dict:
    """
    Walk entire project and index all indexable files.
    Returns stats dict.
    """
    stats = {"files": 0, "chunks": 0, "skipped": 0}

    for root, dirs, files in os.walk(project_root):
        # Prune skipped dirs in-place
        dirs[:] = [
            d for d in dirs
            if d not in SKIP_DIRS and not d.startswith(".")
        ]
        for filename in files:
            full_path = os.path.join(root, filename)
            ext = Path(filename).suffix.lower()
            if ext not in INDEXABLE_EXTENSIONS:
                stats["skipped"] += 1
                continue
            # Yield control every 10 files to avoid blocking
            if stats["files"] % 10 == 0:
                await asyncio.sleep(0)
            count = index_file(project_root, full_path)
            if count > 0:
                stats["files"] += 1
                stats["chunks"] += count
            else:
                stats["skipped"] += 1

    return stats


def search_code(project_root: str, query: str, n_results: int = 5) -> List[dict]:
    """
    Semantic search over indexed code.
    Returns list of {source, content, score} dicts.
    """
    try:
        collection = get_collection(project_root, "code")
        results = collection.query(
            query_texts=[query],
            n_results=min(n_results, collection.count()),
            include=["documents", "metadatas", "distances"],
        )
        if not results["ids"] or not results["ids"][0]:
            return []
        output = []
        for i, doc in enumerate(results["documents"][0]):
            output.append({
                "source": results["metadatas"][0][i].get("source", ""),
                "content": doc,
                "score": round(1 - results["distances"][0][i], 3),
                "extension": results["metadatas"][0][i].get("extension", ""),
            })
        return output
    except Exception as e:
        return []


def get_index_stats(project_root: str) -> dict:
    try:
        collection = get_collection(project_root, "code")
        count = collection.count()
        return {"total_chunks": count, "status": "ready" if count > 0 else "empty"}
    except Exception:
        return {"total_chunks": 0, "status": "not_initialized"}
