/*
 * The editor. Two panels, never mixed:
 *   Edit       the site and its content: pages, their order and words, each story's works and arrangement.
 *   Customise  the artistic choices: the look, and under it light, palette, accent, type, mount, spacing, motion, size.
 * On the page itself (in edit mode): words are typed in place, each work has a quiet toolbar, a + sits in each gap.
 * Every action is an operation from ops.ts, committed through main.ts (history, saving, redraw in place).
 */
import * as O from "./ops";
import { state, commit, undo, redo, draw, current, go, pageId } from "./main";
import { esc } from "./render";
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

let panel: HTMLElement, dock: HTMLElement, lib: HTMLElement, mode: "edit" | "customise" | null = null, tab: "site" | "page" = "page";
let openMenu: { k: number; kind: "arrange" | "move" } | null = null, trayOpen: number | null = null;

export function init() {
  document.body.insertAdjacentHTML("beforeend",
    `<div class="dock" id="dock"><span class="meter" id="meter"></span><button type="button" id="undo">Undo</button><button type="button" id="redo">Redo</button><button type="button" id="edit" aria-pressed="false">Edit</button><button type="button" id="page-btn" hidden>Page</button><button type="button" id="tweak" aria-expanded="false">Customise</button></div>` +
    `<aside id="panel" aria-label="Edit the site"></aside>` +
    `<div class="lib" id="lib" role="dialog" aria-modal="true" aria-label="Your work" hidden><div class="sheet2"><header><b>Your work</b><button type="button" class="x" data-lib="close">Close</button></header><div class="grid"></div><footer><span class="note"></span><button type="button" class="go" data-lib="add" disabled>Add</button></footer></div></div>` +
    `<input type="file" id="files" accept="image/*,.heic,.heif" multiple hidden><div class="toast" role="status" aria-live="polite" hidden></div>`);
  panel = $("#panel")!; dock = $("#dock")!; lib = $("#lib")!;
  state.listeners.push(afterDraw);
  document.addEventListener("click", onClick);
  document.addEventListener("focusin", (e) => { const t = e.target as HTMLElement; if (t.isContentEditable) t.dataset.before = plain(t); });
  document.addEventListener("focusout", onWord);
  document.addEventListener("keydown", onKey);
  panel.addEventListener("change", onPanelInput);
  $<HTMLInputElement>("#files")!.addEventListener("change", onFiles);
  document.addEventListener("wall:notify", (e) => toast((e as CustomEvent<string>).detail));
  const q = new URLSearchParams(location.search);
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
function openPanel(m: "edit" | "customise") { mode = m; panel.classList.add("open"); document.documentElement.dataset.panel = m; renderPanel(); }
function closePanel() { mode = null; panel.classList.remove("open"); delete document.documentElement.dataset.panel; }

function afterDraw() {
  if (!dock) return;
  const s = state.site, n = photographCount(s);
  $("#meter")!.innerHTML = state.editing ? `<b>${n}</b> ${n === 1 ? "work" : "works"} <span class="more">· <b>${s.pages.length}</b> pages · Saved on this device</span>` : "";
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
    slot.innerHTML = `<span class="tb" role="toolbar" aria-label="This work">${canArrange ? `<button type="button" data-a="menu-arrange" data-k="${k}">Arrange</button>` : ""}<button type="button" data-a="piece-up" data-k="${k}"${k === 0 ? " disabled" : ""} aria-label="Earlier">&uarr;</button><button type="button" data-a="piece-down" data-k="${k}"${k === last ? " disabled" : ""} aria-label="Later">&darr;</button><button type="button" data-a="menu-move" data-k="${k}">Move to</button><button type="button" data-a="piece-remove" data-k="${k}">Remove</button></span>` +
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
  let h = `<header><b>${mode === "edit" ? "Edit" : "Customise"}</b><button type="button" class="x" data-a="${mode === "edit" ? "done" : "close"}">${mode === "edit" ? "Done" : "Close"}</button></header>`;
  if (mode === "edit") h += `<div class="tabs" role="tablist">${([["page", "This page"], ["site", "The site"]] as const).map(([k, t]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}">${t}</button>`).join("")}</div>`;
  h += `<div class="scroll">${mode === "customise" ? customise() : tab === "site" ? siteTab() : pageTab()}</div><footer><span>Saved on this device</span></footer>`;
  panel.innerHTML = h;
  $(".scroll", panel)!.scrollTop = keep;
}

function siteTab() {
  const s = state.site, has = (k: string) => s.pages.some((p) => p.kind === k), cur = pageId();
  let h = `<h3>Words</h3>${input("site.name", s.name, "Your name")}${input("site.contact", s.contact, "A line at the foot of every page")}`;
  h += `<h3>Pages</h3><ol class="pages"><li class="${cur ? "" : "on"}"><a href="#/">The front page<small>${{ covers: "Covers", list: "A list", sheet: "A sheet", walk: "A walk" }[s.front.form]}</small></a><span class="acts"></span></li>` +
    s.pages.map((p, i) => `<li class="${cur === p.id ? "on" : ""}${p.inNav ? "" : " off"}"><a href="#/${encodeURIComponent(p.id)}">${esc(title(p))}<small>${esc(kindLine(p))}${p.inNav ? "" : " · hidden"}</small></a><span class="acts"><button type="button" data-a="page-up" data-id="${esc(p.id)}"${i === 0 ? " disabled" : ""} aria-label="Move up">&uarr;</button><button type="button" data-a="page-down" data-id="${esc(p.id)}"${i === s.pages.length - 1 ? " disabled" : ""} aria-label="Move down">&darr;</button><button type="button" data-a="page-nav" data-id="${esc(p.id)}" aria-label="${p.inNav ? "Hide" : "Show"} ${esc(title(p))}" title="${p.inNav ? "Shown" : "Hidden"}">${p.inNav ? "&#9679;" : "&#9675;"}</button></span></li>`).join("") + `</ol>`;
  h += `<h3>Add a page</h3><div class="adds">${(["story", "writing", "film", "project"] as const).map((k) => `<button type="button" data-a="page-add" data-kind="${k}">+ ${O.KIND_NAMES[k]}</button>`).join("")}${has("about") ? "" : '<button type="button" data-a="page-add" data-kind="about">+ About</button>'}${has("contact") ? "" : '<button type="button" data-a="page-add" data-kind="contact">+ Contact</button>'}</div>`;
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
  if (p.kind !== "about" && p.kind !== "contact") h += input(f("titleEm"), p.titleEm, "Its italic part");
  if (p.kind === "story") {
    h += input(f("kicker"), p.kicker, "Above the title: a season, a place") + area(f("note"), p.note, "A line or two to introduce it");
    const arr = house(s.house).arrangements, names: Record<string, string> = { held: "Held", book: "Book", passage: "Passage", contact: "Contact", wall: "Wall", slides: "Slides" };
    h += `<h3>Arrangement</h3>${arr.length > 1 ? seg("arrangement", arr.map((a) => [a, names[a]] as [string, string]), p.arrangement) : `<p class="fixed">${names[p.arrangement]}</p>`}<p class="hint">${{ held: "One work at a time, held large and still, down the page.", book: "Spreads, turned two pages at a time, like a photobook.", passage: "A walk along one wall, sideways, every work on the same line.", contact: "The whole story at a glance; choose one to hold it large.", wall: "Works hung together at their true size relative to one another.", slides: "One at a time, centred, with a strip of the others beneath." }[p.arrangement]}</p>`;
    h += `<h3>Works</h3><p class="hint">How each work sits is yours to choose: press the line under its title. Each arrangement offers only what it can show${p.arrangement === "contact" ? "; a contact sheet gives every frame an equal cell, so here there is only the order" : ""}.</p><ol class="tray">${p.pieces.map((x, k) => {
      if (x.type === "pause") return `<li class="pause"><span class="th ps">&para;</span><span class="t">${esc(x.text || "A pause")}<small>A pause</small></span>${acts(k, p.pieces.length)}</li>`;
      const w = s.library[x.asset], opts = O.arrangeOptions(s, p.id, k), cur = opts.find((o) => o.current), tag = cur ? cur.title.toLowerCase() : "in the sheet";
      const note = x.arrange === "margin-note" && opts.some((o) => o.key === "margin-note") ? `<div class="menu wide">${input(`piece:${p.id}:${k}.note`, x.note, "The note beside it")}</div>` : "";
      return `<li>${thumb(x.asset)}<span class="t">${esc(w?.title || "Untitled")}${opts.length ? `<button type="button" class="how" data-a="tray" data-k="${k}" aria-expanded="${trayOpen === k}" title="Change how it sits">${esc(tag)} &rsaquo;</button>` : `<small>${esc(tag)}</small>`}</span>${acts(k, p.pieces.length)}${note}${trayOpen === k ? `<div class="menu">${opts.map((o) => `<button type="button" data-a="arrange" data-k="${k}" data-key="${o.key}" aria-pressed="${o.current}">${o.title}</button>`).join("")}</div><div class="menu"><span class="h">Move to</span>${s.pages.filter((y) => y.kind === "story" && y.id !== p.id).map((y) => `<button type="button" data-a="move-to" data-k="${k}" data-to="${esc(y.id)}">${esc(title(y))}</button>`).join("")}<button type="button" data-a="move-to" data-k="${k}" data-to="new">A new story</button></div><div class="menu"><button type="button" data-a="pause-after" data-k="${k}">A pause after it</button></div>` : ""}</li>`;
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
  if (p.kind === "about" || p.kind === "contact") {
    h += `<h3>Text</h3>${p.paras.map((t, i) => `<div class="para">${area(`${f("para")}.${i}`, t, "A paragraph", 4)}${p.paras.length > 1 ? `<button type="button" class="rm" data-a="para-remove" data-i="${i}" aria-label="Remove this paragraph">&times;</button>` : ""}</div>`).join("")}<div class="adds"><button type="button" data-a="para-add">+ A paragraph</button></div>`;
    if (p.kind === "about") h += `<h3>Principles</h3>${p.principles.map((t, i) => `<div class="para">${input(`${f("principle")}.${i}`, t, "A principle")}<button type="button" class="rm" data-a="prin-remove" data-i="${i}" aria-label="Remove">&times;</button></div>`).join("")}<div class="adds"><button type="button" data-a="prin-add">+ A principle</button></div><p class="hint">Principles are set large and numbered under the text. Leave them out if you have none.</p>`;
  }
  h += `<h3>Address</h3><p class="hint">Shown at <b>/${esc(p.id)}</b>.${p.inNav ? "" : " Hidden from the site; only its address reaches it."}</p><div class="adds"><button type="button" data-a="page-nav" data-id="${esc(p.id)}">${p.inNav ? "Hide this page" : "Show this page"}</button><button type="button" data-a="page-rename">Address from the title</button><button type="button" class="danger" data-a="page-remove" data-id="${esc(p.id)}">Remove this page</button></div>`;
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
  h2 += `<h3>Accent</h3><div class="swatches">${[null, ...L.ACCENTS].map((a) => { const shown = L.accentFor(t.look, a, dark, t.palette).peony; const on = a === null ? !t.accent : t.accent?.toLowerCase() === a.toLowerCase(); return `<button type="button" class="sw${a === null ? " own" : ""}" data-accent="${a ?? ""}" aria-pressed="${on}" aria-label="${a === null ? "The look's own accent" : `Accent ${a}`}"><i style="background:${shown}"></i></button>`; }).join("")}</div>`;
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

/* ------------------------------------------------------------------ the library */

type Target = { kind: "story"; page: string; after: number } | { kind: "list"; page: string; list: "stills" | "outcome" | "process" } | { kind: "poster"; page: string } | { kind: "writing"; page: string };
let target: Target | null = null, chosen: string[] = [];
const single = () => target?.kind === "poster" || target?.kind === "writing";
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
  let s = state.site; const errors: string[] = [];
  for (const f of files) {
    try { const r = await state.store.putImage(f); s = O.addToLibrary(s, r.id, r); chosen.push(r.id); if (single()) chosen = [r.id]; }
    catch (err) { errors.push((err as Error).message); }
  }
  await state.store.prepare(Object.keys(s.library));
  commit(s, { keep: true });
  renderLib(errors.length ? errors.join(" ") : "Added to your work, and chosen. Press Add to place them.");
}
function place() {
  if (!target || !chosen.length) return;
  const t = target, s = state.site; closeLib();
  if (t.kind === "story") commit(O.addWorks(s, t.page, t.after, chosen));
  else if (t.kind === "list") commit(O.addToList(s, t.page, t.list, chosen));
  else if (t.kind === "poster") commit(O.setFilm(s, t.page, { poster: chosen[0] }));
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
      case "page-remove": { const pg = s.pages.find((x) => x.id === id); if (!pg || !confirm(`Remove “${title(pg)}”? Undo brings it back.`)) return; commit(O.removePage(s, id)); go(""); return toast("Page removed. Undo brings it back."); }
      case "page-rename": { if (!p) return; const r = O.renamePage(s, p.id, title(p)); if (r.id === p.id) return toast("The address already follows the title."); commit(r.site); go(r.id); return; }
      case "lib-remove": return commit(O.removeFromLibrary(s, d.asset!));
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
      case "para-add": return commit(O.addPara(s, id));
      case "para-remove": return commit(O.removePara(s, id, Number(d.i)));
      case "prin-add": return commit(O.addPara(s, id, "principles"));
      case "prin-remove": return commit(O.removePara(s, id, Number(d.i), "principles"));
    }
  });
}

function onSet(key: string, v: string) {
  const s = state.site, p = current();
  try {
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
  const t = e.target as HTMLInputElement; const f = t.dataset.f; if (!f) return;
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

let toastT = 0;
function toast(text: string) { const el = $(".toast")!; el.textContent = text; el.hidden = false; clearTimeout(toastT); toastT = window.setTimeout(() => { el.hidden = true; }, 3200); }
