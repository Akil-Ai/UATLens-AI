import re
from typing import Tuple, List, Dict, Any


def parse_markdown_or_text(text_content: str) -> Tuple[str, List[str], List[Dict[str, Any]]]:
    """
    Parses plain text or Markdown, extracting detected headings and Markdown tables.
    """
    lines = text_content.splitlines()
    headings: List[str] = []
    tables: List[Dict[str, Any]] = []

    # Detect Markdown headings (# Heading)
    heading_pattern = re.compile(r"^(#{1,6})\s+(.+)$")
    # Detect pipe table lines (| col1 | col2 |)
    table_line_pattern = re.compile(r"^\|(.+)\|$")

    in_table = False
    current_table_rows = []

    for line in lines:
        stripped = line.strip()
        
        # Check heading
        m_head = heading_pattern.match(stripped)
        if m_head:
            headings.append(m_head.group(2).strip())

        # Check table
        if table_line_pattern.match(stripped):
            in_table = True
            cells = [c.strip() for c in stripped.split("|")[1:-1]]
            current_table_rows.append(cells)
        else:
            if in_table and current_table_rows:
                # Table ended
                tables.append({
                    "row_count": len(current_table_rows),
                    "col_count": len(current_table_rows[0]) if current_table_rows else 0,
                    "columns": current_table_rows[0] if current_table_rows else []
                })
                current_table_rows = []
                in_table = False

    if in_table and current_table_rows:
        tables.append({
            "row_count": len(current_table_rows),
            "col_count": len(current_table_rows[0]) if current_table_rows else 0,
            "columns": current_table_rows[0] if current_table_rows else []
        })

    return text_content.strip(), headings, tables
