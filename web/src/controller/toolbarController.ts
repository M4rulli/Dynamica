/**
 * Floating toolbar web component controller.
 * Handles tool selection, drag-to-move behavior, and key shortcuts.
 */

class Toolbar extends HTMLElement {
  currentColor: HTMLElement | null = null;
  colorWell: HTMLInputElement | null = null;
  constructor() {
    super();
  }
  connectedCallback() {
    const left = this.getAttribute("data-left") ?? "420px";
    const top = this.getAttribute("data-top") ?? "24px";

    this.innerHTML = `<menu id="Toolbar" style="position: absolute; left: ${left}; top: ${top};">
                        <li id="Grip" class="grip right-separator"><i class="bx bx-move"></i></li>
                        
                        <li class="active tool pointer toggle"><button title="Pointer"><span class="label">Pointer</span><i class="bx bx-pointer"></i></button></li>
                        
                        <li class="tool wire toggle" data-tool="wire">
                          <button title="Wire">
                            <span class="label">Wire</span>
                            <svg class="wire-icon" viewBox="0 0 24 24" width="24" height="24">
                              <circle cx="4" cy="20" r="2" fill="white" stroke="black" stroke-width="1.5" />
                              <circle cx="20" cy="4" r="2" fill="white" stroke="black" stroke-width="1.5" />
                              <line x1="5.5" y1="18.5" x2="18.5" y2="5.5" stroke="black" stroke-width="1.5" />
                            </svg>
                          </button>
                        </li>

                        <li class="tool clone toggle"><button title="Clone Mode"><span class="label">Clone</span><i class="bx bx-copy-alt"></i></button></li>
                         <li class="tool erase toggle right-separator"><button title="Delete Mode"><span class="label">Erase</span><i class="bx bx-eraser"></i></button></li>

                         <li class="tool center-view"><button title="Center View" id="center-view-btn"><span class="label">Center</span><i class="bx bx-scan"></i></button></li>
                         <li class="tool clear-circuit"><button title="Clear Circuit"><span class="label">Clear</span><i class="bx bx-trash-alt"></i></button></li>
                         </menu>`;

    this.setupDragAndDrop();
    this.setupButtons();
  }


  setupDragAndDrop() {
    const grip = this.querySelector("#Grip") as HTMLElement;
    grip.addEventListener("mousedown", this.drag);
  }

  setupButtons() {
    const isInspectorKeyboardLocked = () => (window as any).__inspectorKeyboardLock === true;
    const toggleButtons = this.querySelectorAll("li.toggle");

    toggleButtons.forEach((el) => {
      el.addEventListener("click", (evt: Event) => {
        evt.stopPropagation();
        this.toggleButton(evt);
        const toolEl = evt.currentTarget as HTMLElement;
        const toolType = toolEl.classList.contains("tool") ? toolEl.classList[1] : null;
        const controller = (window as any).canvasController;
        if (controller && typeof controller.setWireMode === "function") {
          controller.setWireMode(toolType === "wire");
        }
        if (controller && typeof controller.setCloneMode === "function") {
          controller.setCloneMode(toolType === "clone");
        }
        if (controller && typeof controller.setEraseMode === "function") {
          controller.setEraseMode(toolType === "erase");
        }
      });
    });

    // Wire tool: explicitly activate wire mode.
    const wireButton = this.querySelector(".tool.wire") as HTMLElement;
    wireButton?.addEventListener("click", () => {
      const controller = (window as any).canvasController;
      if (controller && typeof controller.setWireMode === "function") {
        controller.setWireMode(true);
      }
    });

    const cloneModeButton = this.querySelector(".tool.clone") as HTMLElement;
    cloneModeButton?.addEventListener("click", () => {
      const controller = (window as any).canvasController;
      controller?.setCloneMode?.(true);
    });

    const eraseModeButton = this.querySelector(".tool.erase") as HTMLElement;
    eraseModeButton?.addEventListener("click", () => {
      const controller = (window as any).canvasController;
      controller?.setEraseMode?.(true);
    });

    // Shortcut "W": toggle between wire and pointer.
    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (isInspectorKeyboardLocked()) return;
      if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        const currentTool = (window as any).currentTool;
        const pointerButton = this.querySelector(".tool.pointer") as HTMLElement;
        if (currentTool === "wire") {
          pointerButton?.click(); // Switch back to pointer mode.
        } else {
          wireButton?.click(); // Switch to wire mode.
        }
      }
    });

    const centerButton = this.querySelector("#center-view-btn");
    centerButton?.addEventListener("click", () => {
      const controller = (window as any).canvasController;
      if (controller?.zoomToFit) {
        controller.zoomToFit();
      }
    });
    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (isInspectorKeyboardLocked()) return;
      if ((e.key === "z" || e.key === "Z") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        (centerButton as HTMLElement)?.click();
      }
    });

    const clearCircuitButton = this.querySelector(".tool.clear-circuit button");
    clearCircuitButton?.addEventListener("click", () => {
      const controller = (window as any).canvasController;
      if (!controller) return;
      const ok = window.confirm("Vuoi davvero svuotare tutto il circuito?");
      if (!ok) return;
      controller?.clearCircuit?.();
    });
  }

  toggleButton(evt: Event) {
    const toggleButtons = this.querySelectorAll("li.toggle");
    toggleButtons.forEach((el) => {
      el.classList.remove("active");
    });

    if (evt.currentTarget) {
      (evt.currentTarget as HTMLElement).classList.add("active");
      // Update current tool based on clicked button classes.
      const toolEl = evt.currentTarget as HTMLElement;
      const toolType = toolEl.classList.contains("tool") ? toolEl.classList[1] : null;
      if (toolType) {
        (window as any).currentTool = toolType;
      }
    }
  }

  drag(event: MouseEvent) {
    const grip = document.querySelector("#Grip") as HTMLElement;
    const offsetX = grip.offsetWidth / 2;
    const offsetY = grip.offsetHeight / 2;
    const mouseMoveHandler = function (event: MouseEvent) {
      moveAt(event.pageX, event.pageY, offsetX, offsetY);
    };
    const moveAt = function(
      shiftX: number,
      shiftY: number,
      offsetX: number,
      offsetY: number
    ) {
      const newX = shiftX - offsetX;
      const newY = shiftY - offsetY;
      if (newX >= 0 && newY >= 0) {
        toolbar.style.left = newX + "px";
        toolbar.style.top = newY + "px";
      }
    };
    const toolbar = document.querySelector("#Toolbar") as HTMLElement;


    moveAt(event.pageX, event.pageY, offsetX, offsetY);

    document.addEventListener("mousemove", mouseMoveHandler);

    document.addEventListener("mouseup", () => {
      document.removeEventListener("mousemove", mouseMoveHandler);
      document.onmouseup = null;
    });

    toolbar.ondragstart = function () {
      return false;
    };
  }
}
customElements.define("floating-toolbar", Toolbar);

export async function loadToolbar() {
  if (document.querySelector("floating-toolbar")) return;
  const toolbar = document.createElement("floating-toolbar");

  toolbar.style.position = "fixed";
  document.body.appendChild(toolbar);
}
