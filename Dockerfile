# ==============================================================================
# Stage 1: Build Frontend Assets (React + Vite + Tailwind CSS)
# ==============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /build

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Python FastAPI Production Runtime
# ==============================================================================
FROM python:3.11-slim AS runtime

# Install system utilities and clean up
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python backend dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/app/ ./app/

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /build/dist ./frontend/dist

# Persistent data directory for SQLite database, tokens, and OAuth credentials
RUN mkdir -p /app/data
VOLUME /app/data

# Environment configuration
ENV HOST=0.0.0.0
ENV PORT=8000
ENV PYTHONPATH=/app

EXPOSE 8000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/auth/status || exit 1

# Launch production ASGI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
