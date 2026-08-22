import numpy as np
import soundfile as sf

from app.services.chord_detection import (
    _LABELS,
    _TEMPLATES,
    _viterbi_smooth,
    detect_chords,
)


def test_templates_cover_all_24_major_minor_chords() -> None:
    assert _TEMPLATES.shape == (24, 12)
    roots = "C C# D D# E F F# G G# A A# B".split()
    expected = [f"{root}{suffix}" for root in roots for suffix in ("", "m")]
    assert sorted(_LABELS) == sorted(expected)


def test_viterbi_smooths_a_single_outlier_frame() -> None:
    # 10 kare boyunca net şekilde "C" (indeks 0), ama 5. karede gürültülü bir
    # aykırı değer var. Yüksek self-transition olasılığı bunu bastırmalı.
    n_frames, n_chords = 10, 24
    probs = np.full((n_frames, n_chords), 0.01 / (n_chords - 1))
    probs[:, 0] = 0.99
    probs[5] = np.full(n_chords, 0.01 / (n_chords - 1))
    probs[5, 7] = 0.99  # aykırı kare: "G" gibi görünüyor

    path = _viterbi_smooth(probs)

    assert (path == 0).all()  # tüm dizi boyunca "C" olarak kalmalı


def _write_chord_wav(path, frequencies: list[float], duration: float, sr: int = 22050) -> None:
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    tones = np.array([np.sin(2 * np.pi * f * t) for f in frequencies])
    signal = tones.mean(axis=0)
    sf.write(str(path), signal.astype(np.float32), sr)


def test_detect_chords_identifies_c_major(tmp_path) -> None:
    wav_path = tmp_path / "c-major.wav"
    _write_chord_wav(wav_path, [261.63, 329.63, 392.00], duration=3.0)

    segments = detect_chords(wav_path)

    assert len(segments) == 1
    assert segments[0]["chord"] == "C"
    assert segments[0]["start"] == 0.0
    assert segments[0]["end"] > 2.5


def test_detect_chords_identifies_a_minor(tmp_path) -> None:
    wav_path = tmp_path / "a-minor.wav"
    _write_chord_wav(wav_path, [220.00, 261.63, 329.63], duration=3.0)

    segments = detect_chords(wav_path)

    assert len(segments) == 1
    assert segments[0]["chord"] == "Am"


def test_detect_chords_segments_a_chord_change(tmp_path) -> None:
    wav_path = tmp_path / "c-then-g.wav"
    sr = 22050
    _write_chord_wav(tmp_path / "_c.wav", [261.63, 329.63, 392.00], duration=2.5, sr=sr)
    _write_chord_wav(tmp_path / "_g.wav", [196.00, 246.94, 293.66], duration=2.5, sr=sr)

    c_audio, _ = sf.read(str(tmp_path / "_c.wav"))
    g_audio, _ = sf.read(str(tmp_path / "_g.wav"))
    sf.write(str(wav_path), np.concatenate([c_audio, g_audio]).astype(np.float32), sr)

    segments = detect_chords(wav_path)

    chords = [s["chord"] for s in segments]
    assert chords == ["C", "G"]
