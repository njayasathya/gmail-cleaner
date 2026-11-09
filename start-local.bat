@echo off
echo Starting Gmail Cleaner locally...
cd /d "%~dp0"
if exist backend\.venv\Scripts\python.exe (
    start "" http://localhost:8000
    backend\.venv\Scripts\python.exe backend\run.py
) else (
    echo Python virtual environment not found in backend\.venv.
    echo Please run: python -m venv backend\.venv ^&^& backend\.venv\Scripts\pip install -r backend\requirements.txt
    pause
)
