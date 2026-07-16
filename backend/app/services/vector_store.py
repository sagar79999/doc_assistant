import os
import shutil
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from app.services.embedding import get_embeddings
from app.utils.config import settings
from app.utils.logger import logger

INDEX_PATH = settings.VECTOR_STORE_DIR / "faiss_index"

# Global loaded vector store cache
_vector_store = None

def get_vector_store() -> FAISS:
    """
    Returns the loaded FAISS vector store. If not cached, tries to load from disk.
    If no store exists on disk, returns None.
    """
    global _vector_store
    if _vector_store is not None:
        return _vector_store
        
    if os.path.exists(INDEX_PATH):
        try:
            embeddings = get_embeddings()
            _vector_store = FAISS.load_local(
                str(INDEX_PATH), 
                embeddings, 
                allow_dangerous_deserialization=True  # Required for loading local pickle files in LangChain
            )
            logger.info("Loaded FAISS vector store from disk.")
            return _vector_store
        except Exception as e:
            logger.error(f"Failed to load FAISS index from disk: {e}")
            
    return None

def save_vector_store(db: FAISS):
    """
    Saves the FAISS index to disk and updates the in-memory cache.
    """
    global _vector_store
    _vector_store = db
    os.makedirs(settings.VECTOR_STORE_DIR, exist_ok=True)
    db.save_local(str(INDEX_PATH))
    logger.info(f"Saved FAISS vector store to {INDEX_PATH}.")

def add_documents_to_store(documents: list[Document]):
    """
    Adds new documents to the FAISS index. Creates a new store if none exists.
    """
    db = get_vector_store()
    if db is None:
        embeddings = get_embeddings()
        logger.info("Initializing a new FAISS vector store.")
        db = FAISS.from_documents(documents, embeddings)
    else:
        logger.info(f"Adding {len(documents)} documents to existing FAISS vector store.")
        db.add_documents(documents)
    save_vector_store(db)

def rebuild_vector_store_excluding(filename: str):
    """
    Rebuilds the FAISS index from all uploaded PDFs except the given filename.
    """
    global _vector_store
    from app.services.pdf_loader import load_pdf
    from app.services.chunking import chunk_pdf_pages

    registry_path = settings.UPLOAD_DIR / "registry.json"
    if not registry_path.exists():
        clear_vector_store()
        return

    import json
    with open(registry_path, "r", encoding="utf-8") as f:
        registry = json.load(f)

    remaining = [name for name in registry if name != filename]
    if not remaining:
        clear_vector_store()
        return

    all_docs = []
    for name in remaining:
        path = settings.UPLOAD_DIR / name
        if not path.exists():
            continue
        try:
            pages_data = load_pdf(str(path))
            all_docs.extend(chunk_pdf_pages(pages_data, name, str(path)))
        except Exception as e:
            logger.warning(f"Could not reload {name} during rebuild: {e}")

    if not all_docs:
        clear_vector_store()
        return

    _vector_store = None
    if os.path.exists(INDEX_PATH):
        shutil.rmtree(INDEX_PATH)

    embeddings = get_embeddings()
    db = FAISS.from_documents(all_docs, embeddings)
    save_vector_store(db)
    logger.info(f"Rebuilt FAISS index excluding '{filename}'.")

def clear_vector_store():
    """
    Clears the FAISS index from memory and disk.
    """
    global _vector_store
    _vector_store = None
    if os.path.exists(INDEX_PATH):
        shutil.rmtree(INDEX_PATH)
        logger.info("Cleared FAISS index from disk.")
    else:
        logger.info("No FAISS index to clear.")

def search_documents(
    query: str, 
    search_type: str = "similarity", 
    k: int = 5, 
    filter_metadata: dict = None
) -> list[Document]:
    """
    Searches the FAISS vector store.
    Supports search_type: 'similarity' or 'mmr'
    Supports metadata filtering.
    """
    db = get_vector_store()
    if db is None:
        logger.warning("Search failed: Vector store is empty.")
        return []
        
    # Standard callable filter for FAISS metadata dictionary
    filter_func = None
    if filter_metadata:
        def faiss_filter(metadata: dict) -> bool:
            for key, val in filter_metadata.items():
                if metadata.get(key) != val:
                    return False
            return True
        filter_func = faiss_filter

    if search_type == "mmr":
        logger.info(f"Performing MMR search for query: '{query}' with k={k}")
        return db.max_marginal_relevance_search(query, k=k, filter=filter_func)
    else:
        logger.info(f"Performing Similarity search for query: '{query}' with k={k}")
        return db.similarity_search(query, k=k, filter=filter_func)
