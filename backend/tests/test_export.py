import io
import pytest
from openpyxl import load_workbook
from backend.app.export.excel_builder import generate_excel_workbook


def test_excel_export_structure():
    test_cases = [
        {
            "id": "TC-001",
            "scenario": "Verify valid checkout",
            "preconditions": ["User logged in", "Cart has items"],
            "steps": ["1. Go to cart", "2. Click checkout"],
            "test_data": {"amount": 50.00, "item": "Keyboard"},
            "expected_result": "Order placed successfully",
            "scenario_type": "Positive",
            "role": "Registered Customer",
            "priority": "High",
            "requirement_id": "REQ-001",
            "status": "Approved",
            "flags": []
        },
        {
            "id": "TC-002",
            "scenario": "Verify invalid coupon code",
            "preconditions": ["Cart total $10"],
            "steps": ["1. Enter coupon", "2. Click apply"],
            "test_data": {"coupon": "INVALID"},
            "expected_result": "Error shown",
            "scenario_type": "Negative",
            "role": "Guest",
            "priority": "Medium",
            "requirement_id": "REQ-002",
            "status": "Draft",
            "flags": [{"type": "Ambiguous Requirement", "severity": "Medium", "message": "Vague error text"}]
        }
    ]
    requirements = [
        {"id": "REQ-001", "title": "Checkout Workflow"},
        {"id": "REQ-002", "title": "Coupon Processing"}
    ]

    excel_stream = generate_excel_workbook(test_cases, requirements, "Test Project")
    wb = load_workbook(excel_stream)

    # 1. Assert sheet names
    expected_sheets = ["Test Cases", "Summary", "Clarifications", "Traceability"]
    assert wb.sheetnames == expected_sheets

    # 2. Assert exact column headers and order on Sheet 1
    ws1 = wb["Test Cases"]
    expected_headers = [
        "ID", "Scenario", "Preconditions", "Steps", "Test Data", "Expected Result",
        "Type", "Role", "Priority", "Requirement ID", "Status", "Flags"
    ]
    actual_headers = [ws1.cell(row=1, column=col).value for col in range(1, len(expected_headers) + 1)]
    assert actual_headers == expected_headers

    # 3. Assert row count
    assert ws1.max_row == 3

    # 4. Assert Sheet 2 Summary has metrics
    ws2 = wb["Summary"]
    assert ws2.cell(row=1, column=1).value == "Metric"

    # 5. Assert Sheet 3 Clarifications has flags
    ws3 = wb["Clarifications"]
    assert ws3.max_row >= 2
    assert ws3.cell(row=2, column=1).value == "TC-002"

    # 6. Assert Sheet 4 Traceability has linked cases
    ws4 = wb["Traceability"]
    assert ws4.cell(row=2, column=1).value == "REQ-001"
