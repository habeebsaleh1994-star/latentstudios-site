/* The artist's mark, how pages appear elsewhere, and the focal point: set in the editor, carried into the published files. */
import { chromium, webkit } from "../../node_modules/playwright-core/index.mjs";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const which = process.argv[2] || "chromium", B = "http://127.0.0.1:5181", OUT = `/tmp/wall-shots/appears-${which}`;
const br = await (which === "webkit" ? webkit : chromium).launch(), fails = [];
const ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }), pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
const ok = (c, m) => { if (!c) fails.push(m); }; const w = (ms) => pg.waitForTimeout(ms);
const site = () => pg.evaluate(() => window.__wall.site), space = "ap" + Date.now();
await pg.goto(`${B}/app/index.html?site=habib&space=${space}&edit#/the-road-in`, { waitUntil: "networkidle" }); await w(600);
// this page: a description, a share image, its focal point
await pg.fill('#panel [data-f="page:the-road-in.appears.description"]', "Three photographs from spring."); await pg.press('#panel [data-f="page:the-road-in.appears.description"]', "Tab"); await w(300);
ok(/Three photographs from spring/.test(await pg.locator("#panel .search p").innerText()), "the search preview shows the description");
await pg.click('#panel [data-a="share-pick"]'); await w(300); await pg.click('[data-pick="/design/folio/img/2.jpg"]'); await pg.click('[data-lib="add"]'); await w(400);
ok((await site()).pages.find((p) => p.id === "the-road-in").appears.share === "/design/folio/img/2.jpg", "the share image is set");
await pg.click('#panel [data-a="focal"]'); await w(300); const pic = pg.locator("#focal .pic img"); await pic.click({ position: { x: 40, y: 30 } }); await w(300);
const f = (await site()).library["/design/folio/img/2.jpg"].focal; ok(f.x < 30 && f.y < 30, `the focal point moved to where it was pressed: ${JSON.stringify(f)}`);
await pg.click('[data-focal="close"]'); await w(200);
// the site: a logo in place of the name
await pg.click('#panel [data-tab="site"]'); await w(200); await pg.click('#panel [data-a="logo-pick"]'); await w(300); await pg.click('[data-pick="/design/folio/img/9.jpg"]'); await pg.click('[data-lib="add"]'); await w(500);
ok(await pg.locator(".bar .name img.logo").count() === 1, "the logo shows in place of the name");
ok((await pg.locator("#panel .tray .t").first().innerText()).includes("Wall, late light") || (await site()).mark.logo === "/design/folio/img/9.jpg", "and is listed under Your mark");
// publish: the files carry it all
await pg.click("#publish"); await w(400); await pg.click('#panel [data-pub="publish"]'); await pg.waitForSelector("#panel .versions", { timeout: 30000 }); await w(400);
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const [dl] = await Promise.all([pg.waitForEvent("download", { timeout: 30000 }), pg.click('#panel a[download], #panel [data-pub="download"]')]);
await dl.saveAs(`${OUT}/site.zip`); execSync(`unzip -q -o ${OUT}/site.zip -d ${OUT}/site`);
ok(existsSync(`${OUT}/site/assets/favicon.svg`), "the icon is in the files");
ok(existsSync(`${OUT}/site/assets/share/the-road-in.jpg`) && existsSync(`${OUT}/site/assets/share/front.jpg`), "share images are made for the front and the story");
const html = readFileSync(`${OUT}/site/the-road-in/index.html`, "utf8");
ok(/<meta name="description" content="Three photographs from spring\."/.test(html), "the page carries its description");
ok(/og:image" content="\.\.\/assets\/share\/the-road-in\.jpg"/.test(html), "and its share image");
ok(/img class="logo"/.test(html), "and the logo");
ok(readFileSync(`${OUT}/site/assets/favicon.svg`, "utf8").includes(">H<"), "the icon is the artist's initial");
const p2 = await ctx.newPage(); await p2.goto(`file://${OUT}/site/assets/share/the-road-in.jpg`); const dims = await p2.evaluate(() => { const i = document.querySelector("img"); return [i.naturalWidth, i.naturalHeight]; }); await p2.close();
ok(dims[0] === 1200 && dims[1] === 630, `the share image is 1200 × 630 (${dims})`);
if (errs.length) fails.push(errs.join(" | "));
console.log(which, fails.length ? "FAILS:\n  " + fails.join("\n  ") : "the mark, how pages appear and the focal point carry into the files"); await br.close();
