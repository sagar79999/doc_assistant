from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from app.utils.logger import logger

def chunk_pdf_pages(pages_data: list[dict], filename: str, file_path: str) -> list[Document]:
    """
    Takes the page-by-page text data and splits it into standard chunks.
    Preserves page number, filename, source, and chunk indices in document metadata.
    
    Chunk Size: 1000
    Chunk Overlap: 200
    """
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
        separators=["\n\n", "\n", " ", ""]
    )
    
    documents = []
    
    for page_entry in pages_data:
        page_num = page_entry["page"]
        text = page_entry["text"]
        
        if not text.strip():
            continue
            
        # Split the text from this page
        chunks = text_splitter.split_text(text)
        
        for chunk_idx, chunk in enumerate(chunks):
            metadata = {
                "source": file_path,
                "filename": filename,
                "page": page_num,
                "chunk_index": chunk_idx,
                "excerpt": chunk[:150] + "..." if len(chunk) > 150 else chunk
            }
            doc = Document(page_content=chunk, metadata=metadata)
            documents.append(doc)
            
    logger.info(f"Split PDF '{filename}' into {len(documents)} chunks.")
    return documents
