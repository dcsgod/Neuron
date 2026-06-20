from pydantic import BaseModel, Field
from typing import Optional, List, Any
from enum import Enum


class MessageRole(str, Enum):
    user = "user"
    assistant = "assistant"
    system = "system"


class ChatMessage(BaseModel):
    role: MessageRole
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None  # None = auto-route
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 4096
    stream: bool = True


class TokenStats(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    tokens_per_sec: float = 0.0
    latency_ms: float = 0.0
    context_used_pct: float = 0.0
    context_window: int = 32768
    cost_usd: float = 0.0  # Always 0 for local


class FileNode(BaseModel):
    name: str
    path: str
    type: str  # "file" | "directory"
    extension: Optional[str] = None
    children: Optional[List["FileNode"]] = None
    size: Optional[int] = None


FileNode.model_rebuild()


class FileContentRequest(BaseModel):
    path: str


class FileSaveRequest(BaseModel):
    path: str
    content: str


class HealthStatus(BaseModel):
    status: str  # "ok" | "degraded" | "error"
    python_version: str
    ollama_running: bool
    ollama_models: List[str]
    cuda_available: bool
    cuda_version: Optional[str]
    disk_free_gb: float
    issues: List[str]


class AgentStep(BaseModel):
    index: int
    description: str
    status: str  # "pending" | "running" | "done" | "error"
    timestamp: Optional[str] = None
    tokens_used: int = 0


class AgentState(BaseModel):
    agent_name: str = "Code Agent"
    task: str = ""
    status: str = "idle"  # idle | thinking | running | done | error
    steps: List[AgentStep] = []
    confidence: float = 0.0
    total_tokens: int = 0
    context_saved_pct: float = 0.0
