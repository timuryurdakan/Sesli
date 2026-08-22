import numpy as np
import soundfile as sf

from app.services.tempo_key import detect_bpm, detect_key


def _write_wav(path, signal: np.ndarray, sr: int) -> None:
    sf.write(str(path), signal.astype(np.float32), sr)


def test_detect_key_identifies_c_major(tmp_path) -> None:
    sr = 22050
    t = np.linspace(0, 3.0, int(sr * 3.0), endpoint=False)
    tones = np.array([np.sin(2 * np.pi * f * t) for f in (261.63, 329.63, 392.00)])
    _write_wav(tmp_path / "c-major.wav", tones.mean(axis=0), sr)

    assert detect_key(tmp_path / "c-major.wav") == "C major"


def test_detect_key_identifies_a_minor(tmp_path) -> None:
    sr = 22050
    t = np.linspace(0, 3.0, int(sr * 3.0), endpoint=False)
    tones = np.array([np.sin(2 * np.pi * f * t) for f in (220.00, 261.63, 329.63)])
    _write_wav(tmp_path / "a-minor.wav", tones.mean(axis=0), sr)

    assert detect_key(tmp_path / "a-minor.wav") == "A minor"


def test_detect_bpm_close_to_click_track_rate(tmp_path) -> None:
    sr = 22050
    duration = 10.0
    interval = 0.5  # 120 BPM
    t = np.arange(0, duration, 1 / sr)
    signal = np.zeros_like(t)

    click_times = np.arange(0, duration, interval)
    click_len = int(0.02 * sr)
    click = np.sin(2 * np.pi * 1000 * np.arange(click_len) / sr)

    for click_time in click_times:
        start = int(click_time * sr)
        end = min(start + click_len, len(signal))
        signal[start:end] += click[: end - start]

    _write_wav(tmp_path / "click.wav", signal, sr)

    bpm = detect_bpm(tmp_path / "click.wav")
    assert abs(bpm - 120) < 15
