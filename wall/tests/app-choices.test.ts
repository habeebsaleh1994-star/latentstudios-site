/*
 * Every choice the editor offers must visibly change the page. A choice that does nothing is a bug
 * (it happened: "With a note" and "Full" were offered on a Wall, where they show nothing).
 * This walks every sample site, every story, every arrangement, every work and every option offered,
 * renders the page before and after, and fails if the page is the same.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { openSite, type SiteDocument, type StoryPage } from "../src/studio/site";
import * as O from "../src/app/ops";
import { house } from "../src/app/houses";
import { page, bookLeaves, slideList, type Ctx } from "../src/app/render";

const SITES: Record<string, string> = {
  habib: "design/samples/habib-saleh.site.json", folio: "design/folio/doc/before-it-disappears.site.json", salon: "design/salon/doc/sora-vale.site.json", lantern: "design/lantern/doc/lantern.site.json",
};
const HOUSE_IDS = ["folio", "gallery", "monograph", "passage", "reel", "salon", "index", "atelier", "lantern"] as const;
const ctx = (site: SiteDocument): Ctx => ({ site, editing: false, href: (id) => `#/${id}`, src: (a) => a });
/** What a reader sees of a story: the page, and for the views built in the browser, every spread or slide too. */
function seen(site: SiteDocument, id: string) {
  const p = site.pages.find((x) => x.id === id) as StoryPage, c = ctx(site);
  const extra = p.arrangement === "book" ? bookLeaves(c, p, false).join("") + bookLeaves(c, p, true).join("") : p.arrangement === "slides" ? slideList(c, p).list.join("") : "";
  return page(c, p) + extra;
}

describe("every arrangement choice changes what the reader sees", () => {
  for (const [name, file] of Object.entries(SITES)) {
    it(name, () => {
      const silent: string[] = [];
      let checked = 0;
      // every template, and within it every arrangement it offers
      for (const hid of HOUSE_IDS) {
      const base = O.applyHouse(openSite(JSON.parse(readFileSync(file, "utf8"))), hid).site;
      for (const st of base.pages.filter((p): p is StoryPage => p.kind === "story")) {
        for (const a of house(hid).arrangements) {
          let site = O.setArrangement(base, st.id, a);
          // give every margin note words, so a note that is offered can be seen
          site = { ...site, pages: site.pages.map((p) => (p.id === st.id && p.kind === "story" ? { ...p, pieces: p.pieces.map((x) => (x.type === "work" ? { ...x, note: x.note || "A note." } : x)) } : p)) };
          const story = site.pages.find((p) => p.id === st.id) as StoryPage;
          story.pieces.forEach((x, k) => {
            if (x.type !== "work") return;
            const before = seen(site, st.id);
            for (const o of O.arrangeOptions(site, st.id, k)) {
              if (o.current) continue;
              const after = seen(O.arrange(site, st.id, k, o.key), st.id); checked++;
              if (after === before) silent.push(`${hid}: ${st.id} as ${a}: work ${k + 1}, "${o.title}" changes nothing`);
            }
          });
        }
      }
      }
      expect(silent, silent.join("\n")).toEqual([]);
      expect(checked).toBeGreaterThan(0);
    });
  }

  it("a contact sheet offers no arrangement at all, since every frame sits in an equal cell", () => {
    const s = O.setArrangement(openSite(JSON.parse(readFileSync(SITES.habib, "utf8"))), "the-road-in", "contact"); // Folio offers contact
    (s.pages[0] as StoryPage).pieces.forEach((_x, k) => expect(O.arrangeOptions(s, "the-road-in", k)).toEqual([]));
  });
});
