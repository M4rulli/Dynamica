/**
 * Analysis result renderer for analysis.html.
 *
 * Renders graph/matrices, step-by-step equations, tabular electrical values,
 * and configures lightweight interactive graph manipulation for inspection.
 */

import type { AnalysisResult, JobStatus } from "./analysisTypes";

type GraphNode = {
  id: number;
  x: number;
  y: number;
  circle: SVGCircleElement;
  label: SVGTextElement | null;
};

type GraphEdge = {
  line: SVGLineElement;
  a: GraphNode;
  b: GraphNode;
  label: SVGTextElement | null;
};

/** Squared Euclidean distance utility used for nearest matching. */
function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Safe numeric parser for SVG attributes with fallback. */
function parseNum(v: string | null, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function enableGraphEditing(graph: HTMLElement): void {
  // Interactive view-only manipulation:
  // users can move nodes/edges to inspect geometry, without mutating source circuit data.
  const svg = graph.querySelector(".analysis-graph-viewport svg") as SVGSVGElement | null;
  if (!svg) return;

  const circles = Array.from(svg.querySelectorAll("circle")) as SVGCircleElement[];
  const texts = Array.from(svg.querySelectorAll("text")) as SVGTextElement[];
  const lines = Array.from(svg.querySelectorAll("line")) as SVGLineElement[];

  const nodeTexts = texts.filter((t) => /^N\d+/i.test((t.textContent ?? "").trim()));
  const edgeTexts = texts.filter((t) => !/^N\d+/i.test((t.textContent ?? "").trim()));

  const nodes: GraphNode[] = circles.map((c, idx) => {
    const x = parseNum(c.getAttribute("cx"));
    const y = parseNum(c.getAttribute("cy"));
    let bestText: SVGTextElement | null = null;
    let best = Number.POSITIVE_INFINITY;
    nodeTexts.forEach((t) => {
      const tx = parseNum(t.getAttribute("x"));
      const ty = parseNum(t.getAttribute("y"));
      const d = dist2(x, y, tx - 10, ty + 10);
      if (d < best) {
        best = d;
        bestText = t;
      }
    });
    c.classList.add("graph-node");
    return { id: idx, x, y, circle: c, label: bestText };
  });

  const closestNode = (x: number, y: number): GraphNode => {
    let out = nodes[0];
    let best = Number.POSITIVE_INFINITY;
    nodes.forEach((n) => {
      const d = dist2(n.x, n.y, x, y);
      if (d < best) {
        best = d;
        out = n;
      }
    });
    return out;
  };

  const edges: GraphEdge[] = lines.map((line) => {
    const x1 = parseNum(line.getAttribute("x1"));
    const y1 = parseNum(line.getAttribute("y1"));
    const x2 = parseNum(line.getAttribute("x2"));
    const y2 = parseNum(line.getAttribute("y2"));
    const a = closestNode(x1, y1);
    const b = closestNode(x2, y2);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    let bestText: SVGTextElement | null = null;
    let best = Number.POSITIVE_INFINITY;
    edgeTexts.forEach((t) => {
      const tx = parseNum(t.getAttribute("x"));
      const ty = parseNum(t.getAttribute("y"));
      const d = dist2(mx, my, tx - 6, ty + 6);
      if (d < best) {
        best = d;
        bestText = t;
      }
    });
    line.classList.add("graph-edge");
    return { line, a, b, label: bestText };
  });

  const updateNode = (n: GraphNode) => {
    n.circle.setAttribute("cx", `${n.x}`);
    n.circle.setAttribute("cy", `${n.y}`);
    if (n.label) {
      n.label.setAttribute("x", `${n.x + 10}`);
      n.label.setAttribute("y", `${n.y - 10}`);
    }
  };

  const updateEdge = (e: GraphEdge) => {
    e.line.setAttribute("x1", `${e.a.x}`);
    e.line.setAttribute("y1", `${e.a.y}`);
    e.line.setAttribute("x2", `${e.b.x}`);
    e.line.setAttribute("y2", `${e.b.y}`);
    if (e.label) {
      const mx = (e.a.x + e.b.x) / 2;
      const my = (e.a.y + e.b.y) / 2;
      e.label.setAttribute("x", `${mx + 8}`);
      e.label.setAttribute("y", `${my - 8}`);
    }
  };

  const updateAll = () => {
    nodes.forEach(updateNode);
    edges.forEach(updateEdge);
  };
  updateAll();

  let selectedNode: GraphNode | null = null;
  let selectedEdge: GraphEdge | null = null;

  const clearSelection = () => {
    nodes.forEach((n) => n.circle.classList.remove("graph-selected"));
    edges.forEach((e) => e.line.classList.remove("graph-selected"));
  };

  const startDrag = (onMove: (x: number, y: number) => void) => (ev: MouseEvent) => {
    const move = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    ev.preventDefault();
  };

  const toSvgCoords = (clientX: number, clientY: number): { x: number; y: number } => {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    const local = ctm ? pt.matrixTransform(ctm.inverse()) : pt;
    return { x: local.x, y: local.y };
  };

  nodes.forEach((n) => {
    n.circle.addEventListener(
      "mousedown",
      startDrag((clientX, clientY) => {
        const p = toSvgCoords(clientX, clientY);
        n.x = p.x;
        n.y = p.y;
        updateAll();
      }),
    );
    n.circle.addEventListener("click", (e) => {
      e.stopPropagation();
      clearSelection();
      selectedNode = n;
      selectedEdge = null;
      n.circle.classList.add("graph-selected");
    });
  });

  edges.forEach((ed) => {
    ed.line.addEventListener(
      "mousedown",
      startDrag((clientX, clientY) => {
        const p = toSvgCoords(clientX, clientY);
        // Dragging an edge changes its length by moving endpoint B.
        ed.b.x = p.x;
        ed.b.y = p.y;
        updateAll();
      }),
    );
    ed.line.addEventListener("click", (e) => {
      e.stopPropagation();
      clearSelection();
      selectedEdge = ed;
      selectedNode = null;
      ed.line.classList.add("graph-selected");
    });
  });

  svg.addEventListener("click", () => {
    selectedNode = null;
    selectedEdge = null;
    clearSelection();
  });

  // Keep variables used to avoid TS noUnusedLocal in strict config.
  void selectedNode;
  void selectedEdge;
}

/** Update status pill and optional error line in page header. */
export function renderStatus(status: JobStatus, error?: string | null): void {
  const statusPill = document.getElementById("analysis-status-pill");
  if (statusPill) {
    statusPill.textContent = status;
  }
  const meta = document.getElementById("analysis-job-meta");
  if (error) {
    if (meta) {
      meta.textContent = `Errore: ${error}`;
      meta.classList.add("analysis-meta--error");
    }
  } else if (meta) {
    meta.classList.remove("analysis-meta--error");
  }
}

/** Render current job identifier in metadata row. */
export function renderMeta(jobId: string): void {
  const meta = document.getElementById("analysis-job-meta");
  if (meta) {
    meta.textContent = `Job ID: ${jobId}`;
    meta.classList.remove("analysis-meta--error");
  }
}

/** Render graph, matrices, equations, and electrical tables from backend output. */
export function renderResult(result: AnalysisResult): void {
  const graph = document.getElementById("analysis-graph");
  const latexEl = document.getElementById("analysis-latex");
  const powerTable = document.getElementById("analysis-power-table");
  const powerBalance = document.getElementById("analysis-power-balance");
  if (!graph || !latexEl || !powerTable || !powerBalance) return;

  const graphSvg = typeof result.graph_info.graph_svg === "string" ? result.graph_info.graph_svg : "";
  const incidenceMatrixLatex = typeof result.graph_info.incidence_matrix_latex === "string"
    ? result.graph_info.incidence_matrix_latex
    : "";
  const bMatrixLatex = typeof result.graph_info.B_matrix_latex === "string"
    ? result.graph_info.B_matrix_latex
    : "";
  const powerRows = Array.isArray(result.graph_info.power_table_rows)
    ? result.graph_info.power_table_rows.filter((v): v is string => typeof v === "string")
    : [];
  const powerBalanceLatex = typeof result.graph_info.power_balance_latex === "string"
    ? result.graph_info.power_balance_latex
    : "";
  const analysisSteps = Array.isArray(result.graph_info.analysis_steps)
    ? result.graph_info.analysis_steps.filter((v): v is string => typeof v === "string")
    : [];

  const matrixHtml = bMatrixLatex
    ? `<div class="analysis-matrix">
         <div class="analysis-matrix-title">Matrice B (maglie-rami)</div>
         <div class="analysis-incidence-latex">\\[${bMatrixLatex}\\]</div>
       </div>`
    : "";

  const incidenceHtml = incidenceMatrixLatex
    ? `<div class="analysis-incidence-panel">
         <div class="analysis-matrix-title">Matrice di Incidenza</div>
         <div class="analysis-incidence-latex">\\[${incidenceMatrixLatex}\\]</div>
       </div>`
    : "";

  const graphBlock = graphSvg
    ? `<div class="analysis-graph-main">
         <div class="analysis-matrix-title">Grafo</div>
         <div class="analysis-graph-zoom">
           <div class="analysis-graph-svg"><div class="analysis-graph-viewport">${graphSvg}</div></div>
         </div>
       </div>`
    : '<div class="analysis-graph-main"><div class="analysis-note-list">Grafo non disponibile.</div></div>';

  graph.innerHTML = `
    ${graphBlock}
    <div class="analysis-matrix-grid">
      <div class="analysis-matrix-card">${incidenceHtml || '<div class="analysis-note-list">Matrice di incidenza non disponibile.</div>'}</div>
      <div class="analysis-matrix-card">${matrixHtml || '<div class="analysis-note-list">Matrice B non disponibile.</div>'}</div>
    </div>
  `;

  const viewport = graph.querySelector(".analysis-graph-viewport") as HTMLElement | null;
  if (viewport) {
    let zoom = 1;
    const graphBox = graph.querySelector(".analysis-graph-svg") as HTMLElement | null;
    const applyZoom = () => {
      viewport.style.transform = `scale(${zoom})`;
    };
    if (graphBox) {
      graphBox.addEventListener("wheel", (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const delta = -e.deltaY * 0.0015;
        zoom = Math.min(2.5, Math.max(0.4, zoom + delta));
        applyZoom();
      }, { passive: false });

      let startDistance = 0;
      let startZoom = 1;
      const touchDistance = (a: Touch, b: Touch) => {
        const dx = a.clientX - b.clientX;
        const dy = a.clientY - b.clientY;
        return Math.sqrt(dx * dx + dy * dy);
      };
      graphBox.addEventListener("touchstart", (e) => {
        if (e.touches.length === 2) {
          startDistance = touchDistance(e.touches[0], e.touches[1]);
          startZoom = zoom;
        }
      }, { passive: true });
      graphBox.addEventListener("touchmove", (e) => {
        if (e.touches.length !== 2 || startDistance <= 0) return;
        e.preventDefault();
        const currentDistance = touchDistance(e.touches[0], e.touches[1]);
        const ratio = currentDistance / startDistance;
        zoom = Math.min(2.5, Math.max(0.4, startZoom * ratio));
        applyZoom();
      }, { passive: false });
      graphBox.addEventListener("touchend", () => {
        startDistance = 0;
      }, { passive: true });
    }
    applyZoom();
  }
  enableGraphEditing(graph);

  if (analysisSteps.length > 0) {
    latexEl.innerHTML = analysisSteps
      .map((entry) => {
        const [title, eqBlock] = entry.split("||");
        const equations = (eqBlock ?? "")
          .split("%%")
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((line) => `<div class="analysis-step-equation">\\[${line}\\]</div>`)
          .join("");
        return `<div class="analysis-step"><div class="analysis-step-title">${title ?? ""}</div>${equations}</div>`;
      })
      .join("");
  } else {
    latexEl.innerHTML = `\\(${result.latex}\\)`;
  }
  powerBalance.innerHTML = powerBalanceLatex ? `\\[${powerBalanceLatex}\\]` : "\\[\\text{Bilancio non disponibile}\\]";

  if (powerRows.length > 0) {
    const tableRows = powerRows
      .map((row) => {
        const [element, iVal, vVal, pVal] = row.split("|");
        return `<tr><td>\\(${element ?? ""}\\)</td><td>\\(${iVal ?? ""}\\)</td><td>\\(${vVal ?? ""}\\)</td><td>\\(${pVal ?? ""}\\)</td></tr>`;
      })
      .join("");
    powerTable.innerHTML = `
      <table class="analysis-table">
        <thead>
          <tr><th>Elemento</th><th>I</th><th>V</th><th>P</th></tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;
  } else {
    powerTable.innerHTML = `<div class="analysis-item"><strong>Nessun dato disponibile</strong></div>`;
  }

  const mj = (window as Window & { MathJax?: { typesetPromise?: (nodes: Element[]) => Promise<void>; typeset?: (nodes: Element[]) => void } }).MathJax;
  const syncOverflow = (el: HTMLElement) => {
    const overflowing = el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
    el.classList.toggle("is-overflowing", overflowing);
  };
  if (mj?.typesetPromise) {
    void mj.typesetPromise([graph, latexEl, powerTable, powerBalance]).then(() => {
      syncOverflow(latexEl);
      syncOverflow(powerBalance);
    });
  } else if (mj?.typeset) {
    mj.typeset([graph, latexEl, powerTable, powerBalance]);
    syncOverflow(latexEl);
    syncOverflow(powerBalance);
  } else {
    syncOverflow(latexEl);
    syncOverflow(powerBalance);
  }
}
