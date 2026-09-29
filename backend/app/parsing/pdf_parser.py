import io
from pypdf import PdfReader
from typing import Tuple, List, Dict, Any


def parse_pdf(file_bytes: bytes) -> Tuple[str, List[str], List[Dict[str, Any]], List[str]]:
    """
    Parses a PDF using pypdf.
    Returns (extracted_text, detected_headings, detected_tables, warnings).
    """
    reader = PdfReader(io.BytesIO(file_bytes))
    num_pages = len(reader.pages)
    page_texts: List[str] = []
    headings: List[str] = []
    warnings: List[str] = []

    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip():
            page_texts.append(text)
        
        # Simple heuristic for potential headings: short uppercase or numbered lines
        for line in text.splitlines():
            line_str = line.strip()
            if 3 < len(line_str) < 60:
                if line_str.isupper() or line_str.startswith(("1.", "2.", "3.", "4.", "5.", "6.", "Section", "Chapter")):
                    headings.append(line_str)

    full_text = "\n\n".join(page_texts).strip()

    if not full_text:
        warnings.append("Warning: No extractable text found in PDF. The document may be scanned or image-only.")

    tables: List[Dict[str, Any]] = []  # Simple summary
    return full_text, headings, tables, warnings
