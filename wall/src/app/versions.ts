/*
 * Every published version of a site, kept in this browser so the site can be put back as it was.
 * A version is the site document as published, numbered and dated. The files are made from it on demand.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { siteSchema, type SiteDocument } from "../studio/site";

export type Version = { n: number; at: string; site: SiteDocument };
interface VersionsDB extends DBSchema { versions: { key: string; value: Version & { space: string } } }
let dbp: Promise<IDBPDatabase<VersionsDB>> | null = null;
const db = () => (dbp ??= openDB<VersionsDB>("latent-wall-versions", 1, { upgrade(d) { d.createObjectStore("versions"); } }));
const key = (space: string, n: number) => `${space}:${String(n).padStart(6, "0")}`;

export function createVersions(space: string) {
  async function list(): Promise<Version[]> {
    const all = await (await db()).getAll("versions", IDBKeyRange.bound(`${space}:`, `${space}:￿`));
    return all.map(({ n, at, site }) => ({ n, at, site })).sort((a, b) => b.n - a.n);
  }
  /** The latest published version, or null when nothing has been published. */
  async function latest(): Promise<Version | null> { return (await list())[0] ?? null; }
  async function get(n: number): Promise<Version | null> { const v = await (await db()).get("versions", key(space, n)); return v ? { n: v.n, at: v.at, site: v.site } : null; }
  /** Publish: the site as it is now becomes the next version. */
  async function publish(site: SiteDocument): Promise<Version> {
    const site2 = siteSchema.parse(site), n = ((await latest())?.n ?? 0) + 1, v = { n, at: new Date().toISOString(), site: site2 };
    await (await db()).put("versions", { ...v, space }, key(space, n));
    return v;
  }
  return { list, latest, get, publish };
}
/** Every asset id any published version in this browser refers to; their bytes must stay so a version can be put back. */
export async function everyVersionAsset(): Promise<Set<string>> {
  const out = new Set<string>();
  for (const v of await (await db()).getAll("versions")) for (const a of Object.keys(v.site.library)) out.add(a);
  return out;
}
export type Versions = ReturnType<typeof createVersions>;
