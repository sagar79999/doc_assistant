import os
import json
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from app.utils.config import settings
from app.utils.logger import logger
from app.utils.helpers import sanitize_filename, format_bytes, calculate_reading_time, get_top_keywords, detect_language
from app.services.pdf_loader import load_pdf
from app.services.chunking import chunk_pdf_pages
from app.services.vector_store import add_documents_to_store, clear_vector_store, rebuild_vector_store_excluding

router = APIRouter()

REGISTRY_PATH = settings.UPLOAD_DIR / "registry.json"

def get_registry() -> dict:
    if not REGISTRY_PATH.exists():
        return {}
    try:
        with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to read upload registry: {e}")
        return {}

def save_registry(registry: dict):
    try:
        with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
            json.dump(registry, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Failed to save upload registry: {e}")

@router.post("/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    """
    Uploads multiple PDF documents, extracts texts, splits into chunks,
    generates embeddings, stores in FAISS, and returns document statistics.
    """
    registry = get_registry()
    processed_results = []
    
    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    for file in files:
        if not file.filename:
            continue
            
        # Validate file type
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File '{file.filename}' is not a PDF. Only PDF files are allowed."
            )
            
        # Sanitize filename
        safe_name = sanitize_filename(file.filename)
        save_path = settings.UPLOAD_DIR / safe_name
        
        # Read file contents to validate size
        contents = await file.read()
        file_size = len(contents)
        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        
        if file_size > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File '{file.filename}' exceeds the maximum upload limit of {settings.MAX_UPLOAD_SIZE_MB}MB."
            )
            
        # Check duplicate
        if safe_name in registry:
            logger.info(f"File {safe_name} already processed. Skipping re-embedding.")
            processed_results.append(registry[safe_name])
            continue
            
        # Save file to disk
        try:
            with open(save_path, "wb") as f:
                f.write(contents)
        except Exception as e:
            logger.error(f"Failed to save uploaded file {safe_name}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Could not save file '{file.filename}' on server."
            )
            
        # Load PDF and extract text page by page
        try:
            pages_data = load_pdf(str(save_path))
        except Exception as e:
            if save_path.exists():
                save_path.unlink()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Failed to extract text from PDF '{file.filename}': {str(e)}"
            )
            
        if not pages_data or all(not page["text"] for page in pages_data):
            if save_path.exists():
                save_path.unlink()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"PDF '{file.filename}' contains no extractable text and OCR failed."
            )
            
        # Split text into chunks
        documents = chunk_pdf_pages(pages_data, safe_name, str(save_path))
        
        # Index document chunks in vector store
        try:
            add_documents_to_store(documents)
        except Exception as e:
            if save_path.exists():
                save_path.unlink()
            logger.error(f"Failed to index documents into FAISS: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database embedding failure for '{file.filename}': {str(e)}"
            )
            
        # Compute statistics
        all_text = "\n".join(page["text"] for page in pages_data)
        word_count = len(all_text.split())
        reading_time = calculate_reading_time(all_text)
        top_keywords = get_top_keywords(all_text, 10)
        detected_lang = detect_language(all_text)
        
        stats = {
            "filename": safe_name,
            "original_filename": file.filename,
            "pages": len(pages_data),
            "word_count": word_count,
            "reading_time_min": reading_time,
            "language": detected_lang,
            "file_size": format_bytes(file_size),
            "upload_time": datetime.utcnow().isoformat(),
            "top_keywords": top_keywords,
            "status": "processed"
        }
        
        # Save to registry
        registry[safe_name] = stats
        processed_results.append(stats)
        
    save_registry(registry)
    return {
        "message": f"Successfully processed {len(processed_results)} file(s).",
        "documents": processed_results
    }

@router.get("/uploads")
async def get_uploaded_documents():
    """
    Returns a list of all successfully processed documents.
    """
    registry = get_registry()
    return list(registry.values())

@router.delete("/uploads/{filename}")
async def delete_single_document(filename: str):
    """
    Deletes a single uploaded PDF, removes it from the registry,
    and rebuilds the FAISS index excluding that file.
    """
    registry = get_registry()
    if filename not in registry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File '{filename}' not found.")

    # Delete physical PDF file
    file_path = settings.UPLOAD_DIR / filename
    if file_path.exists():
        file_path.unlink()

    # Remove from registry
    del registry[filename]
    save_registry(registry)

    # Rebuild FAISS index without this file's chunks
    rebuild_vector_store_excluding(filename)

    return {"message": f"Document '{filename}' deleted successfully."}

@router.delete("/uploads")
async def clear_all_documents():
    """
    Deletes all uploaded documents from disk and resets the FAISS vector database.
    """
    clear_vector_store()
    
    # Delete physical PDF files
    if settings.UPLOAD_DIR.exists():
        for item in settings.UPLOAD_DIR.iterdir():
            if item.name != "registry.json" and item.is_file():
                try:
                    item.unlink()
                except Exception as e:
                    logger.warning(f"Could not delete uploaded file {item.name}: {e}")
                    
    # Clear registry
    save_registry({})
    return {"message": "All uploaded documents and index databases cleared successfully."}
