/* Files from the computer: a folder becomes a story in the order taken with the words from the files; a drop adds to the story at hand; Replace keeps a work's place and words. */
import { chromium, webkit } from "../../node_modules/playwright-core/index.mjs";
const which = process.argv[2] || "chromium", B = "http://127.0.0.1:5181", DIR = "/tmp/wall-shots/Joun autumn";
const br = await (which === "webkit" ? webkit : chromium).launch(), fails = [];
const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } }), pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
const ok = (c, m) => { if (!c) fails.push(m); }; const w = (ms) => pg.waitForTimeout(ms);
const site = () => pg.evaluate(() => window.__wall.site);
// an empty site of our own (a fresh browser context: its "mine" is empty)
await pg.goto(`${B}/app/index.html?start=folio`, { waitUntil: "networkidle" }); await w(400);
await pg.fill("#s-name", "Nadia Haddad"); await pg.click(".s-go"); await pg.waitForURL(/edit/); await pg.waitForLoadState("networkidle"); await w(600);
// 1. a folder becomes a story
await pg.click('#panel [data-tab="site"]'); await w(200);
const [fc] = await Promise.all([pg.waitForEvent("filechooser"), pg.click('#panel [data-a="folder"]')]);
ok(fc.isMultiple(), "the folder chooser takes many files");
try { await fc.setFiles(DIR); } catch { await fc.setFiles(["7.jpg", "8.jpg", "12.jpg"].map((f) => `${DIR}/${f}`)); }
await pg.waitForFunction(() => window.__wall.site.pages.some((p) => p.kind === "story"), null, { timeout: 30000 }); await w(800);
let s = await site(); const story = s.pages.find((p) => p.kind === "story");
ok(story && /joun/i.test(story.title), `the story is named after the folder: ${story?.title}`);
const assets = story.pieces.map((x) => x.asset), lib = assets.map((a) => s.library[a]);
ok(assets.length === 3, `three works (${assets.length})`);
ok(lib.map((l) => l.date).join("|") === "7 Mar 2025|24 Mar 2025|10 Nov 2025", `in the order taken, with their dates: ${lib.map((l) => l.date).join(" | ")}`);
ok(lib.some((l) => l.title === "Stray Cat in an Abandoned House"), `titles from the files: ${lib.map((l) => l.title).join(" | ")}`);
ok(lib.every((l) => l.caption && l.alt === l.caption), "captions from the files, kept as the alt text too");
ok(/#\/joun/.test(await pg.evaluate(() => location.hash)), "the new story opens");
ok(await pg.locator(".v-held .work").count() === 3, "and shows its three works");
// 2. a drop onto the story adds to it
await pg.evaluate(async () => {
  const dt = new DataTransfer();
  for (const n of ["1.jpg", "2.jpg"]) { const b = await (await fetch(`/design/folio/img/${n}`)).blob(); dt.items.add(new File([b], n, { type: "image/jpeg" })); }
  document.body.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer: dt }));
  await new Promise((r) => setTimeout(r, 100));
  window.__dropHint = document.getElementById("drop").querySelector("span").textContent;
  document.body.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
});
await pg.waitForFunction(() => window.__wall.site.pages.find((p) => p.kind === "story").pieces.length === 5, null, { timeout: 30000 }); await w(400);
ok(/Drop to add to/.test(await pg.evaluate(() => window.__dropHint)), `the drop hint names the story: ${await pg.evaluate(() => window.__dropHint)}`);
s = await site(); ok(s.pages.find((p) => p.kind === "story").pieces.length === 5, "the dropped photographs joined the story");
// 3. Replace keeps the place and the words
const first = s.pages.find((p) => p.kind === "story").pieces[0].asset, before = s.library[first];
await pg.hover(".v-held .frame >> nth=0"); await w(200);
const [fc2] = await Promise.all([pg.waitForEvent("filechooser"), pg.click('.tb [data-a="replace"][data-k="0"]')]);
await fc2.setFiles(`${DIR}/12.jpg`); await pg.waitForFunction((a) => !window.__wall.site.library[a], first, { timeout: 30000 }); await w(600);
s = await site(); const now = s.pages.find((p) => p.kind === "story").pieces[0].asset, after = s.library[now];
ok(now !== first && !s.library[first], "the old photograph is gone from the library");
ok(after.title === before.title && after.caption === before.caption && after.date === before.date, `its words stayed: ${after.title} / ${after.date}`);
ok(await pg.evaluate(() => { const i = document.querySelector(".v-held .frame img"); return i.complete && i.naturalWidth > 0; }), "the new photograph shows");
ok(/replaced/i.test(await pg.locator(".toast").innerText().catch(() => "")), "and it says so");
if (errs.length) fails.push(errs.join(" | "));
console.log(which, fails.length ? "FAILS:\n  " + fails.join("\n  ") : "folders, drops and replacing work"); await br.close();
