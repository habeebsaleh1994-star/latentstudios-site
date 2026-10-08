/*
 * What we show is what you get. For every template: the thumbnail on the home page, the template on the
 * board, and the copy you get from "Try" must be the same site, in a light browser and a dark one,
 * the first time and after the copy has been edited and reloaded.
 */
import { chromium, webkit } from "../../node_modules/playwright-core/index.mjs";
const which = process.argv[2] || "chromium", B = "http://127.0.0.1:5181";
const H = ["folio", "gallery", "monograph", "passage", "reel", "salon", "index", "atelier", "lantern"];
const br = await (which === "webkit" ? webkit : chromium).launch(), fails = [], results = {};
const seen = (pg) => pg.evaluate(() => { const d = document.documentElement.dataset, w = window.__wall.site;
  return JSON.stringify({ house: w.house, view: d.view, look: d.look, header: d.header, opening: d.opening, title: d.title, captions: d.captions, footer: d.footer, scale: d.scale, front: w.front.form, scheme: document.documentElement.style.colorScheme, ground: getComputedStyle(document.body).backgroundColor, arr: w.pages.filter((p) => p.kind === "story").map((p) => p.arrangement).join(","), first: (document.querySelector("#app main")?.className ?? "") }); });
for (const scheme of ["light", "dark"]) {
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme }); const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  // the home page's own links, so the test checks exactly what an artist clicks
  await pg.goto(`${B}/design/home/index.html`, { waitUntil: "networkidle" });
  const links = await pg.$$eval(".t", (ts) => ts.map((t) => ({ id: t.dataset.id, preview: t.querySelector("iframe").dataset.src || t.querySelector("iframe").getAttribute("src"), tryIt: t.getAttribute("href") })));
  for (const h of H) {
    const l = links.find((x) => x.id === h); if (!l) { fails.push(`${scheme} ${h}: not on the home page`); continue; }
    const open = async (u) => { await pg.goto("about:blank"); await pg.goto(B + u, { waitUntil: "networkidle" }); await pg.waitForTimeout(500); return seen(pg); };
    const thumb = await open(l.preview), tried = await open(l.tryIt.replace("&edit", ""));
    // edit the try copy, reload: it must come back as the template, not as the edited copy
    await pg.evaluate(() => { window.__wall.site.front.title = "Changed"; });
    const again = await open(l.tryIt.replace("&edit", ""));
    if (thumb !== tried) fails.push(`${scheme} ${h}: the thumbnail and "Try" differ\n     thumbnail ${thumb}\n     try       ${tried}`);
    if (again !== tried) fails.push(`${scheme} ${h}: "Try" changed after a reload`);
    if (JSON.parse(thumb).house !== h) fails.push(`${scheme} ${h}: the thumbnail shows ${JSON.parse(thumb).house}`);
    if (scheme === "dark") { const lightOne = results[h]; if (lightOne && lightOne !== thumb) fails.push(`${scheme} ${h}: looks different on a dark device\n     light ${lightOne}\n     dark  ${thumb}`); }
    else results[h] = thumb;
  }
  await ctx.close();
}

console.log(which, fails.length ? "FAILS:\n  " + fails.join("\n  ") : "every thumbnail is the template you get"); await br.close();
