"""Tempo (BPM) ve ton (key) tespiti — Bölüm 7 Ajan 6."""

import librosa
import numpy as np

SAMPLE_RATE = 22050

# Krumhansl & Kessler (1982) ton profilleri — majör/minör tonun her bir
# kroma pitch-class'ına (I, bII, II, ...) göre ampirik "uyum" ağırlıkları.
# Klasik, yaygın atıfta bulunulan Krumhansl-Schmuckler anahtar tespiti
# algoritmasının temelidir.
_MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def detect_bpm(audio_path) -> float:
    y, sr = librosa.load(str(audio_path), sr=SAMPLE_RATE, mono=True)
    tempo, _beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    return float(np.atleast_1d(tempo)[0])


def detect_key(audio_path) -> str:
    """
    Krumhansl-Schmuckler: şarkının ortalama kroma vektörünü 24 (12 kök x
    majör/minör) ton profiliyle korelasyona sokar, en yüksek korelasyonlu
    tonu döndürür (ör. "A minor", "C major").
    """
    y, sr = librosa.load(str(audio_path), sr=SAMPLE_RATE, mono=True)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    mean_chroma = chroma.mean(axis=1)

    best_score = -np.inf
    best_label = "C major"

    for root in range(12):
        major_profile = np.roll(_MAJOR_PROFILE, root)
        minor_profile = np.roll(_MINOR_PROFILE, root)

        major_score = np.corrcoef(mean_chroma, major_profile)[0, 1]
        minor_score = np.corrcoef(mean_chroma, minor_profile)[0, 1]

        if major_score > best_score:
            best_score = major_score
            best_label = f"{PITCH_CLASSES[root]} major"
        if minor_score > best_score:
            best_score = minor_score
            best_label = f"{PITCH_CLASSES[root]} minor"

    return best_label
