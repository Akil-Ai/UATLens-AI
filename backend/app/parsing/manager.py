from typing import Dict, Any, List
from fastapi import UploadFile, HTTPException
from backend.app.parsing.pdf_parser import parse_pdf
from backend.app.parsing.docx_parser import parse_docx
from backend.app.parsing.text_parser import parse_markdown_or_text

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


async def parse_uploaded_file(file: UploadFile) -> Dict[str, Any]:
    filename = file.filename or "unknown"
    ext = filename.split(".")[-1].lower() if "." in filename else ""

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File exceeds maximum allowed size of 10 MB ({len(content)} bytes).")

    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    warnings: List[str] = []
    headings: List[str] = []
    tables: List[Dict[str, Any]] = []
    parsed_text = ""

    try:
        if ext == "pdf":
            parsed_text, headings, tables, pdf_warnings = parse_pdf(content)
            warnings.extend(pdf_warnings)
        elif ext in ["docx"]:
            parsed_text, headings, tables = parse_docx(content)
        elif ext in ["txt", "md", "markdown"]:
            text_str = content.decode("utf-8", errors="replace")
            parsed_text, headings, tables = parse_markdown_or_text(text_str)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format '.{ext}'. Supported formats: PDF, DOCX, TXT, MD."
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse file '{filename}': {str(e)}")

    word_count = len(parsed_text.split())
    char_count = len(parsed_text)

    if char_count > 60000:
        warnings.append("Document is very large (>60,000 characters). Analysis will chunk automatically.")

    return {
        "filename": filename,
        "extension": ext,
        "parsed_text": parsed_text,
        "word_count": word_count,
        "character_count": char_count,
        "headings": headings,
        "tables": tables,
        "warnings": warnings,
    }

# Commit ref: 25
