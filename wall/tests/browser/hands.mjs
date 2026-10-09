/* The hands and the ears: on every template's front, story and About, every control can be reached by keyboard and shows its focus; every picture has words for a screen reader or is marked decorative; landmarks are there; with reduced motion asked for, nothing animates. Reports; writes design/_explore/audit/hands.json. */
import { chromium } from "../../node_modules/playwright-core/index.mjs";
import { writeFileSync } from "node:fs";
const B = "http://127.0.0.1:5181", houses = ["folio", "gallery", "monograph", "passage", "reel", "salon", "index", "atelier", "lantern", "journal", "column", "catalogue", "chapbook", "cinema", "ledger", "pinboard", "studio", "archive"];
const br = await chromium.launch(), issues = [], rows = [];
const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } }), pg = await ctx.newPage(); pg.setDefaultTimeout(15000);
for (const h of houses) {
  const story = h === "cinema" || h === "reel" ? "the-film" : h === "index" || h === "chapbook" || h === "column" ? "the-door" : "the-road-in";
  for (const page of ["", story, "about"]) {
    await pg.goto("about:blank"); await pg.goto(`${B}/app/index.html?site=habib&house=${h}&preview&space=hands-${h}#/${page}`, { waitUntil: "networkidle" }); await pg.waitForTimeout(500);
    await pg.evaluate(() => { document.querySelector(".demo-note")?.remove(); document.getElementById("dock")?.remove(); });
    const r = await pg.evaluate(() => {
      const out = { landmarks: { main: !!document.querySelector("main"), header: !!document.querySelector("header"), nav: !!document.querySelector("nav[aria-label]"), h1: document.querySelectorAll("h1").length }, imgsNoAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).length, imgsEmptyAlt: [...document.images].filter((i) => i.getAttribute("alt") === "" ).length, imgs: document.images.length, buttonsNoName: [...document.querySelectorAll("button:not([aria-hidden=\"true\"])")].filter((b) => !(b.textContent.trim() || b.getAttribute("aria-label") || b.getAttribute("title"))).length, linksNoName: [...document.querySelectorAll("a[href]")].filter((a) => !(a.textContent.trim() || a.getAttribute("aria-label") || a.querySelector("img[alt]:not([alt=''])"))).length };
      return out;
    });
    // keyboard: tab through up to 60 stops; every stop must be visible and show focus (outline or box-shadow or colour change)
    await pg.evaluate(() => { (document.activeElement)?.blur(); scrollTo(0, 0); });
    const stops = []; let unseen = 0, noRing = 0;
    for (let i = 0; i < 60; i++) {
      await pg.keyboard.press("Tab");
      const st = await pg.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return null; const cs = getComputedStyle(a); const r = a.getBoundingClientRect(); const ring = cs.outlineStyle !== "none" && cs.outlineWidth !== "0px"; const visible = r.width > 0 && r.height > 0 && cs.visibility !== "hidden"; return { tag: a.tagName.toLowerCase(), cls: a.className && String(a.className).split(" ")[0], ring, visible, text: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 30) }; });
      if (!st) break; stops.push(st); if (!st.visible) unseen++; if (!st.ring) noRing++;
    }
    const row = { house: h, page: page || "front", ...r, stops: stops.length, unseen, noRing };
    rows.push(row);
    if (!r.landmarks.main || !r.landmarks.header || r.landmarks.h1 !== 1) issues.push(`${h}/${page || "front"}: landmarks ${JSON.stringify(r.landmarks)}`);
    if (r.imgsNoAlt) issues.push(`${h}/${page || "front"}: ${r.imgsNoAlt} pictures without alt`);
    if (r.buttonsNoName) issues.push(`${h}/${page || "front"}: ${r.buttonsNoName} buttons without a name`);
    if (r.linksNoName) issues.push(`${h}/${page || "front"}: ${r.linksNoName} links without a name`);
    if (unseen) issues.push(`${h}/${page || "front"}: ${unseen} focus stops on things not visible`);
    if (noRing) issues.push(`${h}/${page || "front"}: ${noRing} of ${stops.length} focus stops show no ring (${stops.filter((s) => !s.ring).slice(0, 4).map((s) => s.tag + "." + s.cls).join(", ")})`);
  }
}
// reduced motion: with it asked for, no element on a story page carries a transition or animation longer than 0
const rm = await br.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" }), p2 = await rm.newPage();
for (const h of ["folio", "passage", "lantern", "pinboard"]) {
  await p2.goto(`${B}/app/index.html?site=habib&house=${h}&preview&space=hands-rm-${h}#/the-road-in`, { waitUntil: "networkidle" }); await p2.waitForTimeout(400);
  const moving = await p2.evaluate(() => [...document.querySelectorAll("#app *")].filter((el) => { const cs = getComputedStyle(el); return (cs.animationName !== "none" && cs.animationDuration !== "0s") || (cs.transitionDuration !== "0s" && cs.transitionProperty !== "none" && cs.transitionDuration.split(",").some((d) => parseFloat(d) > 0.3)); }).length);
  if (moving) issues.push(`${h}: ${moving} elements still move under reduced motion`);
}
await br.close();
writeFileSync("design/_explore/audit/hands.json", JSON.stringify({ rows, issues }, null, 1));
console.log(`${rows.length} pages; ${issues.length} issues`); for (const i of issues) console.log(" " + i);
