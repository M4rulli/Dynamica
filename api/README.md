# Dynamica Analysis API

FastAPI service for asynchronous circuit analysis (nodal and mesh workflows), consumed by the Dynamica web client.

## Features

- Async job lifecycle (`queued -> running -> completed|failed`)
- Circuit integrity validation before job execution
- Nodal and mesh analysis dispatch
- Symbolic solving via `lcapy` and `sympy`
- In-memory job persistence for local/dev usage

## Quick Start

1. Create a virtual environment and install dependencies:

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Start the API:

```bash
uvicorn app.main:app --reload --port 8000
```

3. Verify health:

```bash
curl http://127.0.0.1:8000/health
```

## Endpoints

Base URL: `http://127.0.0.1:8000`

- `GET /health`
  - Liveness probe.
- `POST /api/v1/analysis/jobs`
  - Creates an analysis job from an `AnalysisRequest`.
  - Returns `job_id` and initial `queued` status.
- `GET /api/v1/analysis/jobs/{job_id}`
  - Returns current status and optional error.
- `GET /api/v1/analysis/jobs/{job_id}/result`
  - Returns status, optional final result, and optional error.

## Request/Response Model Summary

Core schemas are defined in `app/models.py`:

- `AnalysisRequest`
  - `analysis_type`: `"nodal"` or `"mesh"`
  - `circuit.components`: normalized component list from the editor
  - `options`: optional key-value settings
- `AnalysisResultResponse`
  - `status`: job status
  - `result`: populated when completed
  - `error`: populated when failed

## Project Structure

- `app/main.py`
  - FastAPI app, CORS, endpoint handlers, async job scheduling.
- `app/analysis_engine.py`
  - Validation, graph preparation, and high-level analysis orchestration.
- `app/mesh_analysis.py`
  - Mesh-analysis specific implementation details.
- `app/analysis_common.py`
  - Shared helpers across analysis paths.
- `app/job_store.py`
  - Thread-safe in-memory job store.
- `app/models.py`
  - Pydantic request/response/domain models.

## Operational Notes

- Circuits that fail integrity checks or miss required electrical parameters are rejected before execution.
- The default job store is in-memory and resets on process restart.
- Debug logging can be enabled with:

```bash
export ANALYSIS_DEBUG=1
```

## Dependencies

Pinned in `requirements.txt`:

- `fastapi`
- `uvicorn`
- `pydantic`
- `lcapy`
- `sympy`
