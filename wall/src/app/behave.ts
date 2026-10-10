/*
 * What each view does once it is on the page: a book turns, a passage walks, a contact sheet holds
 * one work large, slides advance, a wall is scaled to the screen, a film plays where it stands.
 *
 * Every view keeps its place across redraws (an edit must never throw the artist back to the start),
 * and keys never act while the artist is typing.
 */
import type { SitePage, StoryPage } from "../studio/site";
import { bookLeaves, slideList, groups, work, listShow, workPages, type Ctx, type View, manuscriptLeaves, leafHref, endLeaf, type W } from "./render";

type Viewer = { open: (items: { src: string; alt: string; title: string; meta: string; cm?: { w: number; h: number } | null }[], at: number) => void; isOpen: () => boolean };
const viewer = () => (window as unknown as { LatentViewer?: Viewer }).LatentViewer;
const typing = (e: Event) => { const t = e.target as HTMLElement; return t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName); };

/** Where each view was, by page, so a redraw lands in the same place. */
const place: Record<string, number> = {};
let cleanup: (() => void)[] = [];
const on = <K extends keyof WindowEventMap>(t: Window | Document | HTMLElement, ev: K | string, fn: (e: never) => void, opt?: AddEventListenerOptions) => {
  t.addEventListener(ev, fn as EventListener, opt); cleanup.push(() => t.removeEventListener(ev, fn as EventListener, opt));
};
const phone = () => matchMedia("(max-width: 700px)").matches;

export function wire(root: HTMLElement, c: Ctx, p: SitePage | null, view: View, keep: boolean) {
  cleanup.forEach((f) => f()); cleanup = [];
  // the header's height, for the views that fill the rest of the screen
  const bar = document.querySelector<HTMLElement>(".bar"), setBar = () => document.documentElement.style.setProperty("--bar-h", `${bar?.offsetHeight ?? 0}px`); setBar(); on(window, "resize", setBar);
  // the editor asks for a work to be brought into view after changing how it sits
  on(root, "wall:show", (e: Event) => {
    const k = (e as CustomEvent<{ k: number }>).detail.k, has = (html: string) => html.includes(`data-k="${k}"`);
    if (view === "book") { const i = bookState?.leaves.findIndex(has) ?? -1; if (i >= 0) bookState?.go(i); return; }
    if (view === "slides" || view === "leaves") { const i = slideState?.list.findIndex(has) ?? -1; if (i >= 0) slideState?.go(i); return; }
    const el = (k < 0 ? root.querySelector<HTMLElement>(".walk .hang") : root.querySelector<HTMLElement>(`[data-k="${k}"]`)?.closest<HTMLElement>("figure, .hang, .art, .pin")) ?? null;
    if (!el) return;
    if (view === "passage") { const walk = root.querySelector<HTMLElement>(".walk"); if (walk) walk.scrollTo({ left: el.offsetLeft - walk.clientWidth / 2 + el.offsetWidth / 2, behavior: "smooth" }); return; }
    el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
  // the door: giving the word
  const door = root.querySelector<HTMLFormElement>("[data-door]");
  if (door) on(door, "submit", async (e: Event) => {
    e.preventDefault(); const input = door.querySelector<HTMLInputElement>("input")!, wrong = door.querySelector<HTMLElement>(".wrong")!;
    door.classList.add("trying"); const ok = await c.open?.(input.value, p); door.classList.remove("trying");
    if (!ok) { wrong.hidden = false; input.select(); }
  });
  // turning a work over, wherever it is framed
  on(root, "click", (e: MouseEvent) => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-turn]"); if (!b) return; e.preventDefault(); e.stopPropagation(); const f = b.closest<HTMLElement>(".frame"); if (f) { f.classList.toggle("turned"); b.setAttribute("aria-pressed", String(f.classList.contains("turned"))); } }, { capture: true });
  document.documentElement.dataset.view = view;
  document.documentElement.toggleAttribute("data-lock", view === "book" || view === "passage");
  const key = `${p?.id ?? ""}:${view}`;
  if (!keep) delete place[key];
  if (view === "front") front(root, c);
  if (!p && view === "passage") return passage(root, key);
  if (p) encounter(root, c, p);
  if (!p || p.kind !== "story") { if (p?.kind === "film") filmBits(root, c, p); if (p?.kind === "project") compare(root); if (p && root.querySelector("[data-leaf-page]")) leafPage(root, c, p); return; }
  if (view === "book") book(root, c, p, key);
  else if (view === "passage") passage(root, key);
  else if (view === "contact") contactSheet(root, c, p);
  else if (view === "wall") wall(root, c, p);
  else if (view === "slides") slides(root, c, p, key);
  else if (view === "leaves") leavesReader(root, c, p, key);
}

function front(root: HTMLElement, c: Ctx) {
  // the archive: sift by kind
  const sift = root.querySelector<HTMLElement>(".f-archive");
  if (sift) on(sift, "click", (e: MouseEvent) => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-kind]"); if (!b || b.tagName !== "BUTTON") return; const k = b.dataset.kind!; sift.querySelectorAll("button[data-kind]").forEach((x) => x.classList.toggle("on", x === b)); sift.querySelectorAll<HTMLElement>("li[data-kind]").forEach((li) => { li.hidden = !!k && li.dataset.kind !== k; }); });
  const show = root.querySelector<HTMLElement>(".f-show"); if (!show) return;
  const list = workPages(c.site).filter((p) => p.inNav || c.editing);
  root.querySelectorAll<HTMLAnchorElement>(".f-list a[data-i]").forEach((a) => {
    const pick = () => { show.innerHTML = listShow(c, list[+a.dataset.i!]); };
    on(a, "mouseenter", pick); on(a, "focus", pick);
  });
}

/** The encounter: on any page, a press on a picture of the work opens it whole on the screen, with the page's other works a key or a swipe away. One viewer, everywhere. */
function encounter(root: HTMLElement, c: Ctx, p: SitePage) {
  const list = (): { src: string; alt: string; title: string; meta: string; cm: { w: number; h: number } | null }[] => {
    const one = (w: W, meta: string) => ({ src: w.src, alt: w.alt, title: w.title, meta, cm: w.size });
    if (p.kind === "story") return groups(c, p).works.map((w) => one(w, [w.caption, w.date].filter(Boolean).join(" · ")));
    if (p.kind === "project") return [...p.outcome, ...p.process].filter((a) => c.site.library[a]).map((a) => { const w = work(c, a); return one(w, [w.caption, w.date].filter(Boolean).join(" · ")); });
    if (p.kind === "film") return [...(p.poster && c.site.library[p.poster] ? [{ asset: p.poster, caption: "Poster" }] : []), ...p.stills].filter((x) => c.site.library[x.asset]).map((x) => { const w = work(c, x.asset); return one(w, x.caption || w.date); });
    if (p.kind === "writing" && p.image && c.site.library[p.image.asset]) { const w = work(c, p.image.asset); return [one(w, w.date)]; }
    return [];
  };
  on(root, "click", (e: MouseEvent) => {
    if (c.editing) return;
    const im = (e.target as HTMLElement).closest("main img") as HTMLImageElement | null; if (!im || im.closest("a, button, .logo, .cover")) return;
    const items = list(), src = im.getAttribute("src"), i = items.findIndex((x) => x.src === src); if (i < 0) return;
    e.preventDefault(); viewer()?.open(items, i);
  });
}

let bookState: { leaves: string[]; go: (i: number) => void } | null = null, slideState: { list: string[]; go: (i: number) => void } | null = null;
function book(root: HTMLElement, c: Ctx, p: StoryPage, key: string) {
  const el = root.querySelector<HTMLElement>("#spread")!, count = root.querySelector<HTMLElement>(".count")!;
  const prev = root.querySelector<HTMLButtonElement>(".turn .prev")!, nextB = root.querySelector<HTMLButtonElement>(".turn .next")!;
  let leaves = bookLeaves(c, p, phone()), at = Math.min(place[key] ?? Math.max(0, (+(new URLSearchParams(location.hash.split("?")[1] ?? "").get("s") ?? 1)) - 1), leaves.length - 1);
  const put = () => {
    el.innerHTML = leaves[at] + (c.editing ? "" : '<button type="button" class="zone prev" tabindex="-1" aria-hidden="true"></button><button type="button" class="zone next" tabindex="-1" aria-hidden="true"></button>');
    count.textContent = `${at + 1} / ${leaves.length}`; prev.disabled = at === 0; nextB.disabled = at === leaves.length - 1; el.classList.remove("turning"); place[key] = at;
    root.dispatchEvent(new CustomEvent("wall:drawn", { bubbles: true }));
  };
  const go = (d: number) => { const to = at + d; if (to < 0 || to >= leaves.length) return; at = to; el.classList.add("turning"); setTimeout(put, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280); };
  put(); bookState = { get leaves() { return leaves; }, go: (i) => go(i - at) }; cleanup.push(() => { bookState = null; });
  on(root, "click", (e: MouseEvent) => { const t = e.target as HTMLElement; if (t.closest(".zone.next, .turn .next")) go(1); else if (t.closest(".zone.prev, .turn .prev")) go(-1); });
  on(document, "keydown", (e: KeyboardEvent) => { if (typing(e)) return; if (e.key === "ArrowRight" || e.key === "PageDown") { go(1); e.preventDefault(); } if (e.key === "ArrowLeft" || e.key === "PageUp") { go(-1); e.preventDefault(); } });
  let x0: number | null = null;
  on(el, "touchstart", (e: TouchEvent) => { x0 = c.editing ? null : e.touches[0].clientX; }, { passive: true });
  on(el, "touchend", (e: TouchEvent) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); });
  const mq = matchMedia("(max-width: 700px)"), re = () => { leaves = bookLeaves(c, p, phone()); at = Math.min(at, leaves.length - 1); put(); };
  mq.addEventListener("change", re); cleanup.push(() => mq.removeEventListener("change", re));
}

function passage(root: HTMLElement, key: string) {
  const walk = root.querySelector<HTMLElement>(".walk")!, bar = root.querySelector<HTMLElement>(".rail .line i")!, at = root.querySelector<HTMLElement>(".rail .at")!;
  const figs = [...walk.querySelectorAll<HTMLElement>(".hang, .door")];
  const centre = (f: HTMLElement) => f.offsetLeft + f.offsetWidth / 2 - walk.clientWidth / 2;
  const nearest = () => { let b = 0, d = Infinity; figs.forEach((f, i) => { const x = Math.abs(centre(f) - walk.scrollLeft); if (x < d) { d = x; b = i; } }); return b; };
  const update = () => {
    const max = walk.scrollWidth - walk.clientWidth, w = (walk.clientWidth / walk.scrollWidth) * 100;
    bar.style.width = `${w}%`; bar.style.left = `${(max ? walk.scrollLeft / max : 0) * (100 - w)}%`;
    at.textContent = !figs.length ? "" : figs[0].offsetLeft - walk.scrollLeft > walk.clientWidth * 0.7 ? `${figs.length} works` : `${figs[nearest()].dataset.n} / ${figs.length}`;
    place[key] = walk.scrollLeft;
  };
  if (place[key]) walk.scrollLeft = place[key];
  else { const m = /[?&]w=(\d+)/.exec(location.hash); if (m && figs[+m[1] - 1]) walk.scrollLeft = figs[+m[1] - 1].offsetLeft - walk.clientWidth * 0.09; }
  on(walk, "scroll", update, { passive: true }); on(window, "resize", update);
  on(walk, "wheel", (e: WheelEvent) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const max = walk.scrollWidth - walk.clientWidth;
    if ((e.deltaY < 0 && walk.scrollLeft <= 0) || (e.deltaY > 0 && walk.scrollLeft >= max - 1)) return;
    walk.scrollLeft += e.deltaY; e.preventDefault();
  }, { passive: false });
  on(document, "keydown", (e: KeyboardEvent) => {
    if (typing(e) || !figs.length) return;
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (!d) return;
    const n = nearest(), here = Math.abs(centre(figs[n]) - walk.scrollLeft) < 4, to = here ? n + d : (centre(figs[n]) > walk.scrollLeft) === d > 0 ? n : n + d;
    walk.scrollTo({ left: to < 0 ? 0 : to >= figs.length ? walk.scrollWidth : centre(figs[to]), behavior: "smooth" }); e.preventDefault();
  });
  update();
}

function contactSheet(root: HTMLElement, c: Ctx, p: StoryPage) {
  const { groups: G } = groups(c, p), held = root.querySelector<HTMLElement>(".held")!, mid = held.querySelector<HTMLElement>(".mid")!, strip = held.querySelector<HTMLElement>(".strip")!, where = held.querySelector<HTMLElement>(".where")!;
  const shownG = G;
  let at = 0, opener: HTMLElement | null = null;
  const put = () => {
    const g = shownG[at];
    mid.className = `mid ${g.type === "pair" ? "two" : "one"}`;
    mid.innerHTML = '<button type="button" class="zone prev" tabindex="-1" aria-label="Previous"></button><button type="button" class="zone next" tabindex="-1" aria-label="Next"></button>' +
      (g.type === "pause" ? `<p class="say"><span class="label">${esc(g.label)}</span>${esc(g.text)}</p>` : g.works.map((w) => `<figure style="--r:${w.r.toFixed(4)}"><img src="${esc(w.src)}" alt="${esc(w.alt)}"><figcaption><p class="cap"><span class="n">${w.n}</span><span>${esc(w.title)}</span><span class="d">${esc(w.date)}</span></p>${g.type === "note" ? `<p class="aside">${esc(g.note)}</p>` : ""}</figcaption></figure>`).join(""));
    const ns = g.works.map((w) => w.n);
    strip.querySelectorAll<HTMLElement>("button").forEach((b) => b.classList.toggle("on", ns.includes(b.dataset.hold!)));
    where.textContent = ns.length ? `${ns.join(" – ")} / ${groups(c, p).works.length}` : "";
  };
  const groupOf = (n: string) => Math.max(0, shownG.findIndex((g) => g.works.some((w) => w.n === n)));
  const open = (n: string) => { opener = document.activeElement as HTMLElement; at = groupOf(n); put(); held.hidden = false; requestAnimationFrame(() => held.classList.add("on")); document.documentElement.setAttribute("data-lock", ""); held.querySelector<HTMLElement>(".back")!.focus({ preventScroll: true }); };
  const close = () => { held.classList.remove("on"); held.hidden = true; document.documentElement.removeAttribute("data-lock"); opener?.focus({ preventScroll: true }); };
  const go = (d: number) => { at = (at + d + shownG.length) % shownG.length; put(); };
  on(root, "click", (e: MouseEvent) => {
    const t = e.target as HTMLElement, h = t.closest<HTMLElement>("[data-hold]");
    if (h && !t.closest(".strip")) return open(h.dataset.hold!);
    if (h) { at = groupOf(h.dataset.hold!); return put(); }
    if (t.closest(".held .back")) return close();
    const z = t.closest(".mid .zone"); if (z) go(z.classList.contains("next") ? 1 : -1);
  });
  on(document, "keydown", (e: KeyboardEvent) => { if (held.hidden || typing(e)) return; if (e.key === "Escape") close(); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); });
  const m = /[?&]open=(\d+)/.exec(location.hash); if (m) open(String(m[1]).padStart(2, "0"));
}

function wall(root: HTMLElement, c: Ctx, p: StoryPage) {
  const s = root.querySelector<HTMLElement>(".salon")!;
  /* pixels per centimetre: the widest wall fills the width, and no work stands taller than the screen allows (the wall's own padding is in pixels) */
  const fit = () => {
    const widest = +s.style.getPropertyValue("--widest") || 1, tallest = +s.style.getPropertyValue("--tallest") || 1;
    const cs = getComputedStyle(s), inner = s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const cap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--wall-cap")) || 0.7;
    const byWidth = (inner - 96) / widest, byHeight = (innerHeight * cap - 112) / tallest;
    s.style.setProperty("--k", Math.min(byWidth, byHeight).toFixed(4));
  };
  fit(); on(window, "resize", fit);
  const ws = groups(c, p).works;
  on(root, "click", (e: MouseEvent) => {
    if (c.editing) return;
    const f = (e.target as HTMLElement).closest<HTMLElement>(".art"); if (!f) return;
    viewer()?.open(ws.map((w) => ({ src: w.src, alt: w.alt, title: w.title, meta: [w.caption, w.date].filter(Boolean).join(" · "), cm: w.size })), +f.dataset.view!);
  });
}

function slides(root: HTMLElement, c: Ctx, p: StoryPage, key: string) {
  const stage = root.querySelector<HTMLElement>(".stage")!, th = root.querySelector<HTMLElement>(".thumbs")!;
  const { list, thumbs } = slideList(c, p);
  let at = Math.min(place[key] ?? 0, list.length - 1);
  const put = () => {
    stage.innerHTML = list[at].replace('class="slide', 'class="slide fade') + `<button type="button" class="arrow prev" aria-label="Previous slide"${at === 0 ? " disabled" : ""}>&lsaquo;</button><button type="button" class="arrow next" aria-label="Next slide"${at === list.length - 1 ? " disabled" : ""}>&rsaquo;</button>`;
    th.innerHTML = thumbs.map((t, i) => `<button type="button" data-go="${i}" aria-current="${i === at}" aria-label="Slide ${i + 1}">${t}</button>`).join("");
    const cur = th.querySelector<HTMLElement>('[aria-current="true"]'); if (cur && th.scrollWidth > th.clientWidth) th.scrollLeft = cur.offsetLeft - th.clientWidth / 2 + cur.offsetWidth / 2;
    place[key] = at; root.dispatchEvent(new CustomEvent("wall:drawn", { bubbles: true }));
  };
  const go = (i: number) => { i = Math.max(0, Math.min(list.length - 1, i)); if (i !== at) { at = i; put(); } };
  put(); slideState = { list, go }; cleanup.push(() => { slideState = null; });
  on(root, "click", (e: MouseEvent) => { const t = e.target as HTMLElement; if (t.closest(".arrow.prev")) go(at - 1); else if (t.closest(".arrow.next")) go(at + 1); else { const g = t.closest<HTMLElement>("[data-go]"); if (g) go(+g.dataset.go!); } });
  on(document, "keydown", (e: KeyboardEvent) => { if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return; if (e.key === "ArrowRight") { e.preventDefault(); go(at + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(at - 1); } });
  let x0: number | null = null;
  on(stage, "touchstart", (e: TouchEvent) => { x0 = c.editing ? null : e.touches[0].clientX; }, { passive: true });
  on(stage, "touchend", (e: TouchEvent) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 48) go(at + (dx < 0 ? 1 : -1)); });
}

/** A writing or a film as one leaf of a Manuscript: counted in the running head, turned into the pages before and after. */
function leafPage(root: HTMLElement, c: Ctx, p: SitePage) {
  const at$ = root.querySelector<HTMLElement>(".runhead .at")!, back = root.querySelector<HTMLAnchorElement>(".turns .back")!, fwd = root.querySelector<HTMLAnchorElement>(".turns .fwd")!;
  const book = manuscriptLeaves(c), me = book.findIndex((b) => b.page.id === p.id), before = book.slice(0, Math.max(0, me)).reduce((n, b) => n + b.n, 0), total = book.reduce((n, b) => n + b.n, 0);
  const prevPage = me > 0 ? book[me - 1].page : null, nextPage = me >= 0 && me < book.length - 1 ? book[me + 1].page : null;
  at$.textContent = total ? `${before + 1} / ${total}` : "";
  back.hidden = !prevPage; fwd.hidden = !nextPage;
  back.href = prevPage ? leafHref(c, prevPage.id, 0).replace(/l=0$/, "l=end") : "#"; fwd.href = nextPage ? leafHref(c, nextPage.id, 0) : "#";
  on(document, "keydown", (e: KeyboardEvent) => { if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return; if (e.key === "ArrowRight" && nextPage) { e.preventDefault(); location.href = fwd.href; } else if (e.key === "ArrowLeft" && prevPage) { e.preventDefault(); location.href = back.href; } });
}

/** The reader of a Manuscript: one leaf at a time, the keys and a swipe to turn, the running head counting through the whole book, the turns at either end carrying into the pages before and after. */
function leavesReader(root: HTMLElement, c: Ctx, p: StoryPage, key: string) {
  const stage = root.querySelector<HTMLElement>(".stage")!, at$ = root.querySelector<HTMLElement>(".runhead .at")!, back = root.querySelector<HTMLAnchorElement>(".turns .back")!, fwd = root.querySelector<HTMLAnchorElement>(".turns .fwd")!;
  const { list } = slideList(c, p), book = manuscriptLeaves(c), me = book.findIndex((b) => b.page.id === p.id), before = book.slice(0, Math.max(0, me)).reduce((n, b) => n + b.n, 0);
  // the book's last leaf, after the last page
  const last = me === book.length - 1; if (last && (c.site.front.end || c.editing)) list.push(endLeaf(c));
  const total = book.reduce((n, b) => n + b.n, 0) + (last && (c.site.front.end || c.editing) ? 1 : 0);
  const where = location.hash + location.search, asked = /[?#]l=(\d+)/.exec(where), fromEnd = /[?#]l=end/.test(where);
  let at = Math.max(0, Math.min(list.length - 1, fromEnd ? list.length - 1 : asked ? +asked[1] : place[key] ?? 0));
  const prevPage = me > 0 ? book[me - 1].page : null, nextPage = me >= 0 && me < book.length - 1 ? book[me + 1].page : null;
  const put = () => {
    stage.innerHTML = list[at].replace('class="slide', 'class="leaf fade');
    at$.textContent = total ? `${before + at + 1} / ${total}` : "";
    back.hidden = at === 0 && !prevPage; fwd.hidden = at === list.length - 1 && !nextPage;
    back.href = at > 0 ? leafHref(c, p.id, at - 1) : prevPage ? leafHref(c, prevPage.id, 0).replace(/l=0$/, "l=end") : "#";
    fwd.href = at < list.length - 1 ? leafHref(c, p.id, at + 1) : nextPage ? leafHref(c, nextPage.id, 0) : "#";
    place[key] = at;
    // the address names the leaf, quietly, so a link to it lands here
    try { const h = leafHref(c, p.id, at), i = h.indexOf("#"); if (i >= 0) history.replaceState(null, "", location.href.replace(/#.*$/, "") + h.slice(i)); } catch { /* a file opened by hand */ }
    root.dispatchEvent(new CustomEvent("wall:drawn", { bubbles: true }));
  };
  const go = (i: number) => { if (i < 0) { if (prevPage) location.href = back.href; return; } if (i > list.length - 1) { if (nextPage) location.href = fwd.href; return; } if (i !== at) { at = i; put(); } };
  put(); slideState = { list, go }; cleanup.push(() => { slideState = null; });
  // a link to another leaf of this page (the contents, a shared address) turns to it without leaving
  on(window, "hashchange", () => { const m = /[?#]l=(\d+|end)/.exec(location.hash + location.search); if (m) go(m[1] === "end" ? list.length - 1 : +m[1]); });
  on(root, "click", (e: MouseEvent) => { const t = e.target as HTMLElement; if (t.closest(".turns .back") && at > 0) { e.preventDefault(); go(at - 1); } else if (t.closest(".turns .fwd") && at < list.length - 1) { e.preventDefault(); go(at + 1); } });
  on(document, "keydown", (e: KeyboardEvent) => { if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return; if (e.key === "ArrowRight") { e.preventDefault(); go(at + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(at - 1); } });
  let x0: number | null = null;
  on(stage, "touchstart", (e: TouchEvent) => { x0 = c.editing ? null : e.touches[0].clientX; }, { passive: true });
  on(stage, "touchend", (e: TouchEvent) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 48) go(at + (dx < 0 ? 1 : -1)); });
}

function filmBits(root: HTMLElement, c: Ctx, p: Extract<SitePage, { kind: "film" }>) {
  on(root, "click", (e: MouseEvent) => {
    const t = e.target as HTMLElement, play = t.closest<HTMLElement>("[data-play]");
    if (play) {
      const box = play.closest<HTMLElement>(".screen")!, poster = box.querySelector("img")?.getAttribute("src");
      box.innerHTML = `<video src="${esc(play.dataset.play!)}" controls autoplay playsinline${poster ? ` poster="${esc(poster)}"` : ""}></video>`;
      box.querySelector("video")!.play().catch(() => {});
      return;
    }
    const s = t.closest<HTMLElement>("[data-still]"); if (!s || c.editing) return;
    const stills = p.stills.filter((x) => c.site.library[x.asset]);
    viewer()?.open(stills.map((x) => { const w = work(c, x.asset); return { src: w.src, alt: w.alt, title: x.caption || p.title, meta: p.title }; }), +s.dataset.still!);
  });
}

function compare(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(".compare").forEach((box) => {
    const r = box.querySelector<HTMLInputElement>("input")!;
    const set = () => box.style.setProperty("--cut", `${r.value}%`);
    on(r, "input", set); set();
  });
}

const ENT: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
function esc(s: unknown) { return String(s ?? "").replace(/[&<>"]/g, (ch) => ENT[ch]); }
