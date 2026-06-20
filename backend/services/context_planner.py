"""
Context Planner — selects the minimal, highest-value context
for each agent request.

Reward = relevance_score - token_cost_penalty - latency_penalty
"""
from typing import List, Dict, Any, Optional
from services.indexer import search_code
from services.memory_service import get_project_context_summary, read_memory_file
from services.file_service import read_file_content
from pathlib import Path
import json

MAX_CONTEXT_CHARS = 8_000   # approx 2K tokens
MIN_SCORE_THRESHOLD = 0.4   # ignore low-relevance results


class ContextPiece:
    def __init__(self, label: str, content: str, score: float, tokens: int = 0):
        self.label = label
        self.content = content
        self.score = score
        self.tokens = tokens or (len(content) // 4)

    @property
    def reward(self) -> float:
        """reward = relevance - token_cost_penalty"""
        token_cost = self.tokens / 4096  # normalized
        return self.score - (token_cost * 0.3)


def plan_context(
    project_root: str,
    user_query: str,
    active_file: Optional[str] = None,
    max_chars: int = MAX_CONTEXT_CHARS,
) -> Dict[str, Any]:
    """
    Given a user query, build the optimal context block.
    Returns dict with: system_context, pieces, stats
    """
    pieces: List[ContextPiece] = []
    
    # 1. Project memory (always included, low cost)
    memory_summary = get_project_context_summary(project_root)
    if memory_summary:
        pieces.append(ContextPiece(
            label="project_memory",
            content=memory_summary,
            score=0.9,
        ))

    # 2. Active file (if open, very high relevance)
    if active_file:
        try:
            file_content = read_file_content(active_file)
            # Truncate large files
            if len(file_content) > 3000:
                file_content = file_content[:3000] + "\n... [truncated]"
            fname = Path(active_file).name
            pieces.append(ContextPiece(
                label=f"active_file:{fname}",
                content=f"# Currently open: {fname}\n```\n{file_content}\n```",
                score=0.95,
            ))
        except Exception:
            pass

    # 3. Semantic code search
    if project_root:
        code_results = search_code(project_root, user_query, n_results=6)
        for r in code_results:
            if r["score"] < MIN_SCORE_THRESHOLD:
                continue
            snippet = r["content"]
            if len(snippet) > 800:
                snippet = snippet[:800] + "..."
            pieces.append(ContextPiece(
                label=f"code:{r['source']}",
                content=f"# {r['source']} (relevance: {r['score']})\n```\n{snippet}\n```",
                score=r["score"],
            ))

    # 4. Experiment history (if ML-related query)
    ml_keywords = ["model", "train", "accuracy", "loss", "experiment", "dataset", "feature"]
    if any(kw in user_query.lower() for kw in ml_keywords):
        exp_history = read_memory_file(project_root, "experiment_history.md")
        if exp_history.strip() and "Experiments will be tracked" not in exp_history:
            pieces.append(ContextPiece(
                label="experiment_history",
                content=f"## Experiment History\n{exp_history[-600:]}",
                score=0.75,
            ))

    # 5. Sort by reward score (descending)
    pieces.sort(key=lambda p: p.reward, reverse=True)

    # 6. Greedily fill context budget
    selected: List[ContextPiece] = []
    used_chars = 0
    for piece in pieces:
        if used_chars + len(piece.content) > max_chars:
            # Try to fit a truncated version
            remaining = max_chars - used_chars
            if remaining > 200:
                truncated = ContextPiece(
                    label=piece.label,
                    content=piece.content[:remaining] + "\n... [context limit]",
                    score=piece.score,
                )
                selected.append(truncated)
                used_chars += len(truncated.content)
            break
        selected.append(piece)
        used_chars += len(piece.content)

    # 7. Build system context string
    if selected:
        context_parts = ["<project_context>"]
        for p in selected:
            context_parts.append(p.content)
        context_parts.append("</project_context>")
        system_context = "\n\n".join(context_parts)
    else:
        system_context = ""

    # 8. Calculate savings
    total_available = sum(len(p.content) for p in pieces)
    saved_pct = round((1 - used_chars / max(total_available, 1)) * 100, 1)

    return {
        "system_context": system_context,
        "pieces": [
            {
                "label": p.label,
                "chars": len(p.content),
                "score": round(p.score, 3),
                "reward": round(p.reward, 3),
            }
            for p in selected
        ],
        "stats": {
            "total_chars": used_chars,
            "pieces_selected": len(selected),
            "pieces_available": len(pieces),
            "context_saved_pct": saved_pct,
        },
    }
