import type { ComponentInstance } from "../circuit-library/componentsInstance";

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function getBounds(components: ComponentInstance[]): Bounds {
  if (components.length === 0) return { minX: 0, minY: 0, maxX: 400, maxY: 300 };
  const points: Array<{ x: number; y: number }> = [];
  components.forEach((c) => {
    points.push(c.pinA, c.pinB);
  });
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

function getGeometry(comp: ComponentInstance) {
  const dx = comp.pinB.x - comp.pinA.x;
  const dy = comp.pinB.y - comp.pinA.y;
  const baseAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const totalAngle = baseAngle + (comp.rotation ?? 0);
  const rad = (totalAngle * Math.PI) / 180;
  const midX = (comp.pinA.x + comp.pinB.x) / 2;
  const midY = (comp.pinA.y + comp.pinB.y) / 2;
  return { midX, midY, rad, totalAngle };
}

function renderResistor(comp: ComponentInstance): string {
  const { midX, midY, rad } = getGeometry(comp);
  const p1x = midX - 30 * Math.cos(rad);
  const p1y = midY - 30 * Math.sin(rad);
  const p2x = midX + 30 * Math.cos(rad);
  const p2y = midY + 30 * Math.sin(rad);
  const zig = "M -30,0 L-25,-10 L-15,10 L-5,-10 L5,10 L15,-10 L25,10 L30,0";

  return [
    `<line x1="${comp.pinA.x}" y1="${comp.pinA.y}" x2="${p1x}" y2="${p1y}" />`,
    `<g transform="rotate(${(comp.rotation ?? 0) + (Math.atan2(comp.pinB.y - comp.pinA.y, comp.pinB.x - comp.pinA.x) * 180) / Math.PI}, ${midX}, ${midY})">`,
    `<path d="${zig}" transform="translate(${midX},${midY})" />`,
    `</g>`,
    `<line x1="${p2x}" y1="${p2y}" x2="${comp.pinB.x}" y2="${comp.pinB.y}" />`,
  ].join("\n");
}

function renderCapacitor(comp: ComponentInstance): string {
  const { midX, midY, rad, totalAngle } = getGeometry(comp);
  const p1x = midX - 8 * Math.cos(rad);
  const p1y = midY - 8 * Math.sin(rad);
  const p2x = midX + 8 * Math.cos(rad);
  const p2y = midY + 8 * Math.sin(rad);

  return [
    `<line x1="${comp.pinA.x}" y1="${comp.pinA.y}" x2="${p1x}" y2="${p1y}" />`,
    `<g transform="rotate(${totalAngle}, ${midX}, ${midY})">`,
    `<line x1="${midX - 8}" y1="${midY - 12}" x2="${midX - 8}" y2="${midY + 12}" />`,
    `<line x1="${midX + 8}" y1="${midY - 12}" x2="${midX + 8}" y2="${midY + 12}" />`,
    `</g>`,
    `<line x1="${p2x}" y1="${p2y}" x2="${comp.pinB.x}" y2="${comp.pinB.y}" />`,
  ].join("\n");
}

function renderInductor(comp: ComponentInstance): string {
  const { midX, midY, rad, totalAngle } = getGeometry(comp);
  const leftLeadX = midX - 24;
  const rightLeadX = midX + 24;
  const startCoil = {
    x: (leftLeadX - midX) * Math.cos(rad) + midX,
    y: (leftLeadX - midX) * Math.sin(rad) + midY,
  };
  const endCoil = {
    x: (rightLeadX - midX) * Math.cos(rad) + midX,
    y: (rightLeadX - midX) * Math.sin(rad) + midY,
  };

  return [
    `<line x1="${comp.pinA.x}" y1="${comp.pinA.y}" x2="${startCoil.x}" y2="${startCoil.y}" />`,
    `<g transform="rotate(${totalAngle}, ${midX}, ${midY})">`,
    `<line x1="${midX - 30}" y1="${midY}" x2="${midX - 24}" y2="${midY}" />`,
    `<path d="M ${midX - 24} ${midY} a 6 6 0 0 1 12 0" />`,
    `<path d="M ${midX - 12} ${midY} a 6 6 0 0 1 12 0" />`,
    `<path d="M ${midX} ${midY} a 6 6 0 0 1 12 0" />`,
    `<path d="M ${midX + 12} ${midY} a 6 6 0 0 1 12 0" />`,
    `<line x1="${midX + 24}" y1="${midY}" x2="${midX + 30}" y2="${midY}" />`,
    `</g>`,
    `<line x1="${endCoil.x}" y1="${endCoil.y}" x2="${comp.pinB.x}" y2="${comp.pinB.y}" />`,
  ].join("\n");
}

function renderWire(comp: ComponentInstance): string {
  return `<line x1="${comp.pinA.x}" y1="${comp.pinA.y}" x2="${comp.pinB.x}" y2="${comp.pinB.y}" />`;
}

function renderVoltageSource(comp: ComponentInstance): string {
  const { midX, midY, rad, totalAngle } = getGeometry(comp);
  const radius = 14;
  const p1x = midX - radius * Math.cos(rad);
  const p1y = midY - radius * Math.sin(rad);
  const p2x = midX + radius * Math.cos(rad);
  const p2y = midY + radius * Math.sin(rad);

  return [
    `<line x1="${comp.pinA.x}" y1="${comp.pinA.y}" x2="${p1x}" y2="${p1y}" />`,
    `<g transform="rotate(${totalAngle}, ${midX}, ${midY})">`,
    `<circle cx="${midX}" cy="${midY}" r="${radius}" />`,
    `<line x1="${midX - 5.5}" y1="${midY - 4.5}" x2="${midX - 5.5}" y2="${midY + 4.5}" />`,
    `<line x1="${midX - 9.5}" y1="${midY}" x2="${midX - 1.5}" y2="${midY}" />`,
    `<line x1="${midX + 3.5}" y1="${midY}" x2="${midX + 10}" y2="${midY}" />`,
    `</g>`,
    `<line x1="${p2x}" y1="${p2y}" x2="${comp.pinB.x}" y2="${comp.pinB.y}" />`,
  ].join("\n");
}

function renderCurrentSource(comp: ComponentInstance): string {
  const { midX, midY, rad, totalAngle } = getGeometry(comp);
  const radius = 14;
  const p1x = midX - radius * Math.cos(rad);
  const p1y = midY - radius * Math.sin(rad);
  const p2x = midX + radius * Math.cos(rad);
  const p2y = midY + radius * Math.sin(rad);

  return [
    `<line x1="${comp.pinA.x}" y1="${comp.pinA.y}" x2="${p1x}" y2="${p1y}" />`,
    `<g transform="rotate(${totalAngle}, ${midX}, ${midY})">`,
    `<circle cx="${midX}" cy="${midY}" r="${radius}" />`,
    `<line x1="${midX - 6.5}" y1="${midY}" x2="${midX + 5.5}" y2="${midY}" />`,
    `<path d="M ${midX + 5.5} ${midY} L ${midX + 1.5} ${midY - 3.5} L ${midX + 1.5} ${midY + 3.5} Z" fill="black" />`,
    `</g>`,
    `<line x1="${p2x}" y1="${p2y}" x2="${comp.pinB.x}" y2="${comp.pinB.y}" />`,
  ].join("\n");
}

function renderLabel(comp: ComponentInstance): string {
  if (!comp.label) return "";
  const { midX, midY, totalAngle } = getGeometry(comp);
  const y = midY - 18;
  return `<text x="${midX}" y="${y}" text-anchor="middle" font-size="13" transform="rotate(${totalAngle}, ${midX}, ${midY})">${esc(comp.label)}</text>`;
}

export function buildCircuitSvg(components: ComponentInstance[]): string {
  const b = getBounds(components);
  const margin = 60;
  const width = Math.max(280, b.maxX - b.minX + margin * 2);
  const height = Math.max(220, b.maxY - b.minY + margin * 2);
  const vx = b.minX - margin;
  const vy = b.minY - margin;

  const bodies = components.map((comp) => {
    if (comp.type === "wire") return renderWire(comp);
    if (comp.type === "resistor") return renderResistor(comp);
    if (comp.type === "capacitor") return renderCapacitor(comp);
    if (comp.type === "inductor") return renderInductor(comp);
    if (comp.type === "voltage_source") return renderVoltageSource(comp);
    if (comp.type === "current_source") return renderCurrentSource(comp);
    return "";
  });

  const labels = components.map(renderLabel).filter(Boolean);

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${width} ${height}" width="${Math.round(width)}" height="${Math.round(height)}">`,
    `<rect x="${vx}" y="${vy}" width="${width}" height="${height}" fill="white" />`,
    `<g fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">`,
    ...bodies,
    `</g>`,
    `<g fill="black" stroke="none" font-family="Arial, Helvetica, sans-serif" font-weight="700">`,
    ...labels,
    `</g>`,
    `</svg>`,
  ].join("\n");
}
