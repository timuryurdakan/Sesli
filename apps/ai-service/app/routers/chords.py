import logging
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.chord_detection import detect_chords
from app.services.supabase_client import download_from_storage, get_supabase

logger = logging.getLogger(__name__)

router = APIRouter()


class ChordSegment(BaseModel):
    start: float
    end: float
    chord: str


class ChordsRequest(BaseModel):
    storagePath: str


class ChordsResponse(BaseModel):
    chords: list[ChordSegment]


@router.post("/chords", response_model=ChordsResponse)
async def chords(request: ChordsRequest) -> ChordsResponse:
    """
    Bölüm 7 Ajan 5: bir parçanın zaman damgalı akor dizisini döndürür.
    Stem ayırmadan bağımsız çalışır (ham/normalize edilmiş sesi kullanır),
    bu yüzden Ajan 4 ile paralel yürütülebilir.
    """
    supabase = get_supabase()

    try:
        with tempfile.TemporaryDirectory(prefix="chords-") as tmp_dir:
            input_path = Path(tmp_dir) / "input.wav"
            raw_bytes = download_from_storage(supabase, request.storagePath)
            input_path.write_bytes(raw_bytes)
            segments = detect_chords(input_path)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Chord detection failed for %s", request.storagePath)
        raise HTTPException(status_code=500, detail="Chord detection failed") from exc

    return ChordsResponse(chords=[ChordSegment(**s) for s in segments])
