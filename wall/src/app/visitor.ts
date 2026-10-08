/* What a published page carries: it is already drawn; this wires its behaviour (turning, walking, holding, slides, film) from window.STATIC. A page behind a word carries itself sealed, and opens here when the word is given. */
import { wire } from "./behave";
import { viewOf, bookLeaves, type Ctx } from "./render";
import { open, type Sealed } from "./lock";
import { applyTheme } from "./theme";
import type { SiteDocument, SitePage } from "../studio/site";
type Static = { page: string | null; base: string; site: SiteDocument; sealed?: Sealed; names?: Record<string, string> };
const S = (window as unknown as { STATIC: Static }).STATIC;
const fileOf = (asset: string, kind: string) => asset.startsWith("asset:") ? `${asset.slice(6)}.${kind === "video" ? "mp4" : "jpg"}` : asset.split("/").pop()!.replace(/[^A-Za-z0-9._-]/g, "-");
const ctx: Ctx = { site: S.site, editing: false, href: (id) => (id ? `${S.base}${encodeURIComponent(id)}/` : S.base || "./"), src: (a) => `${S.base}assets/img/${S.names?.[a] ?? fileOf(a, S.site.library[a]?.kind ?? "image")}` };
const p: SitePage | null = S.site.pages.find((x) => x.id === S.page) ?? null;
void bookLeaves;

const WORDS = "wall-words";
const given = (): string[] => { try { return JSON.parse(sessionStorage.getItem(WORDS) ?? "[]"); } catch { return []; } };
const remember = (w: string) => { try { sessionStorage.setItem(WORDS, JSON.stringify([...given(), w])); } catch { /* a private window may refuse */ } };
/** Open the sealed page with a word: the document becomes the page itself, which brings its own copy of this script. */
async function tryWord(word: string) {
  const html = S.sealed ? await open(S.sealed, word) : null;
  if (html == null) return false;
  remember(word); document.open(); document.write(html); document.close(); return true;
}
// the theme as the app would set it (accent fitted, day or night, the device followed), after the page's own first paint
try { applyTheme(S.site.theme); const mq = matchMedia("(prefers-color-scheme: dark)"); mq.addEventListener("change", () => applyTheme(S.site.theme)); } catch { /* an old browser keeps the first paint */ }
(async () => {
  if (S.sealed) { for (const w of given()) if (await tryWord(w)) return; ctx.open = tryWord; }
  wire(document.getElementById("app")!, ctx, p, viewOf(p, S.site), false);
})();
