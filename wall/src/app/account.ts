/*
 * The artist's account: the door (an email, and the first time a key; a link arrives; the link signs them in),
 * then what the service keeps for them: the site with its revision, the pictures' bytes, and Publish going live.
 * Everything speaks to /api/* on the same origin (the Worker beside the app). Where there is no service (working
 * locally without it) the app goes on as before, on this device alone; nothing here is needed for that.
 */
export type Me = { signedIn: true; email: string; sites: { id: string; label: string | null; revision: number; updated: string; published: string | null }[]; domain: string } | { signedIn: false; reachable: boolean };
export class StaleOnServer extends Error { constructor(public revision: number, public site: unknown) { super("stale"); this.name = "StaleOnServer"; } }

let cached: Me | null = null;
async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`/api/${path}`, { credentials: "same-origin", ...init });
  const body = (await r.json().catch(() => ({}))) as T & { error?: string; revision?: number; site?: unknown };
  if (r.status === 409 && body.error === "stale") throw new StaleOnServer(body.revision!, body.site);
  if (!r.ok) throw Object.assign(new Error(body.error ?? `The service answered ${r.status}.`), { status: r.status, body });
  return body;
}
const post = (data: unknown, method = "POST") => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(data) }) as RequestInit;
const withBytes = (data: Uint8Array | Blob, type: string) => ({ method: "PUT", headers: { "content-type": type }, body: data instanceof Blob ? data : new Blob([data as BlobPart], { type }) }) as RequestInit;

/** Who is signed in, asked once a session. Unreachable means there is no service here, not that the artist is out. */
export async function me(force = false): Promise<Me> {
  if (cached && !force) return cached;
  try { cached = await call<Me>("me"); } catch (e) { cached = { signedIn: false, reachable: (e as { status?: number }).status !== undefined }; }
  return cached;
}
export const signedIn = () => (cached?.signedIn ? cached : null);
export const signIn = (email: string, key: string) => call<{ sent: boolean; link?: string }>("signin", post({ email, key }));
export async function signOut() { await call("signout", { method: "POST" }); cached = null; }
export const deleteAccount = () => call<{ removed: string[] }>("me", post({ confirm: "DELETE" }, "DELETE"));

export const pull = (id: string) => call<{ site: unknown; revision: number; label: string | null; published: string | null }>(`site/${id}`);
/** Put the site on the server, saying which server revision it grew from; a StaleOnServer answer carries the newer site. */
export const push = (id: string, site: unknown, basedOn: number) => call<{ revision: number }>(`site/${id}`, post({ site, basedOn }, "PUT"));

export const asset = {
  async get(id: string): Promise<{ type: string; data: ArrayBuffer } | null> {
    const r = await fetch(`/api/asset/${encodeURIComponent(id)}`, { credentials: "same-origin" });
    if (r.status === 404) return null; if (!r.ok) throw new Error(`The picture could not be fetched (${r.status}).`);
    return { type: r.headers.get("content-type") ?? "application/octet-stream", data: await r.arrayBuffer() };
  },
  put: (id: string, type: string, data: ArrayBuffer | Uint8Array) => call(`asset/${encodeURIComponent(id)}`, withBytes(data instanceof Uint8Array ? data : new Uint8Array(data), type)),
};

const TYPES: Record<string, string> = { html: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", json: "application/json", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", svg: "image/svg+xml", mp4: "video/mp4", woff2: "font/woff2", txt: "text/plain; charset=utf-8", xml: "application/xml" };
/** Publish: claim the address, send every file (four at a time, each tried thrice), then say which files the site has now. */
export async function publish(id: string, label: string, files: { name: string; data: Uint8Array }[], progress?: (done: number, of: number) => void): Promise<{ address: string; fresh: boolean }> {
  const { fresh } = await call<{ fresh: boolean }>(`publish/${id}/begin`, post({ label }));
  let i = 0, done = 0;
  const one = async (f: { name: string; data: Uint8Array }) => {
    for (let t = 1; ; t++) { try { await call(`publish/${id}/${f.name.split("/").map(encodeURIComponent).join("/")}`, withBytes(f.data, TYPES[f.name.split(".").pop()!.toLowerCase()] ?? "application/octet-stream")); break; } catch (e) { if (t === 3) throw e; await new Promise((ok) => setTimeout(ok, 600 * t)); } }
    progress?.(++done, files.length);
  };
  await Promise.all(Array.from({ length: 4 }, async () => { while (i < files.length) await one(files[i++]); }));
  return { ...(await call<{ address: string }>(`publish/${id}/done`, post({ files: files.map((f) => f.name) }))), fresh };
}

/* ---------------------------------------------------------------- the door */
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** Drawn in place of the app for anyone not signed in. */
export function door(app: HTMLElement) {
  document.documentElement.dataset.view = "gate"; document.title = "Latent Wall · Beta, by invite";
  let email = ""; try { email = localStorage.getItem("wall-email") ?? ""; } catch { /* private window */ }
  app.innerHTML = `<main class="gate"><a class="g-brand" href="/design/home/index.html"><span class="lw">Latent Wall<i>.</i></span></a><span class="label">Beta · by invite</span>
    <h1>Come in with <em>your email.</em></h1>
    <p>A link comes to it; the link brings you to your site. The first time, your key goes here too.</p>
    <form id="g-form"><input type="email" id="g-email" autocomplete="email" required placeholder="Your email" aria-label="Your email" value="${esc(email)}">
      <input type="text" id="g-key" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Your key, the first time" aria-label="Your invite key">
      <button type="submit">Send me the link</button></form>
    <p class="g-no" id="g-no" hidden></p>
    <p class="g-foot">No key? Write to <a href="mailto:hello@latentstudios.art">hello@latentstudios.art</a> and say what you make.</p></main>`;
  const form = app.querySelector<HTMLFormElement>("#g-form")!, em = app.querySelector<HTMLInputElement>("#g-email")!, key = app.querySelector<HTMLInputElement>("#g-key")!, no = app.querySelector<HTMLElement>("#g-no")!, go = form.querySelector("button")!;
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); const address = em.value.trim(); if (!address) return;
    go.disabled = true; go.textContent = "Sending…"; no.hidden = true;
    try {
      const r = await signIn(address, key.value);
      try { localStorage.setItem("wall-email", address); } catch { /* private window */ }
      app.querySelector("main")!.innerHTML = `<a class="g-brand" href="/design/home/index.html"><span class="lw">Latent Wall<i>.</i></span></a><span class="label">Beta · by invite</span>
        <h1>The link is <em>on its way.</em></h1>
        <p>Open the email we sent to <b>${esc(address)}</b> and follow the link. It works once, for twenty minutes; the tab can close.</p>
        ${r.link ? `<p class="g-dev"><a href="${esc(r.link)}">While we work: the link, here.</a></p>` : r.sent ? "" : `<p class="g-no">The mail could not be sent just now; write to <a href="mailto:hello@latentstudios.art">hello@latentstudios.art</a>.</p>`}`;
    } catch (err) {
      const e2 = err as Error & { body?: { needKey?: boolean } };
      no.textContent = e2.message; no.hidden = false; go.disabled = false; go.textContent = "Send me the link";
      if (e2.body?.needKey) key.focus(); else em.select();
    }
  });
  (email ? key : em).focus();
}
