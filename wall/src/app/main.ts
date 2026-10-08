/*
 * Latent Wall: one app for the whole site. It reads the site document, finds the page from the
 * address, draws it in its arrangement, applies the look, and wires the page's behaviour.
 * Every change goes through `commit`: history, saving (with a revision), and a redraw in place.
 */
import { openSite, siteSchema, type SiteDocument, type SitePage } from "../studio/site";
import { page, viewOf, titleText, workPages, type Ctx } from "./render";
import { wire } from "./behave";
import { createStore, StaleError, type Store } from "./store";
import { applyTheme } from "./theme";


/** The sample sites. The artist's own site starts from "habib" until they bring their own. */
export const SAMPLES: Record<string, string> = {
  habib: "/design/samples/habib-saleh.site.json",
  folio: "/design/folio/doc/before-it-disappears.site.json", index: "/design/index/doc/noor-rahal.site.json", salon: "/design/salon/doc/sora-vale.site.json",
  reel: "/design/reel/doc/ivo-sen.site.json", atelier: "/design/atelier/doc/common-form.site.json", lantern: "/design/lantern/doc/lantern.site.json",
};

const params = new URLSearchParams(location.search);
const sample = params.get("site");
/** Each sample plays in its own space, so trying one never touches the artist's site. */
/** The artist's own site lives in "mine"; every demo and sample in a space of its own. */
export const space = params.get("space") ?? (sample ? `sample:${sample}` : "mine");
export const isDemo = space !== "mine";

export const state = {
  site: null as unknown as SiteDocument, revision: 0, editing: false, store: null as unknown as Store,
  past: [] as SiteDocument[], future: [] as SiteDocument[],
  listeners: [] as (() => void)[],
};
const app = document.getElementById("app")!;
/* tests and the sweeps read the live site here */
(window as unknown as { __wall: typeof state }).__wall = state;

export function pageId() { return decodeURIComponent((location.hash.slice(1) || "/").split("?")[0].replace(/^\//, "")); }
/** A site with a single piece of work opens straight onto it: a front page would only repeat its title. */
export function current(): SitePage | null {
  const id = pageId(), works = workPages(state.site);
  if (!id && works.length === 1 && !state.editing) return works[0];
  return state.site.pages.find((p) => p.id === id) ?? null;
}
export function go(id: string) { location.hash = `/${encodeURIComponent(id)}`; }
export function ctx(): Ctx {
  const q = location.search.replace(/[?&](edit|panel|look)(=[^&]*)?/g, "").replace(/^&/, "?");
  return { site: state.site, editing: state.editing, href: (id) => `${q}#/${encodeURIComponent(id)}`, src: (a) => state.store.src(a) };
}

/** Draw the page for the current address. `keep` holds the reader's place (an edit, not a navigation). */
export function draw(keep = false) {
  const p = current(), y = scrollY, c = ctx(), v = viewOf(p, state.site);
  // a work turned over stays turned through an edit, without flipping again
  const turned = keep ? [...app.querySelectorAll<HTMLElement>(".frame.turned > .verso")].map((e) => e.dataset.verso) : [];
  applyTheme(state.site.theme);
  document.documentElement.toggleAttribute("data-editing", state.editing);
  app.innerHTML = page(c, p);
  document.title = titleText(state.site, p);
  wire(app, c, p, v, keep);
  // after wire(): a book, a contact sheet and slides build their frames there
  for (const a of turned) { const f = app.querySelector<HTMLElement>(`.verso[data-verso="${CSS.escape(a!)}"]`)?.parentElement; if (f) { f.classList.add("turned", "still"); requestAnimationFrame(() => f.classList.remove("still")); } }
  scrollTo(0, keep ? y : 0);
  state.listeners.forEach((f) => f());
}

let saving: Promise<void> = Promise.resolve();
/** Every change: remember the old site for Undo, save the new one, draw it where the artist is. */
export function commit(next: SiteDocument, opts: { history?: boolean; keep?: boolean } = {}) {
  if (opts.history !== false) { state.past.push(state.site); if (state.past.length > 100) state.past.shift(); state.future = []; }
  state.site = siteSchema.parse(next);
  persist();
  draw(opts.keep !== false);
}
export function undo() { const s = state.past.pop(); if (!s) return; state.future.push(state.site); state.site = s; persist(); draw(true); }
export function redo() { const s = state.future.pop(); if (!s) return; state.past.push(state.site); state.site = s; persist(); draw(true); }
function persist() {
  const site = state.site;
  saving = saving.then(async () => {
    try { state.revision = await state.store.save(site, state.revision); }
    catch (e) {
      if (!(e instanceof StaleError)) { notify(`Not saved: ${(e as Error).message}`); return; }
      const r = await state.store.load(); if (!r) return;
      state.site = r.site; state.revision = r.revision; state.past = []; state.future = [];
      draw(true); notify("This site was changed in another window; that version is shown now.");
    }
  });
}
export const saved = () => saving;
export function notify(text: string) { app.dispatchEvent(new CustomEvent("wall:notify", { bubbles: true, detail: text })); }

async function start() {
  state.store = createStore(space);
  // the published site, as a visitor sees it: the latest version, or the one a private preview link names
  if (params.has("published")) {
    const { createVersions } = await import("./versions"), vs = createVersions(space), v = params.get("v") ? await vs.get(Number(params.get("v"))) : await vs.latest();
    if (!v) { app.innerHTML = `<main class="v-words"><section class="words"><div><h1>Nothing is published yet.</h1></div><div class="body"><p>Open the editor and press Publish; the published site then appears here, as a visitor would see it.</p><p><a href="/app/index.html?space=${encodeURIComponent(space)}">Back to the editor</a></p></div></section></main>`; return; }
    state.site = v.site; state.revision = 0;
    await state.store.prepare(Object.keys(state.site.library));
    document.documentElement.dataset.preview = "on"; document.documentElement.dataset.published = String(v.n);
    addEventListener("hashchange", () => draw(false)); draw(false); return;
  }

  // a template shown by link (a preview, a "Try" copy) always starts from the template itself, never from an older saved copy
  const fresh = params.has("reset") || (params.has("house") && isDemo);
  const stored = fresh ? null : await state.store.load();
  if (stored) { state.site = stored.site; state.revision = stored.revision; }
  else if (!isDemo) {
    // nobody's site is made up for them: with nothing saved yet, the artist starts by choosing a template
    (await import("./start")).start(state.store, params.get("start"));
    return;
  }
  else {
    state.site = openSite(await (await fetch(SAMPLES[sample ?? "habib"] ?? SAMPLES.habib)).json());
    const prev = await state.store.load().catch(() => null);
    try { state.revision = await state.store.save(state.site, prev?.revision ?? 0); }
    catch { const again = await state.store.load(); if (again) { state.site = again.site; state.revision = again.revision; } }
  }
  // ?house= tries a template on this space's copy (the study board uses it); the artist's own site is never changed by a link
  const h = params.get("house");
  if (h && isDemo) { const { applyHouse } = await import("./ops"); state.site = applyHouse(state.site, h as never).site; state.revision = await state.store.save(state.site, state.revision); }
  else if (!stored && sample) { const { applyHouse } = await import("./ops"); state.site = applyHouse(state.site, state.site.house).site; state.revision = await state.store.save(state.site, state.revision); }
  { const { conform } = await import("./ops"); const c = conform(state.site); if (JSON.stringify(c) !== JSON.stringify(state.site)) { state.site = c; state.revision = await state.store.save(c, state.revision); } }
  await state.store.prepare(Object.keys(state.site.library));
  state.store.onOther(async (site, revision) => {
    if (revision <= state.revision) return;
    const a = document.activeElement as HTMLElement | null; if (a?.isContentEditable) a.blur();
    await state.store.prepare(Object.keys(site.library));
    state.site = site; state.revision = revision; state.past = []; state.future = [];
    draw(true); notify("Updated from another window.");
  });
  if (params.has("preview")) document.documentElement.dataset.preview = "on";
  addEventListener("hashchange", () => draw(false));
  draw(false);
  if (!params.has("preview")) {
    (await import("./edit")).init();
    if (isDemo && params.has("house")) demoNote(params.get("house")!);
  }
}
/** A demo says so, and offers to start the artist's own site in the same template. */
async function demoNote(h: string) {
  const { house } = await import("./houses"), name = house(h).name;
  document.body.insertAdjacentHTML("beforeend", `<div class="demo-note" role="note"><span>A demo of <b>${name}</b>, with sample work. Edit and Customise freely; nothing here is kept.</span><a href="/app/index.html?start=${h}">Start your own site in ${name} &rarr;</a></div>`);
}

start().catch((e) => { app.innerHTML = `<main class="v-words"><section class="words"><div><h1>This site could not be opened.</h1></div><div class="body"><p>${String((e as Error).message ?? e)}</p></div></section></main>`; });
