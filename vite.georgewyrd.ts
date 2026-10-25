// georgewyrd fork only: point the app's help links at our own help page (public/help/index.html)
// instead of the upstream docs site. Done at build time so the ~20 upstream files that hold
// the links stay untouched and the weekly upstream sync merges cleanly.
import type { Plugin } from "vite";

const DOCS = /https:\/\/docs\.orbat-mapper\.app(?:\/[\w-]+)*\/?(?:#[\w-]*)?/g;

/** Sections of the help page; any other docs link lands on its top. */
export const HELP_SECTIONS = new Set([
  "getting-started",
  "map-edit-mode",
  "chart-edit-mode",
  "grid-edit-mode",
  "text-to-orbat",
  "import-data",
  "export-data",
  "sharing-scenarios",
  "storage",
  "custom-symbols",
]);

export function helpUrl(docsUrl: string): string {
  const page = docsUrl.replace(/#.*$/, "").replace(/\/$/, "").split("/").pop() ?? "";
  return HELP_SECTIONS.has(page) ? `/help/#${page}` : "/help/";
}

export function georgewyrdHelpLinks(): Plugin {
  return {
    name: "georgewyrd-help-links",
    enforce: "pre",
    transform(code, id) {
      // App source only: not dependencies, and not tests, which may assert the upstream URLs.
      const app = id.includes("/src/") && !id.includes("/node_modules/") && !/\.test\.ts$/.test(id);
      if (!app || !/\.(vue|ts)(\?|$)/.test(id) || !code.includes("docs.orbat-mapper.app")) {
        return null;
      }
      return { code: code.replace(DOCS, helpUrl), map: null };
    },
  };
}
