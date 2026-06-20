# ══════════════════════════════════════════════════════════════════
#  Neuron IDE — Docker image
#  Stage 1: Build the React frontend
#  Stage 2: Python FastAPI backend + static files
# ══════════════════════════════════════════════════════════════════

# ─── Stage 1: Frontend build ───────────────────────────────────────
FROM node:20-alpine AS frontend

WORKDIR /build

# Install dependencies
COPY package*.json ./
# --ignore-scripts avoids Tauri CLI trying to download native binaries
RUN npm ci --ignore-scripts

# Copy source
COPY index.html ./
COPY vite.config.ts tsconfig*.json tailwind.config.ts postcss.config.js ./
COPY src/ ./src/

# Build React app.
# VITE_BACKEND_URL="" → relative paths → works when served from same origin.
RUN VITE_BACKEND_URL="" npm run build:web


# ─── Stage 2: Python backend + runtime ────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app

# System deps (curl for healthcheck, git for cloud tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Backend source
COPY backend/ ./backend/

# React build output from stage 1
COPY --from=frontend /build/dist ./dist

# Default workspace (users mount their projects here)
RUN mkdir -p /workspace

# ─── Environment defaults ──────────────────────────────────────────
# Override OLLAMA_HOST to point at the ollama container
ENV OLLAMA_HOST=http://ollama:11434
ENV PYTHONPATH=/app/backend
ENV PORT=8000

# Expose API + frontend
EXPOSE 8000

# ─── Entrypoint ────────────────────────────────────────────────────
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
