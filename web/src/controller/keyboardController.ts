/**
 * Global keyboard shortcut controller for the editor canvas.
 * Handles tool-specific shortcuts and scene shortcuts while respecting
 * inspector focus lock to avoid hijacking form input interactions.
 */

import type { CanvasManager } from "./canvasController";

function isInspectorKeyboardLocked(): boolean {
  return (window as any).__inspectorKeyboardLock === true;
}

export function setupKeyboardShortcuts(canvas: CanvasManager) {
  window.addEventListener("keydown", (e) => {
    if (isInspectorKeyboardLocked()) return;
    const tool = (window as any).currentTool;
    if (tool === "wire" && e.key === "Escape") {
      canvas.clearDraftWire?.();
      e.preventDefault();
      return;
    }

    const preview = canvas.previewComponent;

    /* ----------  Preview-specific shortcuts ---------- */
    if (preview) {
      // Space: rotate selected preview by 45deg (disabled placeholder).
      if (e.code === "Space") {
        e.preventDefault();
        return;
      }

      // Escape: cancel preview.
      if (e.key === "Escape") {
        canvas.setPreviewComponent(null);
        // Also clear focus if a sidebar element was active.
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }
    }

    /* ----------  Scene shortcuts (no preview) ---------- */
    if (!preview) {
      // Space: rotate all selected components by 45deg.
      if (e.code === "Space") {
        e.preventDefault();
        canvas.rotateSelected?.(45);
        return;
      }

      // Backspace/Delete: remove selected components.
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault(); // Prevent browser navigation/back action.
        canvas.removeSelected?.();
        return;
      }

      // Ctrl/Cmd shortcuts.
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();

        if (k === "z") {
          e.preventDefault();
          canvas.undo?.();
          return;
        }

        // On many mac layouts Cmd+Shift+Z is redo; keep Ctrl+Y as well
        if (k === "y" || (e.shiftKey && k === "z")) {
          e.preventDefault();
          canvas.redo?.();
          return;
        }

        if (k === "a") {
          e.preventDefault(); // Prevent browser select-all.
          canvas.selectAll?.();
          return;
        }
      }
    }
  });
}
