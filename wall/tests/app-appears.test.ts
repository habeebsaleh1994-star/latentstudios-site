import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { openSite } from "../src/studio/site";
import * as O from "../src/app/ops";
import { appearsOf, type Ctx } from "../src/app/render";
import { pageFile, favicon, buildFiles } from "../src/app/publish";

const win: Record<string, unknown> = {};
runInNewContext(readFileSync("design/shared/theme.js", "utf8"), { window: win, document: {}, matchMedia: () => ({ matches: false }) });
(globalThis as Record<string, unknown>).FolioTheme = win.FolioTheme;
const site = () => openSite(JSON.parse(readFileSync("design/samples/habib-saleh.site.json", "utf8")));
const ctx = (s = site()): Ctx => ({ site: s, editing: false, href: (i) => "#/" + i, src: (a) => a });

describe("how a page appears elsewhere", () => {
  it("comes from the page itself until the artist sets it", () => {
    const s = site(), p = s.pages.find((x) => x.id === "the-road-in")!, a = appearsOf(ctx(s), p);
    expect(a.title).toBe("The road in · Habib Saleh"); expect(a.description).toBe(p.kind === "story" ? p.note : ""); expect(a.share?.asset).toBe("/design/folio/img/12.jpg"); expect(a.own).toBe(false);
    let t = O.setField(s, "page:the-road-in.appears.title", "The road in, a story from Joun"); t = O.setField(t, "page:the-road-in.appears.description", "Three photographs.");
    t = O.setShare(t, "the-road-in", "/design/folio/img/2.jpg");
    const b = appearsOf(ctx(t), t.pages.find((x) => x.id === "the-road-in")!);
    expect([b.title, b.description, b.share?.asset, b.own]).toEqual(["The road in, a story from Joun", "Three photographs.", "/design/folio/img/2.jpg", true]);
  });
  it("the front page uses the site's own line and image, else the first cover; a poem its first lines", () => {
    let s = O.setField(site(), "site.appears.description", "Photographs from Lebanon.");
    expect(appearsOf(ctx(s), null).share?.asset).toBe("/design/folio/img/12.jpg");
    s = O.setShare(s, null, "/design/folio/img/5.jpg");
    expect(appearsOf(ctx(s), null).share?.asset).toBe("/design/folio/img/5.jpg");
    const poem = appearsOf(ctx(s), s.pages.find((x) => x.id === "the-door")!);
    expect(poem.description).toMatch(/^The door remembers the shape of every leaving:/);
    expect(appearsOf(ctx(s), s.pages.find((x) => x.id === "contact")!).description).toMatch(/enquiries/);
  });
  it("a focal point is kept in bounds, and a logo or share image must be in the library", () => {
    const s = O.setFocal(site(), "/design/folio/img/12.jpg", 120, -3);
    expect(s.library["/design/folio/img/12.jpg"].focal).toEqual({ x: 100, y: 0 });
    expect(() => O.setLogo(site(), "ghost")).toThrow(); expect(() => O.setShare(site(), null, "ghost")).toThrow();
    expect(O.setLogo(site(), "/design/folio/img/9.jpg").mark.logo).toBe("/design/folio/img/9.jpg");
    expect(O.unused(O.setLogo(O.addToLibrary(site(), "asset:x", { w: 10, h: 10, title: "m" }), "asset:x"))).toEqual([]);
  });
  it("replacing a work carries the logo and share images with it", () => {
    let s = O.setLogo(site(), "/design/folio/img/9.jpg"); s = O.setShare(s, "the-road-in", "/design/folio/img/9.jpg");
    s = O.replaceWork(s, "/design/folio/img/9.jpg", "asset:n", { w: 10, h: 10 });
    expect(s.mark.logo).toBe("asset:n"); expect(s.pages.find((x) => x.id === "the-road-in")!.appears.share).toBe("asset:n");
  });
});

describe("in the published files", () => {
  it("every page carries its title, description, share image and the icon", () => {
    const s = O.setShare(O.setField(site(), "page:the-road-in.appears.description", "Three photographs from spring."), "the-road-in", "/design/folio/img/2.jpg");
    const html = pageFile(s, s.pages.find((x) => x.id === "the-road-in")!, "../");
    expect(html).toMatch(/<title>The road in · Habib Saleh<\/title>/);
    expect(html).toMatch(/<meta name="description" content="Three photographs from spring\.">/);
    expect(html).toMatch(/<meta property="og:image" content="\.\.\/assets\/share\/the-road-in\.jpg">/);
    expect(html).toMatch(/<link rel="icon" href="\.\.\/assets\/favicon\.svg"/);
  });
  it("the icon is the artist's initial on the site's ground, and the share images are made for each page", async () => {
    const s = O.setTheme(site(), { look: "toned" });
    expect(favicon(s)).toMatch(/<text[^>]*>H<\/text>/); expect(favicon(s)).toMatch(/fill="#D8C6A4"/);
    const files = await buildFiles(s, { text: async () => "", bytes: async () => new Uint8Array(1), share: async () => new Uint8Array(3) });
    const names = files.map((f) => f.name);
    expect(names).toContain("assets/favicon.svg"); expect(names).toContain("assets/share/front.jpg");
    expect(names).not.toContain("assets/share/the-road-in.jpg"); // its cover is the front's picture too, so they share the file
    expect(names).toContain("assets/share/he-looked-back.jpg");
    expect(names).not.toContain("assets/share/about.jpg"); // words pages show the site's image, drawn once as the front's
    expect(pageFile(s, s.pages.find((x) => x.id === "about")!, "../")).toMatch(/og:image" content="\.\.\/assets\/share\/front\.jpg"/);
  });
});
