from fastapi import FastAPI

from app.routers.separate import router as separate_router

app = FastAPI(title="Woodshed AI Service")
app.include_router(separate_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
