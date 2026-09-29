import io
import csv
from typing import List, Dict, Any


def generate_standard_csv(test_cases: List[Dict[str, Any]]) -> io.StringIO:
    """
    Standard CSV with the exact first six columns:
    ID, Scenario, Preconditions, Steps, Test Data, Expected Result, Type, Role, Priority, Requirement ID, Status
    """
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "ID", "Scenario", "Preconditions", "Steps", "Test Data", "Expected Result",
        "Type", "Role", "Priority", "Requirement ID", "Status"
    ])

    for tc in test_cases:
        preconds = "\n".join(tc.get("preconditions", [])) if isinstance(tc.get("preconditions"), list) else str(tc.get("preconditions", ""))
        steps = "\n".join([f"{i+1}. {s}" for i, s in enumerate(tc.get("steps", []))]) if isinstance(tc.get("steps"), list) else str(tc.get("steps", ""))
        test_data = "\n".join([f"{k}: {v}" for k, v in tc.get("test_data", {}).items()]) if isinstance(tc.get("test_data"), dict) else str(tc.get("test_data", ""))

        writer.writerow([
            tc.get("id"),
            tc.get("scenario"),
            preconds,
            steps,
            test_data,
            tc.get("expected_result"),
            tc.get("scenario_type"),
            tc.get("role"),
            tc.get("priority"),
            tc.get("requirement_id"),
            tc.get("status"),
        ])

    output.seek(0)
    return output


def generate_jira_csv(test_cases: List[Dict[str, Any]]) -> io.StringIO:
    """
    Jira/TestRail-ready CSV format:
    Summary, Description, Preconditions, Steps, Expected Result, Priority, Labels
    """
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Summary", "Description", "Preconditions", "Steps", "Expected Result", "Priority", "Labels"
    ])

    for tc in test_cases:
        summary = f"[{tc.get('id')}] {tc.get('scenario')}"
        preconds = "\n".join(tc.get("preconditions", [])) if isinstance(tc.get("preconditions"), list) else ""
        steps = "\n".join([f"{i+1}. {s}" for i, s in enumerate(tc.get("steps", []))]) if isinstance(tc.get("steps"), list) else ""
        labels = f"UAT,{tc.get('scenario_type')},{tc.get('role')},{tc.get('requirement_id')}"
        desc = f"Role: {tc.get('role')}\nRequirement: {tc.get('requirement_id')}\nQuote: {tc.get('source_quote')}"

        writer.writerow([
            summary,
            desc,
            preconds,
            steps,
            tc.get("expected_result"),
            tc.get("priority"),
            labels
        ])

    output.seek(0)
    return output
