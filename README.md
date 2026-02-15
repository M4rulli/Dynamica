# Dynamica

[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=111827)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.1x-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![SymPy](https://img.shields.io/badge/SymPy-symbolic-3B5526)](https://www.sympy.org/)
[![Lcapy](https://img.shields.io/badge/Lcapy-circuit%20analysis-4B6CB7)](https://lcapy.readthedocs.io/)

Professional circuit editor with a modern UI, SVG/LaTeX export, and asynchronous API analysis (mesh/nodal workflows).

## Highlights

- Drag-and-drop circuit editor with snapping, labeling, and rotation.
- Dedicated component inspector (labels, electrical parameters, unknown flags).
- Export pipeline:
  - SVG (clean presentation output)
  - LaTeX (`circuitikz`)
- Async analysis API with job polling.
- Mesh analysis pipeline with current-source constraints and supermesh-aware equations.
- Rich analysis report page:
  - interactive graph panel
  - incidence and mesh matrices
  - equation steps
  - branch table (`I, V, P`)
  - power-balance card

## Architecture

### Web

- Stack: `Vite + React + TypeScript`
- Main entry: `web/src/main.ts`
- Key controllers:
  - `web/src/controller/canvasController.ts`: canvas state + interaction core
  - `web/src/controller/componentInspectorController.ts`: selected-component editing
  - `web/src/controller/navbarController.ts`: sidebar controls (theme/grid/export/analysis)
  - `web/src/controller/analysisController.ts`: analysis job submission
- Analysis report:
  - `web/pages/analysis.html`
  - `web/src/analysis/analysisMain.ts`
  - `web/src/analysis/analysisRenderer.ts`

### API

- Stack: `FastAPI + SymPy (+ Lcapy available in environment)`
- API entrypoint: `api/app/main.py`
- General orchestration: `api/app/analysis_engine.py`
- Mesh-specific algorithm: `api/app/mesh_analysis.py`
- Shared utilities: `api/app/analysis_common.py`
- In-memory job store: `api/app/job_store.py`

## Quick Start

## 1) Web

```bash
npm install
npm run dev
```

Default dev URL: `http://127.0.0.1:5173`

## 2) API

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

## 3) Build

```bash
npm run build
```

## Analysis API

Base URL: `http://127.0.0.1:8000/api/v1`

- `POST /analysis/jobs`
  - Creates a new async analysis job.
- `GET /analysis/jobs/{job_id}`
  - Returns job status (`queued|running|completed|failed`).
- `GET /analysis/jobs/{job_id}/result`
  - Returns result payload when completed.

Notes:

- Circuit integrity is validated before job enqueueing.
- Missing required electrical parameters are rejected early.

## Usage Flow

1. Build a circuit in the editor.
2. Set component parameters in Inspector.
3. Run `Analisi Nodi` or `Analisi Maglie`.
4. A report tab opens (`/pages/analysis.html?job=...`) and auto-polls results.
5. Review graph/matrices/equations/table/power-balance.

## Project Structure

```text
.
├─ web/
│  ├─ src/                  # Web source (React + controllers)
│  ├─ public/static/        # Static UI fragments (navbar/grid/inspector)
│  ├─ pages/
│  │  ├─ editor.html
│  │  └─ analysis.html
│  └─ index.html
├─ config/                  # Build/TypeScript configuration
├─ api/
│  ├─ app/
│  │  ├─ main.py            # FastAPI endpoints + job lifecycle
│  │  ├─ analysis_engine.py # General dispatcher and validation
│  │  ├─ mesh_analysis.py   # Mesh analysis algorithm
│  │  ├─ analysis_common.py # Shared graph/latex/svg helpers
│  │  ├─ models.py          # Pydantic schemas
│  │  └─ job_store.py       # In-memory job store
│  └─ requirements.txt
└─ package.json
```

## Development Notes

- Editor and analysis pages are theme-aware (`light`/`dark`) via localStorage.
- API debug traces can be enabled with:

```bash
export ANALYSIS_DEBUG=1
```

## Roadmap

- Full nodal solver parity with the current mesh reporting quality.
- Stronger supermesh detection/annotation in the report UI.
- Import/save persistence workflow (currently UI placeholders exist).
- E2E regression tests for editor -> API -> report pipeline.
- Optional persistent API job storage (Redis/PostgreSQL).

## License

Specify project license here (e.g. MIT) before publishing.
