/*
 * Is "no two artists alike" true? For every template, render many valid combinations of its choices on the same
 * page, and measure how visibly different they are from one another (mean colour distance between small renders).
 * Reports the median distance, the nearest pair (the two settings that look most alike) and how many pairs are
 * near-duplicates. Run: npx tsx scripts/distinct.ts [combos-per-template]  (needs the dev server on 5181)
 */
import { chromium } from "playwright-core";
import { writeFileSync, mkdirSync } from "node:fs";
import { HOUSES, allows } from "../src/app/houses";

const B = "http://127.0.0.1:5181", K = Number(process.argv[2] ?? 24), OUT = "design/_explore/audit";
const ACCENTS = [null, "#B87B8A", "#8A7280", "#7C8B7F", "#A5895A", "#5F7389", "#A4574E"], PALETTES = ["silk", "bone", "fog", "clay", "night"], MOUNTS = ["bare", "line", "matte"], SPACES = ["airy", "standard", "close"];
const pick = <T>(a: readonly T[], r: () => number) => a[Math.floor(r() * a.length)];
const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
mkdirSync(OUT, { recursive: true });

const br = await chromium.launch(), ctx = await br.newContext({ viewport: { width: 1440, height: 900 } }), pg = await ctx.newPage(), cv = await ctx.newPage();
await cv.setContent("<canvas id=c width=96 height=60></canvas>");
const small = async (png: Buffer): Promise<number[]> => cv.evaluate(async (b64) => { const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode(); const c = document.getElementById("c") as HTMLCanvasElement, g = c.getContext("2d")!; g.drawImage(img, 0, 0, 96, 60); return [...g.getImageData(0, 0, 96, 60).data].filter((_, i) => i % 4 !== 3); }, png.toString("base64"));
const dist = (a: number[], b: number[]) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length / 255; };

type Row = { house: string; median: number; min: number; minPair: [string, string]; near: number; pairs: number; defaults?: number[] };
const report: Row[] = [], defaults: { house: string; px: number[] }[] = [];
for (const h of HOUSES) {
  const r = rng(h.id.length * 7919 + 17), themes: Record<string, unknown>[] = [{}];
  while (themes.length < K) {
    const t: Record<string, unknown> = {};
    for (const [k, vs] of Object.entries(h.dials)) t[k] = pick(vs as string[], r);
    t.look = pick(h.looks, r); t.typeface = pick(h.typefaces, r); t.accent = pick(ACCENTS, r); t.palette = pick(PALETTES, r); t.mount = pick(MOUNTS, r); t.space = pick(SPACES, r); t.mode = pick(["light", "dark"] as const, r);
    if (Object.entries(t).every(([k, v]) => allows(h, k, v))) themes.push(t);
  }
  const page = h.leads[0] === "film" ? "the-film" : h.leads[0] === "writing" ? "the-door" : h.leads[0] === "project" ? "the-film" : "the-road-in";
  const shots: number[][] = [], names: string[] = [];
  for (const [i, t] of themes.entries()) {
    await pg.goto("about:blank");
    await pg.goto(`${B}/app/index.html?site=habib&house=${h.id}&preview&space=audit-${h.id}&theme=${encodeURIComponent(JSON.stringify(t))}#/${page}`, { waitUntil: "networkidle" }); await pg.waitForTimeout(500);
    await pg.evaluate(() => { document.querySelector(".demo-note")?.remove(); document.getElementById("dock")?.remove(); scrollTo(0, 0); });
    const png = await pg.screenshot({ type: "png" });
    if (i === 0) writeFileSync(`${OUT}/${h.id}-default.png`, png);
    shots.push(await small(png)); names.push(JSON.stringify(t));
  }
  defaults.push({ house: h.id, px: shots[0] });
  const ds: { d: number; a: number; b: number }[] = [];
  for (let a = 0; a < shots.length; a++) for (let b = a + 1; b < shots.length; b++) ds.push({ d: dist(shots[a], shots[b]), a, b });
  ds.sort((x, y) => x.d - y.d);
  const med = ds[Math.floor(ds.length / 2)].d, near = ds.filter((x) => x.d < 0.02).length;
  report.push({ house: h.id, median: +med.toFixed(4), min: +ds[0].d.toFixed(4), minPair: [names[ds[0].a], names[ds[0].b]], near, pairs: ds.length });
  console.log(`${h.name.padEnd(10)} median ${med.toFixed(3)}  nearest ${ds[0].d.toFixed(3)}  near-duplicates ${near}/${ds.length}`);
}
// templates against one another, each at its own defaults
const cross: { a: string; b: string; d: number }[] = [];
for (let a = 0; a < defaults.length; a++) for (let b = a + 1; b < defaults.length; b++) cross.push({ a: defaults[a].house, b: defaults[b].house, d: +dist(defaults[a].px, defaults[b].px).toFixed(4) });
cross.sort((x, y) => x.d - y.d);
console.log("templates nearest to each other:", cross.slice(0, 5).map((c) => `${c.a}/${c.b} ${c.d}`).join("  "));
writeFileSync(`${OUT}/distinct.json`, JSON.stringify({ k: K, report, cross }, null, 1));
await br.close();
