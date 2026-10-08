/*
 * The editor. Two panels, never mixed:
 *   Edit       the site and its content: pages, their order and words, each story's works and arrangement.
 *   Customise  the artistic choices: the look, and under it light, palette, accent, type, mount, spacing, motion, size.
 * On the page itself (in edit mode): words are typed in place, each work has a quiet toolbar, a + sits in each gap.
 * Every action is an operation from ops.ts, committed through main.ts (history, saving, redraw in place).
 */
import * as O from "./ops";
import { state, commit, undo, redo, draw, current, go, pageId, space, isDemo } from "./main";
import * as P from "./pubpanel";
import { inOrder } from "./meta";
import { accentsFrom, accentsAcross, pixelsOf } from "./colour";
import { esc, appearsOf } from "./render";
import { address } from "./publish";
import type { SitePage, StoryPage } from "../studio/site";
import { photographCount } from "../studio/site";
import { HOUSES, house, DIALS } from "./houses";
import { TYPEFACES, STRUCTURE, STRUCTURE_HINTS } from "./theme";

type ThemeLib = {
  LOOKS: Record<string, { name: string; note?: string; only?: string[]; scheme?: string; vars?: Record<string, string> }>;
  PALETTES: Record<string, { name: string; light: { silk: string; ink: string }; dark: { silk: string; ink: string } }>;
  TYPES: Record<string, { name: string; display: string; weight: string | number }>;
  ACCENTS: string[];
  looksFor: (house: string) => string[];
  accentFor: (look: string, accent: string | null, dark: boolean, palette: string) => { peony: string };
};
const T = () => (window as unknown as { FolioTheme: ThemeLib }).FolioTheme;
const $ = <E extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<E>(sel);
const phone = () => matchMedia("(max-width: 760px)").matches;
const title = (p: { title: string; titleEm?: string }) => [p.title, p.titleEm].filter(Boolean).join(" ");

let panel: HTMLElement, dock: HTMLElement, lib: HTMLElement, mode: "edit" | "customise" | "publish" | null = null, tab: "site" | "page" = "page";
let openMenu: { k: number; kind: "arrange" | "move" } | null = null, trayOpen: number | null = null;

export function init() {
  document.body.insertAdjacentHTML("beforeend",
    `<div class="dock" id="dock"><span class="meter" id="meter"></span><button type="button" id="undo">Undo</button><button type="button" id="redo">Redo</button><button type="button" id="edit" aria-pressed="false">Edit</button><button type="button" id="page-btn" hidden>Page</button><button type="button" id="tweak" aria-expanded="false">Customise</button><button type="button" id="phone-btn" aria-pressed="false" title="See it on a phone">Phone</button><button type="button" id="publish">Publish</button></div>` +
    `<aside id="panel" aria-label="Edit the site"></aside>` +
    `<div class="lib" id="lib" role="dialog" aria-modal="true" aria-label="Your work" hidden><div class="sheet2"><header><b>Your work</b><button type="button" class="x" data-lib="close">Close</button></header><div class="grid"></div><footer><span class="note"></span><button type="button" class="go" data-lib="add" disabled>Add</button></footer></div></div>` +
    `<input type="file" id="files" accept="image/*,.heic,.heif" multiple hidden><input type="file" id="folder" webkitdirectory multiple hidden><input type="file" id="one-file" accept="image/*,.heic,.heif" hidden><div class="drop" id="drop" hidden><span></span></div><div class="phone-frame" id="phone" hidden><div class="device"><iframe title="Your site, on a phone"></iframe></div><button type="button" class="x" id="phone-close">Close</button></div><div class="toast" role="status" aria-live="polite" hidden></div>`);
  panel = $("#panel")!; dock = $("#dock")!; lib = $("#lib")!;
  state.listeners.push(afterDraw);
  document.addEventListener("click", onClick);
  document.addEventListener("focusin", (e) => { const t = e.target as HTMLElement; if (t.isContentEditable) t.dataset.before = plain(t); });
  document.addEventListener("focusout", onWord);
  document.addEventListener("keydown", onKey);
  panel.addEventListener("change", onPanelInput);
  // reordering the tray by drag: the row lifted, the place it will land marked, the drop committed
  let lifted: number | null = null;
  const rowOf = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>(".tray li[draggable]");
  const clearOver = () => panel.querySelectorAll(".over-before, .over-after").forEach((el) => el.classList.remove("over-before", "over-after"));
  panel.addEventListener("dragstart", (e) => { const li = rowOf(e); if (!li) return; lifted = Number(li.dataset.k); li.classList.add("lifted"); e.dataTransfer?.setData("text/plain", li.dataset.k!); if (e.dataTransfer) e.dataTransfer.effectAllowed = "move"; });
  panel.addEventListener("dragover", (e) => { const li = rowOf(e); if (lifted == null || !li) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "move"; const r = li.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2; clearOver(); li.classList.add(after ? "over-after" : "over-before"); });
  panel.addEventListener("dragleave", (e) => { if (!(e.relatedTarget as HTMLElement | null)?.closest?.(".tray")) clearOver(); });
  panel.addEventListener("drop", (e) => { const li = rowOf(e); if (lifted == null || !li) return; e.preventDefault(); e.stopPropagation(); const p = current(); const after = li.classList.contains("over-after"), to = Number(li.dataset.k) + (after ? 1 : 0), from = lifted; lifted = null; clearOver(); if (p?.kind === "story") { try { const n = O.reorder(state.site, p.id, from, to); if (n !== state.site) commit(n); } catch (err) { toast((err as Error).message); } } });
  panel.addEventListener("dragend", () => { lifted = null; clearOver(); panel.querySelectorAll(".lifted").forEach((el) => el.classList.remove("lifted")); });
  $<HTMLInputElement>("#files")!.addEventListener("change", onFiles);
  $<HTMLInputElement>("#folder")!.addEventListener("change", onFolder);
  $<HTMLInputElement>("#one-file")!.addEventListener("change", onReplaceFile);
  for (const ev of ["dragenter", "dragover"]) document.addEventListener(ev, (e) => { if (!state.editing || !hasFiles(e as DragEvent)) return; e.preventDefault(); dropHint(true); });
  document.addEventListener("dragleave", (e) => { if ((e as DragEvent).relatedTarget === null) dropHint(false); });
  document.addEventListener("drop", onDrop);
  document.addEventListener("wall:notify", (e) => toast((e as CustomEvent<string>).detail));
  P.forSpace(space); P.refresh().then(afterDraw);
  const q = new URLSearchParams(location.search);
  if (q.has("publish")) openPanel("publish");
  if (q.has("edit")) setEditing(true);
  if (q.get("panel") === "look") openPanel("customise");
  afterDraw();
}

/* ------------------------------------------------------------------ the dock and the two modes */

function setEditing(on: boolean) {
  state.editing = on; openMenu = null; trayOpen = null;
  draw(true);
  if (on && !phone()) { tab = "page"; openPanel("edit"); } else if (!on && mode === "edit") closePanel();
}
function openPanel(m: "edit" | "customise" | "publish") { mode = m; panel.classList.add("open"); document.documentElement.dataset.panel = m; renderPanel(); if (m === "publish") P.refresh().then(renderPanel); }
function closePanel() { mode = null; panel.classList.remove("open"); delete document.documentElement.dataset.panel; }

function afterDraw() {
  if (!dock) return;
  const s = state.site, n = photographCount(s);
  const diff = P.published() ? P.draftChanges().length : 0;
  $("#meter")!.innerHTML = state.editing ? `<b>${n}</b> ${n === 1 ? "work" : "works"} <span class="more">· <b>${s.pages.length}</b> pages · Saved on this device${P.published() ? (diff ? ` · <span class="draft">Draft: ${diff === 1 ? "one change" : `${diff} changes`} since published</span>` : " · As published") : ""}</span>` : (isDemo || !P.published() ? "" : diff ? `<span class="draft">Draft: ${diff === 1 ? "one change" : `${diff} changes`} not yet published</span>` : "");
  $<HTMLButtonElement>("#undo")!.hidden = $<HTMLButtonElement>("#redo")!.hidden = !state.editing;
  $<HTMLButtonElement>("#undo")!.disabled = !state.past.length; $<HTMLButtonElement>("#redo")!.disabled = !state.future.length;
  const e = $<HTMLButtonElement>("#edit")!; e.textContent = state.editing ? "Done" : "Edit"; e.setAttribute("aria-pressed", String(state.editing));
  $<HTMLButtonElement>("#page-btn")!.hidden = !(state.editing && phone());
  $("#tweak")!.setAttribute("aria-expanded", String(mode === "customise"));
  if (state.editing) toolbars();
  if (mode) renderPanel();
}

/* ------------------------------------------------------------------ on the page: toolbars on works */

function toolbars() {
  const p = current(); if (!p || p.kind !== "story") return;
  document.querySelectorAll<HTMLElement>(".tb-slot").forEach((slot) => {
    const k = +slot.dataset.k!, last = p.pieces.length - 1;
    const canArrange = O.arrangeOptions(state.site, p.id, k).length > 0;
    slot.innerHTML = `<span class="tb" role="toolbar" aria-label="This work">${canArrange ? `<button type="button" data-a="menu-arrange" data-k="${k}">Arrange</button>` : ""}<button type="button" data-a="piece-up" data-k="${k}"${k === 0 ? " disabled" : ""} aria-label="Earlier">&uarr;</button><button type="button" data-a="piece-down" data-k="${k}"${k === last ? " disabled" : ""} aria-label="Later">&darr;</button><button type="button" data-a="menu-move" data-k="${k}">Move to</button><button type="button" data-a="replace" data-k="${k}">Replace</button><button type="button" data-a="piece-remove" data-k="${k}">Remove</button></span>` +
      (openMenu?.k === k ? menu(p, k, openMenu.kind) : "");
  });
}
function menu(p: StoryPage, k: number, kind: "arrange" | "move") {
  const items = kind === "arrange"
    ? O.arrangeOptions(state.site, p.id, k).map((o) => `<button type="button" data-a="arrange" data-k="${k}" data-key="${o.key}"${o.current ? ' aria-current="true"' : ""}>${o.title}<small>${o.note}</small></button>`)
    : [...state.site.pages.filter((x): x is StoryPage => x.kind === "story" && x.id !== p.id).map((x) => `<button type="button" data-a="move-to" data-k="${k}" data-to="${esc(x.id)}">${esc(title(x))}<small>${x.pieces.filter((y) => y.type === "work").length} works</small></button>`),
      `<button type="button" data-a="move-to" data-k="${k}" data-to="new">A new story<small>Starts one with this work</small></button>`];
  return `<span class="arr" role="menu"><span class="h">${kind === "arrange" ? "How it sits" : "Move to"}</span>${items.join("")}</span>`;
}

/* ------------------------------------------------------------------ the panels */

function seg(key: string, opts: [string, string][], cur: string, locked: string[] = []) {
  return `<div class="seg" data-set="${key}">${opts.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${cur === v}"${locked.includes(v) ? ' class="locked"' : ""}>${t}</button>`).join("")}</div>`;
}
const input = (f: string, v: string, ph: string) => `<input type="text" data-f="${esc(f)}" value="${esc(v)}" placeholder="${esc(ph)}" aria-label="${esc(ph)}">`;
const area = (f: string, v: string, ph: string, rows = 2) => `<textarea rows="${rows}" data-f="${esc(f)}" placeholder="${esc(ph)}" aria-label="${esc(ph)}">${esc(v)}</textarea>`;
const thumb = (a: string) => { const w = state.site.library[a]; return w ? `<span class="th"><img src="${esc(state.store.src(a))}" alt=""></span>` : `<span class="th miss">?</span>`; };
const kindLine = (p: SitePage) => p.kind === "story" ? `${p.pieces.filter((x) => x.type === "work").length} works · ${{ held: "Held", book: "Book", passage: "Passage", contact: "Contact sheet", wall: "Wall", slides: "Slides" }[p.arrangement]}` : O.KIND_NAMES[p.kind];

function renderPanel() {
  if (!mode) return;
  const keep = $(".scroll", panel)?.scrollTop ?? 0;
  let h = `<header><b>${mode === "edit" ? "Edit" : mode === "publish" ? "Publish" : "Customise"}</b><button type="button" class="x" data-a="${mode === "edit" ? "done" : "close"}">${mode === "edit" ? "Done" : "Close"}</button></header>`;
  if (mode === "edit") h += `<div class="tabs" role="tablist">${([["page", "This page"], ["site", "The site"]] as const).map(([k, t]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}">${t}</button>`).join("")}</div>`;
  h += `<div class="scroll">${mode === "publish" ? P.render() : mode === "customise" ? customise() : tab === "site" ? siteTab() : pageTab()}</div><footer><span>${mode === "publish" ? "Every version is kept on this device" : "Saved on this device"}</span></footer>`;
  panel.innerHTML = h;
  $(".scroll", panel)!.scrollTop = keep;
}

function siteTab() {
  const s = state.site, has = (k: string) => s.pages.some((p) => p.kind === k), cur = pageId();
  let h = `<h3>Words</h3>${input("site.name", s.name, "Your name")}${input("site.contact", s.contact, "A line at the foot of every page")}`;
  h += appearsBlock(null) + `<h3>Your mark</h3>${s.mark.logo ? `<ol class="tray"><li>${thumb(s.mark.logo)}<span class="t">${esc(s.library[s.mark.logo]?.title || "Logo")}<small>in place of your name</small></span><span class="acts"><button type="button" data-a="logo-clear" aria-label="Show the name instead">&times;</button></span></li></ol>` : ""}<div class="adds"><button type="button" data-a="logo-pick">${s.mark.logo ? "Another logo" : "+ A logo or wordmark"}</button></div><p class="hint">Shown in place of your name at the top of every page. A PNG with a transparent ground works best.</p>`;
  const mode = s.door.soon ? "soon" : s.door.word || doorWant ? "word" : "open";
  h += `<h3>Who can see it</h3>${seg("door", [["open", "Everyone"], ["word", "Those with a word"], ["soon", "No one yet"]], mode)}`;
  if (mode !== "open") h += `<input type="text" data-f="site.door.word" value="${esc(s.door.word)}" placeholder="The word" aria-label="The word" autocapitalize="none" spellcheck="false">`;
  if (mode === "soon") h += input("site.door.note", s.door.note, "A line on the holding page (“Soon.”)");
  h += `<p class="hint">${mode === "open" ? "The site is open to everyone." : mode === "word" ? (s.door.word ? "Visitors meet a door and give the word once; the published files keep every page sealed until it is given." : "Give a word; until then the site stays open.") : `Visitors see only your name and a line.${s.door.word ? " Those with the word still get in." : ""} Publish to let people know, then open the site when it is ready.`}</p>`;
  h += `<h3>Pages</h3><ol class="pages"><li class="${cur ? "" : "on"}"><a href="#/">The front page<small>${{ covers: "Covers", list: "A list", sheet: "A sheet", walk: "A walk" }[s.front.form]}</small></a><span class="acts"></span></li>` +
    s.pages.map((p, i) => `<li class="${cur === p.id ? "on" : ""}${p.inNav ? "" : " off"}"><a href="#/${encodeURIComponent(p.id)}">${esc(title(p))}<small>${esc(kindLine(p))}${p.inNav ? "" : " · hidden"}</small></a><span class="acts"><button type="button" data-a="page-up" data-id="${esc(p.id)}"${i === 0 ? " disabled" : ""} aria-label="Move up">&uarr;</button><button type="button" data-a="page-down" data-id="${esc(p.id)}"${i === s.pages.length - 1 ? " disabled" : ""} aria-label="Move down">&darr;</button><button type="button" data-a="page-nav" data-id="${esc(p.id)}" aria-label="${p.inNav ? "Hide" : "Show"} ${esc(title(p))}" title="${p.inNav ? "Shown" : "Hidden"}">${p.inNav ? "&#9679;" : "&#9675;"}</button></span></li>`).join("") + `</ol>`;
  if (s.trash.length) h += `<h3>Removed</h3><ol class="pages trash">${s.trash.map((t) => `<li><span class="t">${esc(title(t.page))}<small>${esc(O.KIND_NAMES[t.page.kind])} · removed ${esc(new Date(t.removedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }))}</small></span><span class="acts wide"><button type="button" class="word" data-a="page-restore" data-id="${esc(t.page.id)}">Put back</button><button type="button" data-a="trash-empty" data-id="${esc(t.page.id)}" aria-label="Delete for good">&times;</button></span></li>`).join("")}</ol><p class="hint">Removed pages wait here for thirty days, with their work, and can be put back.</p>`;
  h += `<h3>Add a page</h3><div class="adds">${(["story", "writing", "film", "project"] as const).map((k) => `<button type="button" data-a="page-add" data-kind="${k}">+ ${O.KIND_NAMES[k]}</button>`).join("")}${has("about") ? "" : '<button type="button" data-a="page-add" data-kind="about">+ About</button>'}${has("contact") ? "" : '<button type="button" data-a="page-add" data-kind="contact">+ Contact</button>'}${has("record") ? "" : '<button type="button" data-a="page-add" data-kind="record">+ Record</button>'}</div><p class="hint">A record holds your statement and the dated lists: exhibitions, publications, awards.</p>`;
  h += `<div class="adds"><button type="button" data-a="folder">+ A story from a folder</button></div><p class="hint">Choose a folder of photographs: they arrive as one story, in the order they were taken, with the titles, captions and dates written in the files. Or drop files or a folder anywhere on the page while editing.</p>`;
  h += `<p class="hint">A story holds photographs or paintings, arranged as you choose. Writing holds a poem, an essay or a fragment. A film shows at its own ratio. A project sets its process beside its outcome.</p>`;
  const spare = O.unused(s);
  if (spare.length) h += `<h3>Not on any page</h3><ol class="tray">${spare.map((a) => `<li>${thumb(a)}<span class="t">${esc(s.library[a].title || "Untitled")}</span><span class="acts"><button type="button" data-a="lib-remove" data-asset="${esc(a)}" aria-label="Delete from your work">&times;</button></span></li>`).join("")}</ol>`;
  return h;
}

function pageTab() {
  const p = current(), s = state.site;
  if (!p) {
    const list = s.pages.filter((x) => x.kind === "story" || x.kind === "writing" || x.kind === "film" || x.kind === "project");
    return `<h3>The front page</h3>${input("front.kicker", s.front.kicker, "Above the title")}${input("front.title", s.front.title, "Title")}${input("front.titleEm", s.front.titleEm, "Its italic part")}${area("front.note", s.front.note, "A line or two to introduce the site")}` +
      (house(s.house).fronts.length > 1 ? `<h3>Form</h3>${seg("front", house(s.house).fronts.map((f) => [f, { covers: "Covers", list: "A list", sheet: "A sheet", walk: "A walk" }[f]] as [string, string]), s.front.form)}` : `<h3>Form</h3>`) + `<p class="hint">${{ covers: "Each piece of work held large, one after another.", list: "A list of titles, with one cover held beside it.", sheet: "Covers in equal cells: the whole site at a glance.", walk: "The work hung along one wall, crossed sideways; each cover opens its story." }[s.front.form]}</p>` +
      `<h3>What it shows, in order</h3><ol class="pages">${list.map((x) => { const i = s.pages.indexOf(x); return `<li class="${x.inNav ? "" : "off"}"><a href="#/${encodeURIComponent(x.id)}">${esc(title(x))}<small>${esc(kindLine(x))}${x.inNav ? "" : " · hidden"}</small></a><span class="acts"><button type="button" data-a="page-up" data-id="${esc(x.id)}"${i === 0 ? " disabled" : ""} aria-label="Move up">&uarr;</button><button type="button" data-a="page-down" data-id="${esc(x.id)}"${i === s.pages.length - 1 ? " disabled" : ""} aria-label="Move down">&darr;</button><button type="button" data-a="page-nav" data-id="${esc(x.id)}" aria-label="${x.inNav ? "Hide" : "Show"}">${x.inNav ? "&#9679;" : "&#9675;"}</button></span></li>`; }).join("")}</ol>` +
      `<div class="adds">${(["story", "writing", "film", "project"] as const).map((k) => `<button type="button" data-a="page-add" data-kind="${k}">+ ${O.KIND_NAMES[k]}</button>`).join("")}</div>`;
  }
  const f = (k: string) => `page:${p.id}.${k}`;
  let h = `<p class="kind">${O.KIND_NAMES[p.kind]} · <span class="addr">/${esc(p.id)}</span></p><h3>Words</h3>${input(f("title"), p.title, "Title")}`;
  if (p.kind !== "about" && p.kind !== "contact" && p.kind !== "record") h += input(f("titleEm"), p.titleEm, "Its italic part");
  if (p.kind === "story") {
    h += input(f("kicker"), p.kicker, "Above the title: a season, a place") + area(f("note"), p.note, "A line or two to introduce it");
    const arr = house(s.house).arrangements, names: Record<string, string> = { held: "Held", book: "Book", passage: "Passage", contact: "Contact", wall: "Wall", slides: "Slides" };
    h += `<h3>Arrangement</h3>${arr.length > 1 ? seg("arrangement", arr.map((a) => [a, names[a]] as [string, string]), p.arrangement) : `<p class="fixed">${names[p.arrangement]}</p>`}<p class="hint">${{ held: "One work at a time, held large and still, down the page.", book: "Spreads, turned two pages at a time, like a photobook.", passage: "A walk along one wall, sideways, every work on the same line.", contact: "The whole story at a glance; choose one to hold it large.", wall: "Works hung together at their true size relative to one another.", slides: "One at a time, centred, with a strip of the others beneath." }[p.arrangement]}</p>`;
    h += `<h3>Works</h3><p class="hint">Drag a row to reorder. How each work sits is yours to choose: press the line under its title. Each arrangement offers only what it can show${p.arrangement === "contact" ? "; a contact sheet gives every frame an equal cell, so here there is only the order" : ""}.</p><ol class="tray">${p.pieces.map((x, k) => {
      if (x.type === "pause") return `<li class="pause" draggable="true" data-k="${k}"><span class="th ps">&para;</span><span class="t">${esc(x.text || "A pause")}<small>A pause</small></span>${acts(k, p.pieces.length)}</li>`;
      const w = s.library[x.asset], opts = O.arrangeOptions(s, p.id, k), cur = opts.find((o) => o.current), tag = cur ? cur.title.toLowerCase() : "in the sheet";
      const note = x.arrange === "margin-note" && opts.some((o) => o.key === "margin-note") ? `<div class="menu wide">${input(`piece:${p.id}:${k}.note`, x.note, "The note beside it")}</div>` : "";
      return `<li draggable="true" data-k="${k}">${thumb(x.asset)}<span class="t">${esc(w?.title || "Untitled")}${w?.size ? `<small class="sz">${w.size.w} × ${w.size.h} cm</small>` : ""}${opts.length ? `<button type="button" class="how" data-a="tray" data-k="${k}" aria-expanded="${trayOpen === k}" title="Change how it sits">${esc(tag)} &rsaquo;</button>` : `<small>${esc(tag)}</small>`}</span>${acts(k, p.pieces.length)}${note}${trayOpen === k ? `<div class="menu">${opts.map((o) => `<button type="button" data-a="arrange" data-k="${k}" data-key="${o.key}" aria-pressed="${o.current}">${o.title}</button>`).join("")}</div><div class="menu"><span class="h">Move to</span>${s.pages.filter((y) => y.kind === "story" && y.id !== p.id).map((y) => `<button type="button" data-a="move-to" data-k="${k}" data-to="${esc(y.id)}">${esc(title(y))}</button>`).join("")}<button type="button" data-a="move-to" data-k="${k}" data-to="new">A new story</button></div><div class="menu"><button type="button" data-a="pause-after" data-k="${k}">A pause after it</button><button type="button" data-a="replace" data-k="${k}">Replace the photograph</button><button type="button" data-a="focal" data-asset="${esc(x.asset)}">Set the focal point</button></div><div class="menu size"><span class="h">Real size</span><label><input type="number" inputmode="decimal" min="1" max="2000" step="0.1" data-size="w" data-asset="${esc(x.asset)}" value="${w?.size ? w.size.w : ""}" placeholder="width" aria-label="Width in centimetres"> × <input type="number" inputmode="decimal" min="1" max="2000" step="0.1" data-size="h" data-asset="${esc(x.asset)}" value="${w?.size ? w.size.h : ""}" placeholder="height" aria-label="Height in centimetres"> cm</label><p class="hint">Give one side; the other follows the picture. A work with a real size can be seen at life size.</p></div>` : ""}</li>`;
    }).join("")}</ol><div class="adds"><button type="button" data-a="add-works" data-page="${esc(p.id)}" data-after="${p.pieces.length - 1}">+ Works</button><button type="button" data-a="pause-after" data-k="${p.pieces.length - 1}">+ A pause</button></div>`;
  }
  if (p.kind === "writing") {
    h += input(f("place"), p.place, "Place") + input(f("year"), p.year, "Year");
    h += `<h3>Form</h3>${seg("form", [["Poem", "Poem"], ["Essay", "Essay"], ["Fragment", "Fragment"]], /poem/i.test(p.form) ? "Poem" : /essay/i.test(p.form) ? "Essay" : "Fragment")}`;
    h += `<h3>Text</h3>${p.paras.map((t, i) => `<div class="para">${area(`${f("para")}.${i}`, t, /poem/i.test(p.form) ? "The poem, with its line breaks" : "A paragraph", /poem/i.test(p.form) ? 8 : 4)}${p.paras.length > 1 ? `<button type="button" class="rm" data-a="para-remove" data-i="${i}" aria-label="Remove this paragraph">&times;</button>` : ""}</div>`).join("")}${/poem/i.test(p.form) ? "" : '<div class="adds"><button type="button" data-a="para-add">+ A paragraph</button></div>'}${input(f("margin"), p.margin, "A note under the piece")}`;
    h += `<h3>Image</h3>${p.image ? `<ol class="tray"><li>${thumb(p.image.asset)}<span class="t">${esc(s.library[p.image.asset]?.title || "Image")}<small>${p.image.at === "cover" ? "above the text" : "inside the text"}</small></span><span class="acts"><button type="button" data-a="w-img-remove" aria-label="Remove the image">&times;</button></span></li></ol>${!/poem/i.test(p.form) && p.paras.length > 1 ? seg("img-at", [["cover", "Above the text"], ["in", "Inside the text"]], p.image.at === "cover" ? "cover" : "in") : ""}` : `<div class="adds"><button type="button" data-a="w-img">+ An image</button></div>`}`;
  }
  if (p.kind === "film") {
    h += input(f("form"), p.form, "Form: short film, documentary") + input(f("year"), p.year, "Year") + input(f("runtime"), p.runtime, "Length: 28 sec, 12 min") + area(f("synopsis"), p.synopsis, "A line or two about the film") + input(`film:${p.id}.link`, p.link, "Where it can be watched (a link)") + area(f("credits"), p.credits.join("\n"), "Credits, one per line", 3);
    h += `<h3>Ratio</h3>${seg("ratio", [["2.39:1", "2.39"], ["2.00:1", "2.00"], ["1.85:1", "1.85"], ["16:9", "16:9"], ["4:3", "4:3"], ["1:1", "1:1"]], p.ratio)}`;
    h += `<h3>Poster</h3>${p.poster ? `<ol class="tray"><li>${thumb(p.poster)}<span class="t">${esc(s.library[p.poster]?.title || "Poster")}</span><span class="acts"><button type="button" data-a="poster-remove" aria-label="Remove the poster">&times;</button></span></li></ol>` : ""}<div class="adds"><button type="button" data-a="poster">${p.poster ? "Replace the poster" : "+ A poster"}</button></div>`;
    h += list("stills", "Stills", p.stills.map((x) => x.asset));
  }
  if (p.kind === "project") {
    h += input(f("discipline"), p.discipline, "Kind: identity, book, exhibition") + input(f("client"), p.client, "Client") + input(f("year"), p.year, "Year") + area(f("summary"), p.summary, "What the project was") + area(f("facts"), p.facts.join("\n"), "Facts, one per line: Role: …", 3);
    h += list("process", "Process, in order", p.process) + list("outcome", "Outcome", p.outcome);
    if (p.process.length && p.outcome.length) h += `<h3>Comparison</h3>${seg("compare", [["on", "Set the first step against the outcome"], ["off", "No comparison"]], p.compare ? "on" : "off")}`;
  }
  if (p.kind === "record") {
    h += `<h3>Statement</h3>${p.paras.map((t, i) => `<div class="para">${area(`${f("para")}.${i}`, t, i ? "Another paragraph" : "What the work is, and why", 4)}${p.paras.length > 1 ? `<button type="button" class="rm" data-a="para-remove" data-i="${i}" aria-label="Remove this paragraph">&times;</button>` : ""}</div>`).join("")}<div class="adds"><button type="button" data-a="para-add">+ A paragraph</button></div>`;
    h += p.sections.map((sec, n) => `<div class="rsec"><div class="rhead">${input(`${f("section")}.${n}.title`, sec.title, "Section")}<span class="acts"><button type="button" data-a="sec-up" data-n="${n}"${n === 0 ? " disabled" : ""} aria-label="Move up">&uarr;</button><button type="button" data-a="sec-down" data-n="${n}"${n === p.sections.length - 1 ? " disabled" : ""} aria-label="Move down">&darr;</button><button type="button" data-a="sec-remove" data-n="${n}" aria-label="Remove this section">&times;</button></span></div><ol class="entries">${sec.entries.map((e, m) => `<li><input type="text" class="yr" data-f="${f("entry")}.${n}.${m}.year" value="${esc(e.year)}" placeholder="Year" aria-label="Year"><input type="text" data-f="${f("entry")}.${n}.${m}.text" value="${esc(e.text)}" placeholder="What, where" aria-label="Entry"><span class="acts"><button type="button" data-a="ent-up" data-n="${n}" data-m="${m}"${m === 0 ? " disabled" : ""} aria-label="Earlier">&uarr;</button><button type="button" data-a="ent-down" data-n="${n}" data-m="${m}"${m === sec.entries.length - 1 ? " disabled" : ""} aria-label="Later">&darr;</button><button type="button" data-a="ent-remove" data-n="${n}" data-m="${m}" aria-label="Remove">&times;</button></span></li>`).join("")}</ol><div class="adds"><button type="button" data-a="ent-add" data-n="${n}">+ An entry</button></div></div>`).join("");
    h += `<h3>Add a section</h3><div class="adds">${O.RECORD_SECTIONS.filter((t) => !p.sections.some((x) => x.title.toLowerCase() === t.toLowerCase())).map((t) => `<button type="button" data-a="sec-add" data-title="${t}">+ ${t}</button>`).join("")}<button type="button" data-a="sec-add" data-title="A section">+ Another</button></div><p class="hint">Newest first is the custom; the order is yours.</p>`;
  }
  if (p.kind === "about" || p.kind === "contact") {
    h += `<h3>Text</h3>${p.paras.map((t, i) => `<div class="para">${area(`${f("para")}.${i}`, t, "A paragraph", 4)}${p.paras.length > 1 ? `<button type="button" class="rm" data-a="para-remove" data-i="${i}" aria-label="Remove this paragraph">&times;</button>` : ""}</div>`).join("")}<div class="adds"><button type="button" data-a="para-add">+ A paragraph</button></div>`;
    if (p.kind === "about") h += `<h3>Principles</h3>${p.principles.map((t, i) => `<div class="para">${input(`${f("principle")}.${i}`, t, "A principle")}<button type="button" class="rm" data-a="prin-remove" data-i="${i}" aria-label="Remove">&times;</button></div>`).join("")}<div class="adds"><button type="button" data-a="prin-add">+ A principle</button></div><p class="hint">Principles are set large and numbered under the text. Leave them out if you have none.</p>`;
  }
  h += appearsBlock(p);
  h += `<h3>Address</h3><p class="hint">Shown at <b>/${esc(p.id)}</b>.${p.inNav ? "" : " Hidden from the site; only its address reaches it."}${s.door.word ? " The whole site is behind a word." : p.word ? " Shown to those who have the word; its cover and lines stay out of sight." : ""}</p>${s.door.word ? "" : `<input type="text" data-f="page:${esc(p.id)}.word" value="${esc(p.word)}" placeholder="Behind a word (leave empty for open)" aria-label="A word this page is behind" autocapitalize="none" spellcheck="false">`}<div class="adds"><button type="button" data-a="page-nav" data-id="${esc(p.id)}">${p.inNav ? "Hide this page" : "Show this page"}</button><button type="button" data-a="page-rename">Address from the title</button><button type="button" class="danger" data-a="page-remove" data-id="${esc(p.id)}">Remove this page</button></div>`;
  return h;
}
/** How a page (or the site) appears elsewhere: title and description for a search result, the share image for a link; shown as they would look. */
function appearsBlock(p: SitePage | null): string {
  const s = state.site, c = { site: s, editing: false, href: (i: string) => "/" + i, src: (a: string) => state.store.src(a) }, ap = appearsOf(c, p), f = p ? `page:${p.id}.appears` : "site.appears", addr = address(s.name) + (p ? `/${p.id}` : "");
  const set = p ? p.appears : { title: "", description: "", share: s.appears.share };
  let h = `<h3>How it appears</h3><p class="hint top">In a search result, and as a link sent to someone. Left empty, it is taken from the page itself.</p>`;
  if (p) h += input(`${f}.title`, set.title, ap.title);
  h += area(`${f}.description`, set.description, p ? ap.description || "A line or two about this page" : "A line about the site, for pages that have none");
  h += `<div class="appears"><div class="search"><b>${esc(ap.title)}</b><span>${esc(addr)}</span><p>${esc(ap.description || "")}</p></div>` +
    `<div class="card-share">${ap.share ? `<img src="${esc(ap.share.src)}" alt="" style="--fx:${ap.share.focal.x}%;--fy:${ap.share.focal.y}%">` : `<span class="none">No image</span>`}<span class="t">${esc(ap.title)}</span></div></div>`;
  h += `<div class="adds"><button type="button" data-a="share-pick" data-page="${esc(p?.id ?? "")}">${ap.own ? "Another share image" : "Choose a share image"}</button>${ap.own ? `<button type="button" data-a="share-clear" data-page="${esc(p?.id ?? "")}">${p ? "Back to the cover" : "None"}</button>` : ""}${ap.share ? `<button type="button" data-a="focal" data-asset="${esc(ap.share.asset)}">Set its focal point</button>` : ""}</div><p class="hint">${p ? "Without one, the page's cover is used, cut around its focal point." : "Used for pages that have no cover of their own."}</p>`;
  return h;
}
function acts(k: number, n: number) {
  return `<span class="acts"><button type="button" data-a="piece-up" data-k="${k}"${k === 0 ? " disabled" : ""} aria-label="Earlier">&uarr;</button><button type="button" data-a="piece-down" data-k="${k}"${k === n - 1 ? " disabled" : ""} aria-label="Later">&darr;</button><button type="button" data-a="piece-remove" data-k="${k}" aria-label="Remove">&times;</button></span>`;
}
function list(name: "stills" | "outcome" | "process", label: string, assets: string[]) {
  return `<h3>${label}</h3><ol class="tray">${assets.map((a, i) => `<li>${thumb(a)}<span class="t">${esc(state.site.library[a]?.title || "Untitled")}</span><span class="acts"><button type="button" data-a="list-up" data-list="${name}" data-i="${i}"${i === 0 ? " disabled" : ""} aria-label="Earlier">&uarr;</button><button type="button" data-a="list-down" data-list="${name}" data-i="${i}"${i === assets.length - 1 ? " disabled" : ""} aria-label="Later">&darr;</button><button type="button" data-a="list-remove" data-list="${name}" data-i="${i}" aria-label="Remove">&times;</button></span></li>`).join("")}</ol><div class="adds"><button type="button" data-a="list-add" data-list="${name}">+ Add</button></div>`;
}

function customise() {
  const t = state.site.theme, L = T(), h = house(state.site.house), quiet = t.look === "quiet";
  const dark = document.documentElement.style.colorScheme === "dark";
  const sub = (title: string, note?: string) => `<h2 class="group">${title}</h2>${note ? `<p class="hint top">${note}</p>` : ""}`;
  const label = (key: string, v: string) => (STRUCTURE[key as keyof typeof STRUCTURE] as readonly (readonly [string, string])[]).find((x) => x[0] === v)?.[1] ?? v;
  let h2 = `<div class="this-house"><span class="label-ed">Your template</span><b>${esc(h.name)}</b><span>${esc(h.owns)}</span><button type="button" class="link" data-a="houses">Choose another template</button></div>`;
  if (showHouses) h2 += `<div class="houses">${HOUSES.map((x) => `<button type="button" data-house="${x.id}" aria-pressed="${h.id === x.id}"><b>${esc(x.name)}</b><small>${esc(x.for)}</small><span>${esc(x.idea)}</span></button>`).join("")}</div><p class="hint">A template makes the big decisions: how pages are built, how stories are arranged, which looks and type suit it. Your work and words stay as they are when you change it.</p>`;
  h2 += sub("Look", `The looks made for ${h.name}.`);
  h2 += `<div class="looks">${h.looks.filter((k) => L.LOOKS[k]).map((k) => { const v = L.LOOKS[k].vars ?? {}; return `<button type="button" data-look="${k}" aria-pressed="${t.look === k}" style="background:${v["--silk"] ?? "#EEE9E7"};color:${v["--ink"] ?? "#29222A"}"><span class="aa" style="font-family:${(v["--serif"] ?? L.TYPES.silk.display).replace(/"/g, "&quot;")};font-weight:${v["--title-weight"] ?? 300}">Aa<i style="background:${v["--peony"] ?? "#B87B8A"}"></i></span><span class="tn">${esc(L.LOOKS[k].name)}</span></button>`; }).join("")}</div><p class="hint">${esc(L.LOOKS[t.look]?.note ?? "")}</p>`;
  const swatch = (a: string | null, cls = "") => { const shown = L.accentFor(t.look, a, dark, t.palette).peony; const on = a === null ? !t.accent : t.accent?.toLowerCase() === a!.toLowerCase(); return `<button type="button" class="sw${a === null ? " own" : ""}${cls}" data-accent="${a ?? ""}" aria-pressed="${on}" aria-label="${a === null ? "The look's own accent" : `Accent ${a}`}"><i style="background:${shown}"></i></button>`; };
  h2 += `<h3>Accent</h3><div class="swatches">${[null, ...L.ACCENTS].map((a) => swatch(a)).join("")}</div>`;
  const fromWork = workColours();
  if (fromWork === null) h2 += `<p class="hint">Reading the colours in your work…</p>`;
  else if (fromWork.length) h2 += `<p class="hint top" style="margin-top:14px">From your work</p><div class="swatches">${fromWork.map((a) => swatch(a, " work")).join("")}</div><p class="hint">The colours that recur in your photographs, each made to read on this ground.</p>`;
  if (quiet) {
    h2 += `<h3>Light</h3>${seg("mode", [["light", "Day"], ["dark", "Night"], ["system", "Follow the device"]], t.mode)}`;
    h2 += `<h3>Palette</h3><div class="swatches">${Object.entries(L.PALETTES).map(([k, p]) => `<button type="button" class="sw pal" data-palette="${k}" aria-pressed="${t.palette === k}" aria-label="${esc(p.name)}"><i style="background:linear-gradient(135deg, ${p.light.silk} 50%, ${p.light.ink} 50%)"></i></button>`).join("")}</div>`;
  }
  if (h.typefaces.length > 1) h2 += `<h3>Type</h3><div class="types">${h.typefaces.map((k) => { const f = k ? TYPEFACES[k] : null; return `<button type="button" data-typeface="${k ?? ""}" aria-pressed="${(t.typeface ?? null) === k}"${f ? ` title="${esc(f.note)}"` : ""}><span class="aa"${f ? ` style="font-family:${f.display.replace(/"/g, "&quot;")};font-weight:${f.weight}"` : ""}>Aa</span><span class="tn">${f ? esc(f.name) : "The look's own"}</span></button>`; }).join("")}</div>`;
  const open = DIALS.filter((d) => h.dials[d].length > 1);
  if (open.length) {
    h2 += sub(`Within ${h.name}`, "The ways this template can be set. Each keeps it itself.");
    for (const d of open) h2 += `<h3>${{ header: "Header", opening: "Opening", title: "Titles", captions: "Captions", footer: "Footer", scale: "Scale" }[d]}</h3>${seg(d, (h.dials[d] as string[]).map((v) => [v, label(d, v)] as [string, string]), t[d] as string)}<p class="hint">${STRUCTURE_HINTS[d]}</p>`;
  }
  h2 += sub("Details");
  h2 += `<h3>Mount</h3>${seg("mount", [["bare", "Bare"], ["line", "A hairline"], ["matte", "A mat"]], t.mount)}`;
  h2 += `<h3>Spacing</h3>${seg("space", [["airy", "Airy"], ["standard", "Standard"], ["close", "Close"]], t.space)}`;
  h2 += `<h3>Reading size</h3>${seg("read", [["small", "Small"], ["standard", "Standard"], ["large", "Large"]], t.read)}`;
  h2 += `<h3>Motion</h3>${seg("motion", [["slow", "Slow arrivals"], ["still", "Still"]], t.motion)}`;
  return h2;
}
let showHouses = false;

/* the colours in the artist's work, read once per set of photographs; null while they are being read */
let coloursFor = "", coloursReady: string[] | null = null;
function workColours(): string[] | null {
  const ids = Object.keys(state.site.library).filter((a) => state.site.library[a].kind !== "video").slice(0, 24), key = ids.join("|");
  if (key === coloursFor) return coloursReady;
  coloursFor = key; coloursReady = null;
  if (!ids.length) { coloursReady = []; return coloursReady; }
  Promise.all(ids.map((a) => pixelsOf(state.store.src(a)))).then((all) => {
    if (key !== coloursFor) return;
    coloursReady = accentsAcross(all.filter((px): px is Uint8ClampedArray => !!px).map((px) => accentsFrom(px)));
    if (mode === "customise") renderPanel();
  });
  return null;
}

/* ------------------------------------------------------------------ the library */

type Target = { kind: "story"; page: string; after: number } | { kind: "list"; page: string; list: "stills" | "outcome" | "process" } | { kind: "poster"; page: string } | { kind: "writing"; page: string } | { kind: "share"; page: string | null } | { kind: "logo" };
let target: Target | null = null, chosen: string[] = [];
const single = () => target?.kind === "poster" || target?.kind === "writing" || target?.kind === "share" || target?.kind === "logo";
function openLib(t: Target) { target = t; chosen = []; renderLib(); lib.hidden = false; (lib.querySelector(".grid button") as HTMLElement | null)?.focus(); }
function closeLib() { lib.hidden = true; target = null; }
function renderLib(note?: string) {
  const s = state.site, where: Record<string, string[]> = {};
  s.pages.forEach((p) => { (p.kind === "story" ? p.pieces.flatMap((x) => (x.type === "work" ? [x.asset] : [])) : p.kind === "film" ? [p.poster, ...p.stills.map((x) => x.asset)] : p.kind === "project" ? [...p.outcome, ...p.process] : p.kind === "writing" && p.image ? [p.image.asset] : []).forEach((a) => { if (a) (where[a] ??= []).push(title(p)); }); });
  const ids = Object.keys(s.library).filter((a) => s.library[a].kind !== "video").sort((a, b) => Number(b.startsWith("asset:")) - Number(a.startsWith("asset:")));
  $(".grid", lib)!.innerHTML = `<button type="button" class="new" data-lib="files"><span>From your computer</span><small>JPEG, PNG or HEIC, up to 15 MB each</small></button>` +
    ids.map((a) => `<button type="button" data-pick="${esc(a)}" aria-pressed="${chosen.includes(a)}"><span class="fr">${thumb(a).replace('class="th"', 'class="im"')}</span><span class="nm">${esc(s.library[a].title || "Untitled")}</span><span class="in">${where[a] ? `In ${esc([...new Set(where[a])].join(", "))}` : "Not on a page yet"}</span></button>`).join("");
  $(".note", lib)!.textContent = note ?? (single() ? "Choose one." : "Choose as many as you like. A work can sit in more than one story.");
  const add = $<HTMLButtonElement>("[data-lib=add]", lib)!; add.disabled = !chosen.length; add.textContent = chosen.length > 1 ? `Add ${chosen.length}` : "Add";
}
async function onFiles(e: Event) {
  const inp = e.target as HTMLInputElement, files = [...(inp.files ?? [])]; inp.value = ""; if (!files.length) return;
  renderLib(`Preparing ${files.length === 1 ? "one photograph" : `${files.length} photographs`}…`);
  const { site: s, ids, errors } = await bringIn(files);
  chosen = single() ? ids.slice(-1) : [...chosen, ...ids];
  commit(s, { keep: true });
  renderLib(errors.length ? errors.join(" ") : "Added to your work, and chosen. Press Add to place them.");
}
/** Files from the computer into the library, in the order they were taken; what each file said is kept with it. */
async function bringIn(files: File[]) {
  let s = state.site; const errors: string[] = [], got: { id: string; taken?: string; name: string }[] = [];
  for (const f of files) {
    if (f.name.startsWith(".")) continue;
    try { const r = await state.store.putImage(f); s = O.addToLibrary(s, r.id, r); got.push({ id: r.id, taken: r.taken, name: f.webkitRelativePath || f.name }); }
    catch (err) { errors.push((err as Error).message); }
  }
  await state.store.prepare(Object.keys(s.library));
  return { site: s, ids: inOrder(got).map((g) => g.id), errors };
}
/** A folder (chosen, or dropped) becomes a story named after it; dropped on a story, the files join that story. */
async function storyFrom(files: File[], folderName: string) {
  if (!files.length) return;
  toast(`Bringing in ${files.length === 1 ? "one photograph" : `${files.length} photographs`}…`);
  const { site: s, ids, errors } = await bringIn(files);
  if (!ids.length) return toast(errors[0] ?? "Nothing could be read.");
  const p = current();
  if (p?.kind === "story") { commit(O.addWorks(s, p.id, p.pieces.length - 1, ids)); toast(`${ids.length} added to “${title(p)}”.${errors.length ? ` ${errors.length} could not be read.` : ""}`); return; }
  const r = O.storyFromWorks(s, folderName, ids); tab = "page"; commit(r.site); go(r.id);
  toast(`A new story, “${title(r.site.pages.find((x) => x.id === r.id)!)}”, with ${ids.length} ${ids.length === 1 ? "work" : "works"}.${errors.length ? ` ${errors.length} could not be read.` : ""}`);
}
async function onFolder(e: Event) {
  const inp = e.target as HTMLInputElement, files = [...(inp.files ?? [])]; inp.value = "";
  const folder = files[0]?.webkitRelativePath?.split("/")[0] ?? "";
  await storyFrom(files, folder.replace(/[-_]+/g, " "));
}
const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
function dropHint(on: boolean) { const d = $("#drop")!; d.hidden = !on; if (on) { const p = current(); d.querySelector("span")!.textContent = p?.kind === "story" ? `Drop to add to “${title(p)}”` : "Drop to make a new story"; } }
async function onDrop(e: DragEvent) {
  if (!state.editing || !hasFiles(e)) return;
  e.preventDefault(); dropHint(false);
  const items = [...(e.dataTransfer?.items ?? [])], files: File[] = []; let folder = "";
  const take = (f: File, prefix: string) => { if (prefix) Object.defineProperty(f, "webkitRelativePath", { value: prefix + f.name }); files.push(f); };
  const walk = async (entry: FileSystemEntry, prefix: string, fallback: File | null): Promise<void> => {
    if (entry.isFile) { try { take(await new Promise<File>((ok, no) => (entry as FileSystemFileEntry).file(ok, no)), prefix); } catch { if (fallback) take(fallback, prefix); } }
    else if (entry.isDirectory) { folder ||= entry.name; const rd = (entry as FileSystemDirectoryEntry).createReader(); let batch: FileSystemEntry[]; do { batch = await new Promise((ok, no) => rd.readEntries(ok, no)); for (const x of batch) await walk(x, `${prefix}${entry.name}/`, null); } while (batch.length); }
  };
  try { for (const it of items) { const entry = it.webkitGetAsEntry?.(); if (entry) await walk(entry, "", it.getAsFile()); else { const f = it.getAsFile(); if (f) files.push(f); } } }
  catch (err) { return toast(`Could not read what was dropped: ${(err as Error).message}`); }
  await storyFrom(files.filter((f) => /^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name)), folder.replace(/[-_]+/g, " ") || (files.length === 1 ? "" : "New story"));
}
/** Where the picture's heart is: a point the artist sets by pressing on the picture; crops that must cut keep it in view. */
function openFocal(asset: string) {
  const w = state.site.library[asset]; if (!w) return;
  let box = $("#focal");
  if (!box) { document.body.insertAdjacentHTML("beforeend", `<div class="lib focal" id="focal" role="dialog" aria-modal="true" aria-label="The focal point"><div class="sheet2 narrow"><header><b>The focal point</b><button type="button" class="x" data-focal="close">Close</button></header><div class="focal-body"><p class="hint">Press where the picture's heart is. Where a crop must cut, this stays in view: the share image, the opening image.</p><div class="pic"><img alt=""><i></i></div></div></div></div>`); box = $("#focal")!; }
  const img = box.querySelector<HTMLImageElement>("img")!, dot = box.querySelector<HTMLElement>(".pic i")!;
  img.src = state.store.src(asset); dot.style.left = `${w.focal.x}%`; dot.style.top = `${w.focal.y}%`; box.dataset.asset = asset; box.hidden = false;
}
document.addEventListener("click", (e) => {
  const t = e.target as HTMLElement, box = $("#focal"); if (!box || box.hidden) return;
  if (t.closest("[data-focal=close]") || t === box) { box.hidden = true; return; }
  const img = t.closest<HTMLImageElement>("#focal .pic img"); if (!img) return;
  const r = img.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 100, y = ((e.clientY - r.top) / r.height) * 100;
  commit(O.setFocal(state.site, box.dataset.asset!, x, y), { keep: true });
  const dot = box.querySelector<HTMLElement>(".pic i")!; dot.style.left = `${Math.round(x)}%`; dot.style.top = `${Math.round(y)}%`;
});
let replacing: { page: string; k: number } | null = null;
async function onReplaceFile(e: Event) {
  const inp = e.target as HTMLInputElement, f = inp.files?.[0]; inp.value = ""; if (!f || !replacing) return;
  const p = state.site.pages.find((x) => x.id === replacing!.page), piece = p?.kind === "story" ? p.pieces[replacing.k] : null; replacing = null;
  if (!piece || piece.type !== "work") return;
  try { const r = await state.store.putImage(f); await state.store.prepare([r.id]); commit(O.replaceWork(state.site, piece.asset, r.id, r)); toast("Replaced. Its title, caption and date are kept, wherever it appears."); }
  catch (err) { toast((err as Error).message); }
}

function place() {
  if (!target || !chosen.length) return;
  const t = target, s = state.site; closeLib();
  if (t.kind === "story") commit(O.addWorks(s, t.page, t.after, chosen));
  else if (t.kind === "list") commit(O.addToList(s, t.page, t.list, chosen));
  else if (t.kind === "poster") commit(O.setFilm(s, t.page, { poster: chosen[0] }));
  else if (t.kind === "share") commit(O.setShare(s, t.page, chosen[0]));
  else if (t.kind === "logo") commit(O.setLogo(s, chosen[0]));
  else commit(O.setWritingImage(s, t.page, { asset: chosen[0], at: "cover" }));
  toast(chosen.length === 1 ? "Added." : `${chosen.length} added.`);
}

/* ------------------------------------------------------------------ actions */

function act(a: string, d: DOMStringMap) {
  const s = state.site, p = current(), k = Number(d.k), id = d.id ?? p?.id ?? "";
  const run = (f: () => void) => { try { f(); } catch (err) { toast((err as Error).message); } };
  run(() => {
    switch (a) {
      case "done": return setEditing(false);
      case "close": return closePanel();
      case "houses": showHouses = !showHouses; return renderPanel();
      case "page-add": { const r = O.addPage(s, d.kind as O.PageKind); commit(r.site); tab = "page"; go(r.id); return toast(`${O.KIND_NAMES[d.kind as O.PageKind]} added.`); }
      case "page-up": return commit(O.movePage(s, id, -1));
      case "page-down": return commit(O.movePage(s, id, 1));
      case "page-nav": return commit(O.toggleNav(s, id));
      case "page-remove": { const pg = s.pages.find((x) => x.id === id); if (!pg) return; commit(O.removePage(s, id)); if (pageId() === id) go(""); tab = "site"; return toast(`“${title(pg)}” is in the trash, under The site. Undo brings it straight back.`); }
      case "page-restore": { const r = O.restorePage(s, id); commit(r.site); tab = "page"; go(r.id); return toast(r.lost ? `Put back, without ${r.lost === 1 ? "one work" : `${r.lost} works`} deleted meanwhile.` : "Put back."); }
      case "trash-empty": { const t = s.trash.find((x) => x.page.id === id); if (!t || !confirm(`Delete “${title(t.page)}” for good?`)) return; return commit(O.emptyTrash(s, id)); }
      case "page-rename": { if (!p) return; const r = O.renamePage(s, p.id, title(p)); if (r.id === p.id) return toast("The address already follows the title."); commit(r.site); go(r.id); return; }
      case "lib-remove": return commit(O.removeFromLibrary(s, d.asset!));
      case "folder": return $<HTMLInputElement>("#folder")!.click();
      case "share-pick": return openLib({ kind: "share", page: d.page || null });
      case "share-clear": return commit(O.setShare(s, d.page || null, null));
      case "logo-pick": return openLib({ kind: "logo" });
      case "logo-clear": return commit(O.setLogo(s, null));
      case "focal": return openFocal(d.asset!);
      case "replace": { if (!p || p.kind !== "story") return; replacing = { page: p.id, k }; openMenu = null; trayOpen = null; return $<HTMLInputElement>("#one-file")!.click(); }
      case "add-works": return openLib({ kind: "story", page: d.page!, after: Number(d.after) });
      case "piece-up": return commit(O.movePiece(s, id, k, -1));
      case "piece-down": return commit(O.movePiece(s, id, k, 1));
      case "piece-remove": openMenu = null; trayOpen = null; commit(O.removePiece(s, id, k)); return toast("Removed from this story. Undo brings it back; the work stays in your library.");
      case "pause-after": return commit(O.addPause(s, id, k));
      case "menu-arrange": case "menu-move": { const kind = a === "menu-arrange" ? "arrange" : "move"; openMenu = openMenu?.k === k && openMenu.kind === kind ? null : { k, kind }; return toolbars(); }
      case "arrange": openMenu = null; return commit(O.arrange(s, id, k, d.key as O.ArrangeKey));
      case "move-to": { openMenu = null; trayOpen = null; const r = O.moveTo(s, id, k, d.to!); commit(r.site); return toast(`Moved to “${title(r.site.pages.find((x) => x.id === r.to)!)}”.`); }
      case "tray": trayOpen = trayOpen === k ? null : k; return renderPanel();
      case "list-add": return openLib({ kind: "list", page: id, list: d.list as "stills" });
      case "list-up": return commit(O.moveInList(s, id, d.list as "stills", Number(d.i), -1));
      case "list-down": return commit(O.moveInList(s, id, d.list as "stills", Number(d.i), 1));
      case "list-remove": return commit(O.removeFromList(s, id, d.list as "stills", Number(d.i)));
      case "poster": return openLib({ kind: "poster", page: id });
      case "poster-remove": return commit(O.setFilm(s, id, { poster: null }));
      case "w-img": return openLib({ kind: "writing", page: id });
      case "w-img-remove": return commit(O.setWritingImage(s, id, null));
      case "sec-add": return commit(O.addSection(s, id, d.title ?? "A section"));
      case "sec-remove": return commit(O.removeSection(s, id, Number(d.n)));
      case "sec-up": return commit(O.moveSection(s, id, Number(d.n), -1));
      case "sec-down": return commit(O.moveSection(s, id, Number(d.n), 1));
      case "ent-add": return commit(O.addEntry(s, id, Number(d.n)));
      case "ent-remove": return commit(O.removeEntry(s, id, Number(d.n), Number(d.m)));
      case "ent-up": return commit(O.moveEntry(s, id, Number(d.n), Number(d.m), -1));
      case "ent-down": return commit(O.moveEntry(s, id, Number(d.n), Number(d.m), 1));
      case "para-add": return commit(O.addPara(s, id));
      case "para-remove": return commit(O.removePara(s, id, Number(d.i)));
      case "prin-add": return commit(O.addPara(s, id, "principles"));
      case "prin-remove": return commit(O.removePara(s, id, Number(d.i), "principles"));
    }
  });
}

let doorWant = false;
function onSet(key: string, v: string) {
  const s = state.site, p = current();
  try {
    if (key === "door") { doorWant = v === "word"; return commit(O.setDoor(s, v as "open")); }
    if (key === "front") return commit(O.setFront(s, v as "covers"));
    if (key === "arrangement" && p) return commit(O.setArrangement(s, p.id, v as "held"), { keep: false });
    if (key === "form" && p) return commit(O.setField(s, `page:${p.id}.form`, v));
    if (key === "ratio" && p) return commit(O.setFilm(s, p.id, { ratio: v }));
    if (key === "compare" && p) return commit(O.setCompare(s, p.id, v === "on"));
    if (key === "img-at" && p?.kind === "writing" && p.image) return commit(O.setWritingImage(s, p.id, { asset: p.image.asset, at: v === "cover" ? "cover" : 1 }));
    if (["mode", "mount", "space", "read", "motion", "header", "opening", "title", "captions", "footer", "scale"].includes(key)) return commit(O.setTheme(s, { [key]: v }));
  } catch (err) { toast((err as Error).message); }
}

function onClick(e: MouseEvent) {
  const t = e.target as HTMLElement;
  const b = t.closest<HTMLElement>("[data-a]");
  if (b && !(b as HTMLButtonElement).disabled) { e.preventDefault(); act(b.dataset.a!, b.dataset); return; }
  const addr = t.closest<HTMLElement>('[data-act="add-works"]'); if (addr) { act("add-works", addr.dataset); return; }
  const tb = t.closest<HTMLElement>("#panel [data-tab]"); if (tb) { tab = tb.dataset.tab as "site"; trayOpen = null; return renderPanel(); }
  const sg = t.closest<HTMLElement>(".seg[data-set] button"); if (sg) return onSet(sg.parentElement!.dataset.set!, sg.dataset.v!);
  const lk = t.closest<HTMLElement>("#panel [data-look]"); if (lk) return commit(O.setTheme(state.site, { look: lk.dataset.look as never }));
  const ac = t.closest<HTMLElement>("#panel [data-accent]"); if (ac) return commit(O.setTheme(state.site, { accent: ac.dataset.accent || null }));
  const pl = t.closest<HTMLElement>("#panel [data-palette]"); if (pl) return commit(O.setTheme(state.site, { palette: pl.dataset.palette as never }));
  const tf = t.closest<HTMLElement>("#panel [data-typeface]"); if (tf) return commit(O.setTheme(state.site, { typeface: (tf.dataset.typeface || null) as never }));
  const hs = t.closest<HTMLElement>("#panel [data-house]");
  if (hs) {
    if (hs.getAttribute("aria-pressed") === "true") return;
    const r = O.applyHouse(state.site, hs.dataset.house as never); showHouses = false; commit(r.site);
    return toast(`${house(r.site.house).name}. Your work is as it was${r.rearranged.length ? `; ${r.rearranged.length === 1 ? "one story takes" : `${r.rearranged.length} stories take`} an arrangement it offers` : ""}. Undo brings back your previous template.`);
  }
  const pick = t.closest<HTMLElement>("[data-pick]");
  if (pick) { const a = pick.dataset.pick!; chosen = single() ? [a] : chosen.includes(a) ? chosen.filter((x) => x !== a) : [...chosen, a]; return renderLib(); }
  const lb = t.closest<HTMLElement>("[data-lib]");
  if (lb) { const w = lb.dataset.lib; if (w === "close") closeLib(); else if (w === "files") $<HTMLInputElement>("#files")!.click(); else if (w === "add") place(); return; }
  if (t === lib) return closeLib();
  if (t.id === "edit") return setEditing(!state.editing);
  if (t.id === "page-btn") { tab = "page"; return mode ? closePanel() : openPanel("edit"); }
  if (t.id === "tweak") return mode === "customise" ? closePanel() : openPanel("customise");
  if (t.id === "publish") return mode === "publish" ? closePanel() : openPanel("publish");
  if (t.id === "phone-btn") return phonePreview(true);
  if (t.id === "phone-close") return phonePreview(false);
  const pb = t.closest<HTMLElement>("#panel [data-pub]"); if (pb && !(pb as HTMLButtonElement).disabled) { void P.act(pb.dataset.pub!, Number(pb.dataset.n), () => { renderPanel(); afterDraw(); }); return; }
  if (t.id === "undo") return undo();
  if (t.id === "redo") return redo();
  if (openMenu && !t.closest(".arr")) { openMenu = null; toolbars(); }
  const nav = t.closest<HTMLAnchorElement>("#panel .pages a"); if (nav) tab = "page";
}

/** What was typed, with line breaks kept and without the look's text-transform. */
function plain(el: HTMLElement): string {
  let out = "";
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) out += n.nodeValue;
    else if (n.nodeName === "BR") out += "\n";
    else if (n.nodeType === 1) { if (/^(DIV|P)$/.test(n.nodeName) && out && !out.endsWith("\n")) out += "\n"; out += plain(n as HTMLElement); }
  });
  return out;
}
function onWord(e: FocusEvent) {
  const t = e.target as HTMLElement; if (!t.isContentEditable || !t.dataset.ed) return;
  const v = plain(t); if (v === t.dataset.before) return;
  try { commit(O.setField(state.site, t.dataset.ed, v)); } catch (err) { toast((err as Error).message); draw(true); }
}
function onPanelInput(e: Event) {
  const t = e.target as HTMLInputElement;
  if (t.dataset.size) { const n = t.value.trim() === "" ? null : Number(t.value); try { commit(O.setSize(state.site, t.dataset.asset!, t.dataset.size === "w" ? n : null, t.dataset.size === "h" ? n : null)); } catch (err) { toast((err as Error).message); } return; }
  const f = t.dataset.f; if (!f) return;
  try {
    const m = f.match(/^film:(.+)\.link$/);
    commit(m ? O.setFilm(state.site, m[1], { link: t.value.trim() }) : O.setField(state.site, f, t.value));
  } catch (err) { toast((err as Error).message); }
}
function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement;
  if (t.isContentEditable && e.key === "Enter" && !/^(page:[^.]+\.(para\.\d+|credits|facts|text))$/.test(t.dataset.ed ?? "") && !/\.text$/.test(t.dataset.ed ?? "")) { e.preventDefault(); t.blur(); }
  if (e.key === "Escape") { if (!lib.hidden) closeLib(); else if (openMenu) { openMenu = null; toolbars(); } else if (t.isContentEditable) t.blur(); }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !t.isContentEditable && !/^(INPUT|TEXTAREA)$/.test(t.tagName)) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
}

/** The site as it is now, on a phone: the same site in a frame, which follows every save. */
function phonePreview(on: boolean) {
  const box = $("#phone")!, f = box.querySelector("iframe")!;
  $("#phone-btn")!.setAttribute("aria-pressed", String(on));
  if (on) { const q = location.search.replace(/[?&](edit|panel|look|publish|start|house)(=[^&]*)?/g, "").replace(/^&/, "?"); f.src = `/app/index.html${q}${q ? "&" : "?"}preview#/${encodeURIComponent(pageId())}`; box.hidden = false; }
  else { box.hidden = true; f.src = "about:blank"; }
}
let toastT = 0;
function toast(text: string) { const el = $(".toast")!; el.textContent = text; el.hidden = false; clearTimeout(toastT); toastT = window.setTimeout(() => { el.hidden = true; }, 3200); }
