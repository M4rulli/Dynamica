import React from "react";

interface Props {
  pinA: { x: number; y: number };
  pinB: { x: number; y: number };
  startDrag: (setFn: (p: { x: number; y: number }) => void, pin: "pinA" | "pinB") => (e: React.MouseEvent) => void;
  setPinA: (p: { x: number; y: number }) => void;
  setPinB: (p: { x: number; y: number }) => void;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  activePin: "pinA" | "pinB" | null;
  rotation?: number;
}

function getGeometry(pinA: { x: number; y: number }, pinB: { x: number; y: number }) {
  const dx = pinB.x - pinA.x;
  const dy = pinB.y - pinA.y;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const midX = (pinA.x + pinB.x) / 2;
  const midY = (pinA.y + pinB.y) / 2;
  return { angle, midX, midY };
}

export function VoltageSource({ pinA, pinB, startDrag, setPinA, setPinB, selected, onSelect, onDragStart, activePin, rotation }: Props) {
  const { angle, midX, midY } = getGeometry(pinA, pinB);
  const totalAngle = angle + (rotation ?? 0);
  const rad = (totalAngle * Math.PI) / 180;
  const radius = 14;
  const left = { x: midX - radius * Math.cos(rad), y: midY - radius * Math.sin(rad) };
  const right = { x: midX + radius * Math.cos(rad), y: midY + radius * Math.sin(rad) };

  return (
    <>
      <line x1={pinA.x} y1={pinA.y} x2={left.x} y2={left.y} stroke="currentColor" strokeWidth={1} />
      <g transform={`rotate(${totalAngle}, ${midX}, ${midY})`} className={selected ? "selected" : undefined}>
        <rect
          x={midX - 16}
          y={midY - 16}
          width={32}
          height={32}
          className="body-bbox"
          fillOpacity={0}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          onMouseDown={(e) => {
            if (!selected) return;
            e.stopPropagation();
            onDragStart(e);
          }}
        />
        <circle cx={midX} cy={midY} r={radius} fill="none" stroke="currentColor" strokeWidth={1.6} />
        <line x1={midX - 5.5} y1={midY - 4.5} x2={midX - 5.5} y2={midY + 4.5} stroke="currentColor" strokeWidth={1.3} />
        <line x1={midX - 9.5} y1={midY} x2={midX - 1.5} y2={midY} stroke="currentColor" strokeWidth={1.3} />
        <line x1={midX + 3.5} y1={midY} x2={midX + 10} y2={midY} stroke="currentColor" strokeWidth={1.3} />
      </g>
      <line x1={right.x} y1={right.y} x2={pinB.x} y2={pinB.y} stroke="currentColor" strokeWidth={1} />
      <circle
        cx={pinA.x}
        cy={pinA.y}
        r={2}
        className={`terminal ${activePin === "pinA" ? "active" : ""} ${selected ? "visible" : ""}`}
        onMouseDown={selected ? startDrag(setPinA, "pinA") : undefined}
      />
      <circle
        cx={pinB.x}
        cy={pinB.y}
        r={2}
        className={`terminal ${activePin === "pinB" ? "active" : ""} ${selected ? "visible" : ""}`}
        onMouseDown={selected ? startDrag(setPinB, "pinB") : undefined}
      />
    </>
  );
}
