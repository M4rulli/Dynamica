/**
 * Settings panel controller.
 * Auto-scrolls the sidebar settings section into view when expanded.
 */

export function loadSettingsPanel() {
  // Get the checkbox that controls the Settings menu expansion.
  const expandInput = document.getElementById("expand-settings") as HTMLInputElement | null;
  if (!expandInput || !expandInput.checked) return;

  // Find the settings grid container directly inside the submenu.
  const settingsGrid = document.querySelector(".settings-grid") as HTMLElement | null;
  if (!settingsGrid) return;

  const scrollToCenter = () => {
    const navContent = document.getElementById("nav-content");
    if (!navContent) return;

    let offset = 0;
    let el: HTMLElement | null = settingsGrid;
    while (el && el !== navContent) {
      offset += el.offsetTop;
      el = el.offsetParent as HTMLElement;
    }

    const centerPos = offset - (navContent.clientHeight / 2) + (settingsGrid.clientHeight / 2);
    navContent.scrollTo({ top: centerPos, behavior: "smooth" });
  };

  settingsGrid.addEventListener("transitionend", () => {
    scrollToCenter();
  }, { once: true });

  setTimeout(() => {
    scrollToCenter();
  }, 100); // Fallback if transitionend does not fire.
}
