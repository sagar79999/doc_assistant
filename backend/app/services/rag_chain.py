import json
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.utils.config import settings
from app.utils.logger import logger
from app.services.vector_store import search_documents
from app.services.conversation import get_chat_history

# Prompt Template to rewrite the query contextually
REPHRASE_PROMPT = PromptTemplate.from_template(
    "Given the following conversation history and a follow up question, rephrase the follow up question to be a standalone question in its original language.\n\n"
    "Chat History:\n{chat_history}\n"
    "Follow Up Input: {question}\n"
    "Standalone question:"
)

# System prompt template enforcing RAG constraints
RAG_PROMPT = PromptTemplate.from_template(
    "You are an intelligent document assistant.\n\n"
    "Rules:\n"
    "1. Answer the question ONLY using the retrieved context provided below. Do NOT make up facts or use external knowledge.\n"
    "2. If the information does not exist in the context, say exactly: \"I couldn't find this information inside the uploaded documents.\"\n"
    "3. Never hallucinate or assume facts not in the context.\n"
    "4. Give a clean, well-formatted answer without mentioning filenames or page numbers.\n"
    "5. Use bullet points or paragraphs as appropriate for clarity.\n\n"
    "Retrieved Context:\n{context}\n\n"
    "Question: {question}\n\n"
    "Answer:"
)

def get_llm(streaming: bool = False) -> ChatGroq:
    """
    Initializes and returns the ChatGroq LLM instance.
    """
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not configured in .env environment variables.")

    return ChatGroq(
        model=settings.LLM_MODEL,
        api_key=settings.GROQ_API_KEY,
        temperature=0.0,
        streaming=streaming
    )

def format_chat_history(history: list[dict]) -> str:
    """
    Helper to convert raw message JSON history list into a flat text format.
    """
    formatted = []
    for msg in history:
        role = "Human" if msg["role"] == "user" else "Assistant"
        formatted.append(f"{role}: {msg['content']}")
    return "\n".join(formatted)

async def rephrase_question(question: str, history: list[dict]) -> str:
    """
    Rewrites the user question based on chat history to form a standalone question.
    """
    if not history:
        return question
        
    formatted_history = format_chat_history(history)
    llm = get_llm(streaming=False)
    
    chain = REPHRASE_PROMPT | llm | StrOutputParser()
    try:
        standalone = await chain.ainvoke({
            "chat_history": formatted_history,
            "question": question
        })
        logger.info(f"Rephrased question: '{question}' -> '{standalone.strip()}'")
        return standalone.strip()
    except Exception as e:
        logger.error(f"Failed to rephrase question: {e}")
        return question

async def generate_response_stream(
    question: str, 
    session_id: str, 
    search_type: str = "mmr", 
    filter_filename: str = None
):
    """
    Asynchronous generator yielding citations first and then the streaming response text tokens.
    Uses SSE format:
    - 'event: citations' with JSON list of metadata
    - 'event: message' with JSON string tokens
    - 'event: error' with JSON string error message
    - 'event: done' with '[DONE]' to signal termination
    """
    # 1. Fetch history
    history = get_chat_history(session_id)
    
    # 2. Rewrite query (Conversation Aware Retrieval)
    standalone_query = await rephrase_question(question, history)
    
    # 3. Retrieve documents (Supports MMR, metadata filtering)
    filter_metadata = {"filename": filter_filename} if filter_filename else None
    retrieved_docs = search_documents(standalone_query, search_type=search_type, k=5, filter_metadata=filter_metadata)
    
    # Format citations
    citations = []
    for idx, doc in enumerate(retrieved_docs):
        citations.append({
            "id": idx + 1,
            "filename": doc.metadata.get("filename", "Unknown"),
            "page": doc.metadata.get("page", 1),
            "text": doc.page_content,
            "excerpt": doc.metadata.get("excerpt", doc.page_content[:150] + "...")
        })
        
    # Send citations event first
    yield f"event: citations\ndata: {json.dumps(citations)}\n\n"
    
    # 4. Context Optimization / Compression
    context_str = ""
    for doc in retrieved_docs:
        filename = doc.metadata.get('filename', 'Unknown')
        page_num = doc.metadata.get('page', 'Unknown')
        context_str += f"--- DOCUMENT: {filename}, PAGE: {page_num} ---\n"
        context_str += f"{doc.page_content}\n\n"
        
    # 5. Build Generator
    llm = get_llm(streaming=True)
    chain = RAG_PROMPT | llm | StrOutputParser()
    
    try:
        async for chunk in chain.astream({
            "context": context_str,
            "question": standalone_query
        }):
            yield f"event: message\ndata: {json.dumps(chunk)}\n\n"
    except Exception as e:
        logger.error(f"Error streaming response: {e}")
        yield f"event: error\ndata: {json.dumps(str(e))}\n\n"
        
    yield "event: done\ndata: [DONE]\n\n"
