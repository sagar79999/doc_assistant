import os
from app.utils.logger import logger

def extract_text_from_pdf_fitz(file_path: str) -> list[dict]:
    """
    Extracts text page by page using PyMuPDF (fitz).
    Returns list of dicts: [{"page": 1, "text": "..."}]
    """
    import fitz  # PyMuPDF
    pages_data = []
    doc = fitz.open(file_path)
    for i, page in enumerate(doc):
        text = page.get_text()
        pages_data.append({
            "page": i + 1,
            "text": text.strip()
        })
    doc.close()
    return pages_data

def extract_text_from_pdf_pypdf(file_path: str) -> list[dict]:
    """
    Extracts text page by page using pypdf as fallback.
    """
    from pypdf import PdfReader
    pages_data = []
    reader = PdfReader(file_path)
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        pages_data.append({
            "page": i + 1,
            "text": text.strip()
        })
    return pages_data

def extract_text_via_ocr(file_path: str) -> list[dict]:
    """
    OCR fallback. Converts PDF pages to images and uses pytesseract to extract text.
    """
    pages_data = []
    try:
        from pdf2image import convert_from_path
        import pytesseract
    except ImportError:
        logger.error("OCR dependencies (pdf2image or pytesseract) are not installed. Skipping OCR.")
        raise RuntimeError("PDF appears to be scanned, but OCR dependencies (pdf2image, pytesseract) are not installed.")
        
    try:
        pytesseract.get_tesseract_version()
    except Exception as e:
        logger.error(f"Tesseract OCR is not installed or not in PATH: {e}")
        raise RuntimeError("PDF appears to be scanned, but Tesseract OCR is not installed or not configured in system PATH.")

    logger.info(f"Running OCR on scanned PDF: {file_path}")
    try:
        images = convert_from_path(file_path)
        for i, img in enumerate(images):
            text = pytesseract.image_to_string(img)
            pages_data.append({
                "page": i + 1,
                "text": text.strip()
            })
    except Exception as e:
        logger.error(f"Error during OCR extraction: {e}")
        raise RuntimeError(f"OCR processing failed: {str(e)}")
        
    return pages_data

def load_pdf(file_path: str) -> list[dict]:
    """
    Loads text from a PDF file.
    Uses PyMuPDF as primary, pypdf as secondary fallback.
    Detects if the PDF is scanned and runs OCR if text is empty or too short.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
        
    logger.info(f"Extracting text from PDF: {file_path}")
    pages_data = []
    
    # 1. Try PyMuPDF
    try:
        pages_data = extract_text_from_pdf_fitz(file_path)
        logger.info("Successfully extracted text using PyMuPDF.")
    except Exception as e:
        logger.warning(f"PyMuPDF failed, trying pypdf fallback. Error: {e}")
        # 2. Try pypdf fallback
        try:
            pages_data = extract_text_from_pdf_pypdf(file_path)
            logger.info("Successfully extracted text using pypdf fallback.")
        except Exception as e2:
            logger.error(f"All standard PDF text extractors failed: {e2}")
            
    # Calculate total extracted characters
    total_chars = sum(len(page["text"]) for page in pages_data)
    
    # 3. Check if scanned PDF (low text content relative to page count)
    is_scanned = len(pages_data) > 0 and total_chars < (100 * len(pages_data))
    
    if is_scanned:
        logger.info("PDF has very low text density. Attempting OCR.")
        try:
            pages_data = extract_text_via_ocr(file_path)
            logger.info("Successfully extracted text using OCR.")
        except Exception as e:
            logger.error(f"OCR extraction failed: {e}. Returning original extracted text.")
            # If OCR fails, we just keep whatever (if any) text was extracted by PyMuPDF/pypdf.
            
    return pages_data
