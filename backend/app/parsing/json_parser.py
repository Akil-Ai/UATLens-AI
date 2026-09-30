"""
Structured JSON Requirement Parser and Validator.

Validates:
- JSON syntax and structural schemas
- Requirements array with required 'title' and 'text' fields
- Optional fields: id, source_quote, roles_involved, expected_outcome
- Converts validated items into clean Markdown documentation
"""
import json
from typing import Tuple, List, Dict, Any
from fastapi import HTTPException, status


def parse_and_validate_json_requirements(raw_bytes: bytes) -> Tuple[str, List[str], List[Dict[str, Any]]]:
    """
    Parses and validates uploaded JSON requirement specifications.
    Returns (markdown_text, detected_headings, detected_tables).
    Raises HTTPException(422) with detailed error if schema validation fails.
    """
    try:
        data = json.loads(raw_bytes.decode("utf-8"))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Malformed JSON document: {str(e)}"
        )

    # Determine list of requirement items
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        if "requirements" in data and isinstance(data["requirements"], list):
            items = data["requirements"]
        elif "items" in data and isinstance(data["items"], list):
            items = data["items"]
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="JSON object must contain a 'requirements' or 'items' array of requirement objects."
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="JSON document must be an array of requirements or an object with a 'requirements' array."
        )

    if not items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="JSON requirement array is empty."
        )

    headings: List[str] = []
    lines: List[str] = []
    validated_rows: List[List[str]] = []

    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Requirement item at index {idx} must be a JSON object, got {type(item).__name__}."
            )

        title = item.get("title") or item.get("name")
        text = item.get("text") or item.get("description") or item.get("requirement")
        req_id = item.get("id") or f"REQ-{idx+1:03d}"
        source_quote = item.get("source_quote") or ""
        roles = item.get("roles_involved") or item.get("roles") or []
        expected = item.get("expected_outcome") or item.get("expected_result") or ""

        if not title or not str(title).strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Requirement item at index {idx} is missing required 'title' field."
            )
        if not text or not str(text).strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Requirement item at index {idx} ('{title}') is missing required 'text' or 'description' field."
            )

        title_str = str(title).strip()
        text_str = str(text).strip()
        headings.append(f"{req_id}: {title_str}")

        lines.append(f"## {req_id}: {title_str}\n")
        lines.append(f"{text_str}\n")
        if source_quote:
            lines.append(f"> **Source Quote:** {source_quote}\n")
        if roles:
            roles_str = ", ".join(roles) if isinstance(roles, list) else str(roles)
            lines.append(f"**Roles Involved:** {roles_str}\n")
        if expected:
            lines.append(f"**Expected Outcome:** {expected}\n")

        lines.append("---\n")
        validated_rows.append([req_id, title_str, text_str[:120]])

    # Generate summary table
    tables = [{
        "row_count": len(validated_rows),
        "col_count": 3,
        "columns": ["Requirement ID", "Title", "Text Excerpt"]
    }]

    return "\n".join(lines), headings, tables
