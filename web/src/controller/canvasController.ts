/**
 * Core circuit canvas controller (React component).
 *
 * Owns circuit state, interaction modes, selection lifecycle, persistence,
 * and exposes an imperative `window.canvasController` API used by external
 * shell controllers (toolbar/navbar/analysis/export).
 */

import React, { useState, useEffect, useRef } from "react";
import { subscribePreview } from "../controller/previewController";
import { startPreviewFromComponent } from "./previewController";
// import { setupKeyboardShortcuts } from "./keyboardController"; // Removed as per instructions
import type { ComponentInstance } from "../circuit-library/componentsInstance";
import { componentMap } from "../circuit-library/componentsInstance";

const CIRCUIT_STORAGE_KEY = "circuit-components-v1";

declare global {
  interface Window {
    canvasController?: CanvasManager;
  }
}

export type CanvasManager = {
  setPreviewComponent: (comp: ComponentInstance | null) => void;
  addComponent: (c: ComponentInstance) => void;
  updateComponent: (id: string, patch: Partial<ComponentInstance>) => void;
  getComponentById: (id: string) => ComponentInstance | null;
  getAllComponents: () => ComponentInstance[];
  getViewBox: () => { x: number; y: number; width: number; height: number };
  snapToGrid: (x: number, y: number) => { x: number; y: number };
  readonly previewComponent: ComponentInstance | null;
  selectAll: () => void;
  undo: () => void;
  redo: () => void;
  // rotatePreview: (delta: number) => void; // Removed from type as well
  rotateSelected: (delta: number) => void;
  removeSelected: () => void;
  clearDraftWire: () => void;
  setWireMode: (active: boolean) => void;
  setCloneMode: (active: boolean) => void;
  setEraseMode: (active: boolean) => void;
  clearCircuit: () => void;
  cloneSelectedComponent: () => void;
  setGridConfig?: (cfg: { enabled?: boolean; size?: number; subdivisions?: number }) => void;
};

function getLabelPrefix(type: string): string | null {
  if (type === "resistor") return "R";
  if (type === "capacitor") return "C";
  if (type === "inductor") return "L";
  if (type === "voltage_source") return "V";
  if (type === "current_source") return "I";
  return null;
}

function buildLabeledComponent(c: ComponentInstance, existing: ComponentInstance[]): ComponentInstance {
  const prefix = getLabelPrefix(c.type);
  if (!prefix) return c;

  const usedLabels = new Set(existing.map((comp) => comp.label).filter(Boolean) as string[]);
  if (c.label) {
    const ownMatch = c.label.match(/^([A-Z])(\d+)$/);
    if (ownMatch && ownMatch[1] === prefix && !usedLabels.has(c.label)) {
      return c;
    }
  }

  const maxIndex = existing.reduce((max, comp) => {
    if (!comp.label) return max;
    const match = comp.label.match(/^([A-Z])(\d+)$/);
    if (!match) return max;
    if (match[1] !== prefix) return max;
    return Math.max(max, Number(match[2]));
  }, 0);

  const isVoltageSource = c.type === "voltage_source";
  const isCurrentSource = c.type === "current_source";
  const isPassive = c.type === "resistor" || c.type === "capacitor" || c.type === "inductor";
  const currentUnknownRaw = typeof c.currentUnknown === "boolean" ? c.currentUnknown : true;
  const voltageUnknownRaw = typeof c.voltageUnknown === "boolean" ? c.voltageUnknown : true;
  const sourceUnknowns =
    isVoltageSource
      ? { currentUnknown: currentUnknownRaw === voltageUnknownRaw ? true : currentUnknownRaw, voltageUnknown: currentUnknownRaw === voltageUnknownRaw ? false : voltageUnknownRaw }
      : isCurrentSource
        ? { currentUnknown: currentUnknownRaw === voltageUnknownRaw ? false : currentUnknownRaw, voltageUnknown: currentUnknownRaw === voltageUnknownRaw ? true : voltageUnknownRaw }
        : { currentUnknown: currentUnknownRaw, voltageUnknown: voltageUnknownRaw };

  return {
    ...c,
    label: `${prefix}${maxIndex + 1}`,
    valueUnknown: isPassive ? (typeof c.valueUnknown === "boolean" ? c.valueUnknown : false) : undefined,
    value: isPassive ? (c.value ?? "") : undefined,
    current: c.current ?? "",
    currentUnknown: sourceUnknowns.currentUnknown,
    voltage: c.voltage ?? "",
    voltageUnknown: sourceUnknowns.voltageUnknown,
    sourceDirection: c.sourceDirection ?? "a_to_b",
    sourcePolarity: isVoltageSource ? (c.sourcePolarity ?? "a_positive") : c.sourcePolarity,
  };
}

function labelToTex(label: string | undefined): string {
  if (!label) return "";
  const match = label.match(/^([A-Z])(\d+)$/);
  if (!match) return label;
  return `${match[1]}_{${match[2]}}`;
}

function getComponentVisualGeometry(comp: ComponentInstance): { centerX: number; centerY: number; totalAngle: number } {
  const centerX = (comp.pinA.x + comp.pinB.x) / 2;
  const centerY = (comp.pinA.y + comp.pinB.y) / 2;
  const dx = comp.pinB.x - comp.pinA.x;
  const dy = comp.pinB.y - comp.pinA.y;
  const baseAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const totalAngle = baseAngle + (comp.rotation ?? 0);
  return { centerX, centerY, totalAngle };
}

export default function CircuitCanvas() {
  const [gridEnabled, setGridEnabled] = useState(true);
  const [gridSize, setGridSize] = useState(8);
  const [subdivisions, setSubdivisions] = useState(5);
  // Wire drawing mode state
  const [wireMode, setWireMode] = useState(false);
  const [cloneMode, setCloneMode] = useState(false);
  const [eraseMode, setEraseMode] = useState(false);
  const [draftWire, setDraftWire] = useState<{ pinA: { x: number; y: number }; pinB: { x: number; y: number } } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);
  // Smooth viewport panning via arrow keys.
  const pressedKeys = new Set<string>();
  const panSpeed = 2;
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 1000, height: 1000 });
  const [previewComponent, setPreviewComponent] = useState<{
    id: string;
    type: string;
    pinA: { x: number; y: number };
    pinB: { x: number; y: number };
    rotation?: number;
  } | null>(null);



  useEffect(() => {
    const unsubscribe = subscribePreview(setPreviewComponent);
    return () => unsubscribe();
  }, []);

  const [components, setComponents] = useState<ComponentInstance[]>([]);
  const hasLoadedPersistedComponentsRef = useRef(false);
  const componentsRef = React.useRef<ComponentInstance[]>([]);
  useEffect(() => {
    componentsRef.current = components;
  }, [components]);
  const [undoStack, setUndoStack] = useState<ComponentInstance[][]>([]);
  const [redoStack, setRedoStack] = useState<ComponentInstance[][]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CIRCUIT_STORAGE_KEY);
      if (!raw) {
        hasLoadedPersistedComponentsRef.current = true;
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        hasLoadedPersistedComponentsRef.current = true;
        return;
      }

      const isPoint = (p: unknown): p is { x: number; y: number } =>
        !!p &&
        typeof p === "object" &&
        typeof (p as { x?: unknown }).x === "number" &&
        typeof (p as { y?: unknown }).y === "number";

      const sanitized = parsed.filter((c): c is ComponentInstance => {
        if (!c || typeof c !== "object") return false;
        const comp = c as Partial<ComponentInstance>;
        return (
          typeof comp.id === "string" &&
          typeof comp.type === "string" &&
          isPoint(comp.pinA) &&
          isPoint(comp.pinB)
        );
      });

      setComponents(sanitized.map((c) => ({ ...c })));
    } catch (e) {
      console.error("Invalid persisted circuit in localStorage:", e);
    } finally {
      hasLoadedPersistedComponentsRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedPersistedComponentsRef.current) return;
    try {
      localStorage.setItem(CIRCUIT_STORAGE_KEY, JSON.stringify(components));
    } catch (e) {
      console.error("Unable to persist circuit in localStorage:", e);
    }
  }, [components]);

  // Push an undo snapshot of the current components
  const pushUndo = () => {
    const snapshot = componentsRef.current.map(c => ({ ...c }));
    setUndoStack(prev => [...prev, snapshot]);
  };

  useEffect(() => {
    const saved = localStorage.getItem("canvasViewBox");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.x === "number" && typeof parsed.y === "number" &&
            typeof parsed.width === "number" && typeof parsed.height === "number") {
          setViewBox(parsed);
        }
      } catch (e) {
        console.error("Invalid viewBox in localStorage:", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("canvasViewBox", JSON.stringify(viewBox));
  }, [viewBox]);

  const [gridScale] = useState(1);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const skipNextCanvasClickRef = useRef(false);
  const mathLabelCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const cacheHost = document.createElement("div");
    cacheHost.id = "mathjax-label-cache";
    cacheHost.style.position = "fixed";
    cacheHost.style.left = "-99999px";
    cacheHost.style.top = "-99999px";
    cacheHost.style.opacity = "0";
    cacheHost.style.pointerEvents = "none";

    const keys: string[] = [];
    const prefixes = ["R", "C", "L", "V", "I"];
    for (const p of prefixes) {
      for (let i = 1; i <= 300; i++) {
        keys.push(`${p}${i}`);
      }
    }

    cacheHost.innerHTML = keys
      .map((key) => `<span class="pre-math-label" data-label="${key}">\\(${labelToTex(key)}\\)</span>`)
      .join("");
    document.body.appendChild(cacheHost);

    let canceled = false;
    let pollId: number | null = null;

    const hydrateCache = () => {
      const mj = (window as any).MathJax;
      if (!mj) return false;
      const nodes = Array.from(cacheHost.querySelectorAll(".pre-math-label")) as HTMLElement[];
      if (nodes.length === 0) return true;

      const onDone = () => {
        if (canceled) return;
        nodes.forEach((node) => {
          const key = node.dataset.label;
          if (!key) return;
          mathLabelCacheRef.current.set(key, node.innerHTML);
        });
      };

      if (typeof mj.typesetPromise === "function") {
        void mj.typesetPromise(nodes).then(onDone);
      } else if (typeof mj.typeset === "function") {
        mj.typeset(nodes);
        onDone();
      }
      return true;
    };

    if (!hydrateCache()) {
      pollId = window.setInterval(() => {
        if (hydrateCache() && pollId !== null) {
          window.clearInterval(pollId);
          pollId = null;
        }
      }, 120);
    }

    return () => {
      canceled = true;
      if (pollId !== null) window.clearInterval(pollId);
      cacheHost.remove();
    };
  }, []);

  useEffect(() => {
    const handler = () => {};
    window.addEventListener("theme-change", handler);
    return () => window.removeEventListener("theme-change", handler);
  }, []);

  useEffect(() => {
    const selected =
      selectedIds.length === 1
        ? components.find((c) => c.id === selectedIds[0]) ?? null
        : null;
    window.dispatchEvent(
      new CustomEvent("canvas-selection-change", {
        detail: { component: selected ? { ...selected } : null },
      })
    );
  }, [components, selectedIds]);

  useEffect(() => {
    const isInspectorKeyboardLocked = () => (window as any).__inspectorKeyboardLock === true;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInspectorKeyboardLocked()) return;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        pressedKeys.add(e.key);
      }
      if ((e.key === "c" || e.key === "C") && !e.repeat) {
        window.canvasController?.cloneSelectedComponent?.();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeys.delete(e.key);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    let rafId: number;
    const step = () => {
      if (isInspectorKeyboardLocked()) {
        pressedKeys.clear();
        rafId = requestAnimationFrame(step);
        return;
      }
      if (pressedKeys.size > 0) {
        setViewBox(vb => {
          let dx = 0, dy = 0;
          if (pressedKeys.has("ArrowLeft")) dx -= panSpeed;
          if (pressedKeys.has("ArrowRight")) dx += panSpeed;
          if (pressedKeys.has("ArrowUp")) dy -= panSpeed;
          if (pressedKeys.has("ArrowDown")) dy += panSpeed;
          return { ...vb, x: vb.x + dx, y: vb.y + dy };
        });
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement)?.closest("#nav-bar")) return;
      e.preventDefault();
      const scale = e.deltaY < 0 ? 1 / 1.05 : 1.05;
      const newWidth = viewBox.width * scale;
      const newHeight = viewBox.height * scale;
      const dx = (newWidth - viewBox.width) / 2;
      const dy = (newHeight - viewBox.height) / 2;
      setViewBox(vb => ({
        x: vb.x - dx,
        y: vb.y - dy,
        width: newWidth,
        height: newHeight,
      }));
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [viewBox]);

  const snapToGrid = (x: number, y: number) => {
    const step = Math.max(1, gridSize);
    return {
      x: Math.round(x / step) * step,
      y: Math.round(y / step) * step,
    };
  };

  const startDrag = (setFn: (p: { x: number; y: number }) => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    const onMove = (ev: MouseEvent) => {
      // --- wire mode preview logic ---
      if (wireMode && draftWire) {
        const svg = document.querySelector("svg") as SVGSVGElement | null;
        if (!svg) return;
        const pt = svg.createSVGPoint();
        pt.x = ev.clientX;
        pt.y = ev.clientY;
        const matrix = svg.getScreenCTM();
        if (!matrix) return;
        const svgPoint = pt.matrixTransform(matrix.inverse());
        setDraftWire(prev => prev ? { ...prev, pinB: snapToGrid(svgPoint.x, svgPoint.y) } : null);
      }
      // original drag logic
      const svg = document.querySelector("svg") as SVGSVGElement | null;
      if (!svg) return;
      const pt = svg.createSVGPoint();
      pt.x = ev.clientX;
      pt.y = ev.clientY;
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const svgPoint = pt.matrixTransform(matrix.inverse());
      setFn(snapToGrid(svgPoint.x, svgPoint.y));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };


  // Drag all selected components together
  const startDragSelectedComponents = (e: React.MouseEvent) => {
    e.stopPropagation();
    const svg = document.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const start = pt.matrixTransform(matrix.inverse());

    // Get all selected components
    const selectedComps = components.filter(c => selectedIds.includes(c.id));
    if (selectedComps.length === 0) return;

    // Store initial centers for each selected component
    const centers = selectedComps.map(c => ({
      id: c.id,
      centerX: (c.pinA.x + c.pinB.x) / 2,
      centerY: (c.pinA.y + c.pinB.y) / 2,
      pinA: { ...c.pinA },
      pinB: { ...c.pinB },
    }));

    document.body.style.cursor = "grabbing";
    pushUndo();
    const onMove = (ev: MouseEvent) => {
      const svg = document.querySelector("svg") as SVGSVGElement | null;
      if (!svg) return;
      const pt = svg.createSVGPoint();
      pt.x = ev.clientX;
      pt.y = ev.clientY;
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const svgPoint = pt.matrixTransform(matrix.inverse());

      // Compute dx/dy based on the first selected component's original center
      const { centerX, centerY } = centers[0];
      const offsetX = centerX - start.x;
      const offsetY = centerY - start.y;
      const dx = svgPoint.x + offsetX - centerX;
      const dy = svgPoint.y + offsetY - centerY;

      setComponents(prev =>
        prev.map(c => {
          if (!selectedIds.includes(c.id)) return c;
          // Find original pins for this component
          const orig = centers.find(cc => cc.id === c.id);
          if (!orig) return c;
          return {
            ...c,
            pinA: snapToGrid(orig.pinA.x + dx, orig.pinA.y + dy),
            pinB: snapToGrid(orig.pinB.x + dx, orig.pinB.y + dy),
          };
        })
      );
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "default";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };


  useEffect(() => {
    (window as any).canvasController = {
      setPreviewComponent,
      addComponent: (c: ComponentInstance) => {
        pushUndo();
        setComponents(prev => [...prev, buildLabeledComponent(c, prev)]);
      },
      updateComponent: (id: string, patch: Partial<ComponentInstance>) => {
        setComponents((prev) =>
          prev.map((comp) => (comp.id === id ? { ...comp, ...patch } : comp))
        );
      },
      getComponentById: (id: string) => {
        const comp = componentsRef.current.find((c) => c.id === id);
        return comp ? { ...comp } : null;
      },
      getAllComponents: () => componentsRef.current.map((c) => ({ ...c })),
      getViewBox: () => ({ ...viewBox }),
      snapToGrid,
      get previewComponent() {
        return previewComponent;
      },
      // ---- selection helpers ----
      selectAll: () => {
        setSelectedIds(() => componentsRef.current.map(c => c.id));
      },
      removeSelected: () => {
        setSelectedIds(currentSel => {
          if (currentSel.length === 0) return currentSel;
          pushUndo();
          setComponents(cs => cs.filter(c => !currentSel.includes(c.id)));
          return [];
        });
      },
      // ---- rotate helpers ----
      // rotatePreview: (delta: number) => {
      //   setPreviewComponent(prev =>
      //     prev ? { ...prev, rotation: (prev.rotation ?? 0) + delta } : null
      //   );
      // }, // Removed as per instructions
      rotateSelected: (delta: number) => {
        setSelectedIds(currentSel => {
          if (currentSel.length === 0) return currentSel;
          pushUndo();
          setComponents(cs =>
            cs.map(c =>
              currentSel.includes(c.id)
                ? (() => {
                    const cx = (c.pinA.x + c.pinB.x) / 2;
                    const cy = (c.pinA.y + c.pinB.y) / 2;
                    const rad = (delta * Math.PI) / 180;
                    const rotatePoint = (p: { x: number; y: number }) => {
                      const dx = p.x - cx;
                      const dy = p.y - cy;
                      return {
                        x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
                        y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
                      };
                    };
                    return {
                      ...c,
                      pinA: rotatePoint(c.pinA),
                      pinB: rotatePoint(c.pinB),
                    };
                  })()
                : c
            )
          );
          return currentSel;
        });
      },
      // ---- undo/redo ----
      undo: () => {
        if (undoStack.length === 0) return;
        const last = undoStack[undoStack.length - 1];
        setRedoStack(prev => [components.map(c => ({ ...c })), ...prev]);
        setUndoStack(prev => prev.slice(0, -1));
        setComponents(last);
      },
      redo: () => {
        setRedoStack(prev => {
          if (prev.length === 0) return prev;
          const [head, ...rest] = prev;
          setUndoStack(u => [...u, componentsRef.current]);
          setComponents(head);
          return rest;
        });
      },
      setWireMode: (active: boolean) => {
        setWireMode(active);
        if (active) {
          setCloneMode(false);
          setEraseMode(false);
        }
        if (active) {
          setSelectedIds([]);
        }
      },
      setCloneMode: (active: boolean) => {
        setCloneMode(active);
        if (active) {
          setWireMode(false);
          setEraseMode(false);
          setDraftWire(null);
        }
      },
      setEraseMode: (active: boolean) => {
        setEraseMode(active);
        if (active) {
          setWireMode(false);
          setCloneMode(false);
          setDraftWire(null);
          setSelectedIds([]);
        }
      },
      clearCircuit: () => {
        if (componentsRef.current.length === 0) return;
        pushUndo();
        setComponents([]);
        setSelectedIds([]);
      },
      clearDraftWire: () => {
        setDraftWire(null);
      },
      cloneSelectedComponent: () => {
        if (selectedIds.length !== 1) return;
        const original = componentsRef.current.find(c => c.id === selectedIds[0]);
        if (!original) return;

        setSelectedIds([]);
        startPreviewFromComponent(original, window.canvasController as CanvasManager);
      },
      setGridConfig: (cfg: { enabled?: boolean; size?: number; subdivisions?: number }) => {
        if (typeof cfg.enabled === "boolean") setGridEnabled(cfg.enabled);
        if (typeof cfg.size === "number" && !Number.isNaN(cfg.size)) {
          setGridSize(Math.max(1, Math.round(cfg.size)));
        }
        if (typeof cfg.subdivisions === "number" && !Number.isNaN(cfg.subdivisions)) {
          setSubdivisions(Math.max(1, Math.round(cfg.subdivisions)));
        }
      },
      zoomToFit: () => {
        if (componentsRef.current.length === 0) return;

        const allPoints: { x: number; y: number }[] = [];
        componentsRef.current.forEach(c => {
          const rad = ((c.rotation ?? 0) * Math.PI) / 180;
          const cx = (c.pinA.x + c.pinB.x) / 2;
          const cy = (c.pinA.y + c.pinB.y) / 2;
          const rotate = (p: { x: number; y: number }) => {
            const dx = p.x - cx;
            const dy = p.y - cy;
            return {
              x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
              y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
            };
          };
          allPoints.push(rotate(c.pinA), rotate(c.pinB));
        });

        let minX = Math.min(...allPoints.map(p => p.x));
        let maxX = Math.max(...allPoints.map(p => p.x));
        let minY = Math.min(...allPoints.map(p => p.y));
        let maxY = Math.max(...allPoints.map(p => p.y));

        const margin = 100;
        minX -= margin;
        minY -= margin;
        maxX += margin;
        maxY += margin;

        setViewBox({
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        });
      },
      // Debug getters
      get undoStack() { return undoStack; },
      get redoStack() { return redoStack; },
    };
    window.dispatchEvent(new CustomEvent("canvas-controller-ready"));
    // setupKeyboardShortcuts(window.canvasController as CanvasManager); // Removed as per instructions
  }, [components, selectedIds, previewComponent, undoStack, redoStack]);

  // --- wire mode mousemove preview (if you want it decoupled from drag logic) ---
  useEffect(() => {
    if (!wireMode || !draftWire) return;
    const onMove = (ev: MouseEvent) => {
      const svg = document.querySelector("svg") as SVGSVGElement | null;
      if (!svg) return;
      const pt = svg.createSVGPoint();
      pt.x = ev.clientX;
      pt.y = ev.clientY;
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const svgPoint = pt.matrixTransform(matrix.inverse());
      setDraftWire(prev => prev ? { ...prev, pinB: snapToGrid(svgPoint.x, svgPoint.y) } : null);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [wireMode, draftWire]);

  // --- wire mode ESC key clears wire preview ---
  useEffect(() => {
    if (!wireMode || !draftWire) return;
    const isInspectorKeyboardLocked = () => (window as any).__inspectorKeyboardLock === true;
    const handleEsc = (e: KeyboardEvent) => {
      if (isInspectorKeyboardLocked()) return;
      if (e.key === "Escape") {
        setDraftWire(null);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [wireMode, draftWire]);

  useEffect(() => {
    if (!wireMode || draftWire) return;
    const onMove = (e: MouseEvent) => {
      const svg = document.querySelector("svg") as SVGSVGElement | null;
      if (!svg) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const svgPoint = pt.matrixTransform(matrix.inverse());
      setMousePos(snapToGrid(svgPoint.x, svgPoint.y));
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [wireMode, draftWire]);

  // --- Compute junction points ---
  const junctions = (() => {
    const pinMap = new Map<string, number>();
    componentsRef.current.forEach(comp => {
      const pins = [comp.pinA, comp.pinB];
      pins.forEach(({ x, y }) => {
        const key = `${x},${y}`;
        pinMap.set(key, (pinMap.get(key) || 0) + 1);
      });
    });
    return [...pinMap.entries()]
      .filter(([_, count]) => count >= 3)
      .map(([key]) => {
        const [x, y] = key.split(",").map(Number);
        return { x, y };
      });
  })();

  const safeSubdivisions = Math.max(1, subdivisions);
  const minorStep = Math.max(1, gridSize);
  const majorStep = Math.max(1, gridSize * safeSubdivisions);

  return React.createElement(
    "svg",
    {
      width: "100%",
      height: "100%",
      viewBox: `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`,
      style: {
        backgroundColor: "var(--canvas-background)",
        cursor: wireMode ? "crosshair" : eraseMode ? "not-allowed" : cloneMode ? "copy" : (selectedIds.length > 0 ? "default" : "auto"),
        userSelect: "none",
        WebkitUserSelect: "none",
        caretColor: "transparent"
      },
      tabIndex: 0,
      onMouseDown: (e: React.MouseEvent) => {
        if (wireMode || cloneMode || eraseMode) return;
        if ((window as any).currentTool && (window as any).currentTool !== "pointer") return;
        if (e.button !== 0) return;
        const svg = e.currentTarget as SVGSVGElement;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const matrix = svg.getScreenCTM();
        if (!matrix) return;
        const start = pt.matrixTransform(matrix.inverse());
        setSelectionBox({ x1: start.x, y1: start.y, x2: start.x, y2: start.y });

        const onMove = (ev: MouseEvent) => {
          const ptMove = svg.createSVGPoint();
          ptMove.x = ev.clientX;
          ptMove.y = ev.clientY;
          const m = svg.getScreenCTM();
          if (!m) return;
          const cur = ptMove.matrixTransform(m.inverse());
          setSelectionBox((prev) => (prev ? { ...prev, x2: cur.x, y2: cur.y } : prev));
        };

        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          setSelectionBox((box) => {
            if (!box) return null;
            const minX = Math.min(box.x1, box.x2);
            const maxX = Math.max(box.x1, box.x2);
            const minY = Math.min(box.y1, box.y2);
            const maxY = Math.max(box.y1, box.y2);
            const hasArea = (maxX - minX) > 6 && (maxY - minY) > 6;
            if (hasArea) {
              const ids = componentsRef.current
                .filter((c) => {
                  const cx = (c.pinA.x + c.pinB.x) / 2;
                  const cy = (c.pinA.y + c.pinB.y) / 2;
                  return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY;
                })
                .map((c) => c.id);
              setSelectedIds(ids);
              skipNextCanvasClickRef.current = true;
            }
            return null;
          });
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      },
      onClick: (e) => {
        if (skipNextCanvasClickRef.current) {
          skipNextCanvasClickRef.current = false;
          return;
        }
        if (wireMode) {
          const svg = e.currentTarget as SVGSVGElement;
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const matrix = svg.getScreenCTM();
          if (!matrix) return;
          const svgPoint = pt.matrixTransform(matrix.inverse());
          const snapped = snapToGrid(svgPoint.x, svgPoint.y);

          if (!draftWire) {
            setDraftWire({ pinA: snapped, pinB: snapped });
          } else {
            // Confirm and add the wire to the circuit.
            const newId = crypto.randomUUID();
            const newWire: ComponentInstance = {
              id: newId,
              type: "wire",
              pinA: draftWire.pinA,
              pinB: snapped,
            };
            pushUndo();
            setComponents(prev => [...prev, newWire]);
            setDraftWire(null);
          }
          return;
        }
        setPreviewComponent(null);
        setSelectedIds([]);
      },
      // onMouseDown removed
    },
    React.createElement(
      "defs",
      null,
      React.createElement(
        "pattern",
        {
          id: "grid-minor",
          width: minorStep,
          height: minorStep,
          patternUnits: "userSpaceOnUse",
          patternTransform: `scale(${gridScale})`
        },
        React.createElement("path", { d: `M ${minorStep} 0 L 0 0 0 ${minorStep}`, fill: "none", stroke: "var(--grid-minor)", strokeWidth: 0.5 })
      ),
      React.createElement(
        "pattern",
        {
          id: "grid-major",
          width: majorStep,
          height: majorStep,
          patternUnits: "userSpaceOnUse",
          patternTransform: `scale(${gridScale})`
        },
        React.createElement("rect", { width: majorStep, height: majorStep, fill: "url(#grid-minor)" }),
        React.createElement("path", { d: `M ${majorStep} 0 L 0 0 0 ${majorStep}`, fill: "none", stroke: "var(--grid-major)", strokeWidth: 1 })
      )
    ),
    React.createElement("rect", {
      x: -50000,
      y: -50000,
      width: 100000,
      height: 100000,
      fill: "var(--canvas-background)"
    }),
    gridEnabled && React.createElement("rect", {
      x: -50000,
      y: -50000,
      width: 100000,
      height: 100000,
      fill: "url(#grid-major)",
      style: { backgroundColor: "var(--canvas-background)" }
    }),


    // Render components: first non-selected, then selected
    (() => {
      const orderedComponents = [
        ...components.filter(c => !selectedIds.includes(c.id)),
        ...components.filter(c => selectedIds.includes(c.id)),
      ];
      return orderedComponents.map((comp) => {
        const Comp = componentMap[comp.type as keyof typeof componentMap];
        if (!Comp) return null;
        const { centerX, centerY, totalAngle } = getComponentVisualGeometry(comp);
        const labelOffset = 28;
        const labelAngle = (totalAngle * Math.PI) / 180;
        const labelCenterX = centerX + labelOffset * Math.sin(labelAngle);
        const labelCenterY = centerY - labelOffset * Math.cos(labelAngle);
        const cachedMathLabel = comp.label ? mathLabelCacheRef.current.get(comp.label) : undefined;
        const commonProps: {
          pinA: { x: number; y: number };
          pinB: { x: number; y: number };
          setPinA: (p: { x: number; y: number }) => void;
          setPinB: (p: { x: number; y: number }) => void;
          startDrag: (setFn: (p: { x: number; y: number }) => void) => (e: React.MouseEvent) => void;
          selected: boolean;
          onSelect: () => void;
          onDragStart: (e: React.MouseEvent) => void;
          activePin: null;
          rotation: number | undefined;
        } = {
          pinA: comp.pinA,
          pinB: comp.pinB,
          setPinA: (p: { x: number; y: number }) => {
            pushUndo();
            setComponents(prev =>
              prev.map(c => c.id === comp.id ? { ...c, pinA: p } : c)
            );
          },
          setPinB: (p: { x: number; y: number }) => {
            pushUndo();
            setComponents(prev =>
              prev.map(c => c.id === comp.id ? { ...c, pinB: p } : c)
            );
          },
          startDrag,
          selected: selectedIds.includes(comp.id),
          onSelect: () => {
            if (eraseMode) {
              pushUndo();
              setComponents((prev) => prev.filter((c) => c.id !== comp.id));
              setSelectedIds((prev) => prev.filter((id) => id !== comp.id));
              return;
            }
            if (cloneMode) {
              setSelectedIds([]);
              startPreviewFromComponent(comp, window.canvasController as CanvasManager);
              return;
            }
            if (!wireMode) setSelectedIds([comp.id]);
          },
          onDragStart: startDragSelectedComponents,
          activePin: null,
          rotation: comp.rotation,
        };
        // Wrap each component in a <g data-comp-id={comp.id}> group
        return React.createElement(
          "g",
          { key: comp.id, "data-comp-id": comp.id },
          React.createElement(Comp, { ...commonProps }),
          comp.label
            ? React.createElement(
                "g",
                null,
                React.createElement(
                  "foreignObject",
                  {
                    x: labelCenterX - 30,
                    y: labelCenterY - 12,
                    width: 60,
                    height: 24,
                    className: "math-label-host",
                    style: { pointerEvents: "none", overflow: "visible" },
                  },
                  cachedMathLabel
                    ? React.createElement("div", {
                        className: "component-math-label",
                        style: {
                          width: "60px",
                          textAlign: "center",
                          fontSize: "13px",
                          lineHeight: "1",
                          color: "var(--color)",
                          pointerEvents: "none",
                          userSelect: "none",
                        },
                        dangerouslySetInnerHTML: { __html: cachedMathLabel },
                      })
                    : React.createElement(
                        "div",
                        {
                          className: "component-math-label component-math-label--plain",
                          style: {
                            width: "60px",
                            textAlign: "center",
                            fontSize: "13px",
                            lineHeight: "1",
                            color: "var(--color)",
                            pointerEvents: "none",
                            userSelect: "none",
                          },
                        },
                        comp.label
                      )
                )
              )
            : null
        );
      });
    })()
    ,
    previewComponent && (() => {
      const PreviewComp = componentMap[previewComponent.type as keyof typeof componentMap];
      if (!PreviewComp) return null;
      const previewProps = {
        pinA: previewComponent.pinA,
        pinB: previewComponent.pinB,
        setPinA: (p: { x: number; y: number }) =>
          setPreviewComponent(prev => (prev ? { ...prev, pinA: p } : null)),
        setPinB: (p: { x: number; y: number }) =>
          setPreviewComponent(prev => (prev ? { ...prev, pinB: p } : null)),
        startDrag,
        selected: false,
        onSelect: () => {},
        onDragStart: () => {},
        activePin: null,
        rotation: previewComponent.rotation,
      };
      return React.createElement("g", { opacity: 0.5, key: "previewWrapper" },
        React.createElement(PreviewComp, { key: "preview", ...previewProps })
      );
    })(),
    wireMode && !draftWire && mousePos &&
      React.createElement("circle", {
        cx: mousePos.x,
        cy: mousePos.y,
        r: 3,
        fill: "red",
        opacity: 0.4,
        pointerEvents: "none"
      }),
    draftWire &&
      React.createElement(
        "g",
        { opacity: 0.25 },
        React.createElement(componentMap["wire"], {
          pinA: draftWire.pinA,
          pinB: draftWire.pinB,
          setPinA: () => {},
          setPinB: () => {},
          startDrag: () => () => {},
          selected: false,
          onSelect: () => {},
          onDragStart: () => {},
          activePin: null,
        })
      ),
    selectionBox &&
      React.createElement("rect", {
        x: Math.min(selectionBox.x1, selectionBox.x2),
        y: Math.min(selectionBox.y1, selectionBox.y2),
        width: Math.abs(selectionBox.x2 - selectionBox.x1),
        height: Math.abs(selectionBox.y2 - selectionBox.y1),
        fill: "rgba(56, 189, 248, 0.14)",
        stroke: "rgba(56, 189, 248, 0.9)",
        strokeDasharray: "5 4",
        pointerEvents: "none",
      }),
    // --- Render junction points ---
    ...junctions.map((j, i) =>
      React.createElement("circle", {
        key: `junction-${i}`,
        cx: j.x,
        cy: j.y,
        r: 2,
        fill: "black"
      })
    )
  );
}
