from fastapi import APIRouter
from datetime import datetime
from app.utils.config import settings

router = APIRouter()

@router.get("/health")
async def health_check():
    """
    Simple API health check endpoint.
    """
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "environment": settings.ENVIRONMENT,
        "config": {
            "groq_api_configured": bool(settings.GROQ_API_KEY),
            "max_upload_size_mb": settings.MAX_UPLOAD_SIZE_MB
        }
    }
