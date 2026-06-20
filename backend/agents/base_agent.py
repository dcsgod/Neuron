"""
Base Agent — LangGraph ReAct agent with Ollama backend.
All specialized agents inherit from this.
"""
import asyncio
import time
from typing import List, Dict, Any, Optional, AsyncGenerator
from datetime import datetime

from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage
from langchain_core.tools import BaseTool
from langgraph.prebuilt import create_react_agent
from langgraph.graph import StateGraph

from services.trace_service import save_trace
from services.context_planner import plan_context

import os
OLLAMA_BASE_URL = os.getenv("OLLAMA_HOST", "http://localhost:11434")
DEFAULT_MODEL = "qwen2.5-coder"


class AgentStep:
    def __init__(self, index: int, description: str):
        self.index = index
        self.description = description
        self.status = "running"
        self.tokens_used = 0
        self.started_at = datetime.now().isoformat()
        self.output: Optional[str] = None

    def complete(self, output: str = "", tokens: int = 0):
        self.status = "done"
        self.output = output
        self.tokens_used = tokens

    def fail(self, error: str = ""):
        self.status = "error"
        self.output = error

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "description": self.description,
            "status": self.status,
            "tokens_used": self.tokens_used,
            "started_at": self.started_at,
            "output": self.output,
        }


class BaseAgent:
    name: str = "Base Agent"
    description: str = "General purpose agent"
    model: str = DEFAULT_MODEL
    tools: List[BaseTool] = []

    SYSTEM_PROMPT = """You are Neuron, an expert AI agent for Data Scientists and ML Engineers.
You have access to the project's codebase, memory, and tools.
Think step by step. Use tools to gather information before responding.
Always update project memory with important findings.
Be concise but thorough."""

    def __init__(self, model: Optional[str] = None):
        self.model = model or self.model
        self._steps: List[AgentStep] = []
        self._step_index = 0

    def _build_llm(self) -> ChatOllama:
        return ChatOllama(
            model=self.model,
            base_url=OLLAMA_BASE_URL,
            temperature=0.3,
            num_predict=4096,
        )

    def _build_agent(self):
        llm = self._build_llm()
        return create_react_agent(
            llm,
            tools=self.tools,
            state_modifier=self.SYSTEM_PROMPT,
        )

    def _add_step(self, description: str) -> AgentStep:
        step = AgentStep(self._step_index, description)
        self._steps.append(step)
        self._step_index += 1
        return step

    async def run(
        self,
        user_message: str,
        project_root: str = "",
        active_file: Optional[str] = None,
        conversation_history: Optional[List[Dict]] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream agent execution events.
        Yields dicts with: type, content, step, stats
        """
        self._steps = []
        self._step_index = 0
        start_time = time.monotonic()
        total_tokens = 0

        # Step 1: Plan context
        step_ctx = self._add_step("Planning context")
        yield {"type": "step_start", "step": step_ctx.to_dict()}

        context_result = {"system_context": "", "stats": {}}
        if project_root:
            try:
                context_result = plan_context(
                    project_root=project_root,
                    user_query=user_message,
                    active_file=active_file,
                )
                ctx_stats = context_result["stats"]
                step_ctx.complete(
                    output=f"Selected {ctx_stats.get('pieces_selected', 0)} context pieces, "
                           f"saved {ctx_stats.get('context_saved_pct', 0)}%"
                )
            except Exception as e:
                step_ctx.fail(str(e))
        else:
            step_ctx.complete(output="No project root — skipping context")

        yield {"type": "step_done", "step": step_ctx.to_dict()}

        # Step 2: Build messages
        messages = []
        system = self.SYSTEM_PROMPT
        if context_result["system_context"]:
            system += "\n\n" + context_result["system_context"]

        if conversation_history:
            for msg in conversation_history[-6:]:  # last 3 exchanges
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    messages.append(AIMessage(content=msg["content"]))

        messages.append(HumanMessage(content=user_message))

        # Step 3: Execute agent
        step_exec = self._add_step(f"Running {self.name}")
        yield {"type": "step_start", "step": step_exec.to_dict()}

        final_response = ""
        tool_calls_made = []

        try:
            agent = self._build_agent()
            state = {"messages": messages}

            async for event in agent.astream(state):
                for node_name, node_output in event.items():
                    msgs = node_output.get("messages", [])
                    for msg in msgs:
                        if isinstance(msg, AIMessage):
                            content = msg.content
                            if content and not msg.tool_calls:
                                final_response = content
                                yield {"type": "token", "content": content}
                        elif isinstance(msg, ToolMessage):
                            tool_name = msg.name if hasattr(msg, 'name') else "tool"
                            tool_calls_made.append(tool_name)
                            tool_step = self._add_step(f"Tool: {tool_name}")
                            tool_step.complete(output=str(msg.content)[:200])
                            yield {"type": "step_done", "step": tool_step.to_dict()}

            step_exec.complete(output=f"Used {len(tool_calls_made)} tools")
            yield {"type": "step_done", "step": step_exec.to_dict()}

        except Exception as e:
            step_exec.fail(str(e))
            yield {"type": "step_done", "step": step_exec.to_dict()}
            yield {"type": "error", "content": f"Agent error: {str(e)}"}
            final_response = f"I encountered an error: {str(e)}"

        elapsed = time.monotonic() - start_time
        ctx_saved = context_result.get("stats", {}).get("context_saved_pct", 0)

        # Save trace (includes agent_type + model for optimizer)
        if project_root:
            try:
                agent_type_key = next(
                    (k for k, v in __import__('agents.specialized', fromlist=['AGENT_REGISTRY']).AGENT_REGISTRY.items() if v is type(self)),
                    "code"
                )
                trace_id = save_trace(project_root, {
                    "agent": self.name,
                    "agent_type": agent_type_key,
                    "model": self.model,
                    "task": user_message[:200],
                    "steps": [s.to_dict() for s in self._steps],
                    "tool_calls": tool_calls_made,
                    "response_length": len(final_response),
                    "elapsed_ms": round(elapsed * 1000),
                    "context_saved_pct": ctx_saved,
                    "result": "success" if final_response else "error",
                })
            except Exception:
                trace_id = ""
        else:
            trace_id = ""

        yield {
            "type": "done",
            "stats": {
                "elapsed_ms": round(elapsed * 1000),
                "steps": len(self._steps),
                "tool_calls": len(tool_calls_made),
                "context_saved_pct": ctx_saved,
                "trace_id": trace_id,
            },
        }
