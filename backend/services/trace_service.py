"""
Trace Service — persists agent execution traces and reward signals
to .neuron/agent/traces.json and rewards.json.
"""
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional


def _agent_path(project_root: str) -> Path:
    return Path(project_root) / ".neuron" / "agent"


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text())
    except Exception:
        return default


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str))


def save_trace(project_root: str, trace: Dict[str, Any]) -> str:
    """Save a completed agent trace. Returns trace_id."""
    agent_dir = _agent_path(project_root)
    traces_path = agent_dir / "traces.json"
    data = _read_json(traces_path, {"traces": []})

    trace_id = f"trace_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')[:21]}"
    trace["trace_id"] = trace_id
    trace["timestamp"] = datetime.now().isoformat()
    data["traces"].append(trace)

    # Keep last 200 traces
    data["traces"] = data["traces"][-200:]
    _write_json(traces_path, data)
    return trace_id


def get_traces(project_root: str, limit: int = 20) -> List[Dict[str, Any]]:
    agent_dir = _agent_path(project_root)
    data = _read_json(agent_dir / "traces.json", {"traces": []})
    return list(reversed(data["traces"]))[:limit]


def save_reward(
    project_root: str,
    trace_id: str,
    accepted: bool,
    success_score: float,
    token_cost: int,
    latency_ms: float,
    notes: str = "",
) -> None:
    """
    Save a reward signal for learning.
    reward = success_score - token_cost_penalty - latency_penalty
    """
    agent_dir = _agent_path(project_root)
    rewards_path = agent_dir / "rewards.json"
    data = _read_json(rewards_path, {"rewards": []})

    token_penalty = min(token_cost / 10000, 1.0) * 0.3
    latency_penalty = min(latency_ms / 60000, 1.0) * 0.2
    reward = round(success_score - token_penalty - latency_penalty, 4)

    data["rewards"].append({
        "trace_id": trace_id,
        "timestamp": datetime.now().isoformat(),
        "accepted": accepted,
        "success_score": success_score,
        "token_cost": token_cost,
        "latency_ms": latency_ms,
        "reward": reward,
        "notes": notes,
    })
    data["rewards"] = data["rewards"][-500:]
    _write_json(rewards_path, data)


def get_reward_stats(project_root: str) -> Dict[str, Any]:
    agent_dir = _agent_path(project_root)
    data = _read_json(agent_dir / "rewards.json", {"rewards": []})
    rewards = data["rewards"]
    if not rewards:
        return {"count": 0, "avg_reward": 0, "acceptance_rate": 0}
    accepted = [r for r in rewards if r.get("accepted")]
    avg_reward = sum(r["reward"] for r in rewards) / len(rewards)
    return {
        "count": len(rewards),
        "avg_reward": round(avg_reward, 4),
        "acceptance_rate": round(len(accepted) / len(rewards), 3),
        "total_tokens_saved": sum(r.get("token_cost", 0) for r in rewards),
    }
