"""HTTP entrypoint for the Dynamica Analysis API."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.analysis import router as analysis_router

app = FastAPI(title="Dynamica Analysis API")

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
  return {"status": "ok"}


@app.get("/api/v1/health", tags=["health"])
async def health_v1() -> dict[str, str]:
  return {"status": "ok"}


app.include_router(analysis_router, prefix="/api/v1")
