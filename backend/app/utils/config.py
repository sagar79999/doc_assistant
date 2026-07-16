import os
import json
from pathlib import Path
from typing import Any
from pydantic import field_validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ENVIRONMENT: str = "development"
    
    # Path settings
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    UPLOAD_DIR: Path = BASE_DIR / "data" / "uploads"
    VECTOR_STORE_DIR: Path = BASE_DIR / "data" / "vector_store"
    CHAT_HISTORY_DIR: Path = BASE_DIR / "data" / "history"
    
    MAX_UPLOAD_SIZE_MB: int = 20
    ALLOWED_EXTENSIONS: Any = {"pdf"}

    @field_validator("ALLOWED_EXTENSIONS", mode="before")
    @classmethod
    def parse_allowed_extensions(cls, v):
        if isinstance(v, str):
            try:
                data = json.loads(v)
                if isinstance(data, list):
                    return set(data)
                if isinstance(data, str):
                    return {data}
            except Exception:
                pass
            return {ext.strip() for ext in v.split(",") if ext.strip()}
        return v
    
    # Model configuration
    LLM_MODEL: str = "llama-3.3-70b-versatile"
    SUMMARY_MODEL: str = "llama-3.1-8b-instant"
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

# Load settings
settings = Settings()

# Ensure directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.VECTOR_STORE_DIR, exist_ok=True)
os.makedirs(settings.CHAT_HISTORY_DIR, exist_ok=True)
