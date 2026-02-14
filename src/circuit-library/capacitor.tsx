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

export function Capacitor({ pinA, pinB, startDrag, setPinA, setPinB, selected, onSelect, onDragStart, activePin, rotation }: Props) {
  const { angle, midX, midY } = getGeometry(pinA, pinB);
  const totalAngle = angle + (rotation ?? 0);

  return (
    <>
      <line
        x1={pinA.x}
        y1={pinA.y}
        x2={midX - 8 * Math.cos((totalAngle * Math.PI) / 180)}
        y2={midY - 8 * Math.sin((totalAngle * Math.PI) / 180)}
        stroke="currentColor"
        strokeWidth={1}
      />
      <g transform={`rotate(${totalAngle}, ${midX}, ${midY})`} className={selected ? "selected" : undefined}>
        <rect
          x={midX - 12}
          y={midY - 14}
          width={24}
          height={28}
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
        <line x1={midX - 8} y1={midY - 12} x2={midX - 8} y2={midY + 12} stroke="currentColor" strokeWidth={1.6} />
        <line x1={midX + 8} y1={midY - 12} x2={midX + 8} y2={midY + 12} stroke="currentColor" strokeWidth={1.6} />
      </g>
      <line
        x1={midX + 8 * Math.cos((totalAngle * Math.PI) / 180)}
        y1={midY + 8 * Math.sin((totalAngle * Math.PI) / 180)}
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
