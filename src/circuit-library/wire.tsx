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
}

export function Wire({
  pinA,
  pinB,
  startDrag,
  setPinA,
  setPinB,
  selected,
  onSelect,
  onDragStart,
  activePin,
}: Props) {
  return (
    <>
      <line
        x1={pinA.x}
        y1={pinA.y}
        x2={pinB.x}
        y2={pinB.y}
        stroke="currentColor"
        strokeWidth={1}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onDragStart(e);
        }}
        className={selected ? "selected" : ""}
      />
      <circle
        cx={pinA.x}
        cy={pinA.y}
        r={2}
        className={`terminal ${activePin === "pinA" ? "active" : ""} ${selected ? "visible" : ""}`}
        onMouseDown={startDrag(setPinA, "pinA")}
      />
      <circle
        cx={pinB.x}
        cy={pinB.y}
        r={2}
        className={`terminal ${activePin === "pinB" ? "active" : ""} ${selected ? "visible" : ""}`}
        onMouseDown={startDrag(setPinB, "pinB")}
      />
    </>
  );
}