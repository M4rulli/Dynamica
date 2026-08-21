const APP_BASE = import.meta.env.BASE_URL;

/** Resolve a project-relative URL for both local Vite and GitHub Pages. */
export function appPath(path = ""): string {
  return `${APP_BASE}${path.replace(/^\/+/, "")}`;
}
