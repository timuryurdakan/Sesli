"""
Akıllı Akor Tespiti (Bölüm 7 Ajan 5).

Açık kaynak, ücretsiz-uyumlu (MIT/ISC) bir akor tanıma kütüphanesi
bulunmadığı için (bkz. docs/handoffs/stage-05.md — madmom modelleri
CC BY-NC-SA, essentia AGPL, autochord GPL VAMP eklentisine bağımlı),
klasik Fujishima (1999) chroma template-matching + Sheh & Ellis (2003)
tarzı HMM/Viterbi düzeltmesi kendi kod tabanımızda uygulanıyor —
yalnızca librosa (MIT) ve numpy üzerine kurulu, hiçbir GPL/AGPL/NC
bağımlılığı yok.
"""

import librosa
import numpy as np

SAMPLE_RATE = 22050
HOP_LENGTH = 4096  # ~185ms/kare çözünürlük — akor segmentasyonu için yeterli

PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

_MAJOR_TEMPLATE = np.array([1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0], dtype=float)
_MINOR_TEMPLATE = np.array([1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0], dtype=float)

# Sheh & Ellis (2003) tarzı basit geçiş modeli: akorun bir sonraki karede de
# aynı kalma olasılığı yüksek, değişme olasılığı diğer 23 akora eşit dağılır.
SELF_TRANSITION_PROB = 0.95


def _build_templates() -> tuple[np.ndarray, list[str]]:
    """24 akor şablonunu (12 majör + 12 minör) döndürür, L2-normalize edilmiş."""
    templates = []
    labels = []

    for root in range(12):
        major = np.roll(_MAJOR_TEMPLATE, root)
        minor = np.roll(_MINOR_TEMPLATE, root)
        templates.append(major)
        labels.append(PITCH_CLASSES[root])
        templates.append(minor)
        labels.append(f"{PITCH_CLASSES[root]}m")

    matrix = np.stack(templates)
    matrix /= np.linalg.norm(matrix, axis=1, keepdims=True)
    return matrix, labels


_TEMPLATES, _LABELS = _build_templates()
_NUM_CHORDS = len(_LABELS)


def _viterbi_smooth(emission_probs: np.ndarray) -> np.ndarray:
    """
    emission_probs: (n_frames, n_chords), her satır o karedeki 24 akordan
    her birinin olabilirliği (toplamı 1'e normalize edilmiş).
    Döndürür: (n_frames,) en olası akor indeksi dizisi (log-Viterbi).
    """
    n_frames, n_chords = emission_probs.shape
    log_emission = np.log(emission_probs + 1e-12)

    other_prob = (1 - SELF_TRANSITION_PROB) / (n_chords - 1)
    log_trans_self = np.log(SELF_TRANSITION_PROB)
    log_trans_other = np.log(other_prob)

    log_delta = np.full((n_frames, n_chords), -np.inf)
    backpointer = np.zeros((n_frames, n_chords), dtype=int)

    log_delta[0] = np.log(1.0 / n_chords) + log_emission[0]

    for t in range(1, n_frames):
        # (n_chords_prev, n_chords_curr) skor matrisi: self-transition veya diğer
        prev = log_delta[t - 1][:, None]
        trans = np.full((n_chords, n_chords), log_trans_other)
        np.fill_diagonal(trans, log_trans_self)
        scores = prev + trans
        backpointer[t] = np.argmax(scores, axis=0)
        log_delta[t] = np.max(scores, axis=0) + log_emission[t]

    path = np.zeros(n_frames, dtype=int)
    path[-1] = int(np.argmax(log_delta[-1]))
    for t in range(n_frames - 2, -1, -1):
        path[t] = backpointer[t + 1, path[t + 1]]

    return path


def detect_chords(audio_path) -> list[dict]:
    """
    Bir ses dosyasındaki akorları zaman damgalı olarak tespit eder.
    Döndürür: [{"start": 0.0, "end": 1.8, "chord": "Am"}, ...]
    (bkz. Bölüm 11 — Örnek İş API Sözleşmesi).
    """
    y, sr = librosa.load(str(audio_path), sr=SAMPLE_RATE, mono=True)

    # Perküsyonun (davul vb.) akor tespitini bozmasını azaltmak için harmonik
    # bileşeni ayıklıyoruz (Demucs stem'lerine bağımlı olmadan, Ajan 4 ile
    # paralel çalışabilmesi için).
    harmonic, _percussive = librosa.effects.hpss(y)

    chroma = librosa.feature.chroma_cqt(y=harmonic, sr=sr, hop_length=HOP_LENGTH)
    chroma = chroma.T  # (n_frames, 12)

    norms = np.linalg.norm(chroma, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    chroma_normalized = chroma / norms

    similarity = chroma_normalized @ _TEMPLATES.T  # (n_frames, 24), kosinüs benzerliği
    similarity = np.clip(similarity, 0, None)
    row_sums = similarity.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1.0
    emission_probs = similarity / row_sums

    chord_indices = _viterbi_smooth(emission_probs)

    frame_duration = HOP_LENGTH / sr
    segments: list[dict] = []

    for i, chord_idx in enumerate(chord_indices):
        start = i * frame_duration
        end = start + frame_duration
        label = _LABELS[chord_idx]

        if segments and segments[-1]["chord"] == label:
            segments[-1]["end"] = end
        else:
            segments.append({"start": start, "end": end, "chord": label})

    return segments
