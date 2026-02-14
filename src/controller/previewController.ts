/**
 * Preview state controller shared across the editor.
 * Stores the currently previewed component and notifies subscribers.
 */

import type { ComponentInstance } from "../circuit-library/componentsInstance";

type Listener = (comp: ComponentInstance | null) => void;

let preview: ComponentInstance | null = null;
const listeners: Listener[] = [];

/**
 * Replace the current preview component.
 * Pass `null` to clear the preview.
 */
export function setPreviewComponent(comp: ComponentInstance | null): void {
  preview = comp;
  // Notify all listeners about the new preview value.
  listeners.forEach((l) => l(preview));
}

/** Read‑only getter for the current preview component. */
export function getPreviewComponent(): ComponentInstance | null {
  return preview;
}

/**
 * Subscribe to preview changes.  
 * Returns an unsubscribe function that you **must** call in a cleanup.
 */
export function subscribePreview(listener: Listener): () => void {
  listeners.push(listener);
  // Immediately emit current value so subscribers start in sync.
  listener(preview);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}
import { useEffect, useState } from "react";

/** React-friendly hook for reading preview state. */
export function usePreviewComponent(): ComponentInstance | null {
  const [preview, setPreview] = useState<ComponentInstance | null>(() => getPreviewComponent());

  useEffect(() => {
    return subscribePreview(setPreview);
  }, []);

  return preview;
}

import type { CanvasManager } from "./canvasController";

export function setupGrid(canvasController: CanvasManager) {
  if ((window as any).__gridSetupBound) return;
  (window as any).__gridSetupBound = true;

  document.addEventListener("click", (evt) => {
    const target = evt.target as HTMLElement | null;
    const item = target?.closest(".component-item") as HTMLElement | null;
    if (!item) return;

    const canvas = document.querySelector("svg");
    if (!canvas) return;

    // If wire mode is active, switch back to pointer before preview placement.
    const isWire = (window as any).currentTool === "wire";
    if (isWire) {
      window.canvasController?.setWireMode(false);
      const pointerBtn = document.querySelector("li.tool.pointer.toggle") as HTMLElement | null;
      pointerBtn?.click();
    }

    const type = item.getAttribute("data-type");
    if (!type) return;

    const controller = canvasController;
    const { x, y } = controller.snapToGrid(1000000, 1000000);
    setPreviewComponent({
      id: "preview",
      type,
      pinA: { x: x - 50, y },
      pinB: { x: x + 50, y },
      rotation: preview?.rotation ?? 0
    });

    let lastSnap = { x: NaN, y: NaN };

    const onMouseMove = (e: MouseEvent) => {
      const svg = canvas as SVGSVGElement;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const svgPoint = pt.matrixTransform(matrix.inverse());
      const snap = controller.snapToGrid(svgPoint.x, svgPoint.y);

      const prev = getPreviewComponent();
      if (!prev) return;

      if (snap.x !== lastSnap.x || snap.y !== lastSnap.y) {
        const cx = snap.x;
        const cy = snap.y;
        const dx = (prev.pinB.x - prev.pinA.x) / 2;
        const dy = (prev.pinB.y - prev.pinA.y) / 2;

        setPreviewComponent({
          ...prev,
          pinA: { x: cx - dx, y: cy - dy },
          pinB: { x: cx + dx, y: cy + dy },
        });

        lastSnap = snap;
      }
    };

    const onClick = () => {
      const comp = getPreviewComponent();
      if (comp) {
        controller.addComponent?.({
          ...comp,
          id: String(Date.now())
        });
        setPreviewComponent(null);
      }
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if ((window as any).__inspectorKeyboardLock === true) return;
      if (e.key === "Escape") {
        setPreviewComponent(null);
        canvas.removeEventListener("mousemove", onMouseMove);
        canvas.removeEventListener("click", onClick);
        document.removeEventListener("keydown", onKeyDown);
      }
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick, { once: true });
    document.addEventListener("keydown", onKeyDown);
  });
}

/**
 * Starts an interactive preview for a cloned component.
 * The clone is offset by 20px, follows the mouse, and is placed on click.
 */
export function startPreviewFromComponent(original: ComponentInstance, canvasController: CanvasManager): void {
  const offset = 5;
  const clone: ComponentInstance = {
    ...original,
    id: crypto.randomUUID(),
    pinA: { x: original.pinA.x + offset, y: original.pinA.y + offset },
    pinB: { x: original.pinB.x + offset, y: original.pinB.y + offset },
    rotation: original.rotation,
  };
  setPreviewComponent(clone);

  const canvasEl = document.querySelector("svg");
  if (!canvasEl) return;

  const ctrl = canvasController;
  let lastSnap = { x: NaN, y: NaN };

  const onMouseMove = (e: MouseEvent) => {
    const svg = canvasEl as SVGSVGElement;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const svgPoint = pt.matrixTransform(matrix.inverse());
    const snap = ctrl.snapToGrid(svgPoint.x, svgPoint.y);

    const prev = getPreviewComponent();
    if (!prev) return;

    if (snap.x !== lastSnap.x || snap.y !== lastSnap.y) {
      const cx = snap.x;
      const cy = snap.y;
      const dx = (prev.pinB.x - prev.pinA.x) / 2;
      const dy = (prev.pinB.y - prev.pinA.y) / 2;
      setPreviewComponent({
        ...prev,
        pinA: { x: cx - dx, y: cy - dy },
        pinB: { x: cx + dx, y: cy + dy },
        rotation: prev.rotation,
      });
      lastSnap = snap;
    }
  };

  const onClick = () => {
    const comp = getPreviewComponent();
    if (comp) {
      ctrl.addComponent?.({ ...comp, id: String(Date.now()) });
      setPreviewComponent(null);
    }
    canvasEl.removeEventListener("mousemove", onMouseMove);
    canvasEl.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKeyDown);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if ((window as any).__inspectorKeyboardLock === true) return;
    if (e.key === "Escape") {
      setPreviewComponent(null);
      canvasEl.removeEventListener("mousemove", onMouseMove);
      canvasEl.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    }
  };

  canvasEl.addEventListener("mousemove", onMouseMove);
  canvasEl.addEventListener("click", onClick, { once: true });
  document.addEventListener("keydown", onKeyDown);
}
