import io
import logging
from docx import Document
from typing import Tuple, List, Dict, Any

W_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
logger = logging.getLogger(__name__)



def _extract_leaf_text(element) -> str:
    """
    Extracts text strictly from leaf text nodes (w:t) in document order.
    Prevents duplicate text accumulation caused by walking both parent runs and child text nodes.
    """
    text_pieces = []
    # Find only leaf text elements within the current paragraph/cell
    for node in element.findall(f".//{{{W_NAMESPACE}}}t"):
        if node.text:
            text_pieces.append(node.text)
    return "".join(text_pieces).strip()


def parse_docx(file_bytes: bytes) -> Tuple[str, List[str], List[Dict[str, Any]]]:
    """
    Parses a DOCX file into structured Markdown.
    Preserves headings as '# Heading' and tables as Markdown pipe tables.
    Collects text exclusively from leaf text nodes in document body order without duplication.
    Returns (markdown_text, detected_headings, detected_tables).
    """
    doc = Document(io.BytesIO(file_bytes))
    lines: List[str] = []
    headings: List[str] = []
    tables_summary: List[Dict[str, Any]] = []

    # Iterate over elements in document body order
    for element in doc.element.body:
        tag_name = element.tag.split("}")[-1] if "}" in element.tag else element.tag

        if tag_name == "p":
            # Paragraph: extract strictly leaf text
            text = _extract_leaf_text(element)
            if not text:
                continue

            # Check style name if available
            p_style = element.xpath("./w:pPr/w:pStyle/@w:val")
            style_val = p_style[0].lower() if p_style else ""

            if "heading 1" in style_val or style_val == "heading1":
                lines.append(f"\n# {text}\n")
                headings.append(text)
            elif "heading 2" in style_val or style_val == "heading2":
                lines.append(f"\n## {text}\n")
                headings.append(text)
            elif "heading 3" in style_val or style_val == "heading3":
                lines.append(f"\n### {text}\n")
                headings.append(text)
            else:
                lines.append(text)

        elif tag_name == "tbl":
            # Table element
            table_rows = []
            for row_el in element.findall(f".//{{{W_NAMESPACE}}}tr"):
                row_cells = []
                for cell_el in row_el.findall(f".//{{{W_NAMESPACE}}}tc"):
                    cell_text = _extract_leaf_text(cell_el)
                    row_cells.append(cell_text.replace("\n", " ").replace("|", "\\|"))
                if any(c.strip() for c in row_cells):
                    table_rows.append(row_cells)

            if table_rows:
                num_cols = max(len(r) for r in table_rows)
                header = table_rows[0] + [""] * (num_cols - len(table_rows[0]))
                header_line = "| " + " | ".join(header) + " |"
                separator_line = "| " + " | ".join(["---"] * num_cols) + " |"

                table_md = [header_line, separator_line]
                for r in table_rows[1:]:
                    padded_r = r + [""] * (num_cols - len(r))
                    table_md.append("| " + " | ".join(padded_r) + " |")

                table_str = "\n" + "\n".join(table_md) + "\n"
                lines.append(table_str)
                tables_summary.append({
                    "row_count": len(table_rows),
                    "col_count": num_cols,
                    "columns": header
                })

    full_text = "\n\n".join(lines).strip()
    return full_text, headings, tables_summary
