/**
 * Analysis entrypoint controller for the editor sidebar.
 *
 * The sidebar now exposes a single "Analizza" action that opens pages/analysis.html.
 * We persist the current circuit snapshot so the analysis page can:
 * - recap the exact circuit,
 * - let the user choose domain/method,
 * - run backend analysis from there.
 */

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

type CanvasApi = {
  getAllComponents?: () => ComponentInstance[];
};

const ANALYSIS_DRAFT_KEY = "analysis-circuit-draft-v1";
const CLUSTER_TOLERANCE = 8;
let analysisErrorTimer: number | null = null;

function getCanvasComponents(): ComponentInstance[] {
  const canvasController = (window as Window & { canvasController?: CanvasApi }).canvasController;
  return canvasController?.getAllComponents?.() ?? [];
}

function canonicalLabel(comp: ComponentInstance, index: number): string {
  const label = comp.label?.trim();
  if (label) return label;
  return `${comp.type.toUpperCase()}_${index + 1}`;
}

function getMissingParamReason(comp: ComponentInstance): string | null {
  if (comp.type === "wire") return null;

  if (comp.type === "resistor" || comp.type === "capacitor" || comp.type === "inductor") {
    const hasValue = typeof comp.value === "string" && comp.value.trim() !== "";
    return hasValue ? null : "valore";
  }

  if (comp.type === "voltage_source") {
    const hasVoltage = typeof comp.voltage === "string" && comp.voltage.trim() !== "";
    return comp.voltageUnknown === true || !hasVoltage ? "tensione" : null;
  }

  if (comp.type === "current_source") {
    const hasCurrent = typeof comp.current === "string" && comp.current.trim() !== "";
    return comp.currentUnknown === true || !hasCurrent ? "corrente" : null;
  }

  return null;
}

function validateComponentParams(components: ComponentInstance[]): { ok: true } | { ok: false; error: string } {
  const missing = components
    .map((comp, index) => {
      const reason = getMissingParamReason(comp);
      if (!reason) return null;
      return `${canonicalLabel(comp, index)} (${reason})`;
    })
    .filter((entry): entry is string => !!entry);

  if (missing.length === 0) return { ok: true };

  const preview = missing.slice(0, 4).join(", ");
  const suffix = missing.length > 4 ? "..." : "";
  return { ok: false, error: `Errore parametro mancante: ${preview}${suffix}.` };
}

function validateCircuitIntegrity(components: ComponentInstance[]): { ok: true } | { ok: false; error: string } {
  if (components.length === 0) {
    return { ok: false, error: "Circuito vuoto: aggiungi almeno un componente." };
  }

  const tolerance2 = CLUSTER_TOLERANCE * CLUSTER_TOLERANCE;
  const clusters: Array<{ x: number; y: number; count: number }> = [];
  const terminalCounts = new Map<number, number>();
  const clusterComponents = new Map<number, Set<number>>();
  const componentNodes: Array<{ a: number; b: number }> = [];

  const assignCluster = (x: number, y: number): number => {
    for (let i = 0; i < clusters.length; i += 1) {
      const cluster = clusters[i];
      const dx = x - cluster.x;
      const dy = y - cluster.y;
      if (dx * dx + dy * dy > tolerance2) continue;
      const newCount = cluster.count + 1;
      cluster.x = (cluster.x * cluster.count + x) / newCount;
      cluster.y = (cluster.y * cluster.count + y) / newCount;
      cluster.count = newCount;
      return i;
    }
    clusters.push({ x, y, count: 1 });
    return clusters.length - 1;
  };

  const incTerminal = (nodeId: number, compIndex: number) => {
    terminalCounts.set(nodeId, (terminalCounts.get(nodeId) ?? 0) + 1);
    const set = clusterComponents.get(nodeId) ?? new Set<number>();
    set.add(compIndex);
    clusterComponents.set(nodeId, set);
  };

  components.forEach((comp, index) => {
    const a = assignCluster(comp.pinA.x, comp.pinA.y);
    const b = assignCluster(comp.pinB.x, comp.pinB.y);
    componentNodes.push({ a, b });
    incTerminal(a, index);
    incTerminal(b, index);
  });

  const danglingComponents = componentNodes
    .map((nodes, index) => {
      const aCount = terminalCounts.get(nodes.a) ?? 0;
      const bCount = terminalCounts.get(nodes.b) ?? 0;
      if (aCount < 2 || bCount < 2) return canonicalLabel(components[index], index);
      return null;
    })
    .filter((name): name is string => !!name);

  if (danglingComponents.length > 0) {
    const preview = danglingComponents.slice(0, 4).join(", ");
    const suffix = danglingComponents.length > 4 ? "..." : "";
    return { ok: false, error: `Errore di integrità: componenti/rami scoperti (${preview}${suffix}).` };
  }

  const adjacency = components.map(() => new Set<number>());
  clusterComponents.forEach((compIds) => {
    const ids = Array.from(compIds);
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = ids[i];
        const b = ids[j];
        adjacency[a].add(b);
        adjacency[b].add(a);
      }
    }
  });

  const visited = new Set<number>([0]);
  const queue: number[] = [0];
  while (queue.length > 0) {
    const current = queue.shift()!;
    adjacency[current].forEach((neighbor) => {
      if (visited.has(neighbor)) return;
      visited.add(neighbor);
      queue.push(neighbor);
    });
  }

  if (visited.size !== components.length) {
    return { ok: false, error: "Errore di integrità: il circuito non è completamente interconnesso." };
  }

  return { ok: true };
}

function showAnalysisErrorPopup(message: string): void {
  let popup = document.getElementById("analysis-error-popup") as HTMLDivElement | null;
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "analysis-error-popup";
    popup.className = "analysis-error-popup";
    popup.setAttribute("role", "alert");
    popup.setAttribute("aria-live", "assertive");
    document.body.appendChild(popup);
  }
  popup.textContent = message;
  popup.classList.add("is-visible");

  if (analysisErrorTimer !== null) {
    window.clearTimeout(analysisErrorTimer);
  }
  analysisErrorTimer = window.setTimeout(() => {
    popup?.classList.remove("is-visible");
    analysisErrorTimer = null;
  }, 3200);
}

export function normalizeComponentsForAnalysis(components: ComponentInstance[]): ComponentInstance[] {
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

export function loadAnalysisControls(): void {
  const analyzeBtn = document.getElementById("open-analysis-page") as HTMLButtonElement | null;
  if (!analyzeBtn) return;

  analyzeBtn.addEventListener("click", () => {
    const components = normalizeComponentsForAnalysis(getCanvasComponents());
    const integrity = validateCircuitIntegrity(components);
    if (!integrity.ok) {
      showAnalysisErrorPopup(integrity.error);
      return;
    }

    const params = validateComponentParams(components);
    if (!params.ok) {
      showAnalysisErrorPopup(params.error);
      return;
    }

    const snapshot = {
      savedAt: Date.now(),
      circuit: { components },
    };
    localStorage.setItem(ANALYSIS_DRAFT_KEY, JSON.stringify(snapshot));
    window.open("/pages/analysis.html", "_blank", "noopener,noreferrer");
  });
}
