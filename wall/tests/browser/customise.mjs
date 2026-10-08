/*
 * Every Customise choice must visibly change the page. Presses every button in the panel, on every
 * sample site, and compares what the reader sees (colours, type, frames, spacing, motion) before and after.
 */
import { chromium, webkit } from "../../node_modules/playwright-core/index.mjs";
const which = process.argv[2] || "chromium", B = "http://127.0.0.1:5181/app/index.html";
// each sample in its own template, and the three templates without a sample of their own on your site
const SITES = { habib: "the-road-in", folio: "series", index: "door", salon: "works", reel: "before", atelier: "almond", lantern: "series", "habib&house=gallery": "the-road-in", "habib&house=monograph": "the-road-in", "habib&house=passage": "the-road-in" };
const br = await (which === "webkit" ? webkit : chromium).launch(), fails = []; let pressed = 0;
const pg = await (await br.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" })).newPage(); pg.setDefaultTimeout(5000);
const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
const seen = () => pg.evaluate(() => {
  const st = (el, ks) => (el ? ks.map((k) => getComputedStyle(el)[k]).join("|") : "");
  const r = document.documentElement, app = document.getElementById("app");
  return [r.getAttribute("style"), JSON.stringify(r.dataset), st(document.body, ["backgroundColor", "color", "fontFamily", "fontSize"]),
    st(app.querySelector("h1"), ["fontFamily", "fontWeight", "fontSize", "letterSpacing", "textTransform", "color"]), st(app.querySelector("h1 em"), ["color", "fontStyle"]),
    st(app.querySelector(".frame"), ["outlineStyle", "outlineOffset", "paddingTop", "backgroundColor", "borderTopWidth"]), st(app.querySelector(".label"), ["fontFamily", "letterSpacing", "textTransform"]),
    st(app.querySelector(".work, .hang-wall, .piece, .film, .proj, .slide"), ["marginTop", "marginBottom"])].join("\n");
});
for (const [site, id] of Object.entries(SITES)) {
  await pg.goto("about:blank"); await pg.goto(`${B}?site=${site}&space=cz-${site.replace(/\W/g, "")}-${Date.now()}#/${id}`, { waitUntil: "networkidle" }); await pg.waitForTimeout(400);
  await pg.click("#tweak"); await pg.waitForTimeout(250);
  // every look the template offers, then, in its first two looks, every other choice it offers
  const looks = await pg.$$eval("#panel [data-look]", (b) => b.map((x) => x.dataset.look));
  for (const look of looks) {
    const before = await seen(); const was = await pg.getAttribute(`#panel [data-look="${look}"]`, "aria-pressed");
    await pg.click(`#panel [data-look="${look}"]`); await pg.waitForTimeout(120); pressed++;
    if (was !== "true" && (await seen()) === before) fails.push(`${site}: look ${look} changes nothing`);
  }
  for (const look of looks.slice(0, 2)) {
    await pg.click(`#panel [data-look="${look}"]`); await pg.waitForTimeout(150);
    const sels = await pg.$$eval("#panel .scroll button:not([data-look])", (bs) => bs.map((b) => { const p = b.closest("[data-set]"); return p ? `#panel [data-set="${p.dataset.set}"] [data-v="${b.dataset.v}"]` : b.dataset.accent !== undefined ? `#panel [data-accent="${b.dataset.accent}"]` : b.dataset.palette ? `#panel [data-palette="${b.dataset.palette}"]` : b.dataset.typeface !== undefined ? `#panel [data-typeface="${b.dataset.typeface}"]` : null; }).filter(Boolean));
    for (const sel of sels) {
      if (!(await pg.locator(sel).count())) continue;
      if ((await pg.getAttribute(sel, "aria-pressed")) === "true") continue;
      const before = await seen(); await pg.click(sel); await pg.waitForTimeout(120); pressed++;
      // Day and "Follow the device" are the same light on a light device: switching between them may look the same
      const light = /data-set="mode"\] \[data-v="(light|system)"/.test(sel) && (await pg.getAttribute('#panel [data-set="mode"] [data-v="light"]', "aria-pressed") === "true" || await pg.getAttribute('#panel [data-set="mode"] [data-v="system"]', "aria-pressed") === "true");
      if ((await seen()) === before && !light) fails.push(`${site} (${look}): ${sel.replace("#panel ", "")} changes nothing`);
    }
  }
  if (errs.length) fails.push(`${site}: ${errs.splice(0).join(" | ")}`);
}
console.log(which, `${pressed} choices pressed;`, fails.length ? "FAILS:\n  " + fails.join("\n  ") : "every choice changes the page"); await br.close();
