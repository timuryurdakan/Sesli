import asyncio
import logging
import os
import tempfile
from functools import lru_cache
from pathlib import Path

from demucs.api import Separator, save_audio

from .supabase_client import download_from_storage, get_supabase, upload_to_storage

logger = logging.getLogger(__name__)

MODEL_NAME = "htdemucs_6s"


class UnsupportedAudioError(Exception):
    """Girdi dosyası bozuk veya demucs/torchaudio tarafından okunamıyor."""


@lru_cache(maxsize=1)
def _get_separator() -> Separator:
    # Model ağırlıkları ilk çağrıda otomatik indirilir (torch-hub tarzı,
    # ~birkaç yüz MB — bkz. stage-04 handoff). Süreç içinde tek bir instance
    # olarak yeniden kullanılır; eşzamanlılık _get_semaphore() ile sınırlanır.
    return Separator(model=MODEL_NAME, device="cpu", progress=False)


@lru_cache(maxsize=1)
def _get_semaphore() -> asyncio.Semaphore:
    max_concurrent = int(os.environ.get("MAX_CONCURRENT_JOBS", "1"))
    return asyncio.Semaphore(max_concurrent)


def _run_separation_sync(input_path: Path) -> dict[str, Path]:
    """CPU-bound, bloklayan demucs çağrısı — bir thread'de çalıştırılmalı."""
    separator = _get_separator()

    try:
        _original, stems = separator.separate_audio_file(input_path)
    except Exception as exc:  # demucs/torchaudio ses dosyasını okuyamazsa
        raise UnsupportedAudioError(str(exc)) from exc

    output_dir = Path(tempfile.mkdtemp(prefix="stems-"))
    stem_paths: dict[str, Path] = {}

    for name, wav in stems.items():
        stem_path = output_dir / f"{name}.wav"
        save_audio(wav, stem_path, samplerate=separator.samplerate)
        stem_paths[name] = stem_path

    return stem_paths


async def separate_track(job_id: str, storage_path: str) -> dict[str, str]:
    """
    Bir parçayı Supabase Storage'dan indirir, Demucs (htdemucs_6s) ile
    vokal/davul/bas/gitar/piyano/diğer olmak üzere 6 kanala ayırır, sonuçları
    tekrar Storage'a yükler ve stem storage path'lerini döndürür.

    Bölüm 7 Ajan 4 DoD'si: "Kaynak yönetimi: aynı anda işlenebilecek maksimum
    iş sayısını sınırla" — `MAX_CONCURRENT_JOBS` ile gated bir semaphore
    kullanılır.
    """
    supabase = get_supabase()

    async with _get_semaphore():
        with tempfile.TemporaryDirectory(prefix="raw-") as tmp_dir:
            input_path = Path(tmp_dir) / "input.wav"

            raw_bytes = await asyncio.to_thread(download_from_storage, supabase, storage_path)
            input_path.write_bytes(raw_bytes)

            stem_paths = await asyncio.to_thread(_run_separation_sync, input_path)
            output_dir = next(iter(stem_paths.values())).parent

            try:
                result: dict[str, str] = {}
                for name, path in stem_paths.items():
                    dest = f"stems/{job_id}/{name}.wav"
                    data = path.read_bytes()
                    await asyncio.to_thread(upload_to_storage, supabase, dest, data)
                    result[name] = dest
                return result
            finally:
                for path in stem_paths.values():
                    path.unlink(missing_ok=True)
                output_dir.rmdir()
