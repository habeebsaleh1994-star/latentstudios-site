/* The account flow, door to delete, in a headless browser. Needs `npm run dev` (5181) and `npm run api` (8787); to check the published
   site is served too, run the sites Worker locally on the same local bucket and pass its address:
     cd host && npx wrangler@latest dev --port 8788 --local --host 127.0.0.1 --persist-to ../deploy/.wrangler/state --var BARE_HOSTS:127.0.0.1
     HOST=http://127.0.0.1:8788 S=/tmp/wall-shots node tests/browser/account-walk.mjs
   Signs in with KEY (an invite key in the local database: `npm run invite -- make walk --local`) as EMAIL, makes a site from three pictures,
   publishes, signs out from Account and back in from a fresh browser (the site comes from the server), deletes the account from Account.
   S is where the screenshots go. The engine is the first argument: chromium (default) or webkit. */
import { chromium, webkit } from "playwright-core";
const ENGINE = process.argv[2] === "webkit" ? webkit : chromium;
const S = process.env.S || "/tmp/wall-shots", base = "http://127.0.0.1:5181", HOST = process.env.HOST || "";
const EMAIL = process.env.EMAIL || "walk@example.com", KEY = process.env.KEY;
const NAME = `Walk ${process.argv[2] === "webkit" ? "Webkit" : "Chromium"}`, LABEL = NAME.toLowerCase().replace(/ /g, "-");
if (!KEY) { console.log("KEY=<an invite key in the local database> is needed: make one with `npm run invite -- make walk --local`"); process.exit(1); }
const b = ENGINE === webkit ? await webkit.launch() : await chromium.launch({ channel: "chromium-headless-shell" }).catch(() => chromium.launch());
const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }), page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("console:", m.text()); });
page.on("pageerror", (e) => console.log("pageerror:", e.message)); page.on("response", (r) => { if (r.status() >= 400) console.log("http", r.status(), r.request().method(), r.url().slice(0, 110)); });
const api = (path, init) => page.evaluate(async ([p, i]) => { const r = await fetch("/api/" + p, i); return { status: r.status, body: await r.json().catch(() => null) }; }, [path, init || {}]);
async function signIn(shot) {
  await page.goto(`${base}/app/index.html?gate`); await page.waitForSelector(".gate");
  if (shot) await page.screenshot({ path: `${S}/acct-1-door.png` });
  await page.fill("#g-email", EMAIL); await page.fill("#g-key", KEY); await page.click(".gate button[type=submit]");
  await page.waitForSelector(".g-dev a"); const link = await page.getAttribute(".g-dev a", "href"); console.log("link:", link);
  await page.goto(base + link); await page.waitForLoadState("networkidle"); console.log("after link:", page.url());
}
await signIn(true);
// a clean account for the walk: whatever an earlier run left is removed first
const first = await api("me"); if (first.body.sites?.length) { console.log("removing earlier run:", JSON.stringify(await api("me", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) }))); await signIn(false); }
await page.goto(`${base}/app/index.html`); await page.waitForLoadState("networkidle");
console.log("view:", await page.evaluate(() => document.documentElement.dataset.view));
await page.click('.s-t[data-house="folio"]'); await page.fill("#s-name", NAME);
await page.setInputFiles("#s-folder", process.env.FOLDER || "design/samples/palmer/img");
await page.waitForSelector(".s-first.has"); await page.click(".s-go");
await page.waitForURL(/edit/); await page.waitForLoadState("networkidle"); await page.waitForTimeout(3000);
console.log("state:", JSON.stringify(await page.evaluate(() => ({ cloud: window.__wall.cloud, revision: window.__wall.revision, reach: window.__wall.reach, name: window.__wall.site.name, pictures: Object.keys(window.__wall.site.library).length }))));
console.log("me after site:", JSON.stringify((await api("me")).body.sites));
// every picture reached the server?
const ids = await page.evaluate(() => Object.keys(window.__wall.site.library));
for (const id of ids) console.log("asset", id.slice(0, 14), (await page.evaluate((i) => fetch("/api/asset/" + encodeURIComponent(i), { method: "HEAD" }).then((r) => r.status), id)));
// a change: the name; wait for the push
await page.click("#edit"); await page.waitForTimeout(300);
await page.evaluate(() => { const w = window.__wall; }); 
// publish
await page.click("#publish"); await page.waitForSelector("#panel .addr"); await page.waitForTimeout(600); console.log("addr:", await page.textContent("#panel .addr"));
await page.screenshot({ path: `${S}/acct-3-publish.png` });
await page.click('#panel [data-pub="publish"]'); await page.waitForFunction(() => /Live at|Not published/.test(document.querySelector("#panel")?.textContent ?? ""), null, { timeout: 90000 });
console.log("panel:", (await page.textContent("#panel .pub-go")).replace(/\s+/g, " ").trim().slice(0, 300));
await page.screenshot({ path: `${S}/acct-4-live.png` });
console.log("footer:", await page.textContent("#panel footer"));
console.log("me after publish:", JSON.stringify((await api("me")).body.sites));
if (HOST) { for (const f of ["", "assets/app.css"]) { const r = await fetch(`${HOST}/${LABEL}/${f}`); console.log("hosted", f || "/", r.status, (await r.text()).slice(0, 60).replace(/\s+/g, " ")); } }
if (process.env.SKIP_DELETE) { await b.close(); process.exit(0); }
// Account: sign out, then a fresh browser signs in and finds the same site, pictures and all, from the server
const before = await page.evaluate(() => ({ name: window.__wall.site.name, pictures: Object.keys(window.__wall.site.library).length }));
await page.click("#acct-btn"); await page.waitForSelector('#panel [data-acc="signout"]'); await page.screenshot({ path: `${S}/acct-5-account.png` });
await page.click('#panel [data-acc="signout"]'); await page.waitForURL(/\/app\/$/); await page.waitForSelector(".gate"); console.log("signed out to the door:", page.url());
const ctx2 = await b.newContext({ viewport: { width: 1280, height: 860 } }), p2 = await ctx2.newPage();
p2.on("pageerror", (e) => console.log("pageerror (fresh):", e.message));
await p2.goto(`${base}/app/index.html?gate`); await p2.waitForSelector(".gate");
await p2.fill("#g-email", EMAIL); await p2.click(".gate button[type=submit]"); console.log("fresh: asked for a link"); await p2.waitForSelector(".g-dev a, .gate .err, .g-err", { timeout: 15000 }); console.log("fresh: door says", (await p2.textContent(".gate")).replace(/\s+/g, " ").slice(0, 160));
await p2.goto(base + await p2.getAttribute(".g-dev a", "href")); await p2.goto(`${base}/app/index.html`); await p2.waitForLoadState("networkidle"); await p2.waitForTimeout(2500);
const after = await p2.evaluate(() => ({ name: window.__wall?.site?.name, pictures: Object.keys(window.__wall?.site?.library ?? {}).length }));
// the pictures on screen (the rest load as they are scrolled to): every one from the server's copy, none broken
const shown = await p2.evaluate(async () => { const imgs = [...document.images].filter((i) => (i.src.startsWith("blob:") || i.src.includes("/api/asset/")) && i.getBoundingClientRect().top < innerHeight); await Promise.all(imgs.map((i) => Promise.race([i.decode().catch(() => null), new Promise((r) => setTimeout(r, 8000))]))); return { imgs: imgs.length, broken: imgs.filter((i) => !i.naturalWidth).length }; });
console.log("fresh browser:", JSON.stringify(after), "same site:", after.name === before.name && after.pictures === before.pictures, "pictures shown:", JSON.stringify(shown));
await p2.screenshot({ path: `${S}/acct-6-fresh.png` });
// delete the account from Account, in the fresh browser
await p2.click("#acct-btn"); await p2.click('#panel [data-acc="delete"]'); await p2.waitForSelector("#del-word"); await p2.screenshot({ path: `${S}/acct-7-delete.png` });
await p2.fill("#del-word", "DELETE"); await p2.click('#panel [data-acc="delete-go"]'); await p2.waitForURL(/gone/, { timeout: 60000 }); await p2.waitForLoadState("load"); console.log("after delete:", p2.url());
console.log("me after delete:", JSON.stringify(await p2.evaluate(async () => (await fetch("/api/me")).json())));
if (HOST) { const r = await fetch(`${HOST}/${LABEL}/`); console.log("hosted after delete:", r.status, (await r.text()).slice(0, 80).replace(/\s+/g, " ")); }
await p2.goto(`${base}/app/index.html?gate`); await p2.waitForTimeout(500); console.log("view after delete:", await p2.evaluate(() => document.documentElement.dataset.view));
await b.close();
