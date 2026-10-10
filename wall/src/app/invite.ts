/*
 * The door of the beta: Wall is by invite. A key is a short phrase given by hand; the app keeps only the
 * hashes of the keys that are valid (app/keys.json, written by scripts/invite.mjs), so a key can be revoked
 * by removing its line. Once a key is accepted it is kept in this browser and checked again on every visit.
 * Visitors to published sites and the previews on the arrival page never meet the door. While we work
 * (localhost) the door opens only when the address asks for it (?gate), so the sweeps run as before.
 */
const KEPT = "wall-invite";

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s.trim().toLowerCase()));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function valid(): Promise<Set<string>> {
  try { const r = await fetch("/app/keys.json", { cache: "no-cache" }); const j = (await r.json()) as { keys: { hash: string }[] }; return new Set(j.keys.map((k) => k.hash)); } catch { return new Set(); }
}
/** Whether this browser holds an invite that is still good. */
export async function invited(params: URLSearchParams): Promise<boolean> {
  const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (local && !params.has("gate")) return true;
  const key = localStorage.getItem(KEPT); if (!key) return false;
  return (await valid()).has(await sha256(key));
}
/** The door itself, drawn in place of the app. */
export function gate(app: HTMLElement) {
  document.documentElement.dataset.view = "gate"; document.title = "Latent Wall · Beta, by invite";
  app.innerHTML = `<main class="gate"><a class="g-brand" href="/design/home/index.html"><span class="lw">Latent Wall<i>.</i></span></a><span class="label">Beta · by invite</span>
    <h1>Come in with <em>your key.</em></h1>
    <p>Latent Wall is being tried by a few artists before it opens. If you were given a key, it goes here.</p>
    <form id="g-form"><input type="text" id="g-key" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Your key" aria-label="Your invite key"><button type="submit">Enter</button></form>
    <p class="g-no" id="g-no" hidden>That key is not one we know. Keys are short phrases like <i>silk-peony-1234</i>; check for a missed letter, or write to the address that sent it.</p>
    <p class="g-foot">No key? Write to <a href="mailto:hello@latentstudios.art">hello@latentstudios.art</a> and say what you make.</p></main>`;
  const form = app.querySelector<HTMLFormElement>("#g-form")!, input = app.querySelector<HTMLInputElement>("#g-key")!, no = app.querySelector<HTMLElement>("#g-no")!;
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); const key = input.value.trim(); if (!key) return;
    if ((await valid()).has(await sha256(key))) { localStorage.setItem(KEPT, key); const u = new URL(location.href); u.searchParams.delete("gate"); location.replace(u.href); }
    else { no.hidden = false; input.select(); }
  });
  input.focus();
}
