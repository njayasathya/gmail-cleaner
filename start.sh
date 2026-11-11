#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

MODE="${1:-auto}"

run_docker() {
    echo "Starting Gmail Cleaner with Docker Compose..."
    docker compose up -d
    echo "App is running at http://localhost:8000"
}

run_local() {
    if [ ! -d "backend/.venv" ]; then
        echo "Error: Python virtual environment not found at backend/.venv"
        echo "Run: python3 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt"
        exit 1
    fi
    if [ ! -d "frontend/dist" ]; then
        echo "Warning: frontend/dist not found. Build it once via: cd frontend && npm install && npm run build"
    fi
    echo "Starting Gmail Cleaner locally with Python..."
    source backend/.venv/bin/activate
    python backend/run.py
}

case "$MODE" in
    docker)
        run_docker
        ;;
    local)
        run_local
        ;;
    auto)
        if command -v docker &> /dev/null && docker info &> /dev/null && [ -f docker-compose.yml ]; then
            run_docker
        elif [ -d "backend/.venv" ]; then
            run_local
        else
            echo "Neither a running Docker daemon nor backend/.venv was found."
            echo "See README.md for setup instructions."
            exit 1
        fi
        ;;
    *)
        echo "Usage: ./start.sh [auto|docker|local]"
        exit 1
        ;;
esac
