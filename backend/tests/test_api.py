import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.auth import get_current_user, AuthUser

client = TestClient(app)

user_a = AuthUser(
    id="user-aaa-111",
    email="alice@company.com",
    role="QA Lead",
    name="Alice"
)

user_b = AuthUser(
    id="user-bbb-222",
    email="bob@company.com",
    role="Reviewer",
    name="Bob"
)


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


def test_unauthenticated_requests_rejected():
    app.dependency_overrides.clear()
    res = client.get("/api/projects")
    assert res.status_code == 401
    assert "detail" in res.json()

    res = client.post("/api/projects", json={"name": "Secret Project"})
    assert res.status_code == 401


def test_authenticated_project_crud():
    app.dependency_overrides[get_current_user] = lambda: user_a

    # Create
    create_res = client.post("/api/projects", json={"name": "E-Commerce Checkout UAT", "raw_text": "Sample text"})
    assert create_res.status_code == 200
    p_data = create_res.json()
    p_id = p_data["id"]
    assert p_data["name"] == "E-Commerce Checkout UAT"
    assert p_data["owner_id"] == user_a.id

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

    app.dependency_overrides.clear()


def test_cross_user_isolation():
    # User A creates project
    app.dependency_overrides[get_current_user] = lambda: user_a
    create_res = client.post("/api/projects", json={"name": "Alice Private Project", "raw_text": "Private requirements"})
    assert create_res.status_code == 200
    project_id = create_res.json()["id"]

    # User B attempts to access User A's project -> MUST be 403 Forbidden
    app.dependency_overrides[get_current_user] = lambda: user_b
    get_res = client.get(f"/api/projects/{project_id}")
    assert get_res.status_code == 403

    # User B attempts to delete User A's project -> MUST be 403 Forbidden
    del_res = client.delete(f"/api/projects/{project_id}")
    assert del_res.status_code == 403

    # Clean up with User A
    app.dependency_overrides[get_current_user] = lambda: user_a
    client.delete(f"/api/projects/{project_id}")
    app.dependency_overrides.clear()


def test_context_extraction():
    app.dependency_overrides[get_current_user] = lambda: user_a
    create_res = client.post("/api/projects", json={"name": "Context Test", "raw_text": "Guest checkout under $500."})
    assert create_res.status_code == 200
    p_id = create_res.json()["id"]

    extract_res = client.post("/api/extract-context", json={"project_id": p_id, "text": "Guest checkout under $500."})
    assert extract_res.status_code == 200
    data = extract_res.json()
    assert len(data["roles"]) >= 1
    assert len(data["business_rules"]) >= 1
    assert len(data["requirements"]) >= 1

    client.delete(f"/api/projects/{p_id}")
    app.dependency_overrides.clear()
