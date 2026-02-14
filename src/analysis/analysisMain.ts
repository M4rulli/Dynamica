/**
 * Analysis page bootstrap/controller.
 * Orchestrates theme setup, draft loading, job submission/polling, UI reset,
 * and bindings for run/help/save/reset actions.
 */

import { createJob, getJobResult, getJobStatus } from "./analysisApi";
import { renderMeta, renderResult, renderStatus } from "./analysisRenderer";

type AnalysisType = "nodal" | "mesh";

type ComponentInstance = {
  id: string;
  type: string;
  pinA: { x: number; y: number };
  pinB: { x: number; y: number };
  label?: string;
  value?: string;
  current?: string;
  voltage?: string;
  currentUnknown?: boolean;
  voltageUnknown?: boolean;
  sourceDirection?: "a_to_b" | "b_to_a";
  sourcePolarity?: "a_positive" | "b_positive";
};

const ANALYSIS_DRAFT_KEY = "analysis-circuit-draft-v1";
// Token used to invalidate in-flight polling loops when resetting/rerunning.
let activePollToken = 0;

/** Apply persisted app theme class to analysis page body. */
function applySavedTheme(): void {
  const saved = localStorage.getItem("theme");
  document.body.classList.remove("dark-theme", "light-theme");
  if (saved === "light") {
    document.body.classList.add("light-theme");
  } else {
    document.body.classList.add("dark-theme");
  }
}

/** Read `job` identifier from query parameters, if present. */
function getJobIdFromQuery(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("job");
}

/** Read circuit snapshot saved by editor before opening analysis page. */
function readDraftComponents(): ComponentInstance[] {
  const raw = localStorage.getItem(ANALYSIS_DRAFT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { circuit?: { components?: ComponentInstance[] } };
    const components = parsed?.circuit?.components;
    return Array.isArray(components) ? components : [];
  } catch {
    return [];
  }
}

/** Normalize source fields so payload matches backend source constraints. */
function normalizeComponentsForAnalysis(components: ComponentInstance[]): ComponentInstance[] {
  return components.map((comp) => {
    if (comp.type === "voltage_source") {
      const hasVoltage = !!(comp.voltage && comp.voltage.trim() !== "");
      return {
        ...comp,
        value: undefined,
        voltageUnknown: !hasVoltage,
        currentUnknown: hasVoltage,
      };
    }
    if (comp.type === "current_source") {
      const hasCurrent = !!(comp.current && comp.current.trim() !== "");
      return {
        ...comp,
        value: undefined,
        currentUnknown: !hasCurrent,
        voltageUnknown: hasCurrent,
      };
    }
    return comp;
  });
}

/** Render compact circuit summary cards by component type. */
function renderCircuitSummary(components: ComponentInstance[]): void {
  const target = document.getElementById("analysis-circuit-summary");
  if (!target) return;

  if (components.length === 0) {
    target.innerHTML = `
      <div class="analysis-item">
        <span>Stato</span>
        <strong>Nessun circuito disponibile. Torna all'editor e premi "Analizza".</strong>
      </div>
    `;
    return;
  }

  const byType = new Map<string, number>();
  components.forEach((c) => {
    byType.set(c.type, (byType.get(c.type) ?? 0) + 1);
  });
  const typeRows = Array.from(byType.entries())
    .map(([type, qty]) => `<div class="analysis-item"><span>${type}</span><strong>${qty}</strong></div>`)
    .join("");

  target.innerHTML = `
    <div class="analysis-item"><span>Componenti Totali</span><strong>${components.length}</strong></div>
    ${typeRows}
  `;
}

/** Collect current analysis configuration from form controls. */
function collectOptions(): Record<string, string | boolean> {
  const domainInput = document.querySelector<HTMLInputElement>('input[name="analysis-domain"]:checked');
  const regimeInput = document.querySelector<HTMLInputElement>('input[name="analysis-regime"]:checked');
  const laplaceClassic = document.getElementById("analysis-laplace-classic") as HTMLInputElement | null;
  return {
    domain: domainInput?.value ?? "time",
    regime: regimeInput?.value ?? "dc",
    laplace_classic: !!laplaceClassic?.checked,
  };
}

/** Show/hide result card block and enable save button only when visible. */
function setAnalysisResultsVisible(visible: boolean): void {
  const results = document.getElementById("analysis-results-section");
  const saveBtn = document.getElementById("analysis-save-btn") as HTMLButtonElement | null;
  if (results) {
    results.classList.toggle("is-hidden", !visible);
  }
  if (saveBtn) {
    saveBtn.disabled = !visible;
  }
}

/** Clear all result target containers before a new run/reset. */
function clearAnalysisOutputs(): void {
  const graph = document.getElementById("analysis-graph");
  const latex = document.getElementById("analysis-latex");
  const powerTable = document.getElementById("analysis-power-table");
  const powerBalance = document.getElementById("analysis-power-balance");
  if (graph) graph.innerHTML = "";
  if (latex) latex.innerHTML = "";
  if (powerTable) powerTable.innerHTML = "";
  if (powerBalance) powerBalance.innerHTML = "";
}

/** Put status section back to idle state. */
function setIdleStatus(): void {
  const pill = document.getElementById("analysis-status-pill");
  const meta = document.getElementById("analysis-job-meta");
  if (pill) pill.textContent = "In attesa";
  if (meta) {
    meta.textContent = "";
    meta.classList.remove("analysis-meta--error");
  }
}

/** Reset analysis UI to initial state and clear job query parameter. */
function resetAnalysisState(): void {
  activePollToken += 1;
  clearAnalysisOutputs();
  setAnalysisResultsVisible(false);
  setIdleStatus();
  const url = new URL(window.location.href);
  url.searchParams.delete("job");
  window.history.replaceState({}, "", url.toString());
}

/** Poll job status until completion/failure or token invalidation. */
async function poll(jobId: string, token: number): Promise<void> {
  renderMeta(jobId);
  for (;;) {
    if (token !== activePollToken) return;
    const status = await getJobStatus(jobId);
    if (token !== activePollToken) return;
    renderStatus(status.status, status.error);

    if (status.status === "failed") return;
    if (status.status === "completed") {
      const result = await getJobResult(jobId);
      if (token !== activePollToken) return;
      renderStatus(result.status, result.error);
      if (result.result) renderResult(result.result);
      return;
    }
    await new Promise((r) => window.setTimeout(r, 700));
  }
}

/** Start analysis from local draft and stream result into the UI. */
async function runFromDraft(analysisType: AnalysisType): Promise<void> {
  const components = normalizeComponentsForAnalysis(readDraftComponents());
  if (components.length === 0) {
    renderStatus("failed", "Circuito mancante: apri l'editor e premi Analizza.");
    return;
  }

  activePollToken += 1;
  const pollToken = activePollToken;
  setAnalysisResultsVisible(true);
  clearAnalysisOutputs();
  renderStatus("queued");
  const payload = {
    analysis_type: analysisType,
    circuit: { components },
    options: collectOptions(),
  };
  const created = await createJob(payload);
  const url = new URL(window.location.href);
  url.searchParams.set("job", created.job_id);
  window.history.replaceState({}, "", url.toString());
  await poll(created.job_id, pollToken);
}

/** Bind run buttons for nodal and mesh methods. */
function bindRunButtons(): void {
  const nodalBtn = document.getElementById("run-analysis-nodal") as HTMLButtonElement | null;
  const meshBtn = document.getElementById("run-analysis-mesh") as HTMLButtonElement | null;
  if (nodalBtn) {
    nodalBtn.addEventListener("click", () => {
      void runFromDraft("nodal").catch((err) => {
        renderStatus("failed", err instanceof Error ? err.message : "Errore durante analisi nodale");
      });
    });
  }
  if (meshBtn) {
    meshBtn.addEventListener("click", () => {
      void runFromDraft("mesh").catch((err) => {
        renderStatus("failed", err instanceof Error ? err.message : "Errore durante analisi a maglie");
      });
    });
  }
}

/** Bind top action buttons (reset + dummy save). */
function bindActionButtons(): void {
  const resetBtn = document.getElementById("analysis-reset-btn") as HTMLButtonElement | null;
  const saveBtn = document.getElementById("analysis-save-btn") as HTMLButtonElement | null;
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      resetAnalysisState();
    });
  }
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      // Placeholder: analysis persistence is intentionally not implemented yet.
    });
  }
}

/** Bind help modal open/close interactions, including Escape and backdrop. */
function bindHelpModal(): void {
  const modal = document.getElementById("analysis-help-modal") as HTMLDivElement | null;
  const openBtn = document.getElementById("analysis-help-btn") as HTMLButtonElement | null;
  const closeBtn = document.getElementById("analysis-help-close") as HTMLButtonElement | null;
  if (!modal || !openBtn || !closeBtn) return;

  const open = () => {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    const mj = (window as Window & { MathJax?: { typesetPromise?: (nodes: Element[]) => Promise<void> } }).MathJax;
    if (mj?.typesetPromise) {
      void mj.typesetPromise([modal]);
    }
  };

  const close = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  };

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);

  modal.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.dataset.closeModal === "true") close();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) close();
  });
}

/** Page entrypoint: restore state, bind controls, and optionally resume polling. */
window.addEventListener("DOMContentLoaded", () => {
  applySavedTheme();
  const components = readDraftComponents();
  renderCircuitSummary(components);
  bindRunButtons();
  bindActionButtons();
  bindHelpModal();

  const jobId = getJobIdFromQuery();
  if (!jobId) {
    resetAnalysisState();
    return;
  }
  activePollToken += 1;
  const pollToken = activePollToken;
  setAnalysisResultsVisible(true);
  void poll(jobId, pollToken).catch((err) => {
    renderStatus("failed", err instanceof Error ? err.message : "Errore inatteso");
  });
});
