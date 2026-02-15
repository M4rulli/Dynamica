/**
 * Component inspector controller.
 *
 * Provides a focused editing surface for the selected component and keeps
 * keyboard shortcuts isolated when form fields are active.
 */

import type { ComponentInstance } from "../circuit-library/componentsInstance";

type InspectorEventDetail = { component: ComponentInstance | null };

type CanvasApi = {
  updateComponent?: (id: string, patch: Partial<ComponentInstance>) => void;
  getComponentById?: (id: string) => ComponentInstance | null;
};

function normalizeTypeLabel(type: string): string {
  if (type === "resistor") return "Resistore";
  if (type === "capacitor") return "Condensatore";
  if (type === "inductor") return "Induttore";
  if (type === "voltage_source") return "Generatore di Tensione";
  if (type === "current_source") return "Generatore di Corrente";
  return type;
}

function isInspectableComponent(comp: ComponentInstance | null): comp is ComponentInstance {
  return !!comp && comp.type !== "wire";
}

function getUnitByType(type: string): string {
  if (type === "resistor") return "Ω";
  if (type === "capacitor") return "F";
  if (type === "inductor") return "H";
  if (type === "voltage_source") return "V";
  if (type === "current_source") return "A";
  return "";
}

function sanitizeNumericInput(raw: string): string {
  const normalized = raw.replace(",", ".");
  let out = "";
  let dotUsed = false;
  for (const ch of normalized) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
      continue;
    }
    if (ch === "." && !dotUsed) {
      out += ch;
      dotUsed = true;
    }
  }
  return out;
}

export async function loadComponentInspector() {
  const res = await fetch("/static/component-inspector.html");
  const html = await res.text();
  const mount = document.getElementById("component-inspector");
  if (!mount) return;

  mount.innerHTML = html;

  const panelRoot = document.getElementById("component-inspector");
  const collapseButton = document.getElementById("component-inspector-toggle") as HTMLButtonElement | null;
  const typeEl = document.getElementById("inspector-type") as HTMLElement | null;
  const formEl = document.getElementById("inspector-form") as HTMLFormElement | null;
  const valueLabel = document.getElementById("inspector-value-label") as HTMLElement | null;
  const valueField = document.getElementById("inspector-value-field") as HTMLElement | null;
  const labelInput = document.getElementById("inspector-label") as HTMLInputElement | null;
  const valueInput = document.getElementById("inspector-value") as HTMLInputElement | null;
  const currentInput = document.getElementById("inspector-current") as HTMLInputElement | null;
  const voltageInput = document.getElementById("inspector-voltage") as HTMLInputElement | null;
  const currentField = document.getElementById("inspector-current-field") as HTMLElement | null;
  const voltageField = document.getElementById("inspector-voltage-field") as HTMLElement | null;
  const unitEl = document.getElementById("inspector-unit") as HTMLElement | null;
  const currentUnknownInput = document.getElementById("inspector-current-unknown") as HTMLInputElement | null;
  const voltageUnknownInput = document.getElementById("inspector-voltage-unknown") as HTMLInputElement | null;

  if (
    !panelRoot ||
    !collapseButton ||
    !typeEl ||
    !formEl ||
    !valueLabel ||
    !valueField ||
    !labelInput ||
    !valueInput ||
    !currentInput ||
    !voltageInput ||
    !currentField ||
    !voltageField ||
    !unitEl ||
    !currentUnknownInput ||
    !voltageUnknownInput
  ) return;

  const applyCollapsedState = (collapsed: boolean) => {
    panelRoot.classList.toggle("collapsed", collapsed);
    collapseButton.setAttribute("aria-pressed", collapsed ? "true" : "false");
    localStorage.setItem("component-inspector-collapsed", collapsed ? "1" : "0");
  };

  applyCollapsedState(localStorage.getItem("component-inspector-collapsed") === "1");

  collapseButton.addEventListener("click", () => {
    const next = !panelRoot.classList.contains("collapsed");
    applyCollapsedState(next);
  });

  let currentComponentId: string | null = null;
  let currentComponentType: string | null = null;
  (window as any).__inspectorKeyboardLock = false;

  const syncKeyboardLock = () => {
    const active = document.activeElement as HTMLElement | null;
    const lock =
      !!active &&
      panelRoot.contains(active) &&
      (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || active.isContentEditable);
    (window as any).__inspectorKeyboardLock = lock;
    window.dispatchEvent(new CustomEvent("inspector-keyboard-lock-change", { detail: { locked: lock } }));
  };

  panelRoot.addEventListener("focusin", syncKeyboardLock);
  panelRoot.addEventListener("focusout", () => {
    window.setTimeout(syncKeyboardLock, 0);
  });

  const renderComponent = (comp: ComponentInstance | null) => {
    if (!isInspectableComponent(comp)) {
      currentComponentId = null;
      currentComponentType = null;
      typeEl.textContent = "Nessuna selezione";
      formEl.hidden = true;
      return;
    }

    currentComponentId = comp.id;
    currentComponentType = comp.type;
    typeEl.textContent = normalizeTypeLabel(comp.type);
    const isVoltageSource = comp.type === "voltage_source";
    const isCurrentSource = comp.type === "current_source";
    const sourceType = isVoltageSource || isCurrentSource;

    valueLabel.textContent = "Valore";
    unitEl.textContent = getUnitByType(comp.type);
    valueField.hidden = sourceType;
    valueField.style.display = sourceType ? "none" : "";
    valueInput.disabled = sourceType;
    currentField.hidden = false;
    voltageField.hidden = false;
    formEl.hidden = false;

    if (document.activeElement !== labelInput || labelInput.value !== (comp.label ?? "")) {
      labelInput.value = comp.label ?? "";
    }
    const valueText = sourceType ? "" : (comp.value ?? "");
    if (document.activeElement !== valueInput || valueInput.value !== valueText) {
      valueInput.value = valueText;
    }
    if (document.activeElement !== currentInput || currentInput.value !== (comp.current ?? "")) {
      currentInput.value = comp.current ?? "";
    }
    if (document.activeElement !== voltageInput || voltageInput.value !== (comp.voltage ?? "")) {
      voltageInput.value = comp.voltage ?? "";
    }

    let currentUnknown = typeof comp.currentUnknown === "boolean" ? comp.currentUnknown : true;
    let voltageUnknown = typeof comp.voltageUnknown === "boolean" ? comp.voltageUnknown : true;
    if (sourceType && currentUnknown === voltageUnknown) {
      if (isVoltageSource) {
        currentUnknown = true;
        voltageUnknown = false;
      } else if (isCurrentSource) {
        currentUnknown = false;
        voltageUnknown = true;
      }
    }
    currentUnknownInput.checked = currentUnknown;
    voltageUnknownInput.checked = voltageUnknown;
    currentInput.disabled = currentUnknown;
    voltageInput.disabled = voltageUnknown;
  };

  const applyPatch = (patch: Partial<ComponentInstance>) => {
    if (!currentComponentId) return;
    const controller = (window as Window & { canvasController?: CanvasApi }).canvasController;
    controller?.updateComponent?.(currentComponentId, patch);
  };

  labelInput.addEventListener("input", () => {
    applyPatch({ label: labelInput.value.trim() });
  });

  valueInput.addEventListener("input", () => {
    if (currentComponentType === "voltage_source" || currentComponentType === "current_source") {
      valueInput.value = "";
      return;
    }
    const sanitized = sanitizeNumericInput(valueInput.value);
    if (valueInput.value !== sanitized) valueInput.value = sanitized;
    applyPatch({ value: sanitized });
  });

  currentInput.addEventListener("input", () => {
    const sanitized = sanitizeNumericInput(currentInput.value);
    if (currentInput.value !== sanitized) currentInput.value = sanitized;
    applyPatch({ current: sanitized });
  });

  voltageInput.addEventListener("input", () => {
    const sanitized = sanitizeNumericInput(voltageInput.value);
    if (voltageInput.value !== sanitized) voltageInput.value = sanitized;
    applyPatch({ voltage: sanitized });
  });

  currentUnknownInput.addEventListener("change", () => {
    const unknown = currentUnknownInput.checked;
    const isSource = currentComponentType === "voltage_source" || currentComponentType === "current_source";
    if (isSource) {
      let nextCurrentUnknown = unknown;
      let nextVoltageUnknown = voltageUnknownInput.checked;
      if (nextCurrentUnknown) {
        nextVoltageUnknown = false;
      } else if (!nextVoltageUnknown) {
        nextVoltageUnknown = true;
      }
      currentUnknownInput.checked = nextCurrentUnknown;
      voltageUnknownInput.checked = nextVoltageUnknown;
      currentInput.disabled = nextCurrentUnknown;
      voltageInput.disabled = nextVoltageUnknown;
      if (nextCurrentUnknown && currentInput.value !== "") currentInput.value = "";
      if (nextVoltageUnknown && voltageInput.value !== "") voltageInput.value = "";
      applyPatch({
        currentUnknown: nextCurrentUnknown,
        voltageUnknown: nextVoltageUnknown,
        current: nextCurrentUnknown ? "" : sanitizeNumericInput(currentInput.value),
        voltage: nextVoltageUnknown ? "" : sanitizeNumericInput(voltageInput.value),
      });
      return;
    }
    currentInput.disabled = unknown;
    if (unknown && currentInput.value !== "") {
      currentInput.value = "";
      applyPatch({ currentUnknown: true, current: "" });
      return;
    }
    applyPatch({ currentUnknown: unknown });
  });

  voltageUnknownInput.addEventListener("change", () => {
    const unknown = voltageUnknownInput.checked;
    const isSource = currentComponentType === "voltage_source" || currentComponentType === "current_source";
    if (isSource) {
      let nextVoltageUnknown = unknown;
      let nextCurrentUnknown = currentUnknownInput.checked;
      if (nextVoltageUnknown) {
        nextCurrentUnknown = false;
      } else if (!nextCurrentUnknown) {
        nextCurrentUnknown = true;
      }
      voltageUnknownInput.checked = nextVoltageUnknown;
      currentUnknownInput.checked = nextCurrentUnknown;
      voltageInput.disabled = nextVoltageUnknown;
      currentInput.disabled = nextCurrentUnknown;
      if (nextVoltageUnknown && voltageInput.value !== "") voltageInput.value = "";
      if (nextCurrentUnknown && currentInput.value !== "") currentInput.value = "";
      applyPatch({
        voltageUnknown: nextVoltageUnknown,
        currentUnknown: nextCurrentUnknown,
        voltage: nextVoltageUnknown ? "" : sanitizeNumericInput(voltageInput.value),
        current: nextCurrentUnknown ? "" : sanitizeNumericInput(currentInput.value),
      });
      return;
    }
    voltageInput.disabled = unknown;
    if (unknown && voltageInput.value !== "") {
      voltageInput.value = "";
      applyPatch({ voltageUnknown: true, voltage: "" });
      return;
    }
    applyPatch({ voltageUnknown: unknown });
  });

  window.addEventListener("canvas-selection-change", (evt) => {
    const detail = (evt as CustomEvent<InspectorEventDetail>).detail;
    renderComponent(detail?.component ?? null);
  });

  const initialController = (window as Window & { canvasController?: CanvasApi }).canvasController;
  if (initialController?.getComponentById && currentComponentId) {
    renderComponent(initialController.getComponentById(currentComponentId));
  } else {
    renderComponent(null);
  }
  syncKeyboardLock();
}
