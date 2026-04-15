"""Smoke tests — /health cần cài đủ requirements (pgvector, …)."""
import pytest
from fastapi.testclient import TestClient


def test_settings_loads():
    """Luôn chạy được nếu pydantic-settings OK (không cần DB)."""
    from app.config import get_settings

    s = get_settings()
    assert s.APP_NAME
    assert isinstance(s.CORS_ORIGINS, list)


def test_health_ok():
    """Cần `pip install -r requirements.txt` đầy đủ; nếu thiếu gói → skip."""
    try:
        from app.main import app
    except ImportError as e:
        pytest.skip(f"Chưa cài đủ dependency để import app: {e}")

    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"
    assert "service" in data
