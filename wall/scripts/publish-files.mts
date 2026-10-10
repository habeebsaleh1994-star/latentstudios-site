/* The published files of a site document kept on disk, written to a folder: what Publish in the app does, for a document in a repo.
   Usage: npx tsx scripts/publish-files.mts <site.json> <root-of-its-pictures> <out> */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { openSite } from "../src/studio/site";
import { buildFiles } from "../src/app/publish";
import { conform } from "../src/app/ops";
const [doc, root, out] = process.argv.slice(2).map((p) => resolve(p));
const W = resolve(dirname(new URL(import.meta.url).pathname), "..");
const site = conform(openSite(JSON.parse(readFileSync(doc, "utf8"))));
// the shared assets come from the Wall repo; the site's own pictures from its root
const where = (u: string) => (u.startsWith("/design/") || u.startsWith("/src/app/") || u.startsWith("/app/") ? W : root) + u;
const files = await buildFiles(site, { text: async (u: string) => readFileSync(where(u), "utf8"), bytes: async (u: string) => new Uint8Array(readFileSync(where(u))) } as never);
rmSync(out, { recursive: true, force: true });
for (const f of files) { const p = join(out, f.name); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, f.data); }
console.log(`${files.length} files in ${out}`);
