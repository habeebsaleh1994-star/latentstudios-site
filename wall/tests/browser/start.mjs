/* Starting a site from nothing: no work is made up; the artist chooses a template, gives a name, and gets an empty site in it. Demos say they are demos. */
import { chromium, webkit } from "../../node_modules/playwright-core/index.mjs";
const which = process.argv[2] || "chromium", B = "http://127.0.0.1:5181";
const br = await (which === "webkit" ? webkit : chromium).launch(), fails = [];
const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } }), pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
const ok = (c, m) => { if (!c) fails.push(m); };
await pg.goto(`${B}/design/home/index.html`, { waitUntil: "networkidle" });
await pg.click("text=Start your site >> nth=0"); await pg.waitForLoadState("networkidle"); await pg.waitForTimeout(600);
ok(await pg.locator(".start .s-t").count() === 9, "the start page shows the nine templates");
ok(!(await pg.evaluate(() => !!window.__wall?.site)), "no site exists before the artist makes one");
ok(await pg.locator(".s-go").isDisabled(), "Make my site waits for a template");
await pg.click('.s-t[data-house="monograph"]'); await pg.fill("#s-name", "Nadia Haddad"); await pg.fill("#s-title", "Salt and stone");
// a first story from a folder, chosen here; its title comes from the folder
const [fc] = await Promise.all([pg.waitForEvent("filechooser"), pg.click("#s-pick")]);
await fc.setFiles("/tmp/wall-shots/Joun autumn"); await pg.waitForTimeout(400);
ok(/3 photographs/.test(await pg.locator("#s-got").innerText()), `the folder is taken: ${await pg.locator("#s-got").innerText()}`);
await pg.click(".s-go"); await pg.waitForURL(/edit/); await pg.waitForLoadState("networkidle"); await pg.waitForTimeout(1200);
const s = await pg.evaluate(() => window.__wall.site);
{ const story = s.pages.find((p) => p.kind === "story"); ok(story && story.pieces.length === 3 && Object.keys(s.library).length === 3, `the first story has the three photographs (${story?.pieces.length})`);
  ok(story && story.pieces.map((x) => s.library[x.asset].date).join("|") === "7 Mar 2025|24 Mar 2025|10 Nov 2025", "in the order taken, with their dates");
  ok(new RegExp(`#/${story?.id}$`).test(await pg.evaluate(() => location.hash)) && await pg.locator("#spread .pg").count() > 0, "and the site opens on it, in the template's own arrangement"); }
await pg.goto("about:blank"); await pg.goto(`${B}/app/index.html?reset`, { waitUntil: "networkidle" }); await pg.waitForTimeout(600);
ok(await pg.locator(".start").count() === 1, "starting over shows the start page again");
await pg.click('.s-t[data-house="monograph"]'); await pg.fill("#s-name", "Nadia Haddad"); await pg.fill("#s-title", "Salt and stone");
await pg.click(".s-go"); await pg.waitForURL(/edit/); await pg.waitForLoadState("networkidle"); await pg.waitForTimeout(700);
const s2 = await pg.evaluate(() => window.__wall.site);
ok(s.name === "Nadia Haddad" && s.house === "monograph", `name and template kept: ${s.name}, ${s.house}`);
ok(Object.keys(s2.library).length === 0, `no sample work in a new site without a folder (${Object.keys(s2.library).length})`);
ok(s2.pages.map((p) => p.kind).join(",") === "about,contact", `only About and Contact: ${s2.pages.map((p) => p.kind)}`);
ok([s.front.title, s.front.titleEm].join(" ") === "Salt and stone", "the title is the artist's");
ok(await pg.locator("#panel.open").count() === 1, "the editor is open");
ok(await pg.locator(".demo-note").count() === 0, "the artist's own site is not marked as a demo");
await pg.goto(`${B}/app/index.html`, { waitUntil: "networkidle" }); await pg.waitForTimeout(500);
ok((await pg.evaluate(() => window.__wall?.site?.name)) === "Nadia Haddad", "coming back opens the artist's site, not the start page");
// a demo from the home page is labelled, and offers to start in the same template
await pg.goto(`${B}/design/home/index.html`, { waitUntil: "networkidle" });
const tryHref = await pg.getAttribute('.t[data-id="reel"]', "href");
await pg.goto(B + tryHref, { waitUntil: "networkidle" }); await pg.waitForTimeout(600);
ok(/A demo of Reel/.test(await pg.locator(".demo-note").innerText().catch(() => "")), "the Reel demo says it is a demo");
ok((await pg.evaluate(() => window.__wall.site.name)) === "Habib Saleh", "the demo uses sample work");
const ctx2 = await br.newContext({ viewport: { width: 1440, height: 900 } }), p2 = await ctx2.newPage();
await p2.goto(`${B}/app/index.html?start=reel`, { waitUntil: "networkidle" }); await p2.waitForTimeout(500);
ok((await p2.getAttribute('.s-t[data-house="reel"]', "aria-pressed")) === "true", "Start your own site in Reel arrives with Reel chosen");
ok(!(await p2.locator(".s-go").isDisabled()), "and Make my site is ready");
if (errs.length) fails.push(errs.join(" | "));
console.log(which, fails.length ? "FAILS:\n  " + fails.join("\n  ") : "a site starts from nothing, in the chosen template; demos say so"); await br.close();
