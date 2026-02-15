/**
 * Navbar composition and behavior controller.
 *
 * This file wires together:
 * - collapsible menu groups,
 * - theme and grid controls,
 * - export and auxiliary actions loaded from static HTML.
 */

import { loadSettingsPanel } from "./settingsController";
import { bindExportControls } from "./exportController";

function bindExpandableMenus(): void {
  document.querySelectorAll<HTMLInputElement>(".nav-toggle-checkbox").forEach((input) => {
    const container = input.closest(".nav-button.expandable") as HTMLElement | null;
    const submenu = container?.querySelector(".submenu") as HTMLElement | null;
    const icon = container?.querySelector(".expand-icon") as HTMLElement | null;

    if (!container || !submenu) return;

    const syncState = (checked: boolean, animate: boolean) => {
      container.classList.toggle("active", checked);
      icon?.classList.toggle("rotated", checked);

      if (!animate) {
        submenu.style.height = checked ? "auto" : "0px";
        submenu.style.overflow = checked ? "" : "hidden";
        return;
      }

      if (checked) {
        submenu.style.overflow = "hidden";
        submenu.style.height = submenu.scrollHeight + "px";
        const onOpenEnd = () => {
          submenu.style.height = "auto";
          submenu.style.overflow = "";
          submenu.removeEventListener("transitionend", onOpenEnd);
        };
        submenu.addEventListener("transitionend", onOpenEnd);
      } else {
        submenu.style.overflow = "hidden";
        const currentHeight = submenu.scrollHeight;
        submenu.style.height = currentHeight + "px";
        requestAnimationFrame(() => {
          submenu.style.height = "0px";
        });
      }
    };

    syncState(input.checked, false);
    input.addEventListener("change", () => syncState(input.checked, true));
  });
}

function bindThemeToggle(): void {
  const toggle = document.getElementById("theme-toggle") as HTMLInputElement | null;
  if (!toggle) return;

  const saved = localStorage.getItem("theme");
  document.body.classList.remove("dark-theme", "light-theme");

  if (saved === "dark") {
    document.body.classList.add("dark-theme");
    toggle.checked = true;
  } else {
    document.body.classList.add("light-theme");
    toggle.checked = false;
  }

  toggle.addEventListener("change", () => {
    document.body.classList.remove("dark-theme", "light-theme");

    if (toggle.checked) {
      document.body.classList.add("dark-theme");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.add("light-theme");
      localStorage.setItem("theme", "light");
    }

    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("theme-change"));
    });
  });
}

function bindGridControls(): void {
  const toggle = document.getElementById("grid-toggle") as HTMLInputElement | null;
  const cellSize = document.getElementById("grid-cell-size") as HTMLInputElement | null;
  const subdivision = document.getElementById("grid-subdivision") as HTMLInputElement | null;
  if (!toggle || !cellSize || !subdivision) return;

  const apply = () => {
    const controller = (window as Window & { canvasController?: { setGridConfig?: (cfg: { enabled?: boolean; size?: number; subdivisions?: number }) => void } }).canvasController;
    controller?.setGridConfig?.({
      enabled: toggle.checked,
      size: Number(cellSize.value),
      subdivisions: Number(subdivision.value),
    });
  };

  toggle.addEventListener("change", apply);
  cellSize.addEventListener("input", apply);
  subdivision.addEventListener("input", apply);
  window.addEventListener("canvas-controller-ready", apply);

  apply();
}

function bindSidebarCollapseToggle(): void {
  const navBar = document.getElementById("nav-bar");
  const button = document.getElementById("sidebar-collapse-btn") as HTMLButtonElement | null;
  if (!navBar || !button) return;

  const savedCollapsed = localStorage.getItem("sidebar-collapsed") === "1";
  navBar.classList.toggle("collapsed", savedCollapsed);
  button.setAttribute("aria-pressed", savedCollapsed ? "true" : "false");

  button.addEventListener("click", () => {
    const nextCollapsed = !navBar.classList.contains("collapsed");
    navBar.classList.toggle("collapsed", nextCollapsed);
    button.setAttribute("aria-pressed", nextCollapsed ? "true" : "false");
    localStorage.setItem("sidebar-collapsed", nextCollapsed ? "1" : "0");
  });
}

function bindDummyFileActions(): void {
  const importBtn = document.getElementById("import-circuit-btn") as HTMLButtonElement | null;
  const saveBtn = document.getElementById("save-circuit-btn") as HTMLButtonElement | null;
  if (importBtn) {
    importBtn.addEventListener("click", () => {
      // Dummy placeholder requested by product spec.
    });
  }
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      // Dummy placeholder requested by product spec.
    });
  }
}

function bindDummyLanguageToggle(): void {
  const toggleBtn = document.getElementById("language-toggle-btn") as HTMLButtonElement | null;
  const flag = document.getElementById("language-flag") as HTMLImageElement | null;
  if (!toggleBtn || !flag) return;

  const STORAGE_KEY = "ui-language-dummy";
  const applyFlag = (lang: "it" | "en") => {
    flag.src = lang === "it" ? "/flags/it.svg" : "/flags/gb.svg";
    toggleBtn.setAttribute("aria-label", lang === "it" ? "Lingua selezionata Italiano (dummy)" : "Lingua selezionata English (dummy)");
  };

  const saved = localStorage.getItem(STORAGE_KEY);
  const initial: "it" | "en" = saved === "en" ? "en" : "it";
  applyFlag(initial);

  toggleBtn.addEventListener("click", () => {
    const current = localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "it";
    const next: "it" | "en" = current === "it" ? "en" : "it";
    localStorage.setItem(STORAGE_KEY, next);
    applyFlag(next);
  });
}

export async function loadNavbar() {
  const res = await fetch("/static/navbar.html");
  const html = await res.text();
  const target = document.getElementById("nav-bar");
  if (!target) return;

  target.innerHTML = html;

  const electricalTarget = document.getElementById("component-library-electrical");
  if (electricalTarget) {
    const gridRes = await fetch("/static/grid.html");
    electricalTarget.innerHTML = await gridRes.text();
  }

  bindSidebarCollapseToggle();
  bindExpandableMenus();
  bindGridControls();
  bindExportControls();
  bindDummyFileActions();
  bindDummyLanguageToggle();

  const expandSettingsInput = document.getElementById("expand-settings") as HTMLInputElement | null;
  if (expandSettingsInput) {
    expandSettingsInput.addEventListener("change", () => {
      if (expandSettingsInput.checked) {
        loadSettingsPanel();
      }
    });
  }

  bindThemeToggle();
}
