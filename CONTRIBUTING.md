# Contributing to Gmail Cleaner

Thank you for your interest in contributing to **Gmail Cleaner**! All bug reports, documentation improvements, UI polish, and feature pull requests are welcome.

## Development Setup

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm
- Git

### 1. Backend Environment
```bash
python -m venv backend/.venv
# Windows:
backend\.venv\Scripts\activate
# macOS / Linux:
source backend/.venv/bin/activate

pip install -r backend/requirements.txt
pip install -r backend/requirements-dev.txt
```

### 2. Frontend Environment
```bash
cd frontend
npm install
```

### 3. Run in Hot-Reload Dev Mode
Start the backend in one terminal (with reload enabled) and Vite in another:

```bash
# Terminal 1 (from repo root)
DEBUG=true python backend/run.py

# Terminal 2
cd frontend && npm run dev
```

Or build the frontend once (`npm --prefix frontend run build`) and serve everything together at `http://localhost:8000`.

## Running Tests & Checks

Before opening a pull request, verify that all automated backend tests and frontend type/build checks pass cleanly:

```bash
# Backend tests (PYTHONPATH=backend)
pytest backend/tests

# Frontend type-check & production build
cd frontend
npx tsc --noUnusedLocals --noUnusedParameters --noEmit
npm run build
```

## Pull Request Guidelines

1. **Keep secrets out of Git:** Never commit `data/`, `.env`, `credentials.json`, `token.json`, `oauth_state.json`, or `*.db` files.
2. **Scoped changes:** Keep PRs focused, clean, and accompanied by tests for new backend endpoints, parsers, or bug fixes.
3. **Code style:** Avoid duplicating helpers; keep backend async SQLite sessions short-lived and committed before triggering job progress broadcasts.
4. **Update docs:** Update `README.md` if adding configuration flags, scripts, or user-facing workflows.
