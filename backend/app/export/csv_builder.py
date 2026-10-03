"""
CSV and ZIP Export Builder with Formula Injection Protection.

Prevents CSV formula injection:
Prepends a single quote (') to any cell string that begins with =, +, -, @, tab, or carriage return,
neutralizing DDE / macro injection in spreadsheet applications.
"""
import io
import csv
import zipfile
from typing import List, Dict, Any

DANGEROUS_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def sanitize_csv_value(val: Any) -> Any:
    """Neutralizes spreadsheet formula injection."""
    if val is None:
        return ""
    s = str(val)
    if s.startswith(DANGEROUS_PREFIXES) and not (s.startswith("-") and s[1:].replace(".", "", 1).isdigit()):
        return f"'{s}"
    return s


# Aliases for export tests and modules
sanitize_formula_injection = sanitize_csv_value


def generate_standard_csv(test_cases: List[Dict[str, Any]]) -> io.StringIO:
    """
    Standard CSV with traceability fields:
    ID, Scenario, Preconditions, Steps, Test Data, Expected Result, Type, Role, Priority, Requirement ID, Status, Permission Rule IDs, Stale, Blocked
    """
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "ID", "Scenario", "Preconditions", "Steps", "Test Data", "Expected Result",
        "Type", "Role", "Priority", "Requirement ID", "Status",
        "Permission Rule IDs", "Stale", "Blocked", "Blocked Reason"
    ])

    for tc in test_cases:
        preconds = "\n".join(tc.get("preconditions", [])) if isinstance(tc.get("preconditions"), list) else str(tc.get("preconditions", ""))
        steps = "\n".join([f"{i+1}. {s}" for i, s in enumerate(tc.get("steps", []))]) if isinstance(tc.get("steps"), list) else str(tc.get("steps", ""))
        test_data = "\n".join([f"{k}: {v}" for k, v in tc.get("test_data", {}).items()]) if isinstance(tc.get("test_data"), dict) else str(tc.get("test_data", ""))
        perm_rules = ", ".join(tc.get("permission_rule_ids", [])) if isinstance(tc.get("permission_rule_ids"), list) else ""

        writer.writerow([
            sanitize_csv_value(tc.get("id")),
            sanitize_csv_value(tc.get("scenario")),
            sanitize_csv_value(preconds),
            sanitize_csv_value(steps),
            sanitize_csv_value(test_data),
            sanitize_csv_value(tc.get("expected_result")),
            sanitize_csv_value(tc.get("scenario_type")),
            sanitize_csv_value(tc.get("role")),
            sanitize_csv_value(tc.get("priority")),
            sanitize_csv_value(tc.get("requirement_id")),
            sanitize_csv_value(tc.get("status")),
            sanitize_csv_value(perm_rules),
            sanitize_csv_value("Yes" if tc.get("is_stale") else "No"),
            sanitize_csv_value("Yes" if tc.get("is_blocked") else "No"),
            sanitize_csv_value(tc.get("blocked_reason") or ""),
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
            sanitize_csv_value(summary),
            sanitize_csv_value(desc),
            sanitize_csv_value(preconds),
            sanitize_csv_value(steps),
            sanitize_csv_value(tc.get("expected_result")),
            sanitize_csv_value(tc.get("priority")),
            sanitize_csv_value(labels)
        ])

    output.seek(0)
    return output


def generate_requirements_csv(requirements: List[Dict[str, Any]]) -> io.StringIO:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Requirement ID", "Title", "Text", "Source Quote", "Roles Involved", "Expected Outcome"])
    for r in requirements:
        roles_str = ", ".join(r.get("roles_involved", [])) if isinstance(r.get("roles_involved"), list) else str(r.get("roles_involved", ""))
        writer.writerow([
            sanitize_csv_value(r.get("id")),
            sanitize_csv_value(r.get("title")),
            sanitize_csv_value(r.get("text")),
            sanitize_csv_value(r.get("source_quote")),
            sanitize_csv_value(roles_str),
            sanitize_csv_value(r.get("expected_outcome")),
        ])
    output.seek(0)
    return output


def generate_clarifications_csv(clarifications: List[Dict[str, Any]]) -> io.StringIO:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Requirement ID", "Issue Type", "Question", "Status", "Answer", "Confirmed By", "Dismissal Reason"])
    for c in clarifications:
        writer.writerow([
            sanitize_csv_value(c.get("id")),
            sanitize_csv_value(c.get("requirement_id")),
            sanitize_csv_value(c.get("issue_type")),
            sanitize_csv_value(c.get("suggested_question")),
            sanitize_csv_value(c.get("status")),
            sanitize_csv_value(c.get("reviewer_answer")),
            sanitize_csv_value(c.get("confirmed_by")),
            sanitize_csv_value(c.get("dismissal_reason")),
        ])
    output.seek(0)
    return output


def generate_permissions_csv(permission_rules: List[Dict[str, Any]]) -> io.StringIO:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Role", "Action", "Resource", "Scope", "Condition", "Decision", "Review Status", "Revision"])
    for p in permission_rules:
        writer.writerow([
            sanitize_csv_value(p.get("id")),
            sanitize_csv_value(p.get("role")),
            sanitize_csv_value(p.get("action")),
            sanitize_csv_value(p.get("resource")),
            sanitize_csv_value(p.get("scope")),
            sanitize_csv_value(p.get("condition")),
            sanitize_csv_value(p.get("decision")),
            sanitize_csv_value(p.get("review_status")),
            sanitize_csv_value(p.get("revision")),
        ])
    output.seek(0)
    return output


def generate_zip_bundle(
    test_cases: List[Dict[str, Any]],
    requirements: List[Dict[str, Any]],
    clarifications: List[Dict[str, Any]],
    permission_rules: List[Dict[str, Any]],
    project_name: str = "UATLens"
) -> io.BytesIO:
    """
    Packages all tabular entities into a clean multi-file ZIP archive.
    Includes UTF-8 BOM prefix for seamless Microsoft Excel compatibility.
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr("test_cases.csv", "\ufeff" + generate_standard_csv(test_cases).getvalue())
        zip_file.writestr("requirements.csv", "\ufeff" + generate_requirements_csv(requirements).getvalue())
        zip_file.writestr("clarifications.csv", "\ufeff" + generate_clarifications_csv(clarifications).getvalue())
        zip_file.writestr("permission_rules.csv", "\ufeff" + generate_permissions_csv(permission_rules).getvalue())
    buf.seek(0)
    return buf

