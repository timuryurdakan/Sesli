import os

import sentry_sdk
from fastapi import FastAPI

from app.routers.chords import router as chords_router
from app.routers.separate import router as separate_router
from app.routers.tempo import router as tempo_router

# Bölüm 7 Ajan 10: hata izleme (ücretsiz Sentry tier). DSN tanımlı değilse
# SDK sessizce no-op olur.
sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN"),
    environment=os.environ.get("ENVIRONMENT", "development"),
    traces_sample_rate=0.1,
)

app = FastAPI(title="Woodshed AI Service")
app.include_router(separate_router)
app.include_router(chords_router)
app.include_router(tempo_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
