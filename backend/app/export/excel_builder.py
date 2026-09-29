import io
import json
from typing import List, Dict, Any
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter


def generate_excel_workbook(
    test_cases: List[Dict[str, Any]],
    requirements: List[Dict[str, Any]] = None,
    project_name: str = "UATlens Test Suite"
) -> io.BytesIO:
    """
    Generates a professionally styled 4-sheet Excel (.xlsx) workbook using openpyxl.
    Sheet 1: Test Cases (exact order, styled, data validation, conditional formatting)
    Sheet 2: Summary (KPIs, counts by type/priority/role, coverage)
    Sheet 3: Clarifications (flags and suggested BA questions)
    Sheet 4: Traceability (REQ -> TC matrix)
    """
    if requirements is None:
        requirements = []

    wb = Workbook()
    
    # ------------------ SHEET 1: TEST CASES ------------------
    ws1 = wb.active
    ws1.title = "Test Cases"
    ws1.views.sheetView[0].showGridLines = True

    # Header styling
    indigo_fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    data_font = Font(name="Segoe UI", size=10, color="1E293B")
    center_align = Alignment(horizontal="center", vertical="top", wrap_text=True)
    left_wrap_align = Alignment(horizontal="left", vertical="top", wrap_text=True)
    
    thin_border_side = Side(style="thin", color="CBD5E1")
    cell_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)

    # EXACT required columns order
    headers = [
        "ID", "Scenario", "Preconditions", "Steps", "Test Data", "Expected Result",
        "Type", "Role", "Priority", "Requirement ID", "Status", "Flags"
    ]
    ws1.append(headers)

    for col_idx in range(1, len(headers) + 1):
        cell = ws1.cell(row=1, column=col_idx)
        cell.fill = indigo_fill
        cell.font = header_font
        cell.alignment = center_align
        cell.border = cell_border
    
    ws1.row_dimensions[1].height = 28
    ws1.freeze_panes = "A2"

    # Scenario type fills (light tints)
    fill_positive = PatternFill(start_color="ECFDF5", end_color="ECFDF5", fill_type="solid")  # emerald-50
    fill_negative = PatternFill(start_color="FFF1F2", end_color="FFF1F2", fill_type="solid")  # rose-50
    fill_boundary = PatternFill(start_color="FFFBEB", end_color="FFFBEB", fill_type="solid")  # amber-50

    for row_idx, tc in enumerate(test_cases, start=2):
        # Format Preconditions as newline-separated
        preconds = tc.get("preconditions", [])
        preconds_str = "\n".join(preconds) if isinstance(preconds, list) else str(preconds)

        # Format Steps as numbered lines
        steps = tc.get("steps", [])
        if isinstance(steps, list):
            steps_str = "\n".join([s if s.strip().startswith(tuple(str(k) for k in range(1, 10))) else f"{i+1}. {s}" for i, s in enumerate(steps)])
        else:
            steps_str = str(steps)

        # Format Test Data as "key: value" lines
        test_data = tc.get("test_data", {})
        if isinstance(test_data, dict):
            test_data_str = "\n".join([f"{k}: {v}" for k, v in test_data.items()])
        else:
            test_data_str = str(test_data)

        # Format flags
        flags = tc.get("flags", [])
        flags_str = ", ".join([f.get("type", "") for f in flags if isinstance(f, dict)])

        row_data = [
            tc.get("id", f"TC-{row_idx-1:03d}"),
            tc.get("scenario", ""),
            preconds_str,
            steps_str,
            test_data_str,
            tc.get("expected_result", ""),
            tc.get("scenario_type", "Positive"),
            tc.get("role", "Guest"),
            tc.get("priority", "Medium"),
            tc.get("requirement_id", "REQ-001"),
            tc.get("status", "Draft"),
            flags_str,
        ]
        ws1.append(row_data)
        ws1.row_dimensions[row_idx].height = 42

        # Style data cells
        stype = tc.get("scenario_type", "")
        row_fill = None
        if stype == "Positive":
            row_fill = fill_positive
        elif stype == "Negative":
            row_fill = fill_negative
        elif stype == "Boundary":
            row_fill = fill_boundary

        for col_idx in range(1, len(headers) + 1):
            cell = ws1.cell(row=row_idx, column=col_idx)
            cell.font = data_font
            cell.border = cell_border
            if col_idx in [1, 7, 8, 9, 10, 11]:
                cell.alignment = center_align
            else:
                cell.alignment = left_wrap_align

            # Color type column with soft badge tint
            if col_idx == 7 and row_fill:
                cell.fill = row_fill

    # Set column widths
    column_widths = {
        "A": 12,  # ID
        "B": 36,  # Scenario
        "C": 28,  # Preconditions
        "D": 48,  # Steps
        "E": 28,  # Test Data
        "F": 45,  # Expected Result
        "G": 14,  # Type
        "H": 20,  # Role
        "I": 12,  # Priority
        "J": 16,  # Requirement ID
        "K": 16,  # Status
        "L": 26,  # Flags
    }
    for col_letter, width in column_widths.items():
        ws1.column_dimensions[col_letter].width = width

    # Add Auto-filter
    ws1.auto_filter.ref = f"A1:L{len(test_cases) + 1}"

    # Data validation dropdowns for Type, Priority, Status
    dv_type = DataValidation(type="list", formula1='"Positive,Negative,Boundary"', allow_blank=True)
    ws1.add_data_validation(dv_type)
    dv_type.add(f"G2:G{len(test_cases) + 1}")

    dv_priority = DataValidation(type="list", formula1='"High,Medium,Low"', allow_blank=True)
    ws1.add_data_validation(dv_priority)
    dv_priority.add(f"I2:I{len(test_cases) + 1}")

    dv_status = DataValidation(type="list", formula1='"Draft,Reviewed,Approved,Needs Clarification"', allow_blank=True)
    ws1.add_data_validation(dv_status)
    dv_status.add(f"K2:K{len(test_cases) + 1}")

    # ------------------ SHEET 2: SUMMARY ------------------
    ws2 = wb.create_sheet(title="Summary")
    ws2.views.sheetView[0].showGridLines = True
    ws2.column_dimensions["A"].width = 24
    ws2.column_dimensions["B"].width = 20

    ws2.append(["Metric", "Count / Value"])
    for col in (1, 2):
        cell = ws2.cell(row=1, column=col)
        cell.fill = indigo_fill
        cell.font = header_font
        cell.alignment = center_align

    total_tc = len(test_cases)
    approved_tc = sum(1 for tc in test_cases if tc.get("status") == "Approved")
    positive_tc = sum(1 for tc in test_cases if tc.get("scenario_type") == "Positive")
    negative_tc = sum(1 for tc in test_cases if tc.get("scenario_type") == "Negative")
    boundary_tc = sum(1 for tc in test_cases if tc.get("scenario_type") == "Boundary")
    high_tc = sum(1 for tc in test_cases if tc.get("priority") == "High")
    med_tc = sum(1 for tc in test_cases if tc.get("priority") == "Medium")
    low_tc = sum(1 for tc in test_cases if tc.get("priority") == "Low")

    unique_reqs = set(tc.get("requirement_id") for tc in test_cases if tc.get("requirement_id"))
    req_coverage_pct = f"{round((len(unique_reqs) / max(len(requirements), 1)) * 100)}%" if requirements else "100%"

    metrics = [
        ("Total Test Cases", total_tc),
        ("Approved Cases", approved_tc),
        ("Approval Rate", f"{round((approved_tc / max(total_tc, 1)) * 100)}%"),
        ("Requirement Coverage", req_coverage_pct),
        ("", ""),
        ("Scenario: Positive", positive_tc),
        ("Scenario: Negative", negative_tc),
        ("Scenario: Boundary", boundary_tc),
        ("", ""),
        ("Priority: High", high_tc),
        ("Priority: Medium", med_tc),
        ("Priority: Low", low_tc),
    ]

    for m_label, m_val in metrics:
        row_num = ws2.max_row + 1
        ws2.append([m_label, m_val])
        if m_label:
            ws2.cell(row=row_num, column=1).font = Font(name="Segoe UI", size=10, bold=True)
            ws2.cell(row=row_num, column=2).font = data_font
            ws2.cell(row=row_num, column=2).alignment = center_align

    # ------------------ SHEET 3: CLARIFICATIONS ------------------
    ws3 = wb.create_sheet(title="Clarifications")
    ws3.views.sheetView[0].showGridLines = True
    c_headers = ["Test Case ID", "Requirement ID", "Flag Type", "Severity", "Message", "Suggested BA Question"]
    ws3.append(c_headers)
    for col in range(1, len(c_headers) + 1):
        cell = ws3.cell(row=1, column=col)
        cell.fill = indigo_fill
        cell.font = header_font
        cell.alignment = center_align

    for tc in test_cases:
        for f in tc.get("flags", []):
            ws3.append([
                tc.get("id"),
                tc.get("requirement_id"),
                f.get("type"),
                f.get("severity"),
                f.get("message"),
                f.get("suggested_question", "")
            ])

    ws3.column_dimensions["A"].width = 14
    ws3.column_dimensions["B"].width = 16
    ws3.column_dimensions["C"].width = 24
    ws3.column_dimensions["D"].width = 12
    ws3.column_dimensions["E"].width = 45
    ws3.column_dimensions["F"].width = 45

    # ------------------ SHEET 4: TRACEABILITY ------------------
    ws4 = wb.create_sheet(title="Traceability")
    ws4.views.sheetView[0].showGridLines = True
    t_headers = ["Requirement ID", "Requirement Title", "Linked Test Cases", "Covered Scenario Types"]
    ws4.append(t_headers)
    for col in range(1, len(t_headers) + 1):
        cell = ws4.cell(row=1, column=col)
        cell.fill = indigo_fill
        cell.font = header_font
        cell.alignment = center_align

    req_map = {r.get("id"): r for r in requirements}
    all_req_ids = list(req_map.keys()) if req_map else sorted(list(unique_reqs))

    for rid in all_req_ids:
        title = req_map.get(rid, {}).get("title", f"Requirement {rid}")
        matching_tcs = [tc for tc in test_cases if tc.get("requirement_id") == rid]
        tc_ids_str = ", ".join([tc.get("id", "") for tc in matching_tcs])
        types_covered = ", ".join(sorted(list(set(tc.get("scenario_type", "") for tc in matching_tcs))))
        ws4.append([rid, title, tc_ids_str, types_covered])

    ws4.column_dimensions["A"].width = 16
    ws4.column_dimensions["B"].width = 38
    ws4.column_dimensions["C"].width = 35
    ws4.column_dimensions["D"].width = 28

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream

# Commit ref: 43
