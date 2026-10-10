/* The account flow, door to delete, in a headless browser. Needs `npm run dev` (5181) and `npm run api` (8787); to check the published
   site is served too, run the sites Worker locally on the same local bucket and pass its address:
     cd host && npx wrangler@latest dev --port 8788 --local --host 127.0.0.1 --persist-to ../deploy/.wrangler/state --var BARE_HOSTS:127.0.0.1
     HOST=http://127.0.0.1:8788 S=/tmp/wall-shots node tests/browser/account-walk.mjs
   Signs in with KEY (an invite key in the local database: `npm run invite -- make walk --local`) as EMAIL, makes a site from three pictures,
   publishes, deletes the account. S is where the screenshots go. */
import { chromium } from "playwright-core";
const S = process.env.S || "/tmp/wall-shots", base = "http://127.0.0.1:5181", HOST = process.env.HOST || "";
const EMAIL = process.env.EMAIL || "walk@example.com", KEY = process.env.KEY;
if (!KEY) { console.log("KEY=<an invite key in the local database> is needed: make one with `npm run invite -- make walk --local`"); process.exit(1); }
const b = await chromium.launch({ channel: "chromium-headless-shell" }).catch(() => chromium.launch());
const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }), page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("console:", m.text()); });
page.on("pageerror", (e) => console.log("pageerror:", e.message));
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
await page.click('.s-t[data-house="folio"]'); await page.fill("#s-name", "Test Artist");
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
if (HOST) { for (const f of ["", "assets/site.css"]) { const r = await fetch(`${HOST}/test-artist/${f}`); console.log("hosted", f || "/", r.status, (await r.text()).slice(0, 60).replace(/\s+/g, " ")); } }
if (process.env.SKIP_DELETE) { await b.close(); process.exit(0); }
// delete the account from the panel
await page.click('#panel [data-pub="delete"]'); await page.waitForSelector("#del-word"); await page.screenshot({ path: `${S}/acct-5-delete.png` });
await page.fill("#del-word", "DELETE"); await page.click('#panel [data-pub="delete-go"]'); await page.waitForURL(/gone/, { timeout: 60000 }); await page.waitForLoadState("load"); console.log("after delete:", page.url());
console.log("me after delete:", JSON.stringify((await api("me")).body));
if (HOST) { const r = await fetch(`${HOST}/test-artist/`); console.log("hosted after delete:", r.status, (await r.text()).slice(0, 80).replace(/\s+/g, " ")); }
await page.goto(`${base}/app/index.html?gate`); await page.waitForTimeout(500); console.log("view after delete:", await page.evaluate(() => document.documentElement.dataset.view));
await b.close();
