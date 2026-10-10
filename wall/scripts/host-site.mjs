#!/usr/bin/env node
/* Put a published site into the hosting bucket, by hand (the closed test).
   Usage: node scripts/host-site.mjs <name> <folder-or-zip>
   <name> is the site's folder in the bucket and its subdomain; the files are the ones Publish produced. Needs wrangler
   signed in to the Cloudflare account that owns the bucket (see host/wrangler.toml). Every file is sent; files that
   were there and are not in this publish are removed, so the site is exactly this version. */
import { execFileSync } from "node:child_process";
import { readdirSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
const [name, src] = process.argv.slice(2);
if (!name || !src) { console.error("usage: host-site.mjs <name> <folder-or-zip>"); process.exit(1); }
if (!/^[a-z0-9-]+$/.test(name)) { console.error("the name is the subdomain: lowercase letters, digits and hyphens"); process.exit(1); }
let dir = resolve(src), tmp = null;
if (dir.endsWith(".zip")) { tmp = mkdtempSync(join(tmpdir(), "wall-")); execFileSync("unzip", ["-q", dir, "-d", tmp]); dir = tmp; const inner = readdirSync(tmp).filter((n) => !n.startsWith(".")); if (inner.length === 1 && statSync(join(tmp, inner[0])).isDirectory()) dir = join(tmp, inner[0]); }
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return n.startsWith(".") ? [] : statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(dir);
if (!files.some((f) => relative(dir, f) === "index.html")) { console.error(`no index.html in ${dir}`); process.exit(1); }
const wr = (args) => execFileSync("npx", ["wrangler", "r2", "object", ...args], { cwd: resolve(new URL(".", import.meta.url).pathname, "../host"), stdio: ["ignore", "pipe", "inherit"] }).toString();
// what is there now, so what is not in this publish goes
let had = [];
try { had = JSON.parse(wr(["list", "latent-wall-sites", "--prefix", `${name}/`, "--json"]) || "[]").map((o) => o.key); } catch { had = []; }
const keys = new Set();
for (const f of files) { const key = `${name}/${relative(dir, f).split("\\").join("/")}`; keys.add(key); wr(["put", `latent-wall-sites/${key}`, "--file", f]); }
for (const k of had) if (!keys.has(k)) wr(["delete", `latent-wall-sites/${k}`]);
if (tmp) rmSync(tmp, { recursive: true, force: true });
console.log(`${files.length} files at ${name}: https://${name}.<the sites domain>/`);
