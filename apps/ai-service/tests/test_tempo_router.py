from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.soundstretch import SoundStretchError

client = TestClient(app)


def test_tempo_endpoint_returns_bpm_and_key() -> None:
    with (
        patch("app.routers.tempo.get_supabase", return_value=MagicMock()),
        patch("app.routers.tempo.download_from_storage", return_value=b"fake-audio-bytes"),
        patch("app.routers.tempo.detect_bpm", return_value=120.5),
        patch("app.routers.tempo.detect_key", return_value="A minor"),
    ):
        response = client.post("/tempo", json={"storagePath": "raw/u1/t1.wav"})

    assert response.status_code == 200
    assert response.json() == {"bpm": 120.5, "key": "A minor"}


def test_tempo_endpoint_returns_500_on_unexpected_error() -> None:
    with (
        patch("app.routers.tempo.get_supabase", return_value=MagicMock()),
        patch("app.routers.tempo.download_from_storage", side_effect=Exception("boom")),
    ):
        response = client.post("/tempo", json={"storagePath": "raw/u1/t1.wav"})

    assert response.status_code == 500


def test_transform_endpoint_returns_audio_bytes() -> None:
    def fake_transform(input_path, output_path, **kwargs):
        output_path.write_bytes(b"transformed-audio")

    with (
        patch("app.routers.tempo.get_supabase", return_value=MagicMock()),
        patch("app.routers.tempo.download_from_storage", return_value=b"fake-audio-bytes"),
        patch("app.routers.tempo.transform_audio", side_effect=fake_transform),
    ):
        response = client.post(
            "/transform",
            json={"storagePath": "raw/u1/t1.wav", "tempoPercent": -10, "semitones": 2},
        )

    assert response.status_code == 200
    assert response.content == b"transformed-audio"
    assert response.headers["content-type"] == "audio/wav"


def test_transform_endpoint_returns_500_on_soundstretch_error() -> None:
    with (
        patch("app.routers.tempo.get_supabase", return_value=MagicMock()),
        patch("app.routers.tempo.download_from_storage", return_value=b"fake-audio-bytes"),
        patch("app.routers.tempo.transform_audio", side_effect=SoundStretchError("bad exit code")),
    ):
        response = client.post("/transform", json={"storagePath": "raw/u1/t1.wav"})

    assert response.status_code == 500
    assert "bad exit code" in response.json()["detail"]
