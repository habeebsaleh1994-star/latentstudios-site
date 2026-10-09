import { chromium, webkit } from "../../node_modules/playwright-core/index.mjs";
const which = process.argv[2] || "chromium", B = "http://127.0.0.1:5181/app/index.html";
const routes = { habib: ["", "the-road-in", "he-looked-back", "through-the-gate", "afternoon", "late-light", "the-film", "the-door", "about", "contact"], folio: ["", "series"], index: ["", "door", "guest", "about"], salon: ["", "works"], reel: ["", "before"], atelier: ["", "almond", "about"], lantern: ["", "series"], "habib&house=journal": ["", "the-road-in", "about"], "habib&house=column": ["", "the-road-in", "about"], "habib&house=catalogue": ["", "the-road-in", "about"], "habib&house=chapbook": ["", "the-road-in", "about"], "habib&house=cinema": ["", "the-film", "about"], "habib&house=ledger": ["", "the-road-in", "about"], "habib&house=pinboard": ["", "the-road-in", "about"], "habib&house=studio": ["", "the-road-in", "about"], "habib&house=archive": ["", "the-road-in", "about"] };
const br = await (which === "webkit" ? webkit : chromium).launch(); const fails = [];
for (const [k, vp] of Object.entries({ d: { width: 1440, height: 900 }, p: { width: 390, height: 780 } })) {
  const pg = await (await br.newContext({ viewport: vp, colorScheme: "light" })).newPage(); const errs = [];
  pg.on("pageerror", e => errs.push(e.message)); pg.on("console", m => m.type() === "error" && errs.push(m.text()));
  for (const [s, ids] of Object.entries(routes)) for (const id of ids) {
    await pg.goto("about:blank"); await pg.goto(`${B}?site=${s}#/${id}`, { waitUntil: "networkidle" }); await pg.waitForTimeout(600);
    const info = await pg.evaluate(() => ({ view: document.documentElement.dataset.view, wide: document.documentElement.scrollWidth - innerWidth, imgs: document.images.length, broken: [...document.images].filter(i => i.complete && !i.naturalWidth).length, h1: document.querySelector("h1")?.textContent?.slice(0, 40) }));
    await pg.screenshot({ path: `/tmp/wall-shots/${which[0]}${k}-${s.replace(/\W/g, "")}-${id || "front"}.png` });
    if (info.wide > 0 || info.broken || errs.length || !info.view) fails.push(`${k} ${s}/${id}: ${JSON.stringify(info)} ${errs.splice(0).join(" | ")}`);
    else console.log(k, s, id || "front", info.view, info.imgs + " imgs", info.h1);
  }
}
console.log(which, fails.length ? "FAILS:\n  " + fails.join("\n  ") : "all pages clean"); await br.close();
