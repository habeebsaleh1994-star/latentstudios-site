/*
 * Does every choice change what the artist is looking at? For every template, on every page an artist edits,
 * every Customise choice and every "how it sits" option is pressed, and the page (its first two screens,
 * the panel excluded) is compared before and after as pixels. A choice that moves the page less than the eye
 * registers on that page is listed as silent there, so it can be made to show, told where it shows, or taken
 * out of that template. Run: npx tsx scripts/visible.ts  (dev server on 5181). Writes design/_explore/audit/visible.{json,html}.
 */
import { chromium } from "playwright-core";
import { writeFileSync, mkdirSync } from "node:fs";
import { HOUSES } from "../src/app/houses";

const B = "http://127.0.0.1:5181", OUT = "design/_explore/audit"; mkdirSync(OUT, { recursive: true });
// the share of pixels that changed noticeably (any channel by more than 24/255) at 360 × 600: a recoloured word or a caption line counts; nothing counts as nothing
const SILENT = 0.0002, FAINT = 0.002;
const br = await chromium.launch(), ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" }), pg = await ctx.newPage(), cv = await ctx.newPage(); pg.setDefaultTimeout(8000);
await cv.setContent("<canvas id=c width=360 height=600></canvas>");
const small = async (png: Buffer): Promise<Uint8ClampedArray> => new Uint8ClampedArray(await cv.evaluate(async (b64) => { const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode(); const c = document.getElementById("c") as HTMLCanvasElement, g = c.getContext("2d")!; g.clearRect(0, 0, 360, 600); g.drawImage(img, 0, 0, 360, 600); return [...g.getImageData(0, 0, 360, 600).data]; }, png.toString("base64")));
const dist = (a: Uint8ClampedArray, b: Uint8ClampedArray) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 12 || Math.abs(a[i + 1] - b[i + 1]) > 12 || Math.abs(a[i + 2] - b[i + 2]) > 12) n++; return n / (a.length / 4); };
// the first two screens, and the last one (the foot of the page), as one picture
const snap = async () => { const h = await pg.evaluate(() => document.documentElement.scrollHeight); const top = await pg.screenshot({ type: "png", fullPage: true, clip: { x: 0, y: 0, width: 1080, height: 1800 } }); const foot = h > 1800 ? await pg.screenshot({ type: "png", fullPage: true, clip: { x: 0, y: Math.max(1800, h - 900), width: 1080, height: 900 } }) : null; const a = await small(top); if (!foot) return a; const b = await small(foot); const out = new Uint8ClampedArray(a.length + b.length); out.set(a); out.set(b, a.length); return out; };
const clean = () => pg.evaluate(() => { document.querySelector(".demo-note")?.remove(); });

type Row = { house: string; page: string; where: string; choice: string; d: number };
const rows: Row[] = [];
for (const h of HOUSES) {
  const lead = h.leads[0] === "film" ? "the-film" : h.leads[0] === "writing" ? "the-door" : null;
  const pages = ["", "the-road-in", ...(lead ? [lead] : []), "about"];
  for (const page of pages) {
    await pg.goto("about:blank"); await pg.goto(`${B}/app/index.html?site=habib&house=${h.id}&space=vis-${h.id}-${page || "front"}&panel=look#/${page}`, { waitUntil: "networkidle" }); await pg.waitForTimeout(500); await clean();
    const name = page || "front";
    // Customise: every button in the panel, in the order shown
    const sels: { sel: string; label: string }[] = await pg.$$eval("#panel .scroll button", (bs) => bs.map((b) => {
      const el = b as HTMLElement, set = el.closest<HTMLElement>("[data-set]");
      const sel = set ? `#panel [data-set="${set.dataset.set}"] [data-v="${el.dataset.v}"]` : el.dataset.look !== undefined ? `#panel [data-look="${el.dataset.look}"]` : el.dataset.accent !== undefined ? `#panel [data-accent="${el.dataset.accent}"]` : el.dataset.palette ? `#panel [data-palette="${el.dataset.palette}"]` : el.dataset.typeface !== undefined ? `#panel [data-typeface="${el.dataset.typeface}"]` : "";
      const label = set ? `${set.dataset.set}: ${el.textContent!.trim()}` : el.dataset.look !== undefined ? `look: ${el.dataset.look}` : el.dataset.accent !== undefined ? `accent: ${el.dataset.accent || "the look's"}` : el.dataset.palette ? `palette: ${el.dataset.palette}` : el.dataset.typeface !== undefined ? `type: ${el.dataset.typeface || "the look's"}` : "";
      return { sel, label };
    }));
    let before = await snap();
    for (const { sel, label } of sels) {
      if (!sel || !(await pg.locator(sel).count())) continue;
      if ((await pg.getAttribute(sel, "aria-pressed")) === "true") continue;
      if (/^mode: /.test(label) && /Follow/.test(label)) continue; // the device's choice: the same as Day on a light device
      if (/^motion: /.test(label)) continue; // motion is how the page moves; a still picture cannot show it
      await pg.click(sel); await pg.waitForTimeout(350);
      const after = await snap(); const d = dist(before, after); rows.push({ house: h.id, page: name, where: "customise", choice: label, d: +d.toFixed(5) }); before = after;
    }
    // Edit: how each work sits, on a story
    if (page === "the-road-in") {
      await pg.goto("about:blank"); await pg.goto(`${B}/app/index.html?site=habib&house=${h.id}&space=vis-${h.id}-edit&edit#/${page}`, { waitUntil: "networkidle" }); await pg.waitForTimeout(500); await clean();
      const ks = await pg.$$eval('#panel [data-a="tray"]', (bs) => bs.map((b) => (b as HTMLElement).dataset.k!));
      for (const k of ks.slice(0, 3)) {
        await pg.click(`#panel [data-a="tray"][data-k="${k}"]`); await pg.waitForTimeout(250);
        const opts = await pg.$$eval(`#panel [data-a="arrange"][data-k="${k}"]`, (bs) => bs.map((b) => ({ key: (b as HTMLElement).dataset.key!, label: b.textContent!.trim(), on: b.getAttribute("aria-pressed") === "true" })));
        let b2 = await snap();
        for (const o of opts) {
          if (o.on) continue;
          await pg.click(`#panel [data-a="arrange"][data-k="${k}"][data-key="${o.key}"]`); await pg.waitForTimeout(350);
          if (!(await pg.locator(`#panel [data-a="arrange"][data-k="${k}"]`).count())) { await pg.click(`#panel [data-a="tray"][data-k="${k}"]`).catch(() => {}); await pg.waitForTimeout(200); }
          const a2 = await snap(); rows.push({ house: h.id, page: name, where: `work ${Number(k) + 1} sits`, choice: `${o.label}`, d: +dist(b2, a2).toFixed(5) }); b2 = a2;
        }
      }
    }
  }
  const mine = rows.filter((r) => r.house === h.id), silent = mine.filter((r) => r.d < SILENT).length, faint = mine.filter((r) => r.d >= SILENT && r.d < FAINT).length;
  console.log(`${h.name.padEnd(10)} ${mine.length} presses · silent ${silent} · faint ${faint}`);
}
await br.close();
writeFileSync(`${OUT}/visible.json`, JSON.stringify(rows, null, 1));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const bad = rows.filter((r) => r.d < FAINT).sort((a, b) => a.d - b.d);
writeFileSync(`${OUT}/visible.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>What the eye sees</title><style>body{margin:0;background:#EEE9E7;color:#29222A;font-family:"Instrument Sans",system-ui,sans-serif;font-size:13px}.wrap{max-width:1200px;margin:auto;padding:40px}h1{font:300 40px/1 Newsreader,Georgia,serif;margin:0 0 8px}p{color:#6B5F66;max-width:70ch;font:300 17px/1.5 Newsreader,Georgia,serif}table{border-collapse:collapse;width:100%;margin-top:24px}td,th{text-align:left;padding:6px 10px;border-bottom:1px solid #D3C9C7}th{font-weight:500;color:#6B5F66;font-size:11px;letter-spacing:.12em;text-transform:uppercase}.s{color:#A4574E}.f{color:#A5895A}</style></head><body><div class="wrap"><h1>What the eye sees</h1><p>${rows.length} choices pressed across ${HOUSES.length} templates and the pages an artist edits. Each row is a choice that moved the page it was pressed on by less than the eye registers: <b>silent</b>: fewer than ${SILENT * 100}% of the pixels of its first two screens changed noticeably; <b>faint</b>: fewer than ${FAINT * 100}%. Every other choice moved its page visibly.</p><table><tr><th>Template</th><th>Page</th><th>Where</th><th>Choice</th><th>Moved</th></tr>${bad.map((r) => `<tr class="${r.d < SILENT ? "s" : "f"}"><td>${r.house}</td><td>${r.page}</td><td>${esc(r.where)}</td><td>${esc(r.choice)}</td><td>${r.d < SILENT ? "silent" : "faint"} · ${r.d}</td></tr>`).join("")}</table></div></body></html>`);
console.log(`${rows.length} presses; ${rows.filter((r) => r.d < SILENT).length} silent, ${rows.filter((r) => r.d >= SILENT && r.d < FAINT).length} faint → ${OUT}/visible.html`);
