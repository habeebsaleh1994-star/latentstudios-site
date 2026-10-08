/* Sequencing: a tray row dragged to a new place reorders the story; and photographs nothing refers to any more are let go on the next load. */
import { chromium, webkit } from "../../node_modules/playwright-core/index.mjs";
const which = process.argv[2] || "chromium", B = "http://127.0.0.1:5181", DIR = "/tmp/wall-shots/Joun autumn";
const br = await (which === "webkit" ? webkit : chromium).launch(), fails = [];
const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } }), pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
const ok = (c, m) => { if (!c) fails.push(m); }; const w = (ms) => pg.waitForTimeout(ms);
const space = "sq" + Date.now();
const order = () => pg.evaluate(() => window.__wall.site.pages.find((p) => p.id === "the-road-in").pieces.map((x) => (x.type === "work" ? x.asset.split("/").pop() : "¶")));
// a drag, as the browser would raise it: lift a row, hover over another (upper or lower half), drop
const drag = (from, to, half) => pg.evaluate(([from, to, half]) => {
  const li = (k) => document.querySelector(`#panel .tray li[data-k="${k}"]`), dt = new DataTransfer();
  li(from).dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
  const r = li(to).getBoundingClientRect(), y = half === "top" ? r.top + 4 : r.bottom - 4;
  li(to).dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 10, clientY: y }));
  window.__over = li(to).className;
  li(to).dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 10, clientY: y }));
  li(from)?.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
}, [from, to, half]);
await pg.goto(`${B}/app/index.html?site=habib&space=${space}&edit#/the-road-in`, { waitUntil: "networkidle" }); await w(600);
const start = await order(); ok(start.length === 4, `the road has four pieces: ${start.join(" ")}`);
ok(await pg.locator('#panel .tray li[draggable="true"]').count() === 4, "every row can be lifted");
await drag(0, 2, "bottom"); await w(400);
let now = await order(); ok(now.join() === [start[1], start[2], start[0], start[3]].join(), `the first row dropped under the third lands third: ${now.join(" ")}`);
ok(/over-after/.test(await pg.evaluate(() => window.__over)), "the landing place was marked while dragging");
await drag(3, 0, "top"); await w(400);
now = await order(); ok(now[0] === start[3], `the last row dropped above the first comes first: ${now.join(" ")}`);
await drag(1, 1, "top"); await w(300); ok((await order()).join() === now.join(), "dropping a row on itself changes nothing");
ok(await pg.locator("#panel .over-before, #panel .over-after, #panel .lifted").count() === 0, "no marks are left behind");
await pg.click("#undo"); await w(300); await pg.click("#undo"); await w(300);
ok((await order()).join() === start.join(), "two Undos bring the order back");
// bytes nothing refers to are let go on the next load
const [fc] = await Promise.all([pg.waitForEvent("filechooser"), pg.click('#panel [data-a="tray"][data-k="0"]').then(() => pg.click('#panel [data-a="replace"][data-k="0"]'))]);
await fc.setFiles(`${DIR}/7.jpg`); await pg.waitForFunction(() => window.__wall.site.pages.find((p) => p.id === "the-road-in").pieces[0].asset.startsWith("asset:"), null, { timeout: 30000 }); await w(400);
const firstUpload = await pg.evaluate(() => window.__wall.site.pages.find((p) => p.id === "the-road-in").pieces[0].asset);
const [fc2] = await Promise.all([pg.waitForEvent("filechooser"), pg.click('#panel [data-a="tray"][data-k="0"]').then(() => pg.click('#panel [data-a="replace"][data-k="0"]'))]);
await fc2.setFiles(`${DIR}/8.jpg`); await pg.waitForFunction((a) => window.__wall.site.pages.find((p) => p.id === "the-road-in").pieces[0].asset !== a, firstUpload, { timeout: 30000 }); await w(400);
const second = await pg.evaluate(() => window.__wall.site.pages.find((p) => p.id === "the-road-in").pieces[0].asset);
const stored = () => pg.evaluate(() => new Promise((res) => { const r = indexedDB.open("latent-wall"); r.onsuccess = () => { const d = r.result, q = d.transaction("assets").objectStore("assets").getAllKeys(); q.onsuccess = () => { res(q.result); d.close(); }; }; }));
let keys = await stored(); ok(keys.includes(firstUpload.slice(6)) && keys.includes(second.slice(6)), "both uploads' bytes are stored");
ok(!(await pg.evaluate((a) => a in window.__wall.site.library, firstUpload)), "Replace lets the old picture go from the library");
keys = await stored(); ok(keys.includes(firstUpload.slice(6)), "its bytes stay this session, so Undo could bring it back");
await pg.click("#undo"); await w(400); ok(await pg.locator(".v-held img").first().evaluate((i) => i.naturalWidth > 0), "and Undo shows it again");
await pg.click("#redo"); await w(400);
await pg.goto("about:blank"); await pg.goto(`${B}/app/index.html?site=habib&space=${space}#/the-road-in`, { waitUntil: "networkidle" }); await w(3500);
keys = await stored(); ok(!keys.includes(firstUpload.slice(6)) && keys.includes(second.slice(6)), `on the next load the bytes nothing refers to are let go, the current picture's kept (${keys.length} stored)`);
ok(await pg.locator(".v-held img").first().evaluate((i) => i.naturalWidth > 0), "the current picture still shows");
if (errs.length) fails.push(errs.join(" | "));
console.log(which, fails.length ? "FAILS:\n  " + fails.join("\n  ") : "rows drag into order; forgotten bytes are let go"); await br.close();
