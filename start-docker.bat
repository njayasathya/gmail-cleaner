@echo off
echo Starting Gmail Cleaner container with Docker Compose...
cd /d "%~dp0"
docker compose up -d
if %errorlevel% equ 0 (
    echo Container started successfully!
    start "" http://localhost:8000
) else (
    echo Error starting Docker container. Please ensure Docker Desktop is running.
    pause
)
