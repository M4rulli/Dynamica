/**
 * Export controller for editor sidebar actions.
 * Handles SVG and LaTeX exports from current canvas components.
 */

import { buildCircuitLatex } from "../export/latexExport";
import { buildCircuitSvg } from "../export/svgExport";
import type { ComponentInstance } from "../circuit-library/componentsInstance";

type ExportApi = {
  getAllComponents?: () => ComponentInstance[];
};

function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function getComponents(): ComponentInstance[] {
  const api = (window as Window & { canvasController?: ExportApi }).canvasController;
  return api?.getAllComponents?.() ?? [];
}

export function bindExportControls(): void {
  const svgBtn = document.getElementById("export-svg-btn") as HTMLButtonElement | null;
  const texBtn = document.getElementById("export-tex-btn") as HTMLButtonElement | null;
  if (!svgBtn || !texBtn) return;

  const doExportSvg = () => {
    const components = getComponents();
    if (components.length === 0) {
      window.alert("Nessun componente da esportare.");
      return;
    }
    const svg = buildCircuitSvg(components);
    downloadText("circuit.svg", svg, "image/svg+xml;charset=utf-8");
  };

  const doExportTex = () => {
    const components = getComponents();
    if (components.length === 0) {
      window.alert("Nessun componente da esportare.");
      return;
    }
    const tex = buildCircuitLatex(components);
    downloadText("circuit.tex", tex, "text/plain;charset=utf-8");
  };

  svgBtn.addEventListener("click", doExportSvg);
  texBtn.addEventListener("click", doExportTex);
}
