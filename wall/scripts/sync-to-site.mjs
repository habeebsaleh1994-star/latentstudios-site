#!/usr/bin/env node
/* Copy Latent Wall (home and the templates) into the Latent Studios site as /wall.
   Usage: node scripts/sync-to-site.mjs [path-to-site]    default: the site this folder lives in (one level up)
   Safe to re-run: it replaces public/wall completely and touches nothing else except the /wall rule in public/_headers. */
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const site = resolve(process.argv[2] || join(root, ".."));
if (!existsSync(join(site, "public"))) { console.error(`No public folder in ${site}`); process.exit(1); }
const out = join(site, "public/wall");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const skip = (p) => /\/stills(\/|$)/.test(p) || /\/tools(\/|$)/.test(p) || p.endsWith(".DS_Store");
for (const d of ["shared", "folio", "index", "salon", "reel", "atelier", "lantern"]) cpSync(join(root, "design", d), join(out, d), { recursive: true, filter: (s) => !skip(s) });
// the home page becomes /wall/ itself, so its links to the templates lose a level
let home = readFileSync(join(root, "design/home/index.html"), "utf8").replaceAll("../folio/", "./folio/").replaceAll("../index/", "./index/").replaceAll("../salon/", "./salon/").replaceAll("../reel/", "./reel/").replaceAll("../atelier/", "./atelier/").replaceAll("../lantern/", "./lantern/");
writeFileSync(join(out, "index.html"), home);

// not for search engines yet
const noindex = '<meta name="robots" content="noindex, nofollow">';
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
let pages = 0;
for (const f of walk(out).filter((f) => f.endsWith(".html"))) {
  const h = readFileSync(f, "utf8");
  if (!h.includes('name="robots"')) { writeFileSync(f, h.replace("<head>", `<head>\n${noindex}`)); pages++; }
}

// the site forbids framing everywhere; the home page shows templates in frames, so /wall may frame itself
const hp = join(site, "public/_headers");
let headers = readFileSync(hp, "utf8");
const rule = `\n# Latent Wall (work in progress): its home page shows the templates running in frames, and it is not for search engines yet.\n/wall/*\n  ! X-Frame-Options\n  X-Frame-Options: SAMEORIGIN\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-cache\n`;
if (!headers.includes("# Latent Wall")) writeFileSync(hp, headers.replace(/\s*$/, "\n") + rule);

const size = walk(out).reduce((n, f) => n + statSync(f).size, 0);
console.log(`Copied Latent Wall to ${out}: ${walk(out).length} files, ${(size / 1048576).toFixed(1)} MB, ${pages} pages marked noindex.`);
