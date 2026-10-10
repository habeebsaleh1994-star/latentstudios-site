#!/usr/bin/env node
/* Build Latent Wall as a static site, ready for any static host (Cloudflare Pages, a folder on a server).
   Output: dist/ with the app at /app/, the arrival page at /, the samples and the shared assets at the same absolute
   paths the app uses while we work, so nothing in src needs to know whether it runs from Vite or from a host.
   Usage: node scripts/build-site.mjs [out]      default: wall/dist */
import { buildSync } from "esbuild";
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const out = resolve(process.argv[2] || join(root, "dist"));
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const skip = (p) => p.endsWith(".DS_Store") || /\/_explore(\/|$)/.test(p) || /\/_source(\/|$)/.test(p) || /manifest\.json$/.test(p) || /design\/(folio|lantern|index|salon|reel|atelier)(\/|$)/.test(p);

// the app: its shell, with the module built once; the stylesheets it links and the files Publish reads stay at their paths
buildSync({ entryPoints: [`${root}/src/app/main.ts`], bundle: true, format: "esm", platform: "browser", target: "es2020", minify: true, sourcemap: false, outfile: `${out}/app/main.js`, logLevel: "warning" });
mkdirSync(`${out}/src/app`, { recursive: true });
for (const f of ["app.css", "looks.css", "edit.css"]) cpSync(`${root}/src/app/${f}`, `${out}/src/app/${f}`);
cpSync(`${root}/app/visitor.js`, `${out}/app/visitor.js`);
writeFileSync(`${out}/app/index.html`, readFileSync(`${root}/app/index.html`, "utf8").replace('<script type="module" src="/src/app/main.ts"></script>', '<script type="module" src="/app/main.js"></script>'));

// the shared assets, the samples (the stills and the clips included), the arrival page as the root
cpSync(`${root}/design`, `${out}/design`, { recursive: true, filter: (s) => !skip(s) });
writeFileSync(`${out}/index.html`, readFileSync(`${root}/design/home/index.html`, "utf8"));
// a host needs these: the home page frames the app, and nothing here is for search engines yet
writeFileSync(`${out}/_headers`, `/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: SAMEORIGIN\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Robots-Tag: noindex, nofollow\n/design/shared/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n/design/samples/*\n  Cache-Control: public, max-age=2592000\n/app/*\n  Cache-Control: no-cache\n`);

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(out), size = files.reduce((n, f) => n + statSync(f).size, 0);
console.log(`Built Latent Wall into ${out}: ${files.length} files, ${(size / 1048576).toFixed(1)} MB.`);
