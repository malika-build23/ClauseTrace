from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_public_health() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_secure_health_rejects_missing_token(monkeypatch) -> None:
    monkeypatch.setenv("AI_SERVICE_TOKEN", "test-token")
    assert client.get("/health/secure").status_code == 401


def test_secure_health_rejects_wrong_token(monkeypatch) -> None:
    monkeypatch.setenv("AI_SERVICE_TOKEN", "test-token")
    res = client.get("/health/secure", headers={"X-Service-Token": "wrong"})
    assert res.status_code == 401


def test_secure_health_accepts_token(monkeypatch) -> None:
    monkeypatch.setenv("AI_SERVICE_TOKEN", "test-token")
    res = client.get("/health/secure", headers={"X-Service-Token": "test-token"})
    assert res.status_code == 200
    assert res.json()["auth"] == "accepted"


def test_secure_health_fails_closed_without_config(monkeypatch) -> None:
    monkeypatch.delenv("AI_SERVICE_TOKEN", raising=False)
    res = client.get("/health/secure", headers={"X-Service-Token": "anything"})
    assert res.status_code == 503
