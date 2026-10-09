/*
 * Speed, as a visitor's browser measures it: for every template's front and story, the largest paint, the layout
 * shift, the number and weight of images requested, and the longest task. Run: npx tsx scripts/speed.ts
 */
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";
import { HOUSES } from "../src/app/houses";
const B = "http://127.0.0.1:5181", br = await chromium.launch(), rows: Record<string, unknown>[] = [];
for (const h of HOUSES) {
  const story = h.leads[0] === "film" ? "the-film" : h.leads[0] === "writing" ? "the-door" : "the-road-in";
  for (const page of ["", story]) {
    const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } }), pg = await ctx.newPage(); let bytes = 0, imgs = 0;
    pg.on("response", async (r) => { if (/image\//.test(r.headers()["content-type"] ?? "")) { imgs++; try { bytes += (await r.body()).length; } catch { /* a cached or aborted body */ } } });
    await pg.addInitScript(() => { (window as unknown as { __m: { lcp: number; cls: number; long: number } }).__m = { lcp: 0, cls: 0, long: 0 }; const m = (window as unknown as { __m: { lcp: number; cls: number; long: number } }).__m; new PerformanceObserver((l) => { for (const e of l.getEntries()) m.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true }); new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!(e as unknown as { hadRecentInput: boolean }).hadRecentInput) m.cls += (e as unknown as { value: number }).value; }).observe({ type: "layout-shift", buffered: true }); new PerformanceObserver((l) => { for (const e of l.getEntries()) m.long = Math.max(m.long, e.duration); }).observe({ type: "longtask", buffered: true }); });
    const t0 = Date.now(); await pg.goto(`${B}/app/index.html?site=habib&house=${h.id}&preview&space=speed-${h.id}#/${page}`, { waitUntil: "load" }); await pg.waitForTimeout(1500);
    const m = await pg.evaluate(() => (window as unknown as { __m: { lcp: number; cls: number; long: number } }).__m);
    rows.push({ house: h.id, page: page || "front", lcp: Math.round(m.lcp), cls: +m.cls.toFixed(3), long: Math.round(m.long), imgs, kb: Math.round(bytes / 1024), load: Date.now() - t0 });
    await ctx.close();
  }
}
await br.close();
writeFileSync("design/_explore/audit/speed.json", JSON.stringify(rows, null, 1));
const worst = (k: string) => [...rows].sort((a, b) => (b[k] as number) - (a[k] as number)).slice(0, 5).map((r) => `${r.house}/${r.page} ${r[k]}`).join(", ");
console.log(`${rows.length} pages (dev server, uncompressed modules; the published files are lighter)`);
console.log("largest paint, worst:", worst("lcp")); console.log("layout shift, worst:", worst("cls")); console.log("image weight KB, worst:", worst("kb")); console.log("longest task ms, worst:", worst("long"));
console.log("median LCP", [...rows].sort((a, b) => (a.lcp as number) - (b.lcp as number))[Math.floor(rows.length / 2)].lcp, "median image KB", [...rows].sort((a, b) => (a.kb as number) - (b.kb as number))[Math.floor(rows.length / 2)].kb);
