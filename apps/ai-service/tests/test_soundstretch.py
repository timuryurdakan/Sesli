from unittest.mock import patch

import pytest

from app.services.soundstretch import SoundStretchError, transform_audio


def test_transform_audio_builds_correct_command(tmp_path) -> None:
    with patch("app.services.soundstretch.subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        transform_audio(tmp_path / "in.wav", tmp_path / "out.wav", tempo_percent=-20, semitones=3)

    args = mock_run.call_args.args[0]
    assert args[0] == "soundstretch"
    assert str(tmp_path / "in.wav") in args
    assert str(tmp_path / "out.wav") in args
    assert "-tempo=-20" in args
    assert "-pitch=3" in args


def test_transform_audio_omits_flags_when_zero(tmp_path) -> None:
    with patch("app.services.soundstretch.subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        transform_audio(tmp_path / "in.wav", tmp_path / "out.wav")

    args = mock_run.call_args.args[0]
    assert not any(a.startswith("-tempo=") for a in args)
    assert not any(a.startswith("-pitch=") for a in args)


def test_transform_audio_raises_on_nonzero_exit(tmp_path) -> None:
    with patch("app.services.soundstretch.subprocess.run") as mock_run:
        mock_run.return_value.returncode = 1
        mock_run.return_value.stderr = "corrupt file"
        mock_run.return_value.stdout = ""

        with pytest.raises(SoundStretchError, match="corrupt file"):
            transform_audio(tmp_path / "in.wav", tmp_path / "out.wav", tempo_percent=10)
