#!/usr/bin/env node
/* Put a published site into the hosting bucket, or take it down, by hand (the closed beta).
   Usage: node scripts/host-site.mjs <name> <folder-or-zip>     put this version up, exactly
          node scripts/host-site.mjs down <name>                take every file of the site away
   <name> is the site's folder in the bucket and its subdomain. The bucket keeps a manifest per site
   (`<name>/.manifest.json`), so the next publish removes what it no longer has, and `down` removes all. */
import { execFileSync } from "node:child_process";
import { readdirSync, statSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
const HOST = resolve(new URL(".", import.meta.url).pathname, "../host"), BUCKET = "latent-wall-sites";
const wr = (args, opts = {}) => execFileSync("npx", ["-y", "wrangler@latest", "r2", "object", ...args, "--remote"], { cwd: HOST, stdio: ["ignore", "pipe", "pipe"], ...opts }).toString();
const manifestOf = (name) => { const t = mkdtempSync(join(tmpdir(), "wall-m-")), f = join(t, "m.json"); try { wr(["get", `${BUCKET}/${name}/.manifest.json`, "--file", f]); const m = JSON.parse(readFileSync(f, "utf8")); rmSync(t, { recursive: true, force: true }); return m.files ?? []; } catch { rmSync(t, { recursive: true, force: true }); return []; } };
const [a, b] = process.argv.slice(2);
const ok = (n) => /^[a-z0-9-]+$/.test(n);
if (a === "down" && b && ok(b)) {
  const had = manifestOf(b); for (const k of had) { try { wr(["delete", `${BUCKET}/${b}/${k}`]); } catch { /* already gone */ } }
  try { wr(["delete", `${BUCKET}/${b}/.manifest.json`]); } catch { /* none */ }
  console.log(`${b}: ${had.length} files removed; take its line out of host/wrangler.toml and run npm run sites to free the address`); process.exit(0);
}
const [name, src] = [a, b];
if (!name || !src || !ok(name)) { console.error("usage: host-site.mjs <name> <folder-or-zip> | down <name>   (the name: lowercase letters, digits, hyphens)"); process.exit(1); }
let dir = resolve(src), tmp = null;
if (dir.endsWith(".zip")) { tmp = mkdtempSync(join(tmpdir(), "wall-")); execFileSync("unzip", ["-q", dir, "-d", tmp]); dir = tmp; const inner = readdirSync(tmp).filter((n) => !n.startsWith(".")); if (inner.length === 1 && statSync(join(tmp, inner[0])).isDirectory()) dir = join(tmp, inner[0]); }
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return n.startsWith(".") ? [] : statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(dir), rel = (f) => relative(dir, f).split("\\").join("/");
if (!files.some((f) => rel(f) === "index.html")) { console.error(`no index.html in ${dir}`); process.exit(1); }
const had = manifestOf(name), now = new Set(files.map(rel));
let n = 0;
for (const f of files) { wr(["put", `${BUCKET}/${name}/${rel(f)}`, "--file", f]); n++; if (n % 10 === 0) console.log(`  ${n} of ${files.length}`); }
for (const k of had) if (!now.has(k)) { try { wr(["delete", `${BUCKET}/${name}/${k}`]); } catch { /* gone */ } }
const mf = join(tmp ?? tmpdir(), `wall-manifest-${name}.json`); writeFileSync(mf, JSON.stringify({ files: [...now], at: new Date().toISOString() })); wr(["put", `${BUCKET}/${name}/.manifest.json`, "--file", mf]);
if (tmp) rmSync(tmp, { recursive: true, force: true }); else rmSync(mf, { force: true });
console.log(`${files.length} files up at ${name}; ${had.filter((k) => !now.has(k)).length} old files removed`);
