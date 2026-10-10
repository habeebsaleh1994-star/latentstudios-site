/*
 * Each template must do what we say it does. Its promises (who it is for, its idea, what it owns) are
 * written here as checks against the real rendered site, using the same artist's site in every template.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { openSite, type SiteDocument } from "../src/studio/site";
import * as O from "../src/app/ops";
import { HOUSES, house } from "../src/app/houses";
import { page, workPages, type Ctx } from "../src/app/render";

const base = () => openSite(JSON.parse(readFileSync("design/samples/habib-saleh.site.json", "utf8")));
const as = (h: string, s = base()) => O.applyHouse(s, h as never).site;
const ctx = (site: SiteDocument): Ctx => ({ site, editing: false, href: (id) => `#/${id}`, src: (a) => a });
const front = (s: SiteDocument) => page(ctx(s), null);
const at = (s: SiteDocument, id: string) => page(ctx(s), s.pages.find((p) => p.id === id)!);
const arrangements = (s: SiteDocument) => new Set(s.pages.flatMap((p) => (p.kind === "story" ? [p.arrangement] : [])));
const menu = (html: string) => (html.match(/<nav aria-label="Primary"><a[^>]*>([^<]+)/) ?? ["", ""])[1];
const withProject = () => { const r = O.addPage(base(), "project", "Almond & Salt"); return O.addToList(O.addToList(r.site, r.id, "outcome", ["/design/folio/img/1.jpg"]), r.id, "process", ["/design/folio/img/2.jpg"]); };

describe("every template does what it says", () => {
  it("Folio, for photographers: every work held, a caption like a print mount (number, title, date)", () => {
    const s = as("folio");
    expect(arrangements(s)).toEqual(new Set(["held"]));
    expect(at(s, "the-road-in")).toMatch(/<p class="cap"><span class="n">01<\/span><span class="t">The road in<\/span><span class="d"><span>7 Mar 2025/);
    expect(s.front.form).toBe("covers");
  });

  it("Gallery: a white cube, the name alone at the top, the work first, words as labels when pointed at", () => {
    const s = as("gallery");
    expect([s.theme.look, s.theme.header, s.theme.opening, s.theme.captions]).toEqual(["gallery", "name", "work", "hover"]);
    expect(front(s)).not.toMatch(/<section class="card">/); // straight into the work
  });

  it("Monograph, for photographers who make books: name as the cover, a contents page, every series as spreads", () => {
    const s = as("monograph");
    expect(arrangements(s)).toEqual(new Set(["book"]));
    expect(house("monograph").arrangements).toEqual(["book"]);
    const f = front(s);
    expect(f).toMatch(/opening-name"><h1>Habib Saleh<\/h1>/);
    expect(f).toMatch(/<ol aria-label="Contents">/);
    expect(menu(f)).toBe("Contents");
  });

  it("Passage: one walk, the front page and every story hung along a wall, in a dark room", () => {
    const s = as("passage");
    expect(arrangements(s)).toEqual(new Set(["passage"]));
    const f = front(s);
    expect(f).toMatch(/class="v-passage v-front-walk"/);
    expect((f.match(/class="(hang|wall-text say) door/g) ?? []).length).toBe(workPages(s).filter((p) => p.inNav).length);
    expect(["darkroom", "monotype", "graphite", "gallery"]).toContain(s.theme.look);
  });

  it("Reel, for filmmakers: films lead, the site opens on a still from the first film", () => {
    const s = as("reel"), film = s.pages.find((p) => p.kind === "film")!;
    expect(workPages(s)[0].kind).toBe("film");
    const f = front(s);
    expect(f).toMatch(new RegExp(`opening-image[^>]*><img src="${(film as { poster: string }).poster.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    expect(f.indexOf(`href="#/${film.id}"`)).toBeLessThan(f.indexOf('href="#/the-road-in"'));
    expect(menu(f)).toBe("Films");
  });

  it("Salon, for painters: works hung at true relative size, every work given its dimensions", () => {
    const s = as("salon");
    expect(arrangements(s)).toEqual(new Set(["wall"]));
    expect(at(s, "the-road-in")).toMatch(/class="v-wall"/);
    expect(at(s, "the-road-in")).toMatch(/\d+ × \d+ cm/);
    expect(at(O.setArrangement(s, "the-road-in", "held"), "the-road-in")).toMatch(/<span class="d sz">\d+ × \d+ cm/);
  });

  it("Index, for writers: writing leads the contents, a side column, quiet titles", () => {
    const s = as("index"), f = front(s);
    expect(workPages(s)[0].kind).toBe("writing");
    expect(f).toMatch(/<li class="writing[^"]*"><a href="#\/the-door"[^>]*><span class="n">01/);
    expect([s.theme.header, s.theme.title]).toEqual(["rail", "quiet"]);
    expect(menu(f)).toBe("Writing");
  });

  it("Atelier, for studios: projects lead, as case studies with process beside outcome", () => {
    const s = as("atelier", withProject());
    expect(workPages(s)[0].kind).toBe("project");
    expect(menu(front(s))).toBe("Projects");
    expect(at(s, workPages(s)[0].id)).toMatch(/class="v-project"[\s\S]*Process[\s\S]*Outcome/);
    // a project with no process steps shows its outcome alone to a visitor: no empty column
    const r = O.addPage(base(), "project", "Plain"), bare = O.addToList(r.site, r.id, "outcome", ["/design/folio/img/1.jpg"]);
    expect(at(as("atelier", bare), r.id)).toMatch(/no-process/); expect(at(as("atelier", bare), r.id)).not.toMatch(/>Process</);
  });

  it("Manuscript, for books: a threshold with the contents below it, every story read one leaf at a time with a running head and turns", () => {
    const s = as("manuscript");
    expect(s.front.form).toBe("threshold");
    expect(front(s)).toMatch(/class="v-front v-threshold"[\s\S]*Begin the work[\s\S]*id="contents"/);
    expect(workPages(s).every((p) => p.kind !== "story" || p.arrangement === "leaves")).toBe(true);
    expect(at(s, workPages(s)[0].id)).toMatch(/class="v-leaves"[\s\S]*class="runhead"[\s\S]*class="turns"/);
    expect(O.arrangeOptions(s, workPages(s)[0].id, 0)).toEqual([]);
  });

  it("Lantern: every story one slide at a time", () => {
    const s = as("lantern");
    expect(arrangements(s)).toEqual(new Set(["slides"]));
    expect(house("lantern").arrangements).toEqual(["slides"]);
  });

  it("choosing a template puts every story in that template's own arrangement", () => {
    for (const h of HOUSES) expect(arrangements(as(h.id))).toEqual(new Set([h.arrangements[0]]));
  });

  it("Journal: dated entries newest first, each a day held one picture at a time", () => {
    const s = as("journal"); const f = front(s);
    expect([s.front.form, house("journal").arrangements[0], menu(f)]).toEqual(["journal", "held", "Entries"]);
    const whens = [...f.matchAll(/class="when label">([^<]*)</g)].map((m) => m[1]); expect(whens.length).toBeGreaterThan(3);
    expect(f.indexOf("The door")).toBeLessThan(f.indexOf("He looked")); // newest first: the poem of 2026 before December 2025
  });
  it("Column: essays lead, dated; photographs never ahead of the words", () => {
    const s = as("column"); expect([s.front.form, workPages(s)[0].kind, menu(front(s))]).toEqual(["journal", "writing", "Essays"]);
  });
  it("Catalogue: every work numbered through, with its facts; the series keep their dimensions", () => {
    const s = as("catalogue"); const f = front(s);
    expect([s.front.form, menu(f)]).toEqual(["catalogue", "Catalogue"]);
    const nos = [...f.matchAll(/class="no">(\d+)</g)].map((m) => +m[1]); expect(nos.length).toBeGreaterThan(8); expect(nos).toEqual(nos.map((_, i) => i + 1));
    expect(f).toMatch(/<ol start="4">/); // the second series carries on the numbering
  });
  it("Chapbook: the front page is the reading itself, set large; the rest waits at the end", () => {
    const s = as("chapbook"); const f = front(s);
    expect([s.front.form, workPages(s)[0].kind, menu(f)]).toEqual(["reading", "writing", "Poems"]);
    expect(f).toMatch(/<article class="piece">[\s\S]*The door remembers[\s\S]*<\/article>/); expect(f.indexOf("The door remembers")).toBeLessThan(f.indexOf('class="after"'));
    expect([s.theme.header, s.theme.captions]).toEqual(["name", "hidden"]);
  });
  it("Cinema: a poster wall, dark by nature; films lead", () => {
    const s = as("cinema"); const f = front(s);
    expect([s.front.form, workPages(s)[0].kind, s.theme.mode, menu(f)]).toEqual(["posters", "film", "dark", "Films"]);
    expect(f).toMatch(/class="poster" href="#\/the-film" style="--r:/);
  });
  it("Ledger: a table of projects first; pictures kept for the pages", () => {
    const s = as("ledger", withProject()); const f = front(s);
    expect([s.front.form, workPages(s)[0].kind, menu(f)]).toEqual(["ledger", "project", "Projects"]);
    expect(f).toMatch(/<table><thead><tr><th class="no">No\.<\/th><th>Project<\/th><th>Client<\/th>/); expect(f).not.toMatch(/<img/);
  });
  it("Pinboard: every story a board of pins, the larger ones across two", () => {
    const s = as("pinboard"); expect(arrangements(s)).toEqual(new Set(["board"]));
    const h = at(s, "the-road-in"); expect(h).toMatch(/<main class="v-board">/); expect(h).toMatch(/class="pin big"/); // the road's first work is set full in the sample
    expect(s.theme.captions).toBe("hover");
  });
  it("Studio: boards for the making, walls at true size for the made, projects with process", () => {
    const s = as("studio"); expect(house("studio").arrangements).toEqual(["board", "wall", "held"]); expect(house("studio").leads).toEqual(["story", "project"]);
    expect(at(s, "the-road-in")).toMatch(/<main class="v-board">/);
  });
  it("Archive: everything by date, newest first, sifted by kind", () => {
    const s = as("archive"); const f = front(s);
    expect([s.front.form, menu(f)]).toEqual(["archive", "Archive"]);
    expect(f).toMatch(/<nav class="kinds"[^>]*><button type="button" class="label on" data-kind="">All<\/button><button type="button" class="label" data-kind="story">Photographs<\/button>/);
    expect(f.indexOf('<li class="writing" data-kind="writing"')).toBeLessThan(f.indexOf('<li class="story" data-kind="story"')); // the 2026 poem before the 2025 photographs
    expect(workPages(s).map((p) => p.kind)).toContain("film");
  });
  it("the words we use for each template are the words it shows: its name, who it is for, what leads", () => {
    for (const h of HOUSES) {
      expect(h.for.length).toBeGreaterThan(5);
      expect(h.idea.length).toBeGreaterThan(20);
      expect(menu(front(as(h.id, h.leads.includes("project") ? withProject() : base())))).toBe(h.menu);
    }
  });
});
