import { describe, expect, it } from "vitest";
import { georgewyrdHelpLinks, helpUrl } from "./vite.georgewyrd";

describe("georgewyrd help links", () => {
  it("maps docs pages to help sections", () => {
    expect(helpUrl("https://docs.orbat-mapper.app/guide/import-data")).toBe("/help/#import-data");
    expect(helpUrl("https://docs.orbat-mapper.app/guide/about-orbat-mapper")).toBe("/help/");
    expect(helpUrl("https://docs.orbat-mapper.app")).toBe("/help/");
  });

  it("rewrites links in app source", () => {
    const plugin = georgewyrdHelpLinks() as { transform: (code: string, id: string) => { code: string } | null };
    const out = plugin.transform(`help-url="https://docs.orbat-mapper.app/guide/storage"`, "/src/X.vue");
    expect(out?.code).toBe(`help-url="/help/#storage"`);
    expect(plugin.transform("no links", "/src/X.vue")).toBeNull();
  });
});
