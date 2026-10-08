/* The door: a page behind a word, the site behind a word, and "soon". In the app the door is drawn; in the files the page is sealed. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { openSite, type SiteDocument } from "../src/studio/site";
import * as O from "../src/app/ops";
import { page, appearsOf, lockOf, type Ctx } from "../src/app/render";
import { buildFiles, publicSite, checks, changes, pageFile } from "../src/app/publish";
import { open } from "../src/app/lock";

const win: Record<string, unknown> = {};
runInNewContext(readFileSync("design/shared/theme.js", "utf8"), { window: win, document: {}, matchMedia: () => ({ matches: false }) });
(globalThis as Record<string, unknown>).FolioTheme = win.FolioTheme;

const site = () => openSite(JSON.parse(readFileSync("design/samples/habib-saleh.site.json", "utf8")));
const ctx = (s: SiteDocument, given: string[] = []): Ctx => ({ site: s, editing: false, href: (id) => `#/${id}`, src: (a) => a, locked: (p) => lockOf(s, p, given) });
const road = (s: SiteDocument) => s.pages.find((p) => p.id === "the-road-in")!;
const srcs = { text: async (u: string) => `/* ${u} */`, bytes: async (a: string) => new Uint8Array([a.length]) };
const text = (files: { name: string; data: Uint8Array }[], name: string) => new TextDecoder().decode(files.find((f) => f.name === name)!.data);

describe("who can see it", () => {
  it("a page behind a word shows a door, not its work; the word opens it; the front keeps its cover out of sight", () => {
    const s = O.setField(site(), "page:the-road-in.word", "olive");
    expect(lockOf(s, road(s), [])).toBe("word"); expect(lockOf(s, road(s), ["Olive "])).toBeNull(); expect(lockOf(s, null, [])).toBeNull();
    const closed = page(ctx(s), road(s));
    expect(closed).toContain("v-door"); expect(closed).not.toContain("<img"); expect(closed).not.toMatch(/Joun|village/);
    expect(page(ctx(s, ["olive"]), road(s))).toContain("<img");
    expect(page(ctx(s), null)).not.toContain("12.jpg"); expect(page(ctx(s, ["olive"]), null)).toContain("12.jpg"); // its cover
    const ap = appearsOf(ctx(s), road(s)); expect(ap.share).toBeNull(); expect(ap.description).toBe("");
    expect(page({ ...ctx(s), editing: true, locked: undefined }, road(s))).toContain("<img"); // the editor always sees it
  });
  it("the site behind a word, and 'soon'", () => {
    let s = O.setDoor(O.setField(site(), "site.door.word", "pomegranate"), "word");
    expect(lockOf(s, null, [])).toBe("word"); expect(lockOf(s, road(s), ["pomegranate"])).toBeNull();
    s = O.setDoor(s, "soon"); expect(lockOf(s, null, [])).toBe("soon"); expect(lockOf(s, null, ["pomegranate"])).toBeNull();
    const hold = page(ctx(s), null); expect(hold).toContain('data-why="soon"'); expect(hold).toContain("Habib"); expect(hold).toContain("data-door");
    s = O.setDoor(s, "open"); expect(s.door).toEqual({ word: "", soon: false, note: "" });
    expect(page(ctx(O.setDoor(site(), "soon")), null)).not.toContain("data-door"); // soon with no word: no door to knock on
    expect(() => O.setField(site(), "site.door.soon", "x")).toThrow();
  });
  it("is said before publishing, and in what changed", () => {
    const s = O.setField(site(), "page:the-road-in.word", "olive");
    expect(checks(s).map((c) => c.text)).toContain("“The road in” is behind the word “olive”.");
    expect(changes(site(), s)).toContain("The road in: behind a word.");
    expect(changes(site(), O.setDoor(site(), "soon"))).toContain("Only a holding page is shown now.");
    expect(checks(O.setDoor(O.setField(site(), "site.door.word", "x"), "word"))[0].text).toMatch(/behind the word “x”/);
  });
  it("the public document carries no words and no content of pages behind the door", () => {
    const s = O.setField(site(), "page:the-road-in.word", "olive");
    const pub = publicSite(s, null);
    expect(road(pub).word).toBe(""); expect((road(pub) as { pieces: unknown[] }).pieces).toEqual([]); expect(Object.keys(pub.library)).not.toContain("/design/folio/img/8.jpg"); expect(Object.keys(pub.library)).toContain("/design/folio/img/12.jpg"); // 8 is the road's alone; 12 is in the film too
    expect((road(publicSite(s, "the-road-in")) as { pieces: unknown[] }).pieces.length).toBeGreaterThan(0);
    expect(JSON.stringify(publicSite(O.setField(s, "site.door.word", "p"), "all"))).not.toMatch(/"word":"(p|olive)"/);
  });
  it("in the files, a page behind a word is sealed: nothing readable, works under unguessable names, opened by the word", async () => {
    const s = O.setField(site(), "page:the-road-in.word", "olive");
    const files = await buildFiles(s, srcs), names = files.map((f) => f.name);
    const shell = text(files, "the-road-in/index.html");
    expect(shell).toContain("v-door"); expect(shell).not.toMatch(/leaning over a quiet|The pine|8\.jpg/); expect(shell).toContain('"sealed":{');
    expect(names).not.toContain("assets/img/8.jpg"); expect(names).toContain("assets/img/12.jpg"); // the road's own work travels under another name; a work the film shows too keeps its name
    const sealed = JSON.parse(shell.match(/window\.STATIC=(.*?)<\/script>/)![1]).sealed;
    const inner = (await open(sealed, "olive"))!;
    expect(inner).toContain("<img"); expect(inner).not.toContain("assets/img/8.jpg"); expect(inner).toMatch(/"names":\{"\/design\/folio\/img\/8\.jpg":"[0-9a-f]{24}\.jpg"/); // the opened page knows its works' names; the shell does not
    expect(shell).not.toContain('"names"');
    const hidden = inner.match(/assets\/img\/([0-9a-f]{24}\.jpg)/)![1]; expect(names).toContain(`assets/img/${hidden}`);
    expect(await open(sealed, "olives")).toBeNull();
    expect(text(files, "index.html")).not.toContain('"sealed"'); // the front is open
    expect(text(files, "index.html")).not.toContain("8.jpg"); // and carries nothing of the page behind the word
    expect(text(files, "index.html")).not.toContain('"word":"olive"');
    expect(names.some((n) => n.startsWith("assets/share/the-road-in"))).toBe(false);
  });
  it("the site behind a word seals every page with it; 'soon' without a word ships nothing of the site", async () => {
    const s = O.setDoor(O.setField(site(), "site.door.word", "pomegranate"), "word");
    const files = await buildFiles(s, srcs);
    for (const n of ["index.html", "about/index.html"]) { const t = text(files, n); expect(t).toContain('"sealed":{'); expect(t).not.toContain("pomegranate"); }
    expect(files.some((f) => f.name.startsWith("assets/img/") && !f.name.match(/[0-9a-f]{24}\.(jpg|mp4)$/))).toBe(false);
    const soon = await buildFiles(O.setDoor(site(), "soon"), srcs);
    expect(text(soon, "index.html")).toContain('data-why="soon"'); expect(text(soon, "the-road-in/index.html")).not.toContain("<img");
    expect(soon.some((f) => f.name.startsWith("assets/img/"))).toBe(false);
    expect(text(soon, "the-road-in/index.html")).not.toContain('"sealed"');
    expect(pageFile(O.setDoor(site(), "soon"), null, "", { lock: "soon" })).toContain("Soon.");
  });
});
