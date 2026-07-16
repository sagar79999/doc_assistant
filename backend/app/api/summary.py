import os
import json
import re
from typing import Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status
from app.utils.config import settings
from app.utils.logger import logger
from langchain_groq import ChatGroq
from app.services.vector_store import get_vector_store

router = APIRouter()

# Schema for summarization requests
class AnalysisRequest(BaseModel):
    filename: Optional[str] = Field(default=None, description="Optional filename. If omitted, analyzes all loaded documents.")

# Formatting clean up helper for JSON responses
def clean_json_response(raw_text: str) -> dict:
    """
    Cleans markdown code blocks (e.g., ```json ... ```) from the LLM response
    and parses it into a Python dictionary.
    """
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\n", "", cleaned)
        cleaned = re.sub(r"\n```$", "", cleaned)
        cleaned = cleaned.strip()
    return json.loads(cleaned)

def get_document_text(filename: Optional[str] = None) -> str:
    """
    Reconstructs the full text from the FAISS database.
    If filename is provided, restricts to chunks from that specific file.
    """
    db = get_vector_store()
    if db is None:
        return ""
        
    docs = list(db.docstore._dict.values())
    if filename:
        docs = [d for d in docs if d.metadata.get("filename") == filename]
        
    if not docs:
        return ""
        
    # Sort docs chronologically by page number and chunk sequence
    docs.sort(key=lambda x: (x.metadata.get("page", 1), x.metadata.get("chunk_index", 0)))
    
    full_text = "\n".join([d.page_content for d in docs])
    
    # Truncate text if it exceeds maximum context length to keep API requests cost-efficient
    max_chars = 6000
    if len(full_text) > max_chars:
        logger.info(f"Reconstructed document text too large ({len(full_text)} chars). Truncating to {max_chars}.")
        full_text = full_text[:max_chars]
        
    return full_text

@router.post("/summary")
async def generate_summary(request: AnalysisRequest):
    """
    Generates: Short Summary, Detailed Summary, Bullet Summary, 
    Key Insights, Important Dates, Numbers, People, and Organizations.
    Caches the results locally by filename for rapid future loadings.
    """
    text = get_document_text(request.filename)
    if not text:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No document text found. Please upload documents first."
        )
        
    # Set cache path
    cache_key = request.filename if request.filename else "all_documents"
    cache_path = settings.UPLOAD_DIR / f"summary_{cache_key}.json"
    
    if cache_path.exists():
        logger.info(f"Loading summary from cache: {cache_path.name}")
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load summary from cache: {e}")
            
    # Generate via LLM
    prompt = f"""You are an expert document analyst. Analyze the following text and generate:
1. A short summary (2-3 sentences)
2. A detailed summary (multi-paragraph)
3. Bullet points of main summary points
4. Key insights
5. Important dates (with short context description)
6. Important numbers/metrics (with short context description)
7. Important people (with their roles/context)
8. Important organizations (with their roles/context)

Format the output strictly as a JSON object with these keys:
"short_summary": "string",
"detailed_summary": "string",
"bullet_summary": ["string", "string"],
"key_insights": ["string", "string"],
"important_dates": ["string", "string"],
"important_numbers": ["string", "string"],
"important_people": ["string", "string"],
"important_organizations": ["string", "string"]

Do NOT wrap the output in markdown code blocks like ```json ... ```. Just return raw JSON.

Text to analyze:
{text}
"""
    logger.info(f"Generating summary for: {cache_key}")
    llm = ChatGroq(model=settings.SUMMARY_MODEL, api_key=settings.GROQ_API_KEY, temperature=0.0)
    
    try:
        response = await llm.ainvoke(prompt)
        result = clean_json_response(response.content)
        
        # Save to cache
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
            
        return result
    except Exception as e:
        logger.error(f"Failed to generate summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate document summary: {str(e)}"
        )

@router.post("/questions")
async def generate_extra_features(request: AnalysisRequest):
    """
    Generates extra AI features: FAQs, Document Keywords, Topics, 
    Executive Summary, Glossary, Timeline, Action Items, and Important Definitions.
    Caches the results locally by filename.
    """
    text = get_document_text(request.filename)
    if not text:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No document text found. Please upload documents first."
        )
        
    cache_key = request.filename if request.filename else "all_documents"
    cache_path = settings.UPLOAD_DIR / f"questions_{cache_key}.json"
    
    if cache_path.exists():
        logger.info(f"Loading questions/glossary from cache: {cache_path.name}")
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load questions from cache: {e}")
            
    prompt = f"""You are an expert document analyst. Analyze the following text and generate:
1. Frequently Asked Questions (FAQs) - a list of 5-10 question & answer pairs
2. A list of 10 keywords
3. A list of broad topics/themes covered
4. An executive summary
5. Glossary terms (list of key terms/acronyms & their definitions)
6. Timeline (list of date & historical/upcoming event pairs, if chronological events are present)
7. Action items (suggested tasks, recommendations, or steps to take)
8. Important definitions (concepts defined in the text)

Format the output strictly as a JSON object with these keys:
"faqs": [{{"question": "string", "answer": "string"}}],
"keywords": ["string", "string"],
"topics": ["string", "string"],
"executive_summary": "string",
"glossary": [{{"term": "string", "definition": "string"}}],
"timeline": [{{"date": "string", "event": "string"}}],
"action_items": ["string", "string"],
"important_definitions": ["string", "string"]

Do NOT wrap the output in markdown code blocks like ```json ... ```. Just return raw JSON.

Text to analyze:
{text}
"""
    logger.info(f"Generating questions and insights for: {cache_key}")
    llm = ChatGroq(model=settings.SUMMARY_MODEL, api_key=settings.GROQ_API_KEY, temperature=0.0)
    
    try:
        response = await llm.ainvoke(prompt)
        result = clean_json_response(response.content)
        
        # Save to cache
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
            
        return result
    except Exception as e:
        logger.error(f"Failed to generate questions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate extra document insights: {str(e)}"
        )
