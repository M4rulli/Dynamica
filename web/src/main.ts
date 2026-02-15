// src/main.ts
// Frontend bootstrap:
// - mounts the React canvas,
// - loads static UI shells (navbar/toolbar/inspector),
// - wires shared controllers once canvas API is ready.
import React from "react";
import { createRoot } from "react-dom/client";
import CircuitCanvas from "./controller/canvasController";
import { loadNavbar } from "./controller/navbarController";
import { loadToolbar } from "./controller/toolbarController";
import { loadComponentInspector } from "./controller/componentInspectorController";
import { setupGrid } from "./controller/previewController";
import { setupKeyboardShortcuts } from "./controller/keyboardController";
import { loadAnalysisControls } from "./controller/analysisController";

const saved = localStorage.getItem("theme");
document.body.classList.remove("dark-theme", "light-theme");
if (saved === "dark") {
  document.body.classList.add("dark-theme");
} else if (saved === "light") {
  document.body.classList.add("light-theme");
}

window.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("canvas-container");
  if (container) {
    const root = createRoot(container);
    root.render(React.createElement(CircuitCanvas));
    const interval = setInterval(() => {
      if ((window as any).canvasController) {
        setupGrid((window as any).canvasController);
        setupKeyboardShortcuts((window as any).canvasController);
        clearInterval(interval);
      }
    }, 100);
  }
  void loadNavbar().then(() => {
    loadAnalysisControls();
  });
  loadToolbar();
  loadComponentInspector();
});
