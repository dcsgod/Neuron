"""
Optimizer Service — Phase 6.
Learns from reward signals to recommend optimal model-agent pairings
and tracks context selection efficiency over time.
"""
from __future__ import annotations
from typing import Dict, Any, List
from services.trace_service import _agent_path, _read_json

# Default model fallbacks for each agent type
DEFAULT_MODELS: Dict[str, str] = {
    "code": "qwen2.5-coder",
    "data": "qwen2.5-coder",
    "ml": "qwen2.5-coder",
    "research": "qwen2.5-coder",
    "cloud": "qwen2.5-coder",
}


def _load_traces_and_rewards(project_root: str):
    agent_dir = _agent_path(project_root)
    traces = _read_json(agent_dir / "traces.json", {"traces": []})["traces"]
    rewards = _read_json(agent_dir / "rewards.json", {"rewards": []})["rewards"]
    reward_map = {r["trace_id"]: r for r in rewards}
    return traces, reward_map


def analyze_routing_performance(project_root: str) -> Dict[str, Dict[str, Any]]:
    """
    Return per-agent performance broken down by model.
    { "code": { "qwen2.5-coder": { avg_reward, count, acceptance_rate } } }
    """
    traces, reward_map = _load_traces_and_rewards(project_root)

    perf: Dict[str, Dict[str, List[float]]] = {}
    accepted: Dict[str, Dict[str, int]] = {}

    for trace in traces:
        tid = trace.get("trace_id", "")
        agent = trace.get("agent_type", "code")
        model = trace.get("model", "unknown")

        if tid not in reward_map:
            continue

        r = reward_map[tid]
        perf.setdefault(agent, {}).setdefault(model, []).append(r["reward"])
        if r.get("accepted"):
            accepted.setdefault(agent, {}).setdefault(model, 0)
            accepted[agent][model] += 1

    result: Dict[str, Dict[str, Any]] = {}
    for agent, models in perf.items():
        result[agent] = {}
        for model, rewards in models.items():
            cnt = len(rewards)
            acc_cnt = accepted.get(agent, {}).get(model, 0)
            result[agent][model] = {
                "avg_reward": round(sum(rewards) / cnt, 4),
                "count": cnt,
                "acceptance_rate": round(acc_cnt / cnt, 3) if cnt else 0,
            }

    return result


def get_optimal_model(project_root: str, agent_type: str) -> str:
    """Return the best model for an agent type based on reward history (min 3 samples)."""
    perf = analyze_routing_performance(project_root)
    agent_perf = perf.get(agent_type, {})

    best_model = None
    best_score = -float("inf")
    for model, stats in agent_perf.items():
        if stats["count"] >= 3 and stats["avg_reward"] > best_score:
            best_score = stats["avg_reward"]
            best_model = model

    return best_model or DEFAULT_MODELS.get(agent_type, "qwen2.5-coder")


def get_context_efficiency(project_root: str) -> Dict[str, Any]:
    """Analyse how much context the planner is saving on average."""
    traces, _ = _load_traces_and_rewards(project_root)
    if not traces:
        return {"avg_saved_pct": 0, "total_tokens_saved": 0, "sample_count": 0}

    saved_pcts = [t.get("context_saved_pct", 0) for t in traces if "context_saved_pct" in t]
    token_costs = [t.get("token_cost", 0) for t in traces if "token_cost" in t]

    return {
        "avg_saved_pct": round(sum(saved_pcts) / len(saved_pcts), 1) if saved_pcts else 0,
        "total_tokens_saved": sum(token_costs),
        "sample_count": len(traces),
    }


def get_optimization_report(project_root: str) -> Dict[str, Any]:
    """Full Phase 6 optimization report with model recommendations."""
    perf = analyze_routing_performance(project_root)
    efficiency = get_context_efficiency(project_root)

    recommendations: List[Dict[str, Any]] = []
    for agent_type in DEFAULT_MODELS:
        optimal = get_optimal_model(project_root, agent_type)
        agent_perf = perf.get(agent_type, {})
        stats = agent_perf.get(optimal, {})

        recommendations.append({
            "agent": agent_type,
            "recommended_model": optimal,
            "is_learned": stats.get("count", 0) >= 3,
            "avg_reward": stats.get("avg_reward", 0),
            "acceptance_rate": stats.get("acceptance_rate", 0),
            "sample_count": stats.get("count", 0),
        })

    total_traces = sum(
        sum(s["count"] for s in models.values())
        for models in perf.values()
    )

    return {
        "recommendations": recommendations,
        "context_efficiency": efficiency,
        "performance_by_agent": perf,
        "total_traced_runs": total_traces,
        "phase": 6,
    }
