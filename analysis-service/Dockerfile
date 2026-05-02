# =============================================================================
# analysis-service Dockerfile
# Python 3.11 slim image — installs requirements, copies app, runs as non-root
# =============================================================================

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies needed by psycopg2 and torch
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies first for better layer caching
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY app/ ./app/

# Create a non-root user and switch to it
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

# FastAPI / uvicorn port
EXPOSE 8000

# Start the FastAPI application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
