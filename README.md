# Neuron IDE

**AI-native IDE for Data Scientists, ML Engineers, and AI Engineers.**

Neuron is an open-source **AI IDE for data science and machine learning** combining persistent project memory, an agent runtime, dataset intelligence, experiment tracking, MLflow workflows, model evaluation, research assistance, and cloud development.

> Cursor for Data Scientists + MLflow + Cloud Console + AI Research Assistant + Agent Runtime

Neuron is a local-first, context-aware IDE that understands your entire ML workflow — datasets, experiments, models, cloud infrastructure, and research — not just your code. Every project gets a persistent `.neuron/` intelligence layer that the agent reads before every response, so it never starts from zero.

---

## Table of Contents

- [Why Neuron](#why-neuron)
- [Quick Start — Docker](#quick-start--docker)
- [Quick Start — Desktop](#quick-start--desktop-tauri)
- [Quick Start — Dev Mode](#quick-start--dev-mode)
- [Features](#features)
  - [IDE Shell](#ide-shell)
  - [Context Engine](#context-engine--neuron)
  - [Agent Runtime](#agent-runtime)
  - [ML Features](#ml-features)
  - [Dataset Intelligence](#dataset-intelligence)
  - [Model Arena](#model-arena)
  - [Cloud Control Center](#cloud-control-center)
  - [Research Mode](#research-mode)
  - [Notebook Editor](#notebook-editor)
  - [Environment Doctor](#environment-doctor)
  - [Phase 6 — Optimizer](#phase-6--optimizer)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [The .neuron Folder](#the-neuron-folder)
- [Agent System](#agent-system)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Tech Stack](#tech-stack)
- [Build Phases](#build-phases)

---

## Why Neuron

Software engineers have Cursor. Data scientists have nothing.

A data scientist's day involves notebooks, datasets, experiments, model registries, cloud clusters, and papers — none of which a generic coding assistant understands. Neuron is built around these workflows:

| Other AI IDEs | Neuron |
|---|---|
| Chat resets on every conversation | Persistent project memory across sessions |
| No awareness of datasets | Auto-profiles CSV/Parquet, detects leakage |
| No experiment tracking | MLflow built in, runs compared by AI |
| Generic code suggestions | Agent reads your past experiments before suggesting |
| Cloud requires manual CLI | One-click deploy with AI-chosen configuration |
| Papers stay in browser tabs | Import URL → extract algorithm → generate code |

---

## Quick Start — Docker

The easiest way. One command, everything included.

```bash
# Clone the repo
git clone https://github.com/you/neuron.git
cd neuron

# Start (pulls qwen2.5-coder:7b automatically — ~4 GB)
docker compose up -d

# Open in browser
open http://localhost:8000
```

Put your project files in `./workspace/` — they appear at `/workspace` inside the container. Set the project root to `/workspace/your-project` in the IDE.

**First run note:** The model downloads in the background. The IDE is usable immediately; the agent becomes available once the download completes (~5 min on a fast connection).

### GPU Mode (NVIDIA)

```bash
# Requires nvidia-container-toolkit on the host
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

### Custom Model

```bash
DEFAULT_MODEL=llama3.2:3b docker compose up -d
```

### Useful Commands

```bash
docker compose logs -f neuron    # Stream IDE logs
docker compose logs -f ollama    # Stream Ollama logs
docker compose down              # Stop everything
docker compose down -v           # Stop and delete volumes (fresh start)

# Pull a different model manually
docker exec neuron-ollama ollama pull mistral
```

---

## Quick Start — Desktop (Tauri)

Runs as a native desktop app on Windows, macOS, and Linux.

### Prerequisites

- [Rust](https://rustup.rs) (Tauri requires it — install once, forget about it)
- [Node.js 18+](https://nodejs.org)
- [Python 3.11+](https://python.org)
- [Ollama](https://ollama.ai) — install and run `ollama serve`

### Install and Run

```bash
# 1. Install frontend dependencies
npm install

# 2. Install Python backend dependencies
pip install -r backend/requirements.txt

# 3. Pull a local model
ollama pull qwen2.5-coder

# 4. Launch the desktop app
npm run tauri dev
```

This starts:
- FastAPI backend on `http://localhost:8000`
- Vite dev server on `http://localhost:1420`
- The native desktop window

### Production Desktop Build

```bash
npm run tauri build
# Output: src-tauri/target/release/bundle/
```

---

## Quick Start — Dev Mode (Web Only)

No Rust required. Runs the backend and React app separately.

```bash
# Terminal 1 — Python backend
pip install -r backend/requirements.txt
python backend/main.py

# Terminal 2 — React frontend
npm install
npm run dev

# Open http://localhost:1420
```

---

## Features

### IDE Shell

A three-column layout purpose-built for data science work:

```
┌──────────────┬────────────────────────┬──────────────┐
│  Left Panel  │    Center Workspace    │  Right Panel │
│              │                        │              │
│ Files        │  Monaco Editor         │  Agent       │
│ Memory       │  or                    │  Cockpit     │
│ Experiments  │  Notebook Editor       │              │
│ Model Arena  │  (.ipynb)              │  Token Meter │
│ Cloud        │                        │  Model Pick  │
│ Research     │                        │              │
│ Doctor       │                        │              │
└──────────────┴────────────────────────┴──────────────┘
```

**Monaco Editor** — the same editor as VS Code, with a custom Neuron dark theme:
- Syntax highlighting for Python, TypeScript, SQL, Rust, Go, YAML, and more
- File tabs with dirty indicator
- `Ctrl+S` to save
- `.ipynb` files open in the dedicated Notebook Editor instead

**Status Bar** — always-visible strip showing:
- Active project name
- Backend online/offline indicator
- Active file path
- Current model name and GPU availability
- Health warning count

---

### Context Engine (`.neuron/`)

Every project gets a `.neuron/` folder created automatically on first open. The agent reads this before every response — it never starts from zero.

```
.neuron/
├── memory/
│   ├── project_summary.md       # What this project is about
│   ├── decisions.md             # Key architectural decisions
│   ├── failures.md              # Failed experiments and why
│   ├── experiment_history.md    # ML run history
│   ├── dataset_profile.json     # Registered datasets + metadata
│   ├── model_registry.json      # Trained models
│   └── architecture.md          # System design notes
├── index/
│   └── chroma/                  # ChromaDB vector store (semantic code search)
├── agent/
│   ├── traces.json              # Agent execution traces (last 200)
│   └── rewards.json             # Learning reward signals (last 500)
└── mlflow/
    ├── mlflow.db                # MLflow experiment database
    └── artifacts/               # Model artifacts and plots
```

**Memory Panel** — edit any memory file directly in the IDE. Changes are read by the agent on the next request.

**Context Planner** — before each agent call, the planner scores all available context:
```
reward = relevance_score − (token_count / 4096 × 0.3)
```
It greedily packs the highest-reward pieces into an 8K char budget, then injects them as a `<project_context>` block in the system prompt. Context saved % is shown in the token meter.

**Incremental Indexing** — when you open a project, a background watcher (Watchdog + watchfiles) monitors for file changes and re-indexes them in ChromaDB automatically. Semantic search (`semantic_search_code` tool) is always up to date.

---

### Agent Runtime

The right panel is an **Agent Cockpit**, not a chat window.

**Two modes** (toggle in the header):

| Mode | When to use |
|---|---|
| **Agent** (default) | Complex tasks — reads files, searches code, runs tools, saves memory |
| **Chat** | Quick questions — direct Ollama stream, no tools, faster |

**Five specialized agents** — auto-routed by message content:

| Agent | Triggers | Tools |
|---|---|---|
| **Code Agent** | write, debug, explain, refactor | read/write files, search, run Python |
| **Data Agent** | dataset, csv, column, missing, schema | dataset profiler, memory |
| **ML Agent** | train, accuracy, experiment, optimize | all above + shell commands |
| **Research Agent** | paper, arxiv, algorithm, transformer | file search, memory write |
| **Cloud Agent** | deploy, kubernetes, azure, databricks | code tools + cloud CLI |

**Step trace** — the cockpit shows each step the agent takes in real time:
```
✓ Planning context      (selected 4 pieces, saved 67%)
✓ Tool: read_file       (train.py)
✓ Tool: semantic_search (training loop patterns)
⟳ Running ML Agent      ...
```

**Feedback loop** — thumbs up/down on the last response submits a reward signal:
```
reward = success_score − token_cost_penalty − latency_penalty
```
These signals feed the Phase 6 optimizer (see below).

---

### ML Features

#### MLflow Integration

MLflow is a first-class citizen, not a tab you open separately.

- Start/stop a local MLflow server from the Experiments panel
- Browse experiments and runs without leaving the IDE
- Select multiple runs for AI-powered comparison
- The ML Agent reads experiment history before suggesting changes

```
Experiment: customer_churn_v2
Run #42  accuracy: 94.2%  f1: 0.91
Run #41  accuracy: 91.8%  f1: 0.89

AI diff: learning_rate 0.01→0.05 improved accuracy by 2.4%.
         Likely cause: better regularization in sparse feature space.
```

MLflow data is stored in `.neuron/mlflow/mlflow.db` — it travels with the project.

---

### Dataset Intelligence

When you point the agent at a dataset, it automatically:

1. Detects file format (CSV, Parquet, JSON Lines) via DuckDB
2. Profiles schema — column names, types, null counts
3. Computes numeric statistics — min, max, mean, stddev
4. Detects problem type — classification vs regression
5. Checks for issues:
   - Class imbalance (ratio > 5×)
   - High missing values (> 20% per column)
   - Potential leakage columns (by keyword heuristic)
6. Recommends models — LightGBM, XGBoost, CatBoost for classification; Ridge, Lasso, XGBoost for regression
7. Saves findings to `.neuron/memory/dataset_profile.json`

---

### Model Arena

Auto-benchmark every model against your dataset in parallel.

**Supported models:**
- Classification: Logistic Regression, Random Forest, Gradient Boosting, Naive Bayes, LightGBM, XGBoost
- Regression: Ridge, Lasso, Random Forest, LightGBM, XGBoost

**Output:**
```
Leaderboard
───────────────────────────────────
1  XGBoost          accuracy 95.1%
2  LightGBM         accuracy 94.3%
3  Random Forest    accuracy 92.7%
4  Gradient Boost   accuracy 91.2%
```

Results include accuracy/R², F1, ROC AUC or MAE, and training time per model.

---

### Cloud Control Center

A terminal panel for cloud CLI tools with AI assistance.

**Detected CLIs:** Databricks, Azure CLI, AWS CLI, GCP, GitHub CLI, Docker, Kubernetes, Git

**Safe execution** — commands are validated against an allowlist before running:
- Allowed: `databricks`, `az`, `aws`, `gcloud`, `gh`, `docker`, `kubectl`, `git`, `python`, `pip`, `mlflow`
- Blocked: `rm`, `del`, `rmdir`, `format`, `drop`, `truncate` (destructive ops)

**Connection status** — shows active cloud sessions (Git identity, Docker daemon, AWS account, Azure subscription).

You never write raw CLI commands. Tell the Cloud Agent what you want ("deploy this model to Databricks") and it generates and runs the commands.

---

### Research Mode

Import papers and technical documents directly into your workflow.

**Input:** URL (arXiv, blog posts, docs) or pasted text

**Three extraction modes:**

| Mode | Output |
|---|---|
| **Summarize** | Key contribution, method, results, limitations |
| **Extract Algorithm** | Step-by-step process, equations, pseudocode, complexity |
| **Generate Code** | Runnable Python implementation with comments |

Results stream in real time. Toggle "Save to memory" to append the summary to `.neuron/memory/decisions.md` so the agent references it in future sessions.

Example workflow:
1. Find an arXiv paper on a new regularization technique
2. Paste the URL → Extract Algorithm
3. Review the pseudocode
4. Click Generate Code → working starter implementation

---

### Notebook Editor

`.ipynb` files open in a full notebook editor — not as raw JSON in Monaco.

- **Code cells** — Monaco editor (same theme, same keybindings)
- **Markdown cells** — rendered display
- **Cell outputs** — stdout and stderr shown below each cell
- **Run cell** — executes via the backend Python process, streams output
- **Run All** — runs all code cells top to bottom
- **Add / Delete cells** — inline controls
- **Save** — writes back to the `.ipynb` file on disk

The project's `rootPath` is used as the working directory for cell execution, so imports and relative file paths work as expected.

---

### Environment Doctor

A live dashboard of your environment's health.

| Check | What it tests |
|---|---|
| Python version | Reported version |
| Ollama | Running + model count |
| CUDA | nvidia-smi driver version |
| MLflow | Local server responding |
| Disk | Free GB with color threshold (red < 5 GB) |
| GPU VRAM | Used / total per GPU with utilization % |
| ML packages | Installed version of PyTorch, sklearn, pandas, numpy, MLflow, XGBoost, LightGBM, DuckDB, ChromaDB |

All issues are shown with exact fix commands:
```
Ollama is not running.
Fix: ollama serve

No Ollama models found.
Fix: ollama pull qwen2.5-coder
```

---

### Phase 6 — Optimizer

The optimizer learns which model works best for each agent type from your reward history.

**How it works:**
1. Every agent run saves a trace to `.neuron/agent/traces.json` with `agent_type` and `model`
2. Every thumbs-up/down submits a reward signal to `.neuron/agent/rewards.json`
3. The optimizer aggregates: for each `(agent_type, model)` pair with ≥ 3 samples, it computes average reward
4. `/api/optimizer/recommend` returns the best model for a given agent type

**Optimization report** (available via API):
```json
{
  "recommendations": [
    { "agent": "code", "recommended_model": "qwen2.5-coder", "avg_reward": 0.87, "sample_count": 23 },
    { "agent": "ml",   "recommended_model": "nemotron-mini",  "avg_reward": 0.91, "sample_count": 11 }
  ],
  "context_efficiency": {
    "avg_saved_pct": 62.4,
    "total_tokens_saved": 184200,
    "sample_count": 89
  }
}
```

This is the foundation for a future GRPO/DPO fine-tuning loop — the reward data is already being collected.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Desktop UI                               │
│                     Tauri + React 18                            │
│   ┌──────────┐  ┌──────────────────┐  ┌─────────────────────┐  │
│   │ Sidebar  │  │  Monaco / Notebk │  │  Agent Cockpit      │  │
│   │ 7 panels │  │  Center Pane     │  │  LangGraph stream   │  │
│   └──────────┘  └──────────────────┘  └─────────────────────┘  │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ HTTP + SSE
┌─────────────────────────────────▼───────────────────────────────┐
│                    FastAPI Backend (port 8000)                   │
│  /api/chat         Ollama streaming + model routing             │
│  /api/agents       LangGraph ReAct agents (5 types)             │
│  /api/context      ChromaDB indexing + context planning         │
│  /api/experiments  MLflow server + run comparison               │
│  /api/arena        Parallel model benchmarking                  │
│  /api/cloud        Safe CLI execution (8 providers)             │
│  /api/research     URL fetch + AI extraction                    │
│  /api/notebooks    Cell execution + .ipynb parse/save           │
│  /api/optimizer    Phase 6 reward-based model routing           │
│  /api/health       Environment doctor + GPU + packages          │
└──────┬─────────────────┬────────────────────┬───────────────────┘
       │                 │                    │
┌──────▼──────┐  ┌───────▼──────┐  ┌─────────▼──────┐
│   Ollama    │  │   ChromaDB   │  │    MLflow      │
│  localhost  │  │ .neuron/     │  │  .neuron/      │
│  :11434     │  │ index/chroma │  │  mlflow.db     │
└─────────────┘  └──────────────┘  └────────────────┘
```

**Streaming** — all long-running operations (chat, agent runs, cell execution, research extraction, model arena, cloud commands) use Server-Sent Events (SSE). The frontend consumes them via async generators in `src/lib/api.ts`. No polling, no WebSockets.

---

## Project Structure

```
neuron/
├── src/                              # React 18 + TypeScript frontend
│   ├── App.tsx                       # Root: health polling + layout
│   ├── store/
│   │   └── ideStore.ts               # Zustand global state
│   ├── lib/
│   │   └── api.ts                    # All backend API calls + SSE generators
│   ├── components/
│   │   ├── layout/
│   │   │   ├── SidebarContainer.tsx  # Icon rail + 7 panel tabs
│   │   │   ├── LeftPanel.tsx         # File explorer + folder open
│   │   │   ├── CenterPane.tsx        # Monaco editor / notebook router
│   │   │   └── RightPanel.tsx        # Agent cockpit + token meter
│   │   ├── memory/
│   │   │   └── MemoryPanel.tsx       # Edit .neuron/memory/ files
│   │   ├── experiments/
│   │   │   └── ExperimentsPanel.tsx  # MLflow UI
│   │   ├── arena/
│   │   │   └── ModelArena.tsx        # Model benchmarking UI
│   │   ├── cloud/
│   │   │   └── CloudConsole.tsx      # CLI terminal + status
│   │   ├── research/
│   │   │   └── ResearchPanel.tsx     # Paper/doc import + extraction
│   │   ├── notebook/
│   │   │   └── NotebookEditor.tsx    # .ipynb cell editor + executor
│   │   ├── doctor/
│   │   │   └── EnvironmentPanel.tsx  # System health dashboard
│   │   └── shared/
│   │       └── StatusBar.tsx         # Bottom status strip
│   └── styles/
│       └── globals.css               # Tailwind + custom CSS
│
├── src-tauri/                        # Tauri desktop shell (Rust)
│   ├── src/main.rs                   # Window setup + backend subprocess
│   └── tauri.conf.json               # Window config, permissions
│
├── backend/                          # Python FastAPI backend
│   ├── main.py                       # App factory + router registration + SPA serving
│   ├── requirements.txt
│   ├── models/
│   │   └── schemas.py                # Pydantic request/response models
│   ├── routers/
│   │   ├── chat.py                   # Direct Ollama chat stream
│   │   ├── files.py                  # File tree + read/write
│   │   ├── health.py                 # Environment doctor
│   │   ├── projects.py               # Open project + file watcher
│   │   ├── context.py                # Index + memory + context planning
│   │   ├── agents.py                 # LangGraph agent stream + rewards
│   │   ├── experiments.py            # MLflow server + API
│   │   ├── arena.py                  # Model benchmarking stream
│   │   ├── cloud.py                  # Safe CLI execution
│   │   ├── research.py               # URL/text extraction stream
│   │   ├── optimizer.py              # Phase 6 model routing
│   │   └── notebooks.py              # Cell execution + .ipynb parse/save
│   ├── services/
│   │   ├── ollama_client.py          # Model routing + streaming
│   │   ├── file_service.py           # File tree + .neuron init
│   │   ├── health_service.py         # System checks + GPU + packages
│   │   ├── indexer.py                # ChromaDB semantic indexing
│   │   ├── memory_service.py         # .neuron/memory/ I/O
│   │   ├── context_planner.py        # Reward-based context selection
│   │   ├── trace_service.py          # Agent trace + reward persistence
│   │   ├── mlflow_service.py         # MLflow server management
│   │   ├── dataset_profiler.py       # DuckDB dataset analysis
│   │   ├── model_arena.py            # Parallel model benchmarking
│   │   ├── cloud_service.py          # CLI detection + safe execution
│   │   ├── research_service.py       # URL fetch + HTML strip + extraction
│   │   └── optimizer.py              # Reward analysis + model recommendations
│   └── agents/
│       ├── base_agent.py             # LangGraph ReAct loop + context planning
│       ├── specialized.py            # 5 agent types + auto-routing
│       └── tools.py                  # LangChain tool registry
│
├── Dockerfile                        # Multi-stage: Node build → Python runtime
├── docker-compose.yml                # Neuron + Ollama services
├── docker-compose.gpu.yml            # NVIDIA GPU override
├── docker-entrypoint.sh              # Wait for Ollama + auto-pull model
├── .dockerignore
└── workspace/                        # Mount your projects here (Docker)
```

---

## The .neuron Folder

Neuron creates a `.neuron/` folder in every project you open. This is the project's intelligence layer.

### Memory Files

All files are human-readable and editable:

| File | Purpose |
|---|---|
| `project_summary.md` | High-level description of the project. Edit this so the agent understands the domain. |
| `decisions.md` | Architectural decisions and research notes. Research Mode appends here. |
| `failures.md` | Failed experiments and root causes. The ML Agent reads this to avoid repeating mistakes. |
| `experiment_history.md` | A running log of ML experiments. Updated by the ML Agent after each training run. |
| `dataset_profile.json` | Schema and statistics for all registered datasets. Updated by the Data Agent. |
| `model_registry.json` | Trained models with paths, metrics, and checksums. |
| `architecture.md` | System design notes. Edit manually or ask the agent to generate. |

### Index

`index/chroma/` — ChromaDB persistent vector store. Rebuilt on first open, then updated incrementally as files change. Used by `semantic_search_code` tool.

### Agent

`agent/traces.json` — last 200 agent execution traces (agent type, model, tools used, elapsed time, context saved %).

`agent/rewards.json` — last 500 reward signals from thumbs-up/down feedback. Used by the Phase 6 optimizer to improve model routing.

---

## Agent System

### Tool Registry

Every agent has access to a set of tools from `backend/agents/tools.py`:

| Tool | Description |
|---|---|
| `read_file` | Read any file in the project |
| `write_file` | Write or update a file |
| `list_project_files` | Get the full file tree |
| `semantic_search_code` | Search codebase by semantic meaning |
| `read_project_memory` | Read a `.neuron/memory/` file |
| `write_project_memory` | Write a `.neuron/memory/` file |
| `append_project_memory` | Append a timestamped entry to memory |
| `get_dataset_info` | Get registered dataset metadata |
| `run_python_snippet` | Execute Python code (30s timeout) |
| `run_shell_command` | Run a shell command (60s timeout) |

### Auto-routing Logic

When `agent_type` is not specified, the message is auto-routed:

```python
if any(k in msg for k in ["dataset", "csv", "column", "missing", "profile"]):
    return "data"
if any(k in msg for k in ["train", "accuracy", "experiment", "optimize"]):
    return "ml"
if any(k in msg for k in ["paper", "arxiv", "algorithm", "transformer"]):
    return "research"
if any(k in msg for k in ["deploy", "cloud", "kubernetes", "azure", "databricks"]):
    return "cloud"
return "code"
```

### Reward Formula

```
reward = success_score
       − (token_cost / 10000 × 0.3)
       − (latency_ms / 60000 × 0.2)
```

- `success_score`: 1.0 for thumbs-up, 0.2 for thumbs-down
- Token penalty: discourages wasteful context usage
- Latency penalty: discourages slow responses

---

## API Reference

All endpoints are at `http://localhost:8000`. The full OpenAPI spec is at `/docs`.

### Chat

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat` | Stream chat via Ollama (SSE) |
| `GET` | `/api/chat/models` | List available Ollama models |

### Agents

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/agents/run` | Stream LangGraph agent execution (SSE) |
| `GET` | `/api/agents/types` | List agent types |
| `GET` | `/api/agents/traces` | Recent agent traces |
| `GET` | `/api/agents/stats` | Reward statistics |
| `POST` | `/api/agents/reward` | Submit reward signal |

### Files

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/files/tree` | File tree for a root path |
| `GET` | `/api/files/content` | Read file content |
| `POST` | `/api/files/save` | Save file content |

### Context

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/context/index` | Index project into ChromaDB |
| `GET` | `/api/context/search` | Semantic code search |
| `GET` | `/api/context/memory` | Read all `.neuron/memory/` files |
| `POST` | `/api/context/memory/write` | Write a memory file |
| `POST` | `/api/context/plan` | Plan optimal context for a query |
| `POST` | `/api/context/dataset/profile` | Profile a CSV/Parquet/JSON dataset |

### Experiments

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/experiments/server/start` | Start local MLflow server |
| `POST` | `/api/experiments/server/stop` | Stop MLflow server |
| `GET` | `/api/experiments/server/status` | MLflow server status |
| `GET` | `/api/experiments/list` | List experiments |
| `GET` | `/api/experiments/runs` | List runs for an experiment |
| `GET` | `/api/experiments/run` | Run detail with metric history |
| `POST` | `/api/experiments/compare` | Compare multiple runs |

### Model Arena

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/arena/run` | Stream model benchmarking (SSE) |

### Cloud

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/cloud/clis` | Detected CLI tools and versions |
| `GET` | `/api/cloud/connections` | Active cloud connections |
| `POST` | `/api/cloud/run` | Stream CLI command execution (SSE) |

### Research

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/research/extract` | Stream extract from URL or text (SSE) |

### Notebooks

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/notebooks/execute` | Stream cell execution (SSE) |
| `GET` | `/api/notebooks/parse` | Parse `.ipynb` file |
| `POST` | `/api/notebooks/save` | Save `.ipynb` file |

### Optimizer

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/optimizer/report` | Full Phase 6 optimization report |
| `GET` | `/api/optimizer/recommend` | Best model for a given agent type |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Basic environment check |
| `GET` | `/api/health/full` | Extended: GPU, packages, MLflow |

### Projects

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/projects/open` | Open project + init `.neuron/` + start watcher |
| `GET` | `/api/projects/active` | Currently active project |

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL. Set to `http://ollama:11434` in Docker. |
| `PORT` | `8000` | Port the FastAPI server listens on |
| `DEFAULT_MODEL` | `qwen2.5-coder:7b` | Model pulled on first Docker run if none exist |

### Vite / Frontend

| Variable | Default | Description |
|---|---|---|
| `VITE_BACKEND_URL` | `http://127.0.0.1:8000` | Backend base URL. Set to `""` in Docker builds for relative paths. |

### Local Model Recommendations

| Use Case | Recommended Model |
|---|---|
| Code generation / debugging | `qwen2.5-coder:7b` or `qwen2.5-coder:32b` |
| Deep reasoning / ML advice | `nemotron-mini` or `deepseek-r1:14b` |
| Quick tasks / summaries | `phi3` or `phi3.5` |
| General purpose | `llama3.2:3b` (fast) or `llama3.1:8b` (smart) |

---

## Tech Stack

### Frontend

| Technology | Version | Role |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 3 | Styling |
| Monaco Editor | 0.52 | Code editing |
| Zustand | 5 | Global state |
| Tauri | 2 | Desktop shell (optional) |
| Vite | 6 | Build tool |

### Backend

| Technology | Version | Role |
|---|---|---|
| FastAPI | 0.115 | API framework |
| LangGraph | 0.2 | Agent orchestration |
| LangChain | 0.3 | LLM tooling + tool registry |
| Ollama (langchain) | 0.2 | Local LLM provider |
| ChromaDB | 0.5 | Vector store (semantic search) |
| DuckDB | 1.1 | Dataset analytics |
| MLflow | latest | Experiment tracking |
| Watchfiles | 0.24 | Incremental file indexing |
| tiktoken | 0.8 | Token counting |
| httpx | 0.27 | Async HTTP (Ollama, URL fetch) |
| Uvicorn | 0.30 | ASGI server |

### Infrastructure (Docker)

| Technology | Role |
|---|---|
| Docker multi-stage build | Node builds React → Python serves everything |
| `ollama/ollama` | Local LLM inference container |
| Named volumes | Persist Ollama models + Neuron data |

---

## Build Phases

| Phase | Status | What was built |
|---|---|---|
| 1 — IDE Shell | ✅ Complete | Tauri + React, Monaco editor, file explorer, Ollama chat, token meter, status bar |
| 2 — Context Engine | ✅ Complete | `.neuron/` folder, ChromaDB indexing, memory files, context planner with reward scoring, incremental file watching |
| 3 — Agent Runtime | ✅ Complete | LangGraph ReAct loop, 5 specialized agents, 10+ tools, trace logging, reward signals |
| 4 — ML Features | ✅ Complete | MLflow integration, DuckDB dataset profiler, model arena (6+ models), experiment comparison |
| 5 — Cloud | ✅ Complete | 8 CLI providers, safe command execution allowlist, connection status, streaming output |
| 6 — Optimization | ✅ Complete | Reward-based model routing optimizer, context efficiency tracking, Phase 6 API |

**New features beyond the original spec:**
- Research Mode — import papers by URL or paste, extract algorithm / generate code
- Notebook Editor — full `.ipynb` support with cell execution
- Environment Doctor panel — GPU VRAM, package versions, MLflow status
- Agent/Chat mode toggle — switch between LangGraph agent and direct Ollama chat
- Thumbs up/down feedback — submits reward to optimizer
- Docker support — `docker compose up` single-command deploy

---

## License

MIT
