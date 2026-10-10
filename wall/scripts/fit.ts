/*
 * Fit: when a page opens, the thing it exists for is whole on the screen. For every template, for every kind of page,
 * at a laptop, a small laptop and a phone: the first picture (or leaf, slide, spread, poster) must sit within the first
 * screen, caption included, with nothing to scroll to reach it. Reports every violation; the release pass runs it.
 * Run: npx tsx scripts/fit.ts [chromium|webkit]
 */
import { chromium, webkit } from "playwright-core";
import { HOUSES } from "../src/app/houses";
const engine = process.argv[2] === "webkit" ? webkit : chromium, B = "http://127.0.0.1:5181";
const SIZES = [{ w: 1440, h: 900 }, { w: 1280, h: 720 }, { w: 390, h: 844 }];
// the sample pages, by kind: the front, a story, a project, a film, a writing
const PAGES: Record<string, string[]> = { habib: ["", "the-road-in", "the-film", "the-door"], habs: ["", "farnsworth"], redon: ["", "flowers", "from-black-to-colour"] };
const br = await engine.launch(); const rows: { house: string; site: string; page: string; size: string; what: string; top: number; bottom: number; vh: number }[] = [];
for (const h of HOUSES) for (const size of SIZES) {
  const ctx = await br.newContext({ viewport: { width: size.w, height: size.h } }); const pg = await ctx.newPage();
  for (const [site, pages] of Object.entries(PAGES)) for (const page of pages) {
    await pg.goto("about:blank"); await pg.goto(`${B}/app/index.html?site=${site}&house=${h.id}&preview&space=fit-${h.id}-${site}#/${page}`, { waitUntil: "networkidle" }); await pg.waitForTimeout(500);
    const m = await pg.evaluate(() => {
      // the first thing the page is for: the first figure with a picture, a poster, or a leaf
      const el = document.querySelector<HTMLElement>("main figure img, main .screen img, main .poster img, main .frame img, main .leaf, main .slide, main .pg");
      if (!el) return null;
      const fig = el.closest<HTMLElement>("figure, .leaf, .slide, .pg, .screen") ?? el, r = fig.getBoundingClientRect();
      return { what: fig.className.split(" ")[0] || fig.tagName.toLowerCase(), top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY), vh: innerHeight, scrolled: Math.round(scrollY) };
    });
    if (!m) continue;
    if (m.top < m.vh * 0.72 && m.bottom > m.vh + 2) rows.push({ house: h.id, site, page: page || "front", size: `${size.w}×${size.h}`, what: m.what, top: m.top, bottom: m.bottom, vh: m.vh });
  }
  await ctx.close();
}
await br.close();
const by = (k: keyof (typeof rows)[number]) => rows.reduce<Record<string, number>>((o, r) => { o[String(r[k])] = (o[String(r[k])] ?? 0) + 1; return o; }, {});
console.log(`${rows.length} first pictures beyond the first screen`); console.log("by template:", JSON.stringify(by("house"))); console.log("by size:", JSON.stringify(by("size"))); console.log("by page:", JSON.stringify(by("page")));
for (const r of rows.slice(0, 40)) console.log(`  ${r.house.padEnd(11)} ${r.site.padEnd(6)} ${r.page.padEnd(22)} ${r.size.padEnd(9)} ${r.what.padEnd(8)} bottom ${r.bottom} of ${r.vh}`);
