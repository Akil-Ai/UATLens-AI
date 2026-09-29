import os
from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["Sample"])

SAMPLE_PATH = os.path.join(os.path.dirname(__file__), "..", "samples", "ecommerce_checkout.md")


@router.get("/sample")
def get_sample_document():
    if not os.path.exists(SAMPLE_PATH):
        raise HTTPException(status_code=404, detail="Sample requirements document not found.")
    
    with open(SAMPLE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    return {
        "title": "E-Commerce Checkout & Order Processing",
        "filename": "ecommerce_checkout.md",
        "content": content,
        "word_count": len(content.split()),
        "character_count": len(content)
    }

# Commit ref: 54
