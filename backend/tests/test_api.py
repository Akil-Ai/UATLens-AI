import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "service" in data


def test_sample():
    res = client.get("/api/sample")
    assert res.status_code == 200
    data = res.json()
    assert "content" in data
    assert "holds between 1 and 10 units" in data["content"]
    assert data["word_count"] > 100


def test_project_crud():
    # Create
    create_res = client.post("/api/projects", json={"name": "E-Commerce Checkout UAT", "raw_text": "Sample text"})
    assert create_res.status_code == 200
    p_data = create_res.json()
    p_id = p_data["id"]
    assert p_data["name"] == "E-Commerce Checkout UAT"

    # Get
    get_res = client.get(f"/api/projects/{p_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == p_id

    # List
    list_res = client.get("/api/projects")
    assert list_res.status_code == 200
    assert any(p["id"] == p_id for p in list_res.json())

    # Delete
    del_res = client.delete(f"/api/projects/{p_id}")
    assert del_res.status_code == 200


def test_context_extraction():
    create_res = client.post("/api/projects", json={"name": "Context Test", "raw_text": "Guest checkout under $500."})
    p_id = create_res.json()["id"]

    extract_res = client.post("/api/extract-context", json={"project_id": p_id, "text": "Guest checkout under $500."})
    assert extract_res.status_code == 200
    data = extract_res.json()
    assert len(data["roles"]) >= 1
    assert len(data["business_rules"]) >= 1
    assert len(data["requirements"]) >= 1

# Commit ref: 93
