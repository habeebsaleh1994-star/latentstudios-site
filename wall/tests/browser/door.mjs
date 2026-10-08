/* The door: a page behind a word, the site behind a word, and "soon". Set in the editor, met by a visitor in the draft, the published view, and the files from disk (where the page is sealed). */
import { chromium, webkit } from "../../node_modules/playwright-core/index.mjs";
import { mkdirSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
const which = process.argv[2] || "chromium", B = "http://127.0.0.1:5181", OUT = `/tmp/wall-shots/door-${which}`;
const br = await (which === "webkit" ? webkit : chromium).launch(), fails = [];
const ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }), pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
const ok = (c, m) => { if (!c) fails.push(m); }; const w = (ms) => pg.waitForTimeout(ms);
const space = "dr" + Date.now();
const knock = async (page, word) => { await page.fill("[data-door] input", word); await page.click("[data-door] button"); await page.waitForTimeout(1200); };
const fresh = async (url) => { await pg.goto("about:blank"); await pg.goto(url, { waitUntil: "networkidle" }); await w(600); }; // a goto that differs only by the hash would not reload
const setField = async (sel, v) => { await pg.fill(sel, v); await pg.dispatchEvent(sel, "change"); await w(300); };

// a page behind a word
await pg.goto(`${B}/app/index.html?site=habib&space=${space}&edit#/the-road-in`, { waitUntil: "networkidle" }); await w(600);
await setField('#panel [data-f="page:the-road-in.word"]', "Pine");
ok((await pg.evaluate(() => window.__wall.site.pages.find((p) => p.id === "the-road-in").word)) === "Pine", "the page's word is kept");
ok(await pg.locator(".v-held img").count() > 0, "the editor still sees the page");
await pg.click("#edit"); await w(500);
ok(await pg.locator('.v-door[data-why="word"]').count() === 1 && await pg.locator("#app img").count() === 0, "after Done, a visitor meets the door and none of the work");
await knock(pg, "olive"); ok(await pg.locator("[data-door] .wrong").isVisible() && await pg.locator('.v-door').count() === 1, "a wrong word is refused");
await pg.goto(`${B}/app/index.html?site=habib&space=${space}#/`, { waitUntil: "networkidle" }); await w(500);
ok(await pg.locator('.cover[href$="the-road-in"] img').count() === 0 && await pg.locator('.cover[href$="the-road-in"]').count() === 1, "on the front, the page is listed but its cover stays out of sight");
await pg.goto(`${B}/app/index.html?site=habib&space=${space}#/the-road-in`, { waitUntil: "networkidle" }); await w(500);
await knock(pg, " pine "); ok(await pg.locator(".v-held img").count() > 0, "the word opens it (case and spaces forgiven)");
await pg.goto(`${B}/app/index.html?site=habib&space=${space}#/`, { waitUntil: "networkidle" }); await w(500);
ok(await pg.locator('.cover[href$="the-road-in"] img').count() === 1, "and the front shows its cover again this session");

// the files: the page is sealed, and opens from disk with the word
await pg.click("#publish"); await w(400);
ok(/behind the word “Pine”/.test(await pg.locator("#panel").innerText()), "Publish says the page is behind a word");
await pg.click('#panel [data-pub="publish"]'); await pg.waitForSelector("#panel .versions", { timeout: 30000 }); await w(400);
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const [dl] = await Promise.all([pg.waitForEvent("download", { timeout: 30000 }), pg.click('#panel a[download], #panel [data-pub="download"]')]);
await dl.saveAs(`${OUT}/site.zip`); execSync(`unzip -q -o ${OUT}/site.zip -d ${OUT}/site`);
const shell = readFileSync(`${OUT}/site/the-road-in/index.html`, "utf8"), front = readFileSync(`${OUT}/site/index.html`, "utf8"), imgs = readdirSync(`${OUT}/site/assets/img`);
ok(/v-door/.test(shell) && !/leaning over a quiet|The pine|8\.jpg/.test(shell) && /"sealed":\{/.test(shell), "the page's file is a door carrying the page sealed; nothing of it is readable");
ok(!imgs.includes("8.jpg") && imgs.some((n) => /^[0-9a-f]{24}\.jpg$/.test(n)) && !/8\.jpg/.test(front), "its own photographs travel under unguessable names, which the front does not carry");
const p3 = await ctx.newPage(); const e3 = []; p3.on("pageerror", (e) => e3.push(e.message));
await p3.goto(`file://${OUT}/site/the-road-in/index.html`); await p3.waitForTimeout(800);
ok(await p3.locator('.v-door[data-why="word"]').count() === 1 && await p3.locator("img").count() === 0, "from disk: the door, and no work");
await knock(p3, "nope"); ok(await p3.locator("[data-door] .wrong").isVisible(), "from disk: a wrong word is refused");
await knock(p3, "pine"); await p3.waitForTimeout(1500);
for (let y = 0; y < 6000; y += 700) { await p3.evaluate((v) => scrollTo(0, v), y); await p3.waitForTimeout(120); }
const st = await p3.evaluate(() => ({ view: document.documentElement.dataset.view, imgs: [...document.images].filter((i) => i.naturalWidth > 0).length, door: !!document.querySelector(".v-door") }));
ok(st.view === "held" && !st.door && st.imgs >= 3, `from disk: the word opens the page and its photographs load under their new names: ${JSON.stringify(st)}`);
ok(e3.length === 0, `no errors on the sealed page: ${e3.join(" | ")}`);
await p3.close();

// the whole site behind a word, then "soon"
await fresh(`${B}/app/index.html?site=habib&space=${space}&edit#/the-road-in`);
await pg.click('#panel [data-tab="site"]'); await w(200); await pg.click('#panel [data-set="door"] [data-v="word"]'); await w(300);
await setField('#panel [data-f="site.door.word"]', "pomegranate");
await pg.click('#panel [data-set="door"] [data-v="soon"]'); await w(300); await setField('#panel [data-f="site.door.note"]', "Opening in spring.");
ok((await pg.evaluate(() => JSON.stringify(window.__wall.site.door))) === JSON.stringify({ word: "pomegranate", soon: true, note: "Opening in spring." }), "the site's door is kept");
await pg.click("#publish"); await w(400); await pg.click('#panel [data-pub="publish"]'); await pg.waitForSelector("#panel .versions", { timeout: 30000 }); await w(300);
const p2 = await ctx.newPage(); await p2.goto(`${B}/app/index.html?published&space=${space}#/the-road-in`, { waitUntil: "networkidle" }); await p2.waitForTimeout(600);
const hold = await p2.locator("#app").innerText();
ok(await p2.locator('.v-door[data-why="soon"]').count() === 1 && /Habib Saleh/.test(hold) && /Opening in spring\./.test(hold) && await p2.locator("#app img").count() === 0, "the published site shows only the holding page, with the name and the line");
await knock(p2, "Pomegranate"); ok(await p2.locator(".v-held img").count() > 0, "those with the site's word still get in");
await p2.goto(`${B}/app/index.html?published&space=${space}#/`); await p2.waitForTimeout(600);
ok(await p2.locator(".v-door").count() === 0 && await p2.locator(".cover img").count() > 0, "and stay in: the front page, with every cover");
await p2.close();
await fresh(`${B}/app/index.html?site=habib&space=${space}&edit#/the-road-in`);
await pg.click('#panel [data-tab="site"]'); await w(200); await pg.click('#panel [data-set="door"] [data-v="open"]'); await w(300);
ok((await pg.evaluate(() => JSON.stringify(window.__wall.site.door))) === JSON.stringify({ word: "", soon: false, note: "Opening in spring." }), "Everyone opens the site again");
if (errs.length) fails.push(errs.join(" | "));
console.log(which, fails.length ? "FAILS:\n  " + fails.join("\n  ") : "the door stands where it should, in the draft, the published site and the files"); await br.close();
