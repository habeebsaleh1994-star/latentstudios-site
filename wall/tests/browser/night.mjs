/* Day and night, one identity: every template's front, a story and About, the editor, the start page and the home page, rendered by day and by night; every piece of text checked for contrast. Writes a board to design/_explore/night. */
import { chromium } from "../../node_modules/playwright-core/index.mjs";
import { writeFileSync } from "node:fs";
const B = "http://127.0.0.1:5181", OUT = "design/_explore/night/stills";
const houses = ["folio", "gallery", "monograph", "passage", "reel", "salon", "index", "atelier", "lantern", "journal", "column", "catalogue", "chapbook", "cinema", "ledger", "pinboard", "studio", "archive"];
const br = await chromium.launch(), issues = [], shots = [], notNight = [];
async function check(pg, name) {
  return pg.evaluate((name) => {
    // rgb(a)(0–255) and color(srgb 0–1 / a), which color-mix() resolves to
    const parts = (c) => { const m = c.match(/-?\d*\.?\d+(e-?\d+)?/g); if (!m) return null; const srgb = /^color\(srgb/.test(c); const v = m.slice(0, 3).map(Number).map((x) => (srgb ? x * 255 : x)); const a = m.length > 3 ? Number(m[3]) : 1; return { v, a }; };
    const lum = (c) => { const p = parts(c); if (!p || p.a === 0) return null; const [r, g, b] = p.v.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
    const alpha = (c) => { const p = parts(c); return p ? p.a : 1; };
    const bgOf = (el) => { let e = el; while (e) { const cs = getComputedStyle(e); if (cs.backgroundImage !== "none") return "image"; if (alpha(cs.backgroundColor) < 1) { e = e.parentElement; continue; } const l = lum(cs.backgroundColor); if (l != null) return l; e = e.parentElement; } return lum(getComputedStyle(document.body).backgroundColor) ?? 1; };
    const out = []; const seen = new Set();
    for (const el of document.querySelectorAll("body *")) {
      if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
      if (el.closest(".lb, #panel .sw, .demo-note")) continue;
      if ([el, ...(function* (e) { while ((e = e.parentElement)) yield e; })(el)].some((x) => getComputedStyle(x).mixBlendMode !== "normal")) continue; // blended over what is beneath: not judged here
      const bg = bgOf(el); if (bg === "image") continue;
      const fg = lum(cs.color); if (fg == null) continue;
      const ratio = (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05), size = parseFloat(cs.fontSize), big = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
      const need = big ? 3 : 4.5;
      if (ratio < need) { const key = el.className + "|" + el.tagName; if (seen.has(key)) continue; seen.add(key); out.push({ page: name, el: el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : ""), text: el.textContent.trim().slice(0, 40), ratio: +ratio.toFixed(2), need, size }); }
    }
    return out;
  }, name);
}
for (const scheme of ["light", "dark"]) {
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme }), pg = await ctx.newPage(); pg.setDefaultTimeout(15000);
  const shot = async (name, url, prep) => {
    await pg.goto("about:blank"); await pg.goto(url, { waitUntil: "networkidle" }); await pg.waitForTimeout(700);
    if (prep) await prep(); await pg.evaluate(() => document.querySelector(".demo-note")?.remove());
    for (let y = 0; y < 2400; y += 600) { await pg.evaluate((v) => scrollTo(0, v), y); await pg.waitForTimeout(60); } await pg.evaluate(() => scrollTo(0, 0)); await pg.waitForTimeout(400);
    const file = `${name}-${scheme}.jpg`; await pg.screenshot({ path: `${OUT}/${file}`, type: "jpeg", quality: 80 });
    const ground = await pg.evaluate(() => getComputedStyle(document.body).backgroundColor), dark = (() => { const m = ground.match(/\d+/g); return m && (Number(m[0]) + Number(m[1]) + Number(m[2])) / 3 < 110; })();
    shots.push({ name, scheme, file, dark }); if ((scheme === "dark") !== !!dark && !/^home/.test(name)) notNight.push(`${name} (${scheme}) ground ${ground}`);
    issues.push(...(await check(pg, `${name} (${scheme})`)));
  };
  // asked for explicitly, so a template that opens at night by its own decision (Passage, Reel, Cinema) is still seen by day
  const night = `&theme=${encodeURIComponent(JSON.stringify({ mode: scheme === "dark" ? "dark" : "light" }))}`;
  for (const h of houses) {
    const story = h === "reel" || h === "cinema" ? "the-film" : h === "index" || h === "chapbook" || h === "column" ? "the-door" : "the-road-in";
    await shot(`${h}-front`, `${B}/app/index.html?site=habib&house=${h}&preview&space=night-${h}${night}#/`);
    await shot(`${h}-story`, `${B}/app/index.html?site=habib&house=${h}&preview&space=night-${h}${night}#/${story}`);
    await shot(`${h}-about`, `${B}/app/index.html?site=habib&house=${h}&preview&space=night-${h}${night}#/about`);
  }
  await shot("editor", `${B}/app/index.html?site=habib&house=folio&space=night-ed&edit${night}#/the-road-in`);
  await shot("customise", `${B}/app/index.html?site=habib&house=folio&space=night-ed2&panel=look${night}#/the-road-in`);
  await shot("publish", `${B}/app/index.html?site=habib&house=folio&space=night-ed3&publish${night}#/the-road-in`);
  await shot("start", `${B}/app/index.html?reset&space=night-start`);
  await shot("home", `${B}/design/home/index.html`);
  await shot("home-b", `${B}/design/_explore/home/b/index.html`);
  await ctx.close();
}
await br.close();
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Day and night</title><style>body{margin:0;background:#EEE9E7;color:#29222A;font-family:"Instrument Sans",system-ui,sans-serif;font-size:13px}.wrap{max-width:1500px;margin:auto;padding:40px}h1{font:300 40px/1 Newsreader,Georgia,serif;margin:0 0 8px}p{color:#6B5F66;max-width:70ch}.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:36px}.pair img{width:100%;display:block;background:#E4DDDA}.pair h2{grid-column:1/-1;font:300 22px/1 Newsreader,Georgia,serif;margin:0}.issues{margin-top:50px;border-top:1px solid #D3C9C7;padding-top:20px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:6px 10px;border-bottom:1px solid #D3C9C7;font-size:12.5px}th{font-weight:500}.bad{color:#A4574E}</style></head><body><div class="wrap"><h1>Day and night</h1><p>Every template's front page, a story and About, the editor, Customise, Publish, the start page and the home page: by day, and by night. ${issues.length} text elements fall under the WCAG contrast needed (4.5, or 3 for large type); listed at the end. Generated ${new Date().toISOString().slice(0, 10)}.</p>
${[...new Set(shots.map((s) => s.name))].map((n) => `<div class="pair"><h2>${n}</h2><img src="stills/${n}-light.jpg" alt="${n}, day" loading="lazy"><img src="stills/${n}-dark.jpg" alt="${n}, night" loading="lazy"></div>`).join("")}
<div class="issues"><h2 style="font:300 22px/1 Newsreader,Georgia,serif">Contrast</h2><table><tr><th>Page</th><th>Element</th><th>Text</th><th>Ratio</th><th>Needs</th></tr>${issues.map((i) => `<tr><td>${i.page}</td><td>${i.el}</td><td>${i.text.replace(/</g, "&lt;")}</td><td class="bad">${i.ratio}</td><td>${i.need}</td></tr>`).join("")}</table></div></div></body></html>`;
writeFileSync("design/_explore/night/index.html", html);
console.log(`${shots.length} renders, ${issues.length} contrast issues, ${notNight.length} renders not in the mode asked for`); for (const n of notNight) console.log(" wrong mode:", n); for (const i of issues) console.log(` ${i.page}: ${i.el} "${i.text}" ${i.ratio} (needs ${i.need})`);
