/* What a published page carries: it is already drawn; this wires its behaviour (turning, walking, holding, slides, film) from window.STATIC. */
import { wire } from "./behave";
import { viewOf, bookLeaves, type Ctx } from "./render";
import type { SiteDocument, SitePage } from "../studio/site";
type Static = { page: string | null; base: string; site: SiteDocument };
const S = (window as unknown as { STATIC: Static }).STATIC;
const fileOf = (asset: string, kind: string) => asset.startsWith("asset:") ? `${asset.slice(6)}.${kind === "video" ? "mp4" : "jpg"}` : asset.split("/").pop()!.replace(/[^A-Za-z0-9._-]/g, "-");
const ctx: Ctx = { site: S.site, editing: false, href: (id) => (id ? `${S.base}${encodeURIComponent(id)}/` : S.base || "./"), src: (a) => `${S.base}assets/img/${fileOf(a, S.site.library[a]?.kind ?? "image")}` };
const p: SitePage | null = S.site.pages.find((x) => x.id === S.page) ?? null;
void bookLeaves;
wire(document.getElementById("app")!, ctx, p, viewOf(p, S.site), false);
