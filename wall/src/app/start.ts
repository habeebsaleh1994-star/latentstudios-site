/*
 * Starting a site. Nothing is made up for the artist: they choose a template (each shown running, with
 * sample work), give their name, and get an empty site in it, About and Contact ready. Then they add their work.
 */
import { HOUSES } from "./houses";
import { blankSite } from "./ops";
import type { Store } from "./store";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function start(store: Store, preset: string | null) {
  const app = document.getElementById("app")!;
  document.documentElement.dataset.view = "start";
  document.title = "Start your site · Latent Wall";
  let chosen = HOUSES.some((h) => h.id === preset) ? preset! : "";
  app.innerHTML = `<main class="start">
    <header class="s-top"><a class="s-brand" href="/design/home/index.html"><span>l.</span> Wall</a></header>
    <section class="s-head"><span class="label">Start your site</span><h1>Choose a <em>template.</em></h1><p>It makes the big decisions, so you are not flooded with them: how your pages are built, how a story moves, the looks and type that suit it. You can change it later; your work is never lost. Each is shown here with sample work.</p></section>
    <ol class="s-grid">${HOUSES.map((h) => `<li><button type="button" class="s-t" data-house="${h.id}" aria-pressed="${chosen === h.id}"><span class="s-live"><iframe data-src="/app/index.html?site=habib&house=${h.id}&preview&space=start-${h.id}" title="${esc(h.name)}, with sample work" tabindex="-1" aria-hidden="true"></iframe></span><span class="s-meta"><b>${esc(h.name)}</b><span class="label">${esc(h.for)}</span><span class="s-idea">${esc(h.idea)}</span></span><span class="s-tick" aria-hidden="true"></span></button></li>`).join("")}</ol>
    <form class="s-you" id="you"><div><span class="label">Then</span><h2>Your <em>name.</em></h2><p>And, if you like, a title for the front page. Everything else is done on the site itself.</p></div>
      <div class="s-fields"><label><span class="label">Your name</span><input id="s-name" type="text" autocomplete="name" required placeholder="As it should appear on the site"></label>
      <label><span class="label">A title, optional</span><input id="s-title" type="text" placeholder="Say, Ordinary things"></label>
      <p class="s-chosen" id="s-chosen">${chosen ? `In <b>${esc(HOUSES.find((h) => h.id === chosen)!.name)}</b>.` : "Choose a template above."}</p>
      <button class="s-go" type="submit"${chosen ? "" : " disabled"}>Make my site</button></div></form>
  </main>`;
  const fit = () => app.querySelectorAll<HTMLElement>(".s-live").forEach((l) => l.style.setProperty("--s", (l.clientWidth / 1440).toFixed(5)));
  fit(); addEventListener("resize", fit);
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; const f = e.target.querySelector<HTMLIFrameElement>("iframe[data-src]"); if (f) { f.src = f.dataset.src!; f.removeAttribute("data-src"); f.addEventListener("load", () => f.classList.add("on"), { once: true }); } io.unobserve(e.target); }), { rootMargin: "300px" });
  app.querySelectorAll(".s-live").forEach((l) => io.observe(l));
  const go = app.querySelector<HTMLButtonElement>(".s-go")!, note = app.querySelector<HTMLElement>("#s-chosen")!;
  app.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>(".s-t"); if (!b) return;
    chosen = b.dataset.house!;
    app.querySelectorAll(".s-t").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    note.innerHTML = `In <b>${esc(HOUSES.find((h) => h.id === chosen)!.name)}</b>.`; go.disabled = false;
    app.querySelector("#you")!.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    app.querySelector<HTMLInputElement>("#s-name")!.focus({ preventScroll: true });
  });
  app.querySelector("#you")!.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!chosen) return;
    const site = blankSite(app.querySelector<HTMLInputElement>("#s-name")!.value, chosen as never, app.querySelector<HTMLInputElement>("#s-title")!.value);
    go.disabled = true; go.textContent = "Making it…";
    const prev = await store.load().catch(() => null);
    await store.save(site, prev?.revision ?? 0);
    location.href = "/app/index.html?edit#/";
  });
  if (chosen) requestAnimationFrame(() => app.querySelector(`.s-t[data-house="${chosen}"]`)?.scrollIntoView({ block: "center" }));
}
