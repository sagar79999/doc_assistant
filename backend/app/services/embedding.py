from langchain_community.embeddings import FastEmbedEmbeddings
from app.utils.config import settings

def get_embeddings() -> FastEmbedEmbeddings:
    """
    Initializes and returns local FastEmbed embeddings (no API key, no PyTorch).
    Uses BAAI/bge-small-en-v1.5 model for fast, free local embeddings.
    """
    return FastEmbedEmbeddings(model_name=settings.EMBEDDING_MODEL)
