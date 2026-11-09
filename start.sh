#!/bin/bash
cd "$(dirname "$0")"

if command -v docker &> /dev/null && [ -f docker-compose.yml ]; then
    echo "Starting Gmail Cleaner with Docker Compose..."
    docker compose up -d
    echo "App is running at http://localhost:8000"
elif [ -d "backend/.venv" ]; then
    echo "Starting Gmail Cleaner locally with Python..."
    source backend/.venv/bin/activate
    python backend/run.py
else
    echo "Please set up a Python virtual environment or install Docker."
fi
