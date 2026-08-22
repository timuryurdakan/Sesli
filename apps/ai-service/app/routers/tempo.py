import logging
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from app.services.soundstretch import SoundStretchError, transform_audio
from app.services.supabase_client import download_from_storage, get_supabase
from app.services.tempo_key import detect_bpm, detect_key

logger = logging.getLogger(__name__)

router = APIRouter()


class TempoRequest(BaseModel):
    storagePath: str


class TempoResponse(BaseModel):
    bpm: float
    key: str


@router.post("/tempo", response_model=TempoResponse)
async def tempo(request: TempoRequest) -> TempoResponse:
    """Bölüm 7 Ajan 6: bir parçanın BPM'ini ve tonunu tespit eder (batch
    analiz — `jobs.output`'a `bpm`/`key` olarak yazılır)."""
    supabase = get_supabase()

    try:
        with tempfile.TemporaryDirectory(prefix="tempo-") as tmp_dir:
            input_path = Path(tmp_dir) / "input.wav"
            raw_bytes = download_from_storage(supabase, request.storagePath)
            input_path.write_bytes(raw_bytes)
            bpm = detect_bpm(input_path)
            key = detect_key(input_path)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Tempo/key detection failed for %s", request.storagePath)
        raise HTTPException(status_code=500, detail="Tempo/key detection failed") from exc

    return TempoResponse(bpm=bpm, key=key)


class TransformRequest(BaseModel):
    storagePath: str
    tempoPercent: float = 0.0
    semitones: float = 0.0


@router.post("/transform")
async def transform(request: TransformRequest) -> Response:
    """
    Özellik 3 (tempo) ve Özellik 4 (ton değiştirme): oynatıcının anlık
    isteği üzerine bir parçayı (veya stem'i) kalite kaybı olmadan
    hızlandırır/yavaşlatır ve/veya transpoze eder. `jobs` tablosuna
    yazmaz — durumsuz, isteğe bağlı bir dönüşüm uç noktasıdır; NestJS API
    üzerinden oynatıcı (Ajan 7) tarafından çağrılması beklenir.
    """
    supabase = get_supabase()

    try:
        with tempfile.TemporaryDirectory(prefix="transform-") as tmp_dir:
            input_path = Path(tmp_dir) / "input.wav"
            output_path = Path(tmp_dir) / "output.wav"

            raw_bytes = download_from_storage(supabase, request.storagePath)
            input_path.write_bytes(raw_bytes)

            transform_audio(
                input_path,
                output_path,
                tempo_percent=request.tempoPercent,
                semitones=request.semitones,
            )

            data = output_path.read_bytes()
    except SoundStretchError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Audio transform failed for %s", request.storagePath)
        raise HTTPException(status_code=500, detail="Audio transform failed") from exc

    return Response(content=data, media_type="audio/wav")
