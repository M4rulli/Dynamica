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

export function Inductor({ pinA, pinB, startDrag, setPinA, setPinB, selected, onSelect, onDragStart, activePin, rotation }: Props) {
  const { angle, midX, midY } = getGeometry(pinA, pinB);
  const totalAngle = angle + (rotation ?? 0);

  const leftLeadX = midX - 24;
  const rightLeadX = midX + 24;
  const rad = (totalAngle * Math.PI) / 180;
  const startCoil = {
    x: (leftLeadX - midX) * Math.cos(rad) + midX,
    y: (leftLeadX - midX) * Math.sin(rad) + midY,
  };
  const endCoil = {
    x: (rightLeadX - midX) * Math.cos(rad) + midX,
    y: (rightLeadX - midX) * Math.sin(rad) + midY,
  };

  return (
    <>
      <line
        x1={pinA.x}
        y1={pinA.y}
        x2={startCoil.x}
        y2={startCoil.y}
        stroke="currentColor"
        strokeWidth={1}
      />

      <g transform={`rotate(${totalAngle}, ${midX}, ${midY})`} className={selected ? "selected" : undefined}>
        <rect
          x={midX - 30}
          y={midY - 12}
          width={60}
          height={24}
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

        <line x1={midX - 30} y1={midY} x2={midX - 24} y2={midY} stroke="currentColor" strokeWidth={1} />
        <path d={`M ${midX - 24} ${midY} a 6 6 0 0 1 12 0`} fill="none" stroke="currentColor" strokeWidth={1.4} />
        <path d={`M ${midX - 12} ${midY} a 6 6 0 0 1 12 0`} fill="none" stroke="currentColor" strokeWidth={1.4} />
        <path d={`M ${midX} ${midY} a 6 6 0 0 1 12 0`} fill="none" stroke="currentColor" strokeWidth={1.4} />
        <path d={`M ${midX + 12} ${midY} a 6 6 0 0 1 12 0`} fill="none" stroke="currentColor" strokeWidth={1.4} />
        <line x1={midX + 24} y1={midY} x2={midX + 30} y2={midY} stroke="currentColor" strokeWidth={1} />
      </g>

      <line
        x1={endCoil.x}
        y1={endCoil.y}
        x2={pinB.x}
        y2={pinB.y}
        stroke="currentColor"
        strokeWidth={1}
      />

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
