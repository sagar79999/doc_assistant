# ======================================================
# Stage 1: Build React Frontend
# ======================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend

# Copy package configurations and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy source code and build production bundle
COPY frontend/ ./
RUN npm run build

# ======================================================
# Stage 2: Serve via Python Backend
# ======================================================
FROM python:3.11-slim
WORKDIR /app

# Install system utilities including Tesseract OCR and pdftoppm (for OCR scanned PDF conversion)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Install python packages
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend codebase
COPY backend/ ./

# Copy compiled frontend static assets for FastAPI static mounting
COPY --from=frontend-builder /frontend/dist /frontend/dist

# Expose port and configure execution environment
EXPOSE 8000
ENV ENVIRONMENT=production

# Run server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
