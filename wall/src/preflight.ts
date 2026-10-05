import { contentPreflight, type PreflightIssue } from "./publication";
import type { Revision } from "./revisions";
import { validateMedia } from "./mediaValidation";
export async function preflight(
  revision: Revision,
  decode = validateMedia,
  signal?: AbortSignal,
): Promise<PreflightIssue[]> {
  signal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(60000)])
    : AbortSignal.timeout(60000);
  const issues = contentPreflight(revision.site);
  for (const entry of revision.manifest) {
    signal?.throwIfAborted();
    const blob = revision.assets[entry.id];
    if (!blob || entry.missing) {
      issues.push({
        severity: "error",
        message: `A referenced media file is missing (${entry.id}).`,
      });
      continue;
    }
    const blocks = revision.site.pages
      .flatMap((p) => p.blocks)
      .filter((b) => b.assetId === entry.id);
    for (const type of new Set(blocks.map((b) => b.type))) {
      if (type === "text") continue;
      if (
        !(type === "video"
          ? blob.type.startsWith("video/")
          : blob.type.startsWith("image/"))
      ) {
        issues.push({
          severity: "error",
          message: `A ${type} block references the wrong media type (${entry.id}).`,
        });
        continue;
      }
      try {
        const dimensions = await decode(
          new File([blob], entry.id, { type: blob.type }),
          type,
          signal,
        );
        if (dimensions) Object.assign(entry, dimensions);
      } catch {
        signal?.throwIfAborted();
        issues.push({
          severity: "error",
          message: `This browser could not decode a ${type === "video" ? "film" : "photograph"} (${entry.id}). Replace it before releasing.`,
        });
      }
    }
  }
  return issues;
}
