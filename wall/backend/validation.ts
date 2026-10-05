import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import { siteInputSchema, siteSchema, type Site } from "../src/model";
import { contentPreflight } from "../src/publication";
export class BackendError extends Error {
  constructor(
    public code:
      | "INVALID"
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "CONFLICT"
      | "UNVERIFIED"
      | "MEDIA"
      | "UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "BackendError";
  }
}
export function fail(code: BackendError["code"], message: string): never {
  throw new BackendError(code, message);
}
export const hash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export const idSchema = z.string().uuid();
const filename = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,119}$/)
  .refine((v) => !v.includes("..") && !v.endsWith("."));
export const uploadSchema = z
  .object({
    filename,
    mime: z.enum(["image/jpeg", "image/png"]),
    bytes: z
      .number()
      .int()
      .positive()
      .max(30 * 1024 * 1024),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .refine(
    (v) =>
      v.mime === "image/jpeg"
        ? /\.jpe?g$/i.test(v.filename)
        : /\.png$/i.test(v.filename),
    "Extension must match the media type",
  );
export const publishSchema = z
  .object({
    siteId: idSchema,
    domainId: idSchema,
    expectedDraftVersion: z.number().int().positive(),
    expectedGeneration: z.number().int().nonnegative(),
    approvedAssetIds: z.array(idSchema).max(5000),
    idempotencyKey: idSchema,
  })
  .strict();
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    return fail(
      "INVALID",
      "Invalid input: " +
        result.error.issues
          .map((i) => i.path.join(".") + ": " + i.message)
          .join("; "),
    );
  return result.data;
}
export function hostname(value: unknown) {
  const v = parse(z.string().max(253), value).toLowerCase();
  if (
    isIP(v) ||
    v === "localhost" ||
    !v.includes(".") ||
    v.endsWith(".") ||
    !v
      .split(".")
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  )
    return fail(
      "INVALID",
      "Use an ASCII hostname without scheme, path, wildcard, IP address or port.",
    );
  return v;
}
function rejectUnknown(raw: unknown, parsed: unknown) {
  if (!raw || typeof raw !== "object") return;
  if (Array.isArray(raw)) {
    raw.forEach((v, i) => rejectUnknown(v, (parsed as unknown[])[i]));
    return;
  }
  for (const [k, v] of Object.entries(raw)) {
    if (!parsed || !Object.hasOwn(parsed, k))
      fail("INVALID", "Unknown document field: " + k);
    rejectUnknown(v, (parsed as Record<string, unknown>)[k]);
  }
}
export function documentInput(raw: unknown): Site {
  let serialized: string;
  try {
    serialized = JSON.stringify(raw);
  } catch {
    return fail("INVALID", "Document must be JSON.");
  }
  if (!serialized || Buffer.byteLength(serialized) > 2 * 1024 * 1024)
    return fail("INVALID", "Document exceeds 2 MB.");
  if (
    ![5, 6, 7, 8, 9, 10, 11, 12, 13].includes(
      Number((raw as { version?: unknown })?.version),
    )
  )
    return fail(
      "INVALID",
      "Backend accepts version-five through thirteen documents only; migrate earlier versions explicitly in the editor first.",
    );
  rejectUnknown(raw, parse(siteInputSchema, raw));
  const document = parse(siteSchema, raw);
  for (const p of document.pages) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(p.id))
      fail("INVALID", "Invalid page route ID.");
    for (const b of p.blocks) {
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(b.id))
        fail("INVALID", "Invalid block ID.");
      if (b.type !== "text" && b.assetId) parse(idSchema, b.assetId);
      if (b.type === "text" && b.assetId)
        fail("INVALID", "Text blocks cannot conceal media references.");
    }
  }
  if (document.publication.canonical) {
    try {
      const u = new URL(document.publication.canonical);
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        u.search ||
        u.hash
      )
        throw Error();
      hostname(u.hostname);
    } catch {
      return fail("INVALID", "Invalid canonical HTTPS URL.");
    }
  }
  try {
    if (Intl.getCanonicalLocales(document.publication.language).length !== 1)
      throw Error();
  } catch {
    return fail("INVALID", "Invalid language tag.");
  }
  return document;
}
export function publicationDocument(document: Site, host: string) {
  const errors = contentPreflight(document).filter(
    (i) => i.severity === "error",
  );
  if (errors.length) fail("INVALID", errors.map((e) => e.message).join(" "));
  if (
    document.publication.canonical &&
    new URL(document.publication.canonical).hostname !== host
  )
    fail(
      "INVALID",
      "Canonical hostname does not match the verified publication domain.",
    );
}
export const references = (document: Site) =>
  [
    ...new Set(
      document.pages.flatMap((p) =>
        p.blocks.filter((b) => b.type !== "text").map((b) => b.assetId),
      ),
    ),
  ].sort();
export function assertKey(key: string) {
  if (
    !/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(key) ||
    !key.split("/").every((p) => idSchema.safeParse(p).success)
  )
    fail("INVALID", "Invalid private object key.");
  return key;
}
