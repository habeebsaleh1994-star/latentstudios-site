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
const withProject = () => { const r = O.addPage(base(), "project", "Almond & Salt"); return O.addToList(r.site, r.id, "outcome", ["/design/folio/img/1.jpg"]); };

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
  });

  it("Lantern: every story one slide at a time", () => {
    const s = as("lantern");
    expect(arrangements(s)).toEqual(new Set(["slides"]));
    expect(house("lantern").arrangements).toEqual(["slides"]);
  });

  it("choosing a template puts every story in that template's own arrangement", () => {
    for (const h of HOUSES) expect(arrangements(as(h.id))).toEqual(new Set([h.arrangements[0]]));
  });

  it("the words we use for each template are the words it shows: its name, who it is for, what leads", () => {
    for (const h of HOUSES) {
      expect(h.for.length).toBeGreaterThan(5);
      expect(h.idea.length).toBeGreaterThan(20);
      expect(menu(front(as(h.id, h.leads.includes("project") ? withProject() : base())))).toBe(h.menu);
    }
  });
});
