#!/usr/bin/env node
/*
 * The matrix: every template, in every look it offers, with every combination of its options, at desktop and phone
 * size, in both browser engines. Each one is opened to read and then opened to edit.
 *
 * To read it checks: no errors, nothing wider than the screen, all text readable (also with a bright yellow and a deep navy accent), that choosing an accent visibly changes the look, and that the picture viewer fits the screen.
 * To edit it checks: the editor's bar and panel stay on screen and readable, words can be typed and are saved, the
 * template's own controls work, and the Customise panel opens, scrolls and changes things.
 *
 * Needs the browsers: npx playwright-core install chromium-headless-shell webkit
 * Run:  npm run matrix            everything (about 10 minutes)
 *       npm run matrix:quick      one option set per look
 *       node scripts/matrix.mjs --engine webkit --template salon --look plaster --only-opt wall=dark,key=hidden --viewport phone
 */
import { chromium, webkit } from "playwright-core";
import { readdirSync, writeFileSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { runInNewContext } from "node:vm";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg("base", "http://127.0.0.1:5181"), ENGINES = arg("engine", "chromium,webkit").split(","), ONLY = arg("template", ""), QUICK = process.argv.includes("--quick"), PAR = +arg("parallel", "6");
const win = {}; runInNewContext(readFileSync("design/shared/theme.js", "utf8"), { window: win, document: {}, matchMedia: () => ({ matches: false }) });
const T = win.FolioTheme;

/* what each template offers, read from its own file so the test cannot drift from the product */
const TEMPLATES = {
  folio: { ready: ".work", edit: { toolbar: "[data-act=arrange]", after: ".arr", viewer: null } },
  index: { ready: ".piece", edit: { toolbar: "[data-act=p-form]", after: null, viewer: null } },
  salon: { ready: ".wall", edit: { toolbar: "[data-act=arrange]", after: ".arr", viewer: ".art img" } },
  reel: { ready: ".film", edit: { toolbar: "[data-act=f-ratio]", after: null, viewer: "[data-still]" } },
  lantern: { ready: ".slide", edit: { toolbar: "[data-act=replace]", after: null, viewer: null } },
  atelier: { ready: ".proj", edit: { toolbar: "[data-act=a-compare]", after: null, viewer: null } },
};
for (const t of Object.keys(TEMPLATES)) {
  const src = readFileSync(`design/${t}/room.js`, "utf8");
  const block = src.match(/options: \[([\s\S]*?)\n {4}\],/)?.[1] ?? "";
  TEMPLATES[t].options = [...block.matchAll(/key: "(\w+)".*?def: "(\w+)", choices: \[(.*?)\]\s*\}/g)].map((m) => ({ key: m[1], def: m[2], values: [...m[3].matchAll(/\["(\w+)"/g)].map((x) => x[1]) }));
}
const combos = (opts) => opts.reduce((acc, o) => acc.flatMap((a) => o.values.map((v) => ({ ...a, [o.key]: v }))), [{}]);

const FLOOK = arg("look", ""), FOPT = arg("only-opt", ""), FVP = arg("viewport", "");
const jobs = [];
for (const [t, cfg] of Object.entries(TEMPLATES)) {
  if (ONLY && ONLY !== t) continue;
  for (const look of T.looksFor(t)) {
    let cs = combos(cfg.options);
    if (QUICK) cs = [cs[(T.looksFor(t).indexOf(look) * 5) % cs.length]];
    if (FOPT) cs = cs.filter((o) => Object.entries(o).map(([k, v]) => k + "=" + v).join(",") === FOPT);
    if (FLOOK && FLOOK !== look) continue;
    for (const opt of cs) for (const vp of [{ n: "desktop", w: 1440, h: 900 }, { n: "phone", w: 390, h: 844 }]) { if (!FVP || FVP === vp.n) jobs.push({ t, look, opt, vp }); }
  }
}

/* ---- the checks, run inside the page ---- */
const CONTRAST = `(() => {
  const parse = (c) => { const m = c.match(/[\\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] == null ? 1 : m[3] }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const bgOf = (el) => { const layers = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); const c = parse(cs.backgroundColor); if (c.a > 0) layers.push(c); if (c.a >= .99) break; } let base = { r: 255, g: 255, b: 255, a: 1 }; for (const l of layers.reverse()) base = over(l, base); return base; };
  const skip = '.screen, .play, .watch, .lb, #toast, .tbnote, .dock, #panel, .tb, .arr, .addrow, .rm, [aria-hidden=true], .compare, .no';
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue; const el = n.parentElement; if (!el || seen.has(el) || el.closest(skip)) continue; seen.add(el);
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    const fg = parse(cs.color); const bg = bgOf(el); const f = over(fg, bg);
    const ratio = (Math.max(lum(f), lum(bg)) + .05) / (Math.min(lum(f), lum(bg)) + .05);
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700; const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
    if (ratio < need - 0.01) out.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + ' ' + ratio.toFixed(2) + '<' + need + ' "' + el.textContent.trim().slice(0, 18) + '"');
  }
  return out;
})()`;

async function run(browser, job) {
  const { t, look, opt, vp } = job, cfg = TEMPLATES[t];
  const qs = `look=${look}&opt=${Object.entries(opt).map(([k, v]) => k + ":" + v).join(",")}`;
  const fails = [];
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, reducedMotion: "reduce" });
  await ctx.addInitScript(() => { try { localStorage.setItem("latent-plan-preview", "full"); } catch { /* private window */ } });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push("PAGEERR " + e.message.slice(0, 120))); page.on("console", (m) => m.type() === "error" && !/Failed to load resource|favicon|net::ERR/.test(m.text()) && errors.push("CONSOLE " + m.text().slice(0, 120)));
  const wait = (ms) => page.waitForTimeout(ms);
  const nudge = () => page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; document.querySelectorAll("img").forEach((i) => (i.loading = "eager")); });
  try {
    /* ---- reading ---- */
    await page.goto(`${BASE}/design/${t}/index.html?preview&${qs}`); await page.waitForSelector(cfg.ready, { timeout: 20000 }); await nudge(); await wait(900);
    const applied = await page.evaluate(() => [document.documentElement.dataset.look, Object.keys(document.documentElement.dataset).filter((k) => /^opt/.test(k)).length]);
    if (applied[0] !== look) fails.push(`look not applied: got ${applied[0]}`);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) fails.push("read: sideways overflow");
    const low = await page.evaluate(CONTRAST); if (low.length) fails.push("read: low contrast " + low.slice(0, 4).join("; ") + (low.length > 4 ? ` (+${low.length - 4})` : ""));
    /* the artist's own accent: it must visibly change the page in this look, and the page must stay readable with awkward ones */
    const emStyle = () => page.evaluate(() => { const e = document.querySelector(".card h1 em") || document.querySelector(".card h1"); const cs = getComputedStyle(e); return cs.color + "|" + cs.backgroundImage + "|" + getComputedStyle(document.documentElement).getPropertyValue("--peony"); });
    const own = await emStyle();
    for (const [i, hex] of ["FFD400", "1B2A6B"].entries()) {
      await page.goto(`${BASE}/design/${t}/index.html?preview&${qs}&accent=${hex}`); await page.waitForSelector(cfg.ready, { timeout: 20000 }); await nudge(); await wait(500);
      if (i === 0 && (await emStyle()) === own) fails.push("accent: choosing an accent changed nothing in this look");
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) fails.push(`accent ${hex}: sideways overflow`);
      const lowA = await page.evaluate(CONTRAST); if (lowA.length) fails.push(`accent ${hex}: low contrast ` + lowA.slice(0, 3).join("; "));
    }
    await page.goto(`${BASE}/design/${t}/index.html?preview&${qs}`); await page.waitForSelector(cfg.ready, { timeout: 20000 }); await nudge(); await wait(400);
    if (cfg.edit.viewer) {
      await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: "center" }), cfg.edit.viewer); await wait(200);
      await page.evaluate((s) => document.querySelector(s).click(), cfg.edit.viewer); await wait(300);
      const v = await page.evaluate(() => { const i = document.querySelector(".lb img"); if (!i) return null; const r = i.getBoundingClientRect(); return { fits: r.width <= innerWidth + 1 && r.height <= innerHeight + 1 && r.width > 40, locked: document.documentElement.classList.contains("lb-open") }; });
      if (!v) fails.push("viewer did not open"); else { if (!v.fits) fails.push("viewer: picture does not fit the screen"); if (!v.locked) fails.push("viewer: page behind not locked"); }
      await page.keyboard.press("Escape"); await wait(100);
    }
    /* ---- editing ---- */
    await page.goto(`${BASE}/design/${t}/index.html?reset&edit&${qs}`); await page.waitForSelector(cfg.ready, { timeout: 20000 }); await nudge(); await wait(1000);
    const editLook = await page.evaluate(() => document.documentElement.dataset.look);
    if (editLook !== look) fails.push(`edit: the look being edited is ${editLook}, not ${look}`);
    const dock = await page.evaluate(() => { const d = document.getElementById("dock"); if (!d) return null; const r = d.getBoundingClientRect(); const bs = [...d.querySelectorAll("button:not([hidden])")].map((b) => { const q = b.getBoundingClientRect(); return { inside: q.left >= -1 && q.right <= innerWidth + 1 && q.top >= -1 && q.bottom <= innerHeight + 1 && q.width > 8 }; }); return { r: [Math.round(r.left), Math.round(r.right)], vw: innerWidth, bs }; });
    if (!dock) fails.push("edit: no editor bar"); else if (dock.bs.some((b) => !b.inside) || dock.r[1] > dock.vw + 1) fails.push("edit: editor bar runs off the screen");
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) fails.push("edit: sideways overflow");
    /* the editor's own controls are readable on this look */
    const edLow = await page.evaluate(`(() => { ${CONTRAST.slice(CONTRAST.indexOf("const parse"), CONTRAST.indexOf("const skip"))}
      const out = []; for (const el of document.querySelectorAll('#dock button, #dock .meter, .tb button, .addrow button')) { const r = el.getBoundingClientRect(); if (r.width < 2) continue; const cs = getComputedStyle(el); if (cs.opacity === '0') continue; const fg = parse(cs.color); const bg = bgOf(el); const f = over(fg, bg); const ratio = (Math.max(lum(f), lum(bg)) + .05) / (Math.min(lum(f), lum(bg)) + .05); if (ratio < 4.5) out.push(el.tagName.toLowerCase() + ' ' + ratio.toFixed(2) + ' "' + el.textContent.trim().slice(0, 14) + '"'); } return out; })()`);
    if (edLow.length) fails.push("edit: editor controls hard to read " + edLow.slice(0, 3).join("; "));
    /* typing */
    const typed = await page.evaluate(() => { const el = [...document.querySelectorAll("[contenteditable]")].find((e) => e.getBoundingClientRect().width > 4); if (!el) return null; el.scrollIntoView({ block: "center" }); el.focus(); const before = el.textContent; el.textContent = "Typed here"; el.blur(); return before; });
    if (typed === null) fails.push("edit: no editable words found"); else { await wait(900); const st = await page.evaluate(() => (document.getElementById("saved") || {}).textContent); if (!/Saved/.test(st || "")) fails.push("edit: typed words not saved (" + st + ")"); }
    /* the template's own control */
    const tool = await page.evaluate((s) => { const b = document.querySelector(s); if (!b) return "missing"; b.scrollIntoView({ block: "center" }); b.click(); return "clicked"; }, cfg.edit.toolbar);
    if (tool !== "clicked") fails.push("edit: the template's toolbar control is missing"); else { await wait(300); if (cfg.edit.after && !(await page.$(cfg.edit.after))) fails.push("edit: the template's control did nothing"); }
    /* Customise */
    await page.evaluate(() => { window.scrollTo(0, 0); document.getElementById("tweak").click(); }); await page.waitForFunction(() => { const p = document.getElementById("panel"); return p.classList.contains("open") && getComputedStyle(p).transform === "none"; }, null, { timeout: 8000 }); await wait(150);
    const panel = await page.evaluate(() => { const p = document.getElementById("panel"); const r = p.getBoundingClientRect(); const sc = p.querySelector(".scroll"); return { inside: r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1, open: p.classList.contains("open"), scrollable: sc.scrollHeight > sc.clientHeight, looks: p.querySelectorAll("[data-look]").length, opts: p.querySelectorAll("[data-opt]").length }; });
    if (!panel.open || !panel.inside) fails.push("edit: Customise panel not fully on screen");
    if (panel.looks < 2) fails.push("edit: Customise shows no looks");
    if (TEMPLATES[t].options.length && panel.opts !== TEMPLATES[t].options.length) fails.push(`edit: panel shows ${panel.opts} of ${TEMPLATES[t].options.length} options`);
    const pLow = await page.evaluate(`(() => { ${CONTRAST.slice(CONTRAST.indexOf("const parse"), CONTRAST.indexOf("const skip"))}
      const out = []; for (const el of document.querySelectorAll('#panel h3, #panel button, #panel .optname, #panel .note, #panel .sw-label')) { const r = el.getBoundingClientRect(); if (r.width < 2) continue; const cs = getComputedStyle(el); if (+cs.opacity < .6 && !el.classList.contains('locked')) continue; const fg = parse(cs.color); const bg = bgOf(el); const f = over(fg, bg); const ratio = (Math.max(lum(f), lum(bg)) + .05) / (Math.min(lum(f), lum(bg)) + .05); if (ratio < 4.5 && !el.classList.contains('locked') && !el.closest('[data-look]') && !el.closest('.swatches')) out.push(el.tagName.toLowerCase() + ' ' + ratio.toFixed(2) + ' "' + el.textContent.trim().slice(0, 14) + '"'); } return out; })()`);
    if (pLow.length) fails.push("edit: Customise panel hard to read " + pLow.slice(0, 3).join("; "));
    /* use it: a click in the middle of the panel must not move it, and choosing another look must work */
    const other = T.looksFor(t).find((l) => l !== look);
    await page.evaluate(() => { document.querySelector("#panel [data-plan=full]")?.click(); }); await wait(300);
    await page.evaluate(() => { const s = document.querySelector("#panel .scroll"); s.scrollTop = Math.floor(s.scrollHeight * .5); }); await wait(150);
    const settle = async () => { let last = -1; for (let i = 0; i < 20; i++) { const v = await page.evaluate(() => document.querySelector("#panel .scroll").scrollTop); if (v === last) return v; last = v; await wait(120); } return last; };
    const before = await settle();
    await page.evaluate(() => document.querySelector("#panel .seg[data-key=space] [data-v=airy]")?.click()); await wait(250);
    const kept = await settle();
    if (panel.scrollable && Math.abs(kept - before) > 3) fails.push("edit: panel lost its place after a click");
    await page.evaluate((o) => document.querySelector(`#panel [data-look=${o}]`)?.click(), other); await page.waitForFunction((o) => document.documentElement.dataset.look === o, other, { timeout: 5000 }).catch(() => {}); await wait(250);
    const after = await page.evaluate(() => ({ look: document.documentElement.dataset.look, over: document.documentElement.scrollWidth > innerWidth + 1 }));
    /* the accent swatches: pick one, then go back to the look's own */
    await page.evaluate(() => { document.querySelector('#panel [data-accent="#5F7389"]')?.click(); }); await wait(300);
    const picked = await page.evaluate(() => ({ pressed: document.querySelector('#panel [data-accent="#5F7389"]')?.getAttribute("aria-pressed"), peony: getComputedStyle(document.documentElement).getPropertyValue("--peony").trim() }));
    await page.evaluate(() => { document.querySelector('#panel [data-accent=""]')?.click(); }); await wait(300);
    const back = await page.evaluate(() => ({ own: document.querySelector('#panel [data-accent=""]')?.getAttribute("aria-pressed"), peony: getComputedStyle(document.documentElement).getPropertyValue("--peony").trim() }));
    if (picked.pressed !== "true") fails.push("edit: a picked accent swatch is not shown as chosen");
    if (back.own !== "true") fails.push("edit: the look's own accent swatch cannot be selected");
    if (back.peony === picked.peony) fails.push("edit: going back to the look's own accent changed nothing");
    if (after.look !== other) fails.push("edit: choosing another look did nothing"); if (after.over) fails.push("edit: overflow after changing the look");
  } catch (e) { fails.push("RUN FAILED: " + e.message.split("\n")[0].slice(0, 140)); }
  if (errors.length) fails.push("errors: " + errors.slice(0, 3).join(" | "));
  await ctx.close();
  return fails;
}

const exe = (() => { try { const d = readdirSync(homedir() + "/Library/Caches/ms-playwright").find((x) => x.startsWith("chromium_headless_shell")); return `${homedir()}/Library/Caches/ms-playwright/${d}/chrome-headless-shell-mac-arm64/chrome-headless-shell`; } catch { return undefined; } })();
const report = []; let done = 0, failed = 0;
for (const engine of ENGINES) {
  const browser = engine === "webkit" ? await webkit.launch() : await chromium.launch(exe ? { executablePath: exe } : {});
  const queue = [...jobs];
  await Promise.all(Array.from({ length: PAR }, async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      const fails = await run(browser, j); done++;
      const id = `${engine} ${j.t} ${j.look} ${Object.entries(j.opt).map(([k, v]) => k + "=" + v).join(",") || "-"} ${j.vp.n}`;
      if (fails.length) { failed++; report.push({ id, fails }); console.log("FAIL " + id + "\n   " + fails.join("\n   ")); }
      if (done % 40 === 0) console.log(`... ${done}/${jobs.length * ENGINES.length}, ${failed} failing`);
    }
  }));
  await browser.close();
}
writeFileSync("matrix-report.json", JSON.stringify({ total: done, failed, report }, null, 1));
console.log(`\nMatrix: ${done} runs (${jobs.length} combinations x ${ENGINES.length} engines), ${failed} failing.`);
process.exit(failed ? 1 : 0);
