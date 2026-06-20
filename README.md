# Neuron IDE 🧠⚡

**AI-native IDE for Data Scientists and ML Engineers.**

> Cursor for Data Scientists + MLflow + Cloud Console + AI Research Assistant + Agent Runtime

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Rust (installed automatically or via `rustup`)
- [Ollama](https://ollama.ai) running locally with at least one model

```bash
# Pull a model for Neuron to use
ollama pull qwen2.5-coder
```

### Development

```bash
# Install frontend dependencies
npm install

# Install Python backend dependencies
pip install -r backend/requirements.txt

# Run in development mode (Tauri + Vite + FastAPI)
npm run tauri dev
```

This will:
1. Start the FastAPI backend on `http://localhost:8000`
2. Start the Vite dev server on `http://localhost:1420`
3. Open the Tauri desktop window

### Manual Backend Start (optional)

```bash
python backend/main.py
```

---

## Architecture

```
Tauri Desktop Shell
    │
    ├── React + Vite (port 1420)
    │       ├── Monaco Editor
    │       ├── Agent Cockpit
    │       └── File Explorer
    │
    └── FastAPI Backend (port 8000)
            ├── /api/chat   → Ollama streaming
            ├── /api/files  → File system
            └── /api/health → Environment doctor
```

---

## Project Structure

```
neuron/
├── src/                  # React frontend
├── src-tauri/            # Rust/Tauri shell
├── backend/              # FastAPI Python backend
│   ├── main.py
│   ├── routers/
│   ├── services/
│   └── models/
└── .neuron/              # Project intelligence (auto-created)
    ├── memory/
    ├── index/
    └── agent/
```

---

## Features (Phase 1)

- [x] Three-column IDE layout (Explorer | Editor | Agent)
- [x] Monaco Editor with custom Neuron dark theme
- [x] Recursive file tree with icons
- [x] Ollama streaming chat with token meter
- [x] Model auto-routing (Qwen → code, Nemotron → reasoning)
- [x] `.neuron/` project memory initialization
- [x] Environment Doctor (Python, Ollama, CUDA, disk)
- [x] Real-time token stats (speed, latency, context %)
- [x] $0 cost badge (100% local)

## Roadmap

- [ ] Phase 2: Context engine + project indexing
- [ ] Phase 3: LangGraph agent runtime + traces
- [ ] Phase 4: MLflow UI + dataset profiler + model arena
- [ ] Phase 5: Cloud integrations (Databricks, Azure, AWS)
- [ ] Phase 6: Model routing + GRPO learning loop
