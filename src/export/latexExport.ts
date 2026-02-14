import type { ComponentInstance } from "../circuit-library/componentsInstance";

function labelToTex(label: string | undefined): string {
  if (!label) return "";
  const m = label.match(/^([A-Za-z])([0-9]+)$/);
  if (m) return `${m[1]}_{${m[2]}}`;
  return `\\mathrm{${label.replace(/[^a-zA-Z0-9_]/g, "")}}`;
}

function normalizeCoordinates(components: ComponentInstance[]) {
  if (components.length === 0) {
    return {
      mapPoint: () => ({ x: 0, y: 0 }),
    };
  }

  const pts = components.flatMap((c) => [c.pinA, c.pinB]);
  const minX = Math.min(...pts.map((p) => p.x));
  const maxY = Math.max(...pts.map((p) => p.y));
  const scale = 24;

  return {
    mapPoint: (p: { x: number; y: number }) => ({
      x: (p.x - minX) / scale,
      y: (maxY - p.y) / scale,
    }),
  };
}

function fmt(n: number): string {
  return n.toFixed(3).replace(/\.?0+$/, "");
}

function compToTikz(comp: ComponentInstance, mapPoint: (p: { x: number; y: number }) => { x: number; y: number }): string {
  const a = mapPoint(comp.pinA);
  const b = mapPoint(comp.pinB);
  const A = `(${fmt(a.x)},${fmt(a.y)})`;
  const B = `(${fmt(b.x)},${fmt(b.y)})`;

  if (comp.type === "wire") return `\\draw ${A} -- ${B};`;

  const label = labelToTex(comp.label);
  const labelPart = label ? `, l=$${label}$` : "";

  if (comp.type === "resistor") return `\\draw ${A} to[R${labelPart}] ${B};`;
  if (comp.type === "capacitor") return `\\draw ${A} to[C${labelPart}] ${B};`;
  if (comp.type === "inductor") return `\\draw ${A} to[L${labelPart}] ${B};`;
  if (comp.type === "voltage_source") {
    const polarityOpt = comp.sourcePolarity === "b_positive" ? ", invert" : "";
    return `\\draw ${A} to[V${labelPart}${polarityOpt}] ${B};`;
  }
  if (comp.type === "current_source") {
    const directionOpt = comp.sourceDirection === "b_to_a" ? ", invert" : "";
    return `\\draw ${A} to[I${labelPart}${directionOpt}] ${B};`;
  }

  return `\\draw ${A} -- ${B};`;
}

export function buildCircuitLatex(components: ComponentInstance[]): string {
  const { mapPoint } = normalizeCoordinates(components);
  const lines = components.map((c) => compToTikz(c, mapPoint));

  return [
    "\\documentclass[tikz,border=10pt]{standalone}",
    "\\usepackage[american]{circuitikz}",
    "",
    "\\begin{document}",
    "\\begin{circuitikz}",
    ...lines,
    "\\end{circuitikz}",
    "\\end{document}",
    "",
  ].join("\n");
}
