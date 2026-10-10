/*
 * The account panel: who is signed in, and the two things a person may do with their account at any time,
 * published or not: sign out of this browser, or delete the account and everything in it.
 */
import { state, notify } from "./main";
import * as account from "./account";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
let confirming = false, busy: string | false = false;

export function render(): string {
  const me = account.signedIn(); if (!me) return `<p class="hint">Working on this device alone. Nothing of yours is on the server.</p>`;
  let h = `<h3>Signed in as</h3><p class="addr">${esc(me.email)}</p>`;
  h += `<p class="hint">Your site and pictures are kept on the server under this address, so any browser you sign in on opens the same site. To come back, enter this email at the door and follow the link it sends.</p>`;
  if (busy) return h + `<p class="hint">${esc(busy)}</p>`;
  h += `<div class="pub-go"><button type="button" class="go" data-acc="signout">Sign out</button></div><p class="hint">Signs out of this browser. Nothing is lost.</p>`;
  h += `<h3>Delete my account</h3>`;
  h += confirming
    ? `<div class="acct-del"><p class="hint">This removes your site, your pictures, your published site and its address, at once and for good. The copy in this browser is cleared too. Type <b>DELETE</b> to be sure.</p><p class="acct-row"><input type="text" id="del-word" autocomplete="off" autocapitalize="characters" aria-label="Type DELETE"><button type="button" class="go danger" data-acc="delete-go">Delete my account</button><button type="button" class="link-ed" data-acc="delete-no">Keep it</button></p></div>`
    : `<p class="hint">Whenever you want to stop, published or not. Everything of yours goes with it.</p><div class="pub-go"><button type="button" class="link-ed" data-acc="delete">Delete my account…</button></div>`;
  return h;
}

export async function act(what: string, redraw: () => void) {
  if (what === "signout") { busy = "Signing out…"; redraw(); try { await account.signOut(); location.href = "/app/"; } catch (e) { busy = false; notify((e as Error).message); redraw(); } return; }
  if (what === "delete") { confirming = true; redraw(); document.getElementById("del-word")?.focus(); return; }
  if (what === "delete-no") { confirming = false; redraw(); return; }
  if (what === "delete-go") {
    const word = (document.getElementById("del-word") as HTMLInputElement | null)?.value.trim(); if (word !== "DELETE") { notify("Type DELETE, in capitals, to be sure."); return; }
    busy = "Removing everything…"; redraw();
    try { await account.deleteAccount(); await state.store.clear(); try { indexedDB.deleteDatabase("latent-wall"); indexedDB.deleteDatabase("latent-wall-versions"); localStorage.removeItem("wall-email"); } catch { /* best effort */ } location.href = "/design/home/index.html?gone"; }
    catch (e) { notify(`Could not delete: ${(e as Error).message}`); busy = false; confirming = false; redraw(); }
  }
}

/** The same panel as a sheet of its own, for screens without the editor (the start of a site). */
export function sheet() {
  let box = document.getElementById("acct-sheet");
  if (!box) {
    document.body.insertAdjacentHTML("beforeend", `<div class="lib acct-sheet" id="acct-sheet" role="dialog" aria-modal="true" aria-label="Your account"><div class="sheet2 narrow"><header><b>Your account</b><button type="button" class="x" data-acc="close">Close</button></header><div class="scroll"></div></div></div>`);
    box = document.getElementById("acct-sheet")!;
    box.addEventListener("click", (e) => {
      const t = e.target as HTMLElement, b = t.closest<HTMLElement>("[data-acc]");
      if (t === box || b?.dataset.acc === "close") { box!.hidden = true; confirming = false; return; }
      if (b) void act(b.dataset.acc!, draw);
    });
  }
  const draw = () => { box!.querySelector(".scroll")!.innerHTML = render(); };
  draw(); box.hidden = false;
}
