import os

import sentry_sdk
from fastapi import Depends, FastAPI

from app.routers.chords import router as chords_router
from app.routers.separate import router as separate_router
from app.routers.tempo import router as tempo_router
from app.security import verify_internal_key

# Bölüm 7 Ajan 10: hata izleme (ücretsiz Sentry tier). DSN tanımlı değilse
# SDK sessizce no-op olur.
sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN"),
    environment=os.environ.get("ENVIRONMENT", "development"),
    traces_sample_rate=0.1,
)

app = FastAPI(title="Woodshed AI Service")

# Ajan 12 Kritik #1: bu servis service-role Supabase erişimine sahip; yalnızca
# apps/api'nin bildiği paylaşımlı bir anahtarla korunur (bkz. app/security.py).
# `/health` kasıtlı olarak dışarıda bırakılır (platform sağlık kontrolleri için).
_internal_auth = [Depends(verify_internal_key)]
app.include_router(separate_router, dependencies=_internal_auth)
app.include_router(chords_router, dependencies=_internal_auth)
app.include_router(tempo_router, dependencies=_internal_auth)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
