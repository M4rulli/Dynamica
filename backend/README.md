# Dynamica Analysis Backend

Backend FastAPI compatto per analisi circuitale (nodi/maglie) via JSON.

## Avvio rapido

1. Crea venv ed installa dipendenze:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Avvia server:

```bash
uvicorn app.main:app --reload --port 8000
```

API base:
- `POST /api/v1/analysis/jobs`
- `GET /api/v1/analysis/jobs/{job_id}`
- `GET /api/v1/analysis/jobs/{job_id}/result`

## Struttura tecnica ridotta

- `app/main.py`: API + ciclo job asincrono
- `app/models.py`: schemi request/response/componenti
- `app/job_store.py`: storage job in-memory
- `app/analysis_engine.py`: logica analisi
  - validazione parametri componenti
  - costruzione grafo + base maglie (visualizzazione)
  - conversione circuito in netlist Lcapy
  - risoluzione nodale/maglie con Lcapy
  - correnti di ramo da base maglie per report

## Nota operativa

L'analisi viene bloccata se mancano parametri caratteristici dei bipoli (es. `R`, `L`, `C`, tensione/corrente nota del generatore).
Il solver simbolico usato è Lcapy.
