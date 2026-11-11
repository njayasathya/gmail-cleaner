import os
os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .config import settings
from .database import init_db
from .utils import configure_logging
from .routes import (
    auth_routes, scan_routes, action_routes,
    unsubscribe_routes, label_routes, export_routes, job_routes
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    await init_db()
    yield

app = FastAPI(
    title=settings.APP_NAME,
    description="Intelligent, Dockerized Bulk Gmail Cleaner and Newsletter Unsubscribe Engine",
    version="1.0.0",
    lifespan=lifespan
)

# Restrict CORS strictly to trusted local origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
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
_dist_candidates = [
    settings.DATA_PATH.parent / "frontend" / "dist",
    Path(__file__).resolve().parent.parent / "frontend" / "dist",
    Path(__file__).resolve().parent.parent / "dist",
    Path(__file__).resolve().parent.parent.parent / "frontend" / "dist",
]
FRONTEND_DIST = next((p for p in _dist_candidates if p.exists()), _dist_candidates[-1])

if FRONTEND_DIST.exists():
    DIST_ROOT = FRONTEND_DIST.resolve()
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        candidate = (DIST_ROOT / full_path).resolve()
        if candidate.is_relative_to(DIST_ROOT) and candidate.exists() and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(
            DIST_ROOT / "index.html",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
        )
else:
    @app.get("/")
    async def root():
        return {
            "name": settings.APP_NAME,
            "status": "online",
            "api_docs": "/docs",
            "frontend": "Frontend dev server running at http://localhost:5173"
        }
