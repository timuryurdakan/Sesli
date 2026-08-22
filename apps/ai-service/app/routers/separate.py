import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.separation import UnsupportedAudioError, separate_track

logger = logging.getLogger(__name__)

router = APIRouter()


class SeparateRequest(BaseModel):
    jobId: str
    storagePath: str


class SeparateResponse(BaseModel):
    stems: dict[str, str]


@router.post("/separate", response_model=SeparateResponse)
async def separate(request: SeparateRequest) -> SeparateResponse:
    """
    Bölüm 7 Ajan 4: bir parçayı vokal/davul/bas/gitar/piyano/diğer olmak
    üzere 6 kanala ayırır (Demucs `htdemucs_6s`). apps/api'deki BullMQ
    worker'ı bu uç noktayı çağırır (bkz. stem-separation.worker.ts).
    """
    try:
        stems = await separate_track(request.jobId, request.storagePath)
    except UnsupportedAudioError as exc:
        raise HTTPException(
            status_code=422, detail=f"Unsupported or corrupt audio file: {exc}"
        ) from exc
    except RuntimeError as exc:
        # ör. Supabase yapılandırılmamış — bkz. get_supabase()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Stem separation failed for job %s", request.jobId)
        raise HTTPException(status_code=500, detail="Stem separation failed") from exc

    return SeparateResponse(stems=stems)
