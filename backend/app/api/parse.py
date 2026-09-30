from fastapi import APIRouter, UploadFile, File, Depends
from backend.app.parsing.manager import parse_uploaded_file
from backend.app.core.auth import AuthUser, get_current_user

router = APIRouter(tags=["Parsing"])


@router.post("/parse")
async def parse_document(
    file: UploadFile = File(...),
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Parses uploaded PDF, DOCX, TXT, MD, or JSON file.
    Returns preview metadata: parsed text, word count, detected headings, detected tables, and warnings.
    """
    result = await parse_uploaded_file(file)
    return result
