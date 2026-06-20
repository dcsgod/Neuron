"""
Specialized agents — each extends BaseAgent with domain-specific
system prompts, tools, and model choices.
"""
from agents.base_agent import BaseAgent
from agents.tools import CODE_TOOLS, DATA_TOOLS, ML_TOOLS, RESEARCH_TOOLS


class CodeAgent(BaseAgent):
    name = "Code Agent"
    description = "Writes, reads, debugs, and explains code"
    model = "qwen2.5-coder"
    tools = CODE_TOOLS

    SYSTEM_PROMPT = """You are an expert software engineer and data scientist.
You write clean, well-documented Python, SQL, and TypeScript code.
You always read existing files before writing new ones.
You explain your reasoning clearly.
When you write code, use best practices for ML and data science."""


class DataAgent(BaseAgent):
    name = "Data Agent"
    description = "Analyzes datasets, detects issues, profiles schemas"
    model = "qwen2.5-coder"
    tools = DATA_TOOLS

    SYSTEM_PROMPT = """You are an expert data analyst and data engineer.
You analyze datasets thoroughly:
- Check schema and types
- Find missing values and outliers
- Detect leakage and class imbalance  
- Suggest appropriate transformations
- Recommend suitable ML models
Always save dataset findings to project memory."""


class MLAgent(BaseAgent):
    name = "ML Optimization Agent"
    description = "Trains, evaluates, and optimizes ML models"
    model = "qwen2.5-coder"
    tools = ML_TOOLS

    SYSTEM_PROMPT = """You are an expert ML engineer.
You optimize model performance systematically:
1. Review past experiments from memory
2. Identify what changed between runs
3. Propose specific improvements with reasoning
4. Generate training code
5. Save experiment results to memory
Always explain WHY an improvement should work, not just what to change."""


class ResearchAgent(BaseAgent):
    name = "Research Agent"
    description = "Reads papers and technical docs, extracts implementations"
    model = "qwen2.5-coder"
    tools = RESEARCH_TOOLS

    SYSTEM_PROMPT = """You are an expert ML researcher.
You read papers and technical documentation and:
- Extract key algorithms and architectures
- Identify implementation steps
- Connect theory to practical code
- Generate starter implementations
Cite sources and note any limitations or assumptions."""


class CloudAgent(BaseAgent):
    name = "Cloud Agent"
    description = "Manages cloud deployments and infrastructure"
    model = "qwen2.5-coder"
    tools = CODE_TOOLS

    SYSTEM_PROMPT = """You are an expert MLOps and cloud engineer.
You help deploy models and manage cloud infrastructure.
You are familiar with: Databricks, Azure ML, AWS SageMaker, GCP Vertex AI.
You generate CLI commands and configuration files.
Always explain costs and tradeoffs before recommending a deployment target."""


# Agent registry
AGENT_REGISTRY = {
    "code": CodeAgent,
    "data": DataAgent,
    "ml": MLAgent,
    "research": ResearchAgent,
    "cloud": CloudAgent,
}

DEFAULT_AGENT = "code"


def route_agent(user_message: str) -> str:
    """Auto-route to appropriate agent based on message content."""
    msg = user_message.lower()
    if any(k in msg for k in ["dataset", "csv", "column", "missing", "profile", "schema", "data"]):
        return "data"
    if any(k in msg for k in ["train", "accuracy", "loss", "model", "experiment", "hyperparameter", "optimize"]):
        return "ml"
    if any(k in msg for k in ["paper", "arxiv", "research", "algorithm", "architecture", "transformer"]):
        return "research"
    if any(k in msg for k in ["deploy", "cloud", "kubernetes", "docker", "azure", "aws", "databricks"]):
        return "cloud"
    return "code"
