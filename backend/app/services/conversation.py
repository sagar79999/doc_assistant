import json
import os
from pathlib import Path
from datetime import datetime
from langchain_classic.memory import ConversationBufferMemory
from app.utils.config import settings
from app.utils.logger import logger

def get_session_file_path(session_id: str) -> Path:
    return settings.CHAT_HISTORY_DIR / f"{session_id}.json"

def get_chat_history(session_id: str) -> list[dict]:
    """
    Retrieves the raw chat history for a session from disk.
    Each message is a dict: {"role": "user"|"assistant", "content": "...", "timestamp": "...", "citations": [...]}
    """
    file_path = get_session_file_path(session_id)
    if not file_path.exists():
        return []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to read chat history for session {session_id}: {e}")
        return []

def save_chat_message(session_id: str, role: str, content: str, citations: list[dict] = None, filename: str = None) -> list[dict]:
    """
    Appends a user or assistant message to the chat history file.
    Stores filename in session metadata on first message.
    """
    history = get_chat_history(session_id)
    message = {
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat(),
        "citations": citations or []
    }
    # Store filename in first message metadata so sessions can be filtered by PDF
    if filename and len(history) == 0:
        message["filename"] = filename
    history.append(message)
    
    file_path = get_session_file_path(session_id)
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Failed to save chat message for session {session_id}: {e}")
        
    return history

def clear_chat_history(session_id: str):
    """
    Deletes the chat history file for a session.
    """
    file_path = get_session_file_path(session_id)
    if file_path.exists():
        file_path.unlink()
        logger.info(f"Deleted chat history for session {session_id}.")

def get_all_sessions() -> list[dict]:
    """
    Scans the chat history directory and returns metadata about all conversations.
    """
    sessions = []
    if not settings.CHAT_HISTORY_DIR.exists():
        return []
        
    for file in settings.CHAT_HISTORY_DIR.glob("*.json"):
        session_id = file.name.replace(".json", "")
        history = get_chat_history(session_id)
        if not history:
            continue
            
        # Find the first user message for a descriptive title
        title = "New Chat"
        for msg in history:
            if msg["role"] == "user":
                title = msg["content"][:40] + "..." if len(msg["content"]) > 40 else msg["content"]
                break
                
        mtime = file.stat().st_mtime
        last_updated = datetime.fromtimestamp(mtime).isoformat()
        
        sessions.append({
            "session_id": session_id,
            "title": title,
            "last_updated": last_updated,
            "messages_count": len(history),
            "filename": history[0].get("filename", "") if history else ""
        })
        
    sessions.sort(key=lambda x: x["last_updated"], reverse=True)
    return sessions

def get_conversation_memory(session_id: str) -> ConversationBufferMemory:
    """
    Builds and populates a ConversationBufferMemory with session messages.
    """
    history = get_chat_history(session_id)
    memory = ConversationBufferMemory(
        memory_key="chat_history",
        return_messages=True,
        input_key="question",
        output_key="answer"
    )
    
    for msg in history:
        if msg["role"] == "user":
            memory.chat_memory.add_user_message(msg["content"])
        elif msg["role"] == "assistant":
            memory.chat_memory.add_ai_message(msg["content"])
            
    return memory
