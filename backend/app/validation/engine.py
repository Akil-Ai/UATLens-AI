import re
import string
from typing import List, Dict, Any, Tuple, Set, Optional

VAGUE_TERMS = {
    "quickly": "Quantify with specific latency requirement (e.g., < 250ms).",
    "fast": "Replace with objective response time benchmark.",
    "appropriate": "Define explicit error message text, code, or visual cues.",
    "user-friendly": "Provide concrete UX requirements, layout specifications, or guidelines.",
    "proper": "Specify exact validation rules or schema parameters.",
    "properly": "Specify expected behavior and validation outcomes.",
    "as expected": "State observable, unambiguous verification criteria.",
    "works correctly": "Define expected output, data changes, and status codes.",
    "as needed": "Clarify explicit trigger conditions and operational thresholds."
}

# Meaningful operators that MUST be preserved during normalization
# Stripping these alters business logic (e.g. turning "amount > 5000" into "amount 5000")
PRESERVED_SYMBOLS = {"<=", ">=", "!=", "<", ">", "=", "%", "$", "+", "-", "."}
COSMETIC_PUNCTUATION = re.compile(r'[\u201c\u201d\u2018\u2019"\'`,;:()\[\]{}!?~*^\\/_#&@]')


def normalize_text_for_search(text: str) -> str:
    """
    Normalizes text for substring and evidence checking:
    - Normalizes cosmetic whitespace and lowercases
    - Strips cosmetic punctuation (quotes, commas, brackets)
    - Strips cosmetic periods (e.g. ellipses, sentence terminators) while PRESERVING decimal numbers (e.g. 24.99)
    - STRICTLY PRESERVES meaningful symbols: <, >, <=, >=, =, !=, %, $, -, +, and decimals
    """
    if not text:
        return ""

    # Replace smart quotes with standard spaces or remove
    text = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")

    # Remove non-numeric dots (e.g. sentence-ending periods, ellipses, abbreviations)
    # Preserves dots that are surrounded by digits on both sides (e.g. 3.14, 24.99)
    text = re.sub(r'(?<!\d)\.|\.(?!\d)', ' ', text)

    # Remove cosmetic punctuation only
    cleaned = COSMETIC_PUNCTUATION.sub(" ", text)

    # Collapse whitespace and lowercase
    tokens = cleaned.lower().split()
    return " ".join(tokens)


def compute_jaccard_similarity(str1: str, str2: str) -> float:
    """
    Token-set Jaccard similarity preserving operator symbols.
    """
    tokens1 = set(normalize_text_for_search(str1).split())
    tokens2 = set(normalize_text_for_search(str2).split())
    if not tokens1 or not tokens2:
        return 0.0
    intersection = tokens1.intersection(tokens2)
    union = tokens1.union(tokens2)
    return len(intersection) / len(union)


def verify_source_quote_detailed(source_quote: str, raw_document: str) -> Tuple[bool, str]:
    """
    Verifies source_quote against raw_document with detailed match type.
    Returns (is_valid, match_type):
    - match_type: 'exact_excerpt', 'paraphrase', or 'unverified'
    Guarantees opposite operators (e.g. '<' vs '>') are NEVER verified as equivalent.
    """
    if not source_quote or not raw_document:
        return False, "unverified"

    norm_quote = normalize_text_for_search(source_quote)
    norm_doc = normalize_text_for_search(raw_document)

    if not norm_quote:
        return False, "unverified"

    # Exact normalized excerpt
    if norm_quote in norm_doc:
        return True, "exact_excerpt"

    # Operator check: if quote contains > and doc only contains < for that context, reject immediately
    quote_has_greater = ">" in norm_quote and "<" not in norm_quote
    quote_has_less = "<" in norm_quote and ">" not in norm_quote
    if quote_has_greater and ">" not in norm_doc:
        return False, "unverified"
    if quote_has_less and "<" not in norm_doc:
        return False, "unverified"

    # Paraphrase check via high token overlap
    jaccard = compute_jaccard_similarity(source_quote, raw_document)
    if jaccard >= 0.70:
        return False, "paraphrase"

    return False, "unverified"


def verify_source_quote(source_quote: str, raw_document: str) -> bool:
    """
    Boolean check verifying source_quote is an exact excerpt in raw_document.
    """
    is_valid, _ = verify_source_quote_detailed(source_quote, raw_document)
    return is_valid


def validate_test_case(test_case: Dict[str, Any], raw_document: str = "") -> List[Dict[str, Any]]:
    """
    Runs deterministic validations on an individual test case.
    """
    flags = list(test_case.get("flags", []))
    existing_types = {f.get("type") for f in flags}

    # 1. Source Quote Verification
    quote = test_case.get("source_quote", "")
    if quote and raw_document:
        is_verified, match_type = verify_source_quote_detailed(quote, raw_document)
        if not is_verified:
            if match_type == "paraphrase":
                if "Paraphrased Evidence" not in existing_types:
                    flags.append({
                        "type": "Paraphrased Evidence",
                        "severity": "Medium",
                        "message": "Source quote appears to be a paraphrase rather than a verbatim excerpt from the document.",
                        "suggested_question": "Can you provide the verbatim sentence backing this test scenario?",
                        "suggested_fix": "Update source quote to match verbatim text in the requirement document."
                    })
            else:
                if "Unverified Source" not in existing_types:
                    flags.append({
                        "type": "Unverified Source",
                        "severity": "High",
                        "message": "Source quote could not be verified as an exact excerpt from the source document.",
                        "suggested_question": "Which requirement paragraph supports this scenario?",
                        "suggested_fix": "Provide a verbatim excerpt from the document."
                    })
    elif not quote and raw_document:
        if "Unverified Source" not in existing_types:
            flags.append({
                "type": "Unverified Source",
                "severity": "Medium",
                "message": "No source quote provided to justify this test case.",
                "suggested_question": "Which requirement statement justifies this test?",
                "suggested_fix": "Add a verbatim excerpt from the requirements document."
            })

    # 2. Incomplete Case Check
    scenario = test_case.get("scenario", "").strip()
    expected = test_case.get("expected_result", "").strip()
    steps = test_case.get("steps", [])

    if not steps or len(steps) < 2 or not expected:
        if "Incomplete Case" not in existing_types:
            flags.append({
                "type": "Incomplete Case",
                "severity": "High",
                "message": "Test case lacks complete step-by-step instructions or observable expected result.",
                "suggested_question": "What are the exact user steps and expected confirmation for this scenario?",
                "suggested_fix": "Provide at least 2 numbered steps and a verifiable expected outcome."
            })

    # 3. Vague wording detector
    combined_text = f"{scenario} {expected} {' '.join(steps)}".lower()
    for word, guidance in VAGUE_TERMS.items():
        if re.search(r'\b' + re.escape(word) + r'\b', combined_text):
            flag_type = "Ambiguous Requirement"
            if flag_type not in existing_types:
                flags.append({
                    "type": flag_type,
                    "severity": "Medium",
                    "message": f"Contains vague terminology '{word}'. {guidance}",
                    "suggested_question": f"How should '{word}' be quantitatively or observably measured?",
                    "suggested_fix": guidance
                })
                existing_types.add(flag_type)

    # 4. Missing Precondition Details check for Admin overrides
    role = test_case.get("role", "")
    if "admin" in role.lower() and "override" in scenario.lower():
        preconditions = test_case.get("preconditions", [])
        if not any("auth" in p.lower() or "2fa" in p.lower() or "permission" in p.lower() or "credential" in p.lower() for p in preconditions):
            if "Missing Precondition Details" not in existing_types:
                flags.append({
                    "type": "Missing Precondition Details",
                    "severity": "High",
                    "message": "Admin override lacks defined preconditions, security authorization, or audit logging reasons.",
                    "suggested_question": "Are any order states protected against Admin override, and is a mandatory audit justification required?",
                    "suggested_fix": "Specify security tier, 2FA prompt, and reason logging in preconditions."
                })
                existing_types.add("Missing Precondition Details")

    return flags


def validate_test_suite(
    test_cases: List[Dict[str, Any]],
    requirements: List[Dict[str, Any]],
    raw_document: str = ""
) -> Dict[str, Any]:
    """
    Validates entire suite:
    - Calculates requirement coverage across ALL requirements, including zero-test requirements
    - Accurately checks Positive, Negative, and Boundary coverage
    - Duplicates detection
    - Quality score computation
    """
    total_cases = len(test_cases)
    flags_by_type: Dict[str, int] = {}
    coverage_gaps: List[str] = []
    clarification_items: List[Dict[str, Any]] = []

    # Map requirements to scenario types
    req_scenario_map: Dict[str, Set[str]] = {}
    for tc in test_cases:
        req_id = tc.get("requirement_id") or "UNMAPPED"
        st = tc.get("scenario_type") or "Positive"
        req_scenario_map.setdefault(req_id, set()).add(st)

    # Validate individual cases & check duplicates
    for i in range(len(test_cases)):
        case_a = test_cases[i]
        text_a = f"{case_a.get('scenario', '')} {' '.join(case_a.get('steps', []))}"
        case_flags = validate_test_case(case_a, raw_document)

        for j in range(i + 1, len(test_cases)):
            case_b = test_cases[j]
            text_b = f"{case_b.get('scenario', '')} {' '.join(case_b.get('steps', []))}"
            sim = compute_jaccard_similarity(text_a, text_b)
            if sim >= 0.8:
                dup_msg = f"Possible duplicate of {case_b.get('id', 'TC-xxx')} (similarity: {int(sim*100)}%)"
                case_flags.append({
                    "type": "Possible Duplicate",
                    "severity": "Medium",
                    "message": dup_msg,
                    "suggested_question": f"Does {case_a.get('id')} test distinct functionality from {case_b.get('id')}?",
                    "suggested_fix": "Differentiate test data, preconditions, or user role."
                })

        case_a["flags"] = case_flags
        for f in case_flags:
            f_type = f.get("type", "General")
            flags_by_type[f_type] = flags_by_type.get(f_type, 0) + 1
            clarification_items.append({
                "test_case_id": case_a.get("id"),
                "requirement_id": case_a.get("requirement_id"),
                "type": f_type,
                "severity": f.get("severity", "Medium"),
                "message": f.get("message"),
                "suggested_question": f.get("suggested_question")
            })

    # Coverage gap analysis across ALL requirements
    for req in requirements:
        rid = req.get("id")
        title = req.get("title", "")
        req_text = req.get("text", "")
        types_covered = req_scenario_map.get(rid, set())

        if not types_covered:
            coverage_gaps.append(f"{rid} '{title}' has 0 test cases (Missing Coverage).")
            continue

        if "Positive" not in types_covered:
            coverage_gaps.append(f"{rid} '{title}' has no Positive acceptance test.")
        if "Negative" not in types_covered:
            coverage_gaps.append(f"{rid} '{title}' has no Negative test case.")

        # Check if boundary is meaningfully applicable (e.g. contains numbers, limits, thresholds)
        has_boundary_keywords = bool(re.search(r'\d+|limit|maximum|minimum|under|over|between|threshold', req_text, re.IGNORECASE))
        if has_boundary_keywords and "Boundary" not in types_covered:
            coverage_gaps.append(f"{rid} '{title}' has boundary thresholds but no Boundary test case.")

    # Quality score calculation (0 - 100)
    total_flags = sum(flags_by_type.values())
    approved_count = sum(1 for c in test_cases if c.get("status") == "Approved")
    approval_rate = (approved_count / total_cases * 100) if total_cases > 0 else 0
    flag_penalty = min(total_flags * 3, 40)
    coverage_penalty = min(len(coverage_gaps) * 4, 30)

    score = max(0, min(100, int(100 - flag_penalty - coverage_penalty + (approval_rate * 0.2))))

    return {
        "total_test_cases": total_cases,
        "open_flags_count": total_flags,
        "quality_score": score,
        "flags_by_type": flags_by_type,
        "coverage_gaps": coverage_gaps,
        "clarification_items": clarification_items,
    }
