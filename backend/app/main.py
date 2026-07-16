import uvicorn
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.utils.config import settings
from app.utils.logger import logger
from app.api import health, upload, chat, summary

app = FastAPI(
    title="AI PDF Chatbot API",
    description="Production-ready FastAPI backend for document parsing, Advanced RAG, and summarization.",
    version="1.0.0"
)

# Configure CORS origins
origins = [
    "http://localhost:5173",
    "http://localhost:8000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8000",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if settings.ENVIRONMENT == "development" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Middleware
@app.middleware("http")
async def exception_handling_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        logger.error(f"Unhandled server exception: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "An unexpected error occurred on the server.",
                "error": str(e)
            }
        )

# Register routers directly to root paths
app.include_router(health.router)
app.include_router(upload.router)
app.include_router(chat.router)
app.include_router(summary.router)

# Mount compiled static assets in production if they exist
from fastapi.staticfiles import StaticFiles
from pathlib import Path

dist_dir = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=str(dist_dir), html=True), name="static")
else:
    @app.get("/")
    async def root():
        return {
            "message": "Welcome to the AI PDF Chatbot API. Retrieve API specs at /docs.",
            "status": "healthy"
        }

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
