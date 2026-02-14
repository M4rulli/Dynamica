"""
HTTP entrypoint for the analysis backend.

Responsibilities:
- expose REST endpoints for job creation and polling,
- validate request integrity before enqueueing work,
- execute asynchronous analysis jobs and persist status/result in memory.
"""

import asyncio
import os
import traceback
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.analysis_engine import run_analysis, validate_circuit_integrity
from app.job_store import AnalysisJob, job_store
from app.models import (
  AnalysisJobCreateResponse,
  AnalysisJobStatusResponse,
  AnalysisRequest,
  AnalysisResultResponse,
)

app = FastAPI(title="Dynamica Analysis API")

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
  return {"status": "ok"}


def _debug_enabled() -> bool:
  return os.getenv("ANALYSIS_DEBUG", "0").lower() in ("1", "true", "yes", "on")


def _dbg(msg: str) -> None:
  if _debug_enabled():
    print(f"[DEBUG] {msg}")

def _debug_payload(payload: AnalysisRequest) -> None:
  _dbg(f"create_analysis_job payload type={payload.analysis_type} components={len(payload.circuit.components)} options={payload.options}")
  for idx, comp in enumerate(payload.circuit.components):
    _dbg(
      "[REQUEST] "
      + f"#{idx+1} id={comp.id} type={comp.type} label={comp.label} "
      + f"pinA=({comp.pinA.x},{comp.pinA.y}) pinB=({comp.pinB.x},{comp.pinB.y}) "
      + f"value={comp.value} current={comp.current} voltage={comp.voltage} "
      + f"currentUnknown={comp.currentUnknown} voltageUnknown={comp.voltageUnknown} "
      + f"sourceDirection={comp.sourceDirection} sourcePolarity={comp.sourcePolarity}"
    )


async def _process_job(job_id: str) -> None:
  """Run a queued job and transition status through running/completed/failed."""
  job = job_store.get(job_id)
  if not job:
    return
  _dbg(f"job {job_id} -> running")
  job_store.set_running(job_id)
  await asyncio.sleep(0.1)
  try:
    result = run_analysis(job_id, job.request)
    job_store.set_completed(job_id, result)
    _dbg(f"job {job_id} -> completed")
  except Exception as exc:  # pragma: no cover
    _dbg(f"job {job_id} -> failed: {exc}")
    _dbg(traceback.format_exc())
    job_store.set_failed(job_id, str(exc))


@app.post("/api/v1/analysis/jobs", response_model=AnalysisJobCreateResponse)
async def create_analysis_job(payload: AnalysisRequest) -> AnalysisJobCreateResponse:
  """Create an analysis job after a fast structural integrity check."""
  _debug_payload(payload)
  ok, error = validate_circuit_integrity(payload.circuit.components)
  if not ok:
    raise HTTPException(status_code=422, detail=error or "Errore di integrita' del circuito")
  job_id = str(uuid.uuid4())
  job_store.create(AnalysisJob(id=job_id, request=payload))
  asyncio.create_task(_process_job(job_id))
  return AnalysisJobCreateResponse(job_id=job_id, status="queued")


@app.get("/api/v1/analysis/jobs/{job_id}", response_model=AnalysisJobStatusResponse)
async def get_analysis_job_status(job_id: str) -> AnalysisJobStatusResponse:
  job = job_store.get(job_id)
  if not job:
    raise HTTPException(status_code=404, detail="Job non trovato")
  return AnalysisJobStatusResponse(job_id=job.id, status=job.status, error=job.error)


@app.get("/api/v1/analysis/jobs/{job_id}/result", response_model=AnalysisResultResponse)
async def get_analysis_result(job_id: str) -> AnalysisResultResponse:
  job = job_store.get(job_id)
  if not job:
    raise HTTPException(status_code=404, detail="Job non trovato")
  return AnalysisResultResponse(status=job.status, result=job.result, error=job.error)
