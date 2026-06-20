#!/bin/bash
set -e

OLLAMA_HOST="${OLLAMA_HOST:-http://ollama:11434}"
DEFAULT_MODEL="${DEFAULT_MODEL:-qwen2.5-coder:7b}"

echo "┌──────────────────────────────────┐"
echo "│        Neuron IDE v0.3.0         │"
echo "└──────────────────────────────────┘"
echo ""
echo "Waiting for Ollama at $OLLAMA_HOST ..."

# Wait up to 60 s for Ollama to become ready
for i in $(seq 1 30); do
    if curl -sf "${OLLAMA_HOST}/api/tags" > /dev/null 2>&1; then
        echo "Ollama is ready."
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "WARNING: Ollama not reachable after 60s. Continuing anyway."
    fi
    sleep 2
done

# Pull default model if no models are available
MODEL_COUNT=$(curl -s "${OLLAMA_HOST}/api/tags" 2>/dev/null \
    | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('models', [])))" 2>/dev/null || echo "0")

if [ "$MODEL_COUNT" = "0" ]; then
    echo "No models found. Pulling $DEFAULT_MODEL in background..."
    curl -s -X POST "${OLLAMA_HOST}/api/pull" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"$DEFAULT_MODEL\"}" > /dev/null &
    echo "Model pull started. You can use the app while it downloads."
else
    echo "Found $MODEL_COUNT model(s). Ready."
fi

echo ""
echo "Open http://localhost:${PORT:-8000} in your browser."
echo ""

exec python backend/main.py
