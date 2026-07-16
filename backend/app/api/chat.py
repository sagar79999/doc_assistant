import json
from uuid import uuid4
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from app.utils.logger import logger
from app.utils.config import settings
from app.services.rag_chain import generate_response_stream
from app.services.conversation import save_chat_message, get_chat_history, clear_chat_history, get_all_sessions

router = APIRouter()

class ChatRequest(BaseModel):
    session_id: Optional[str] = Field(default=None, description="Unique chat session ID. Generated if empty.")
    question: str = Field(..., description="The user query to chat about.")
    search_type: Optional[str] = Field(default="mmr", description="Retrieval mechanism: 'mmr' or 'similarity'.")
    filter_filename: Optional[str] = Field(default=None, description="Optional filename filter to restrict context.")

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    """
    Core RAG Chat endpoint. Returns an SSE StreamingResponse.
    First chunk contains list of Citations, subsequent chunks stream text tokens.
    """
    session_id = request.session_id or str(uuid4())
    logger.info(f"Incoming query on session '{session_id}': '{request.question}'")
    
    # Save the user query with filename for session filtering
    save_chat_message(session_id, "user", request.question, filename=request.filter_filename)
    
    async def response_generator():
        complete_response = []
        citations = []
        
        async for sse_chunk in generate_response_stream(
            question=request.question,
            session_id=session_id,
            search_type=request.search_type,
            filter_filename=request.filter_filename
        ):
            # Parse events to collect final answer and citations for storing in history
            if sse_chunk.startswith("event: citations"):
                try:
                    data_part = sse_chunk.split("data: ")[1].strip()
                    citations = json.loads(data_part)
                except Exception as e:
                    logger.error(f"Failed to parse citations: {e}")
            elif sse_chunk.startswith("event: message"):
                try:
                    data_part = sse_chunk.split("data: ")[1].strip()
                    text_token = json.loads(data_part)
                    complete_response.append(text_token)
                except Exception as e:
                    logger.error(f"Failed to parse message text: {e}")
                    
            yield sse_chunk
            
        # Stream completed. Save assistant response to file
        full_answer = "".join(complete_response)
        if full_answer:
            save_chat_message(session_id, "assistant", full_answer, citations)
            logger.info(f"Saved assistant response to history for session '{session_id}'")

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Session-ID": session_id  # Send back session ID to the client
    }
    
    return StreamingResponse(response_generator(), headers=headers, media_type="text/event-stream")

@router.get("/history")
async def list_sessions():
    """
    Returns all recent chat sessions.
    """
    return get_all_sessions()

@router.get("/history/{session_id}")
async def get_session_history(session_id: str):
    """
    Returns all message logs for a single session.
    """
    history = get_chat_history(session_id)
    return history

@router.delete("/history")
async def delete_all_history(session_id: Optional[str] = Query(None, description="If provided, only deletes this session")):
    """
    Wipes chat history from disk. If session_id is provided, deletes just that session, otherwise deletes all files.
    """
    if session_id:
        clear_chat_history(session_id)
        return {"message": f"Session '{session_id}' history cleared successfully."}
    else:
        # Wipe all sessions
        if settings.CHAT_HISTORY_DIR.exists():
            for file in settings.CHAT_HISTORY_DIR.glob("*.json"):
                try:
                    file.unlink()
                except Exception as e:
                    logger.warning(f"Could not delete session history file {file.name}: {e}")
        return {"message": "All chat history cleared successfully."}
