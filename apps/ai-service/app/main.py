from fastapi import FastAPI

app = FastAPI(title="Woodshed AI Service")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
