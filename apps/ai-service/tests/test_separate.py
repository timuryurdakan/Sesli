from unittest.mock import AsyncMock

from conftest import TEST_INTERNAL_KEY
from fastapi.testclient import TestClient

from app.main import app
from app.routers import separate as separate_router
from app.services.separation import UnsupportedAudioError

client = TestClient(app, headers={"X-Internal-Service-Key": TEST_INTERNAL_KEY})


def test_separate_success(monkeypatch) -> None:
    mock = AsyncMock(return_value={"vocals": "stems/job-1/vocals.wav"})
    monkeypatch.setattr(separate_router, "separate_track", mock)

    response = client.post("/separate", json={"jobId": "job-1", "storagePath": "raw/u1/t1.wav"})

    assert response.status_code == 200
    assert response.json() == {"stems": {"vocals": "stems/job-1/vocals.wav"}}
    mock.assert_awaited_once_with("job-1", "raw/u1/t1.wav")


def test_separate_unsupported_audio_returns_422(monkeypatch) -> None:
    mock = AsyncMock(side_effect=UnsupportedAudioError("bad header"))
    monkeypatch.setattr(separate_router, "separate_track", mock)

    response = client.post("/separate", json={"jobId": "job-1", "storagePath": "raw/u1/t1.wav"})

    assert response.status_code == 422
    assert "bad header" in response.json()["detail"]


def test_separate_missing_config_returns_500(monkeypatch) -> None:
    mock = AsyncMock(
        side_effect=RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY is not configured")
    )
    monkeypatch.setattr(separate_router, "separate_track", mock)

    response = client.post("/separate", json={"jobId": "job-1", "storagePath": "raw/u1/t1.wav"})

    assert response.status_code == 500


def test_separate_unexpected_error_returns_500(monkeypatch) -> None:
    mock = AsyncMock(side_effect=Exception("boom"))
    monkeypatch.setattr(separate_router, "separate_track", mock)

    response = client.post("/separate", json={"jobId": "job-1", "storagePath": "raw/u1/t1.wav"})

    assert response.status_code == 500
