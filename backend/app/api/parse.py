from fastapi import APIRouter, UploadFile, File
from backend.app.parsing.manager import parse_uploaded_file

router = APIRouter(tags=["Parsing"])


@router.post("/parse")
async def parse_document(file: UploadFile = File(...)):
    """
    Parses uploaded PDF, DOCX, TXT, or MD file.
    Returns preview metadata: parsed text, word count, detected headings, detected tables, and warnings.
    """
    result = await parse_uploaded_file(file)
    return result

# Commit ref: 47
