import pytest
from backend.app.validation.engine import (
    compute_jaccard_similarity,
    normalize_text_for_search,
    verify_source_quote,
    validate_test_case,
    validate_test_suite
)


def test_normalize_text():
    text = "  Hello, World! This is a TEST...  "
    norm = normalize_text_for_search(text)
    assert norm == "hello world this is a test"


def test_jaccard_similarity():
    s1 = "Add valid item to cart and checkout"
    s2 = "Add valid item to cart and complete checkout"
    sim = compute_jaccard_similarity(s1, s2)
    assert sim > 0.7

    s3 = "Completely different text with no overlap"
    sim2 = compute_jaccard_similarity(s1, s3)
    assert sim2 < 0.1


def test_verify_source_quote():
    raw_doc = "Cart holds between 1 and 10 units per distinct item. A cart may contain a maximum of 20 distinct items."
    quote = "Cart holds between 1 and 10 units"
    assert verify_source_quote(quote, raw_doc) is True

    fake_quote = "This statement does not exist in the document"
    assert verify_source_quote(fake_quote, raw_doc) is False


def test_vague_word_detection():
    tc = {
        "id": "TC-001",
        "scenario": "Fast response time test",
        "expected_result": "The system should respond quickly and works correctly.",
        "steps": ["Step 1", "Step 2"],
        "source_quote": "Some quote"
    }
    flags = validate_test_case(tc, raw_document="Some quote")
    flag_types = [f["type"] for f in flags]
    assert "Ambiguous Requirement" in flag_types


def test_admin_override_precondition_flag():
    tc = {
        "id": "TC-002",
        "role": "Admin",
        "scenario": "Admin can override an order status",
        "expected_result": "Order status is updated directly",
        "steps": ["Step 1", "Step 2"],
        "preconditions": ["Admin is logged in"],
        "source_quote": "Admin can override an order status."
    }
    flags = validate_test_case(tc, raw_document="Admin can override an order status.")
    flag_types = [f["type"] for f in flags]
    assert "Missing Precondition Details" in flag_types


def test_missing_steps_or_expected_result():
    tc = {
        "id": "TC-003",
        "scenario": "Incomplete test case",
        "expected_result": "",
        "steps": [],
        "source_quote": ""
    }
    flags = validate_test_case(tc, raw_document="Some document text")
    flag_types = [f["type"] for f in flags]
    assert "Unverified Source" in flag_types or "Incomplete Definition" in flag_types or len(flags) > 0

