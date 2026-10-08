/* The record: a statement and dated lists (exhibitions, publications, awards), added from the site tab, written in the panel, read on the page and in the published site. */
import { chromium, webkit } from "../../node_modules/playwright-core/index.mjs";
const which = process.argv[2] || "chromium", B = "http://127.0.0.1:5181";
const br = await (which === "webkit" ? webkit : chromium).launch(), fails = [];
const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } }), pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
const ok = (c, m) => { if (!c) fails.push(m); }; const w = (ms) => pg.waitForTimeout(ms);
const space = "rc" + Date.now();
const set = async (sel, v) => { await pg.fill(sel, v); await pg.dispatchEvent(sel, "change"); await w(300); };
const rec = () => pg.evaluate(() => window.__wall.site.pages.find((p) => p.kind === "record"));
await pg.goto(`${B}/app/index.html?site=habib&space=${space}&edit#/the-road-in`, { waitUntil: "networkidle" }); await w(600);
await pg.click('#panel [data-tab="site"]'); await w(200);
ok(await pg.locator('#panel [data-a="page-add"][data-kind="record"]').count() === 1, "the site tab offers a Record page");
await pg.click('#panel [data-a="page-add"][data-kind="record"]'); await w(600);
ok(/#\/record$/.test(await pg.evaluate(() => location.hash)) && await pg.locator(".v-record").count() === 1, "adding it opens it");
ok(await pg.locator('header.bar nav a[href$="record"]').count() === 1, "it is in the menu, with About and Contact");
// the statement
await set('#panel [data-f="page:record.para.0"]', "I photograph the hills I grew up in, slowly.");
ok(/slowly\./.test(await pg.locator(".v-record .body").innerText()), "the statement reads on the page");
// a section and its entries
ok(await pg.locator('#panel .rsec').count() === 1 && (await pg.inputValue('#panel [data-f="page:record.section.0.title"]')) === "Exhibitions", "a Record starts with an Exhibitions section");
await pg.click('#panel [data-a="ent-add"][data-n="0"]'); await w(300);
await set('#panel [data-f="page:record.entry.0.0.year"]', "2026"); await set('#panel [data-f="page:record.entry.0.0.text"]', "The road in, Beit Beirut");
await pg.click('#panel [data-a="ent-add"][data-n="0"]'); await w(300);
await set('#panel [data-f="page:record.entry.0.1.year"]', "2024"); await set('#panel [data-f="page:record.entry.0.1.text"]', "Ordinary things, Galerie Tanit");
let r = await rec(); ok(r.sections[0].entries.length === 2 && r.sections[0].entries[1].text === "Ordinary things, Galerie Tanit", "entries are kept");
await pg.click('#panel [data-a="ent-up"][data-n="0"][data-m="1"]'); await w(300);
r = await rec(); ok(r.sections[0].entries[0].year === "2024", "an entry moves up");
await pg.click('#panel [data-a="sec-add"][data-title="Publications"]'); await w(300);
await pg.click('#panel [data-a="ent-add"][data-n="1"]'); await w(300); await set('#panel [data-f="page:record.entry.1.0.text"]', "Ordinary things (book), 2025");
r = await rec(); ok(r.sections.length === 2 && r.sections[1].title === "Publications" && r.sections[1].entries[0].text.startsWith("Ordinary"), "a second section");
await set('#panel [data-f="page:record.section.1.title"]', "Books"); r = await rec(); ok(r.sections[1].title === "Books", "a section can be renamed");
const page = await pg.locator(".v-record .record").innerText();
ok(/EXHIBITIONS[\s\S]*2024[\s\S]*Galerie Tanit[\s\S]*2026[\s\S]*Beit Beirut[\s\S]*BOOKS[\s\S]*Ordinary things \(book\)/i.test(page), `the page reads the lists in order: ${page.replace(/\s+/g, " ").slice(0, 160)}`);
await pg.click('#panel [data-a="ent-remove"][data-n="1"][data-m="0"]'); await w(300); await pg.click('#panel [data-a="sec-remove"][data-n="1"]'); await w(300);
r = await rec(); ok(r.sections.length === 1, "a section is removed");
await pg.click("#undo"); await w(300); r = await rec(); ok(r.sections.length === 2, "and Undo brings it back");
// published
await pg.click("#publish"); await w(400); await pg.click('#panel [data-pub="publish"]'); await pg.waitForSelector("#panel .versions", { timeout: 30000 }); await w(300);
const p2 = await ctx.newPage(); await p2.goto(`${B}/app/index.html?published&space=${space}#/record`, { waitUntil: "networkidle" }); await p2.waitForTimeout(500);
ok(/Galerie Tanit/.test(await p2.locator(".v-record").innerText()) && await p2.locator("[contenteditable]").count() === 0, "the published record reads, without editing marks");
await p2.close();
if (errs.length) fails.push(errs.join(" | "));
console.log(which, fails.length ? "FAILS:\n  " + fails.join("\n  ") : "the record is written, ordered and read"); await br.close();
