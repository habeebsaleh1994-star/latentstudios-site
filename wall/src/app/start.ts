/*
 * Starting a site. Nothing is made up for the artist: they choose a template (each shown running, with
 * sample work), give their name, and get an empty site in it, About and Contact ready. Then they add their work.
 */
import { HOUSES } from "./houses";
import { blankSite, storyFromWorks } from "./ops";
import { bringIn, dropped, hasFiles, folderOf, isImage } from "./bring";
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
    <ol class="s-grid">${HOUSES.map((h) => `<li><button type="button" class="s-t" data-house="${h.id}" aria-pressed="${chosen === h.id}"><span class="s-live"><iframe data-src="/app/index.html?site=${h.sample}&house=${h.id}&preview&space=start-${h.id}" title="${esc(h.name)}, with sample work" tabindex="-1" aria-hidden="true"></iframe></span><span class="s-meta"><b>${esc(h.name)}</b><span class="label">${esc(h.for)}</span><span class="s-idea">${esc(h.idea)}</span></span><span class="s-tick" aria-hidden="true"></span></button></li>`).join("")}</ol>
    <form class="s-you" id="you"><div><span class="label">Then</span><h2>Your <em>name.</em></h2><p>And, if you like, a title for the front page and a folder of photographs for a first story. Everything else is done on the site itself.</p></div>
      <div class="s-fields"><label><span class="label">Your name</span><input id="s-name" type="text" autocomplete="name" required placeholder="As it should appear on the site"></label>
      <label><span class="label">A title, optional</span><input id="s-title" type="text" placeholder="Say, Ordinary things"></label>
      <div class="s-first" id="s-first"><span class="label">A first story, optional</span><button type="button" class="s-pick" id="s-pick">Choose a folder of photographs</button><span class="s-got" id="s-got">Or drop one here. It becomes your first story, in the order the pictures were taken, with the titles and captions in the files.</span><input type="file" id="s-folder" webkitdirectory multiple hidden></div>
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
  // a first story: a folder chosen or dropped, kept until Make my site
  let first: { files: File[]; folder: string } | null = null;
  const firstBox = app.querySelector<HTMLElement>("#s-first")!, got = app.querySelector<HTMLElement>("#s-got")!, folderInput = app.querySelector<HTMLInputElement>("#s-folder")!;
  const took = (files: File[], folder: string) => {
    const imgs = files.filter(isImage); if (!imgs.length) { got.textContent = "No photographs there. Choose a folder of JPEG, PNG or HEIC files."; return; }
    first = { files: imgs, folder }; firstBox.classList.add("has");
    got.innerHTML = `<b>${imgs.length === 1 ? "One photograph" : `${imgs.length} photographs`}</b>${folder ? ` from “${esc(folder)}”` : ""}, your first story. <button type="button" class="s-unpick" id="s-unpick">Not this one</button>`;
  };
  app.querySelector("#s-pick")!.addEventListener("click", () => folderInput.click());
  folderInput.addEventListener("change", () => { const files = [...(folderInput.files ?? [])]; folderInput.value = ""; took(files, folderOf(files)); });
  firstBox.addEventListener("click", (e) => { if ((e.target as HTMLElement).id === "s-unpick") { first = null; firstBox.classList.remove("has"); got.textContent = "Or drop one here. It becomes your first story, in the order the pictures were taken, with the titles and captions in the files."; } });
  for (const ev of ["dragenter", "dragover"]) firstBox.addEventListener(ev, (e) => { if (!hasFiles(e as DragEvent)) return; e.preventDefault(); firstBox.classList.add("over"); });
  firstBox.addEventListener("dragleave", () => firstBox.classList.remove("over"));
  firstBox.addEventListener("drop", async (e) => { if (!hasFiles(e)) return; e.preventDefault(); firstBox.classList.remove("over"); try { const d = await dropped(e); took(d.files, d.folder); } catch { got.textContent = "That could not be read."; } });
  app.querySelector("#you")!.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!chosen) return;
    let site = blankSite(app.querySelector<HTMLInputElement>("#s-name")!.value, chosen as never, app.querySelector<HTMLInputElement>("#s-title")!.value);
    go.disabled = true; go.textContent = "Making it…";
    let open = "";
    if (first) {
      go.textContent = `Bringing in ${first.files.length === 1 ? "one photograph" : `${first.files.length} photographs`}…`;
      const r = await bringIn(store, site, first.files);
      if (r.ids.length) { const made = storyFromWorks(r.site, first.folder || "First story", r.ids); site = made.site; open = made.id; }
    }
    const prev = await store.load().catch(() => null);
    await store.save(site, prev?.revision ?? 0);
    location.href = `/app/index.html?edit#/${encodeURIComponent(open)}`;
  });
  if (chosen) requestAnimationFrame(() => app.querySelector(`.s-t[data-house="${chosen}"]`)?.scrollIntoView({ block: "center" }));
}
