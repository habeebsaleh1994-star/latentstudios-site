import { readFileSync, readdirSync, existsSync } from "node:fs";
import { openSite } from "/Users/habibsaleh/Documents/latentstudios-site/wall/src/studio/site";
import { conform, applyHouse } from "/Users/habibsaleh/Documents/latentstudios-site/wall/src/app/ops";
const dir = "/Users/habibsaleh/Documents/latentstudios-site/wall/design/samples";
for (const f of readdirSync(dir).filter((f) => f.endsWith(".site.json"))) {
  try {
    const s = conform(openSite(JSON.parse(readFileSync(`${dir}/${f}`, "utf8"))));
    const missing = Object.keys(s.library).filter((a) => !existsSync(`/Users/habibsaleh/Documents/latentstudios-site/wall${a}`));
    const refs = new Set<string>(); for (const p of s.pages) JSON.stringify(p, (k, v) => { if (typeof v === "string" && v.startsWith("/design/")) refs.add(v); return v; });
    const dangling = [...refs].filter((a) => !(a in s.library));
    for (const h of ["folio","salon","reel","index","atelier","ledger","archive"] as const) applyHouse(s, h);
    console.log(f, "ok:", Object.keys(s.library).length, "works", s.pages.length, "pages", missing.length ? "MISSING FILES " + missing.join(",") : "", dangling.length ? "DANGLING " + dangling.join(",") : "");
  } catch (e) { console.log(f, "FAILED", String(e).slice(0, 600)); }
}
