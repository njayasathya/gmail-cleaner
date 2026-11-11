@echo off
echo Starting Gmail Cleaner locally...
cd /d "%~dp0"
if exist backend\.venv\Scripts\python.exe (
    if not exist frontend\dist\index.html (
        echo Warning: frontend\dist not found. Build the UI first: cd frontend ^&^& npm install ^&^& npm run build
    )
    start "" http://localhost:8000
    backend\.venv\Scripts\python.exe backend\run.py
) else (
    echo Python virtual environment not found in backend\.venv.
    echo Run: python -m venv backend\.venv ^&^& backend\.venv\Scripts\pip install -r backend\requirements.txt
    pause
)
