from fastapi import FastAPI

from app.routers.chords import router as chords_router
from app.routers.separate import router as separate_router

app = FastAPI(title="Woodshed AI Service")
app.include_router(separate_router)
app.include_router(chords_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
