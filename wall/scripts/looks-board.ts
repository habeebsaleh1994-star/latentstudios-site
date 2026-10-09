/*
 * Every template × every look it offers × day and night, on the page the template leads with, rendered to one
 * board with how far each look stands from the others in that template. Where a template is thin, or a look
 * does not suit it, it shows here. Run: npx tsx scripts/looks-board.ts  → design/_explore/looks/index.html
 */
import { chromium } from "playwright-core";
import { writeFileSync, mkdirSync } from "node:fs";
import { HOUSES } from "../src/app/houses";

const B = "http://127.0.0.1:5181", OUT = "design/_explore/looks"; mkdirSync(`${OUT}/stills`, { recursive: true });
const br = await chromium.launch(), ctx = await br.newContext({ viewport: { width: 1440, height: 900 } }), pg = await ctx.newPage(), cv = await ctx.newPage(); pg.setDefaultTimeout(10000);
await cv.setContent("<canvas id=c width=96 height=60></canvas>");
const small = async (png: Buffer): Promise<number[]> => cv.evaluate(async (b64) => { const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode(); const c = document.getElementById("c") as HTMLCanvasElement, g = c.getContext("2d")!; g.drawImage(img, 0, 0, 96, 60); return [...g.getImageData(0, 0, 96, 60).data].filter((_, i) => i % 4 !== 3); }, png.toString("base64"));
const dist = (a: number[], b: number[]) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length / 255; };
type Cell = { house: string; look: string; mode: string; file: string; px: number[] };
const cells: Cell[] = [], stats: { house: string; n: number; min: number; median: number; nearest: string }[] = [];
for (const h of HOUSES) {
  const page = h.leads[0] === "film" ? "the-film" : h.leads[0] === "writing" ? "the-door" : "the-road-in";
  const mine: Cell[] = [];
  for (const look of h.looks) for (const mode of ["light", "dark"]) {
    await pg.goto("about:blank"); await pg.goto(`${B}/app/index.html?site=habib&house=${h.id}&preview&space=lb-${h.id}&theme=${encodeURIComponent(JSON.stringify({ look, mode }))}#/${page}`, { waitUntil: "networkidle" }); await pg.waitForTimeout(500);
    await pg.evaluate(() => { document.querySelector(".demo-note")?.remove(); document.getElementById("dock")?.remove(); scrollTo(0, 0); });
    const png = await pg.screenshot({ type: "png" }), file = `${h.id}-${look}-${mode}.jpg`;
    await pg.screenshot({ path: `${OUT}/stills/${file}`, type: "jpeg", quality: 78 });
    const cell = { house: h.id, look, mode, file, px: await small(png) }; cells.push(cell); mine.push(cell);
  }
  const ds: { d: number; a: Cell; b: Cell }[] = [];
  for (let a = 0; a < mine.length; a++) for (let b = a + 1; b < mine.length; b++) ds.push({ d: dist(mine[a].px, mine[b].px), a: mine[a], b: mine[b] });
  ds.sort((x, y) => x.d - y.d);
  stats.push({ house: h.id, n: h.looks.length, min: +ds[0].d.toFixed(3), median: +ds[Math.floor(ds.length / 2)].d.toFixed(3), nearest: `${ds[0].a.look} ${ds[0].a.mode} / ${ds[0].b.look} ${ds[0].b.mode}` });
  console.log(`${h.name.padEnd(10)} ${h.looks.length} looks · nearest pair ${ds[0].d.toFixed(3)} (${ds[0].a.look} ${ds[0].a.mode} / ${ds[0].b.look} ${ds[0].b.mode}) · median ${ds[Math.floor(ds.length / 2)].d.toFixed(3)}`);
}
await br.close();
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Every look, every template</title><style>body{margin:0;background:#EEE9E7;color:#29222A;font-family:"Instrument Sans",system-ui,sans-serif;font-size:12.5px}.wrap{max-width:1600px;margin:auto;padding:40px}h1{font:300 40px/1 Newsreader,Georgia,serif;margin:0 0 8px}p{color:#6B5F66;max-width:70ch;font:300 17px/1.5 Newsreader,Georgia,serif}h2{font:300 26px/1 Newsreader,Georgia,serif;margin:60px 0 4px}.st{color:#6B5F66;margin:0 0 14px}.row{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}figure{margin:0}figure img{width:100%;display:block;aspect-ratio:16/10;object-fit:cover;object-position:top;background:#E4DDDA}figure img+img{margin-top:4px}figcaption{margin-top:6px;color:#6B5F66}figcaption b{color:#29222A;font-weight:500}</style></head><body><div class="wrap"><h1>Every look, every template</h1><p>Each template's looks on the page it leads with, by day (above) and by night (below). Under each template: how many looks, how far the nearest two stand from each other, the median distance across all pairs. Generated ${new Date().toISOString().slice(0, 10)}.</p>
${HOUSES.map((h) => { const s = stats.find((x) => x.house === h.id)!; return `<h2>${h.name} <small style="font-size:14px;color:#6B5F66">${h.for}</small></h2><p class="st">${s.n} looks · nearest pair ${s.min} (${s.nearest}) · median ${s.median}</p><div class="row">${h.looks.map((l) => `<figure><img src="stills/${h.id}-${l}-light.jpg" alt="" loading="lazy"><img src="stills/${h.id}-${l}-dark.jpg" alt="" loading="lazy"><figcaption><b>${l}</b>${l === h.looks[0] ? " · its own" : ""}</figcaption></figure>`).join("")}</div>`; }).join("")}
</div></body></html>`;
writeFileSync(`${OUT}/index.html`, html); writeFileSync(`${OUT}/stats.json`, JSON.stringify(stats, null, 1));
console.log(`${cells.length} renders → ${OUT}/index.html`);
