import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { openSite } from "../src/studio/site";
import * as O from "../src/app/ops";
import { runInNewContext } from "node:vm";
import { changes, checks, pageFile, buildFiles, fileOf, address } from "../src/app/publish";

// the looks, as the page has them
const win: Record<string, unknown> = {};
runInNewContext(readFileSync("design/shared/theme.js", "utf8"), { window: win, document: {}, matchMedia: () => ({ matches: false }) });
(globalThis as Record<string, unknown>).FolioTheme = win.FolioTheme;

const site = () => openSite(JSON.parse(readFileSync("design/samples/habib-saleh.site.json", "utf8")));

describe("what changed since the last publish", () => {
  it("says nothing when nothing changed, and 'the whole site' the first time", () => {
    expect(changes(site(), site())).toEqual([]);
    expect(changes(null, site())[0]).toMatch(/first time/);
  });
  it("names new, removed, renamed and changed pages, in the artist's words", () => {
    let s = site();
    s = O.addPage(s, "story", "Winter").site; s = O.addWorks(s, "winter", -1, ["/design/folio/img/1.jpg"]);
    s = O.removePage(s, "the-door"); s = O.setField(s, "page:late-light.title", "Last light"); s = O.removePiece(s, "the-road-in", 0);
    s = O.setTheme(s, { look: "toned" }); s = O.setFront(s, "list");
    const c = changes(site(), s);
    expect(c).toContain("New: Winter (1 works).");
    expect(c).toContain("Removed: The door remembers.");
    expect(c.find((x) => x.startsWith("Last light"))).toMatch(/renamed from “Late light”/);
    expect(c.find((x) => x.startsWith("The road in"))).toMatch(/1 removed/);
    expect(c).toContain("Customise: the look.");
    expect(c).toContain("The front page, now a list.");
  });
  it("notices a caption edited on a work", () => {
    const s = O.setField(site(), "work:/design/folio/img/12.jpg.title", "The road, in spring");
    expect(changes(site(), s)).toContain("The road in: a work's words.");
  });
});

describe("checks before publishing", () => {
  it("stops a site with no name or no work; warns about empty pages", () => {
    const empty = O.blankSite("", "folio");
    expect(checks(empty).filter((c) => c.stop).length).toBe(2);
    const s = O.addPage(site(), "story", "Empty").site;
    expect(checks(s).map((c) => c.text)).toContain("“Empty” has no works yet.");
    expect(checks(site()).some((c) => c.stop)).toBe(false);
  });
});

describe("the files", () => {
  it("a page file stands alone: its html drawn, its theme on the root, its assets relative to its depth", () => {
    const s = O.setTheme(site(), { look: "toned", typeface: "caslon" }), p = s.pages.find((x) => x.id === "the-road-in")!;
    const html = pageFile(s, p, "../");
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toMatch(/data-look="toned"/); expect(html).toMatch(/data-typeface="caslon"/); expect(html).toMatch(/--silk:#D8C6A4/);
    expect(html).toMatch(/href="\.\.\/assets\/app\.css"/);
    expect(html).toMatch(/src="\.\.\/assets\/img\/12\.jpg"/);
    expect(html).toMatch(/href="\.\.\/he-looked-back\/"/);
    expect(html).toMatch(/<title>The road in · Habib Saleh<\/title>/);
    expect(html).not.toMatch(/contenteditable/);
    expect(pageFile(s, null, "")).toMatch(/href="\.\/"/);
  });
  it("every page gets a file, every used photograph is carried, nothing unused is", async () => {
    const s = O.addToLibrary(site(), "asset:unused", { w: 100, h: 100, title: "Spare" });
    const files = await buildFiles(s, { text: async (u) => `/* ${u} */`, bytes: async (a) => new Uint8Array([a.length]) });
    const names = files.map((f) => f.name);
    expect(names).toContain("index.html"); for (const p of s.pages) expect(names).toContain(`${p.id}/index.html`);
    expect(names).toContain("assets/visitor.js"); expect(names).toContain("assets/img/12.jpg");
    expect(names.some((n) => n.includes("unused"))).toBe(false);
  });
  it("names files for uploads by id and keeps samples' names; an address from the name", () => {
    expect(fileOf("asset:abc", "image")).toBe("abc.jpg"); expect(fileOf("/design/folio/img/7.jpg", "image")).toBe("7.jpg");
    expect(address("Nadia Haddad")).toBe("nadia-haddad.latent.site"); expect(address("Éloïse  Marchand!")).toBe("eloise-marchand.latent.site");
  });
});

describe("night and colour in the files", () => {
  it("a page carries its look's night when the site is set to night, both when it follows the device, and the artist's accent fitted", () => {
    const s = O.setTheme(site(), { look: "toned", mode: "dark" });
    const night = pageFile(s, null, "");
    expect(night).toMatch(/data-scheme="dark"/); expect(night).toMatch(/--silk:#2A2016/); expect(night).not.toMatch(/--silk:#D8C6A4/);
    const day = pageFile(O.setTheme(site(), { look: "toned", mode: "light" }), null, "");
    expect(day).toMatch(/data-scheme="light"/); expect(day).toMatch(/--silk:#D8C6A4/); expect(day).not.toMatch(/prefers-color-scheme/);
    const both = pageFile(O.setTheme(site(), { look: "toned", mode: "system" }), null, "");
    expect(both).toMatch(/--silk:#D8C6A4/); expect(both).toMatch(/@media \(prefers-color-scheme: dark\) \{ :root \{ [^}]*--silk:#2A2016/); expect(both).toMatch(/dataset\.scheme=matchMedia/);
    const accent = pageFile(O.setTheme(site(), { accent: "#5F7389", mode: "light" }), null, "");
    expect(accent).toMatch(/--peony:#[0-9a-fA-F]{6}/); expect(accent).toMatch(/--peony-text:#/);
    const quietNight = pageFile(O.setTheme(site(), { palette: "fog", mode: "dark" }), null, "");
    expect(quietNight).toMatch(/--silk:#151A19/); // the fog palette's night
  });
});
