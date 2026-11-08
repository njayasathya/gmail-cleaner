import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .config import settings
from .database import init_db
from .routes import (
    auth_routes, scan_routes, action_routes,
    unsubscribe_routes, label_routes, export_routes, job_routes
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and tables
    await init_db()
    yield

app = FastAPI(
    title=settings.APP_NAME,
    description="Intelligent, Dockerized Bulk Gmail Cleaner and Newsletter Unsubscribe Engine",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Vite frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(auth_routes.router, prefix="/api")
app.include_router(scan_routes.router, prefix="/api")
app.include_router(action_routes.router, prefix="/api")
app.include_router(unsubscribe_routes.router, prefix="/api")
app.include_router(label_routes.router, prefix="/api")
app.include_router(export_routes.router, prefix="/api")
app.include_router(job_routes.router, prefix="/api")

# Serve built frontend in production / Docker if dist directory exists
FRONTEND_DIST = settings.DATA_PATH.parent / "frontend" / "dist"
if not FRONTEND_DIST.exists():
    FRONTEND_DIST = Path(__file__).resolve().parent.parent / "dist"

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")
else:
    @app.get("/")
    async def root():
        return {
            "name": settings.APP_NAME,
            "status": "online",
            "api_docs": "/docs",
            "frontend": "Frontend dev server running at http://localhost:5173"
        }
