/* Every panel, in every template, fits: nothing inside runs wider than the panel, at desktop and phone size. */
import { chromium, webkit } from "../../node_modules/playwright-core/index.mjs";
const which = process.argv[2] || "chromium", B = "http://127.0.0.1:5181/app/index.html";
const H = ["folio", "gallery", "monograph", "passage", "reel", "salon", "index", "atelier", "lantern"];
const br = await (which === "webkit" ? webkit : chromium).launch(), fails = [];
for (const vp of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 780 }]) {
  const pg = await (await br.newContext({ viewport: vp })).newPage(); pg.setDefaultTimeout(5000);
  for (const h of H) {
    await pg.goto("about:blank"); await pg.goto(`${B}?site=habib&house=${h}&space=pn-${h}-${Date.now()}#/the-road-in`, { waitUntil: "networkidle" }); await pg.waitForTimeout(350);
    const check = async (name) => {
      const r = await pg.evaluate(() => { const p = document.getElementById("panel"), sc = p.querySelector(".scroll"), pr = p.getBoundingClientRect(), out = [];
        if (sc && sc.scrollWidth > sc.clientWidth + 1) out.push(`scrolls sideways by ${sc.scrollWidth - sc.clientWidth}px`);
        p.querySelectorAll(".scroll *").forEach((e) => { const b = e.getBoundingClientRect(); if (b.width && (b.right > pr.right + 1 || b.left < pr.left - 1)) out.push(`${e.tagName.toLowerCase()}.${e.className || ""} "${(e.textContent || "").trim().slice(0, 20)}" overflows`); });
        return [...new Set(out)].slice(0, 4); });
      if (r.length) fails.push(`${vp.width} ${h} ${name}: ${r.join("; ")}`);
    };
    await pg.click("#tweak"); await pg.waitForTimeout(250); await check("Customise");
    await pg.click('#panel [data-a="houses"]'); await pg.waitForTimeout(200); await check("Customise, templates open");
    await pg.click('#panel [data-a="close"]'); await pg.waitForTimeout(150);
    await pg.click("#edit"); await pg.waitForTimeout(300);
    if (vp.width < 761) { await pg.click("#page-btn"); await pg.waitForTimeout(250); }
    await check("Edit, this page");
    await pg.click('#panel [data-tab="site"]'); await pg.waitForTimeout(200); await check("Edit, the site");
  }
  await pg.close();
}
console.log(which, fails.length ? "FAILS:\n  " + fails.join("\n  ") : "every panel fits"); await br.close();
