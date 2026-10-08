/*
 * Publishing, the whole way: the draft says what changed, Publish makes a version, the published site opens as a
 * visitor would see it, the files download and open from disk in the right look, an earlier version can be put back.
 */
import { chromium, webkit } from "../../node_modules/playwright-core/index.mjs";
import { mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
const which = process.argv[2] || "chromium", B = "http://127.0.0.1:5181", OUT = `/tmp/wall-shots/publish-${which}`;
const br = await (which === "webkit" ? webkit : chromium).launch(), fails = [];
const ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }), pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
const ok = (c, m) => { if (!c) fails.push(m); };
const w = (ms) => pg.waitForTimeout(ms);
const space = "pub" + Date.now();
// a site of our own in this space, made from the sample
await pg.goto(`${B}/app/index.html?site=habib&space=${space}&edit#/`, { waitUntil: "networkidle" }); await w(600);
// one story as a book, so the files are checked for turning too
await pg.evaluate(() => { location.hash = "#/he-looked-back"; }); await w(500); await pg.click('#panel .seg[data-set="arrangement"] [data-v="book"]'); await w(500);
await pg.evaluate(() => { location.hash = "#/"; }); await w(400);
await pg.click("#publish"); await w(400);
ok(await pg.locator("#panel .addr").innerText() === "habib-saleh.latent.site", "the address comes from the name");
ok(/first time/.test(await pg.locator("#panel .diff:not(.warn)").innerText()), "the first publish says it is the first");
await pg.click('#panel [data-pub="publish"]'); await pg.waitForSelector("#panel .versions", { timeout: 20000 }); await w(400);
ok(/Version 1 published/.test(await pg.locator("#panel .pub-go").innerText()), "version 1 is published");
ok(await pg.locator('#panel [data-pub="publish"]').isDisabled(), "nothing to publish right after publishing");
// a change makes a draft; the panel says what changed
await pg.click("#panel .x"); await w(200); await pg.click("#edit"); await w(200); await pg.click("#edit"); await w(400); // Done, then Edit again: the Edit panel is back
await pg.click('#panel [data-tab="site"]'); await w(200); await pg.click('#panel [data-a="page-add"][data-kind="story"]'); await w(500);
await pg.click("#publish"); await w(400);
ok(/New: New story/.test(await pg.locator("#panel .diff:not(.warn)").innerText()), "the draft lists the new story");
ok(/draft/i.test(await pg.locator("#meter").innerText()), "the meter says it is a draft");
// the published site is version 1, not the draft
const p2 = await ctx.newPage(); await p2.goto(`${B}/app/index.html?published&space=${space}#/`, { waitUntil: "networkidle" }); await p2.waitForTimeout(500);
ok(!(await p2.locator("#dock").count()), "the published site has no editor");
ok(!(await p2.evaluate(() => window.__wall.site.pages.some((p) => p.id === "new-story"))), "the published site does not have the draft's new story");
await p2.close();
// publish again: version 2; then put version 1 back
await pg.click('#panel [data-pub="publish"]'); await pg.waitForSelector('#panel .versions li:nth-child(2)', { timeout: 20000 }); await w(400);
ok(await pg.locator("#panel .versions li").count() === 2, "two versions kept");
await pg.click('#panel [data-pub="restore"][data-n="1"]'); await w(600);
ok(!(await pg.evaluate(() => window.__wall.site.pages.some((p) => p.id === "new-story"))), "putting version 1 back removes the new story from the draft");
ok(/Removed: New story/.test(await pg.locator("#panel .diff:not(.warn)").innerText()), "and the draft now says the story would be removed");
// the files: download, unzip, open from disk
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const [dl] = await Promise.all([pg.waitForEvent("download", { timeout: 30000 }), pg.click('#panel a[download], #panel [data-pub="download"]')]);
const zipPath = `${OUT}/site.zip`; await dl.saveAs(zipPath); execSync(`unzip -q -o ${zipPath} -d ${OUT}/site`);
ok(existsSync(`${OUT}/site/index.html`) && existsSync(`${OUT}/site/the-road-in/index.html`) && existsSync(`${OUT}/site/assets/visitor.js`), "the zip holds the front page, a story and the visitor script");
const imgs = readdirSync(`${OUT}/site/assets/img`); ok(imgs.includes("12.jpg"), "and the photographs");
const p3 = await ctx.newPage(); const e3 = []; p3.on("pageerror", (e) => e3.push(e.message));
await p3.goto(`file://${OUT}/site/the-road-in/index.html`); await p3.waitForTimeout(800);
for (let y = 0; y < 6000; y += 700) { await p3.evaluate((v) => scrollTo(0, v), y); await p3.waitForTimeout(150); } // photographs below the fold load lazily
await p3.evaluate(() => scrollTo(0, 0)); await p3.waitForTimeout(600);
const st = await p3.evaluate(() => ({ look: document.documentElement.dataset.look, view: document.documentElement.dataset.view, ground: getComputedStyle(document.body).backgroundColor, imgs: [...document.images].filter((i) => i.naturalWidth > 0).length, next: document.querySelector(".onward")?.getAttribute("href"), edit: !!document.querySelector("[contenteditable]") }));
ok(st.look === "quiet" && st.view === "held", `the story page from disk is Folio's held story: ${JSON.stringify(st)}`);
ok(st.imgs >= 3, `its photographs load from disk (${st.imgs})`);
ok(st.next && st.next.startsWith("../"), `links between pages are relative (${st.next})`);
ok(!st.edit && st.ground !== "rgba(0, 0, 0, 0)", "no editing marks, and the look applied");
ok(e3.length === 0, `no errors on the file from disk: ${e3.join(" | ")}`);
await p3.goto(`file://${OUT}/site/he-looked-back/index.html`); await p3.waitForTimeout(1200);
ok(await p3.locator("#spread .pg").count() > 0 && /\/ \d+$/.test(await p3.locator(".count").innerText()), "the book turns from disk");
await p3.close();
if (errs.length) fails.push(errs.join(" | "));
console.log(which, fails.length ? "FAILS:\n  " + fails.join("\n  ") : "publishing works the whole way"); await br.close();
