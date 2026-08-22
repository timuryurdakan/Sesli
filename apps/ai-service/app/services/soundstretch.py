"""
SoundTouch (LGPL v2.1) entegrasyonu — Bölüm 4/9.2.

Bakımı yapılan bir Python binding'i yok (araştırıldı — bkz.
docs/handoffs/stage-06.md), bu yüzden resmi `soundstretch` CLI aracı
subprocess ile çağrılıyor (ffmpeg'i `FfmpegService`'te çağırma deseniyle
aynı). Binary bundle edilmez; `SOUNDSTRETCH_PATH` env değişkeniyle verilir.
"""

import os
import subprocess
from pathlib import Path


class SoundStretchError(Exception):
    pass


def _get_binary_path() -> str:
    return os.environ.get("SOUNDSTRETCH_PATH", "soundstretch")


def transform_audio(
    input_path: Path,
    output_path: Path,
    *,
    tempo_percent: float = 0.0,
    semitones: float = 0.0,
) -> None:
    """
    Bir ses dosyasının tempo (%) ve/veya perdesini (yarım ses) kalite
    kaybı olmadan değiştirir (Özellik 3 ve 4). `tempo_percent=-20` ->
    %20 daha yavaş; `semitones=-3` -> 3 yarım ses aşağı transpoze.
    """
    binary = _get_binary_path()
    args = [binary, str(input_path), str(output_path)]

    if tempo_percent:
        args.append(f"-tempo={tempo_percent}")
    if semitones:
        args.append(f"-pitch={semitones}")

    result = subprocess.run(args, capture_output=True, text=True)

    if result.returncode != 0:
        raise SoundStretchError(
            f"soundstretch failed (exit {result.returncode}): {result.stderr or result.stdout}"
        )
