import { colorsFor, contrast } from "./identity";
import { type Site, demoAssets } from "./model";
export interface PreflightIssue {
  severity: "error" | "warning";
  message: string;
  pageId?: string;
}
export function contentPreflight(site: Site): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const add = (
    severity: PreflightIssue["severity"],
    message: string,
    pageId?: string,
  ) => issues.push({ severity, message, pageId });
  if (!site.publication.title.trim())
    add("error", "Add a website title for the browser tab and search results.");
  if (!site.publication.description.trim())
    add("warning", "A website description will help introduce this work.");
  try {
    if (
      !site.publication.language.trim() ||
      Intl.getCanonicalLocales(site.publication.language).length !== 1
    )
      throw new Error();
  } catch {
    add("error", "Use a valid language tag, such as en, ar, or fr-CA.");
  }
  if (site.publication.canonical) {
    try {
      const u = new URL(site.publication.canonical);
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        u.search ||
        u.hash
      )
        throw new Error();
    } catch {
      add(
        "error",
        "The optional public address must be a full HTTPS address without credentials, a query, or a fragment. Leave it empty until you have one.",
      );
    }
  }
  if (!site.name.trim()) add("error", "Add the artist or studio name.");
  const labels = new Set<string>();
  for (const page of site.pages) {
    if (!page.title.trim())
      add("error", "An untitled page needs a title.", page.id);
    if (page.inNav) {
      if (!page.label.trim())
        add(
          "error",
          `${page.title || "Page"} has an empty navigation label.`,
          page.id,
        );
      if (labels.has(page.label.trim().toLowerCase()))
        add(
          "warning",
          `The navigation label “${page.label}” is used more than once.`,
          page.id,
        );
      labels.add(page.label.trim().toLowerCase());
    }
    if (
      page.kind !== "home" &&
      !page.subtitle.trim() &&
      !page.blocks.some((b) => (b.type === "text" ? b.text.trim() : b.assetId))
    )
      add(
        "warning",
        `${page.title}: this destination has no content yet.`,
        page.id,
      );
    for (const block of page.blocks)
      if (block.type !== "text") {
        if (!block.assetId)
          add(
            "error",
            `${page.title}: a ${block.type === "video" ? "film" : "photograph"} is missing.`,
            page.id,
          );
        if (!block.alt.trim())
          add(
            "warning",
            `${page.title}: add an accessible description for this ${block.type === "video" ? "film" : "photograph"}.`,
            page.id,
          );
        if (block.type === "video")
          add(
            "warning",
            `${page.title}: review captions, transcript and audio description for the film; this edition does not add them automatically.`,
            page.id,
          );
      }
  }
  const c = colorsFor(site);
  if (contrast(c.ink, c.canvas) < 4.5)
    add(
      "warning",
      "Body text contrast is below 4.5:1. Review the selected ink and canvas colors.",
    );
  if (contrast(c.accent, c.canvas) < 4.5)
    add(
      "warning",
      "Accent contrast is below 4.5:1. Review links against the canvas.",
    );
  return issues;
}
export const allMediaIds = (site: Site) => [
  ...new Set(
    site.pages
      .flatMap((p) =>
        p.blocks.filter((b) => b.type !== "text").map((b) => b.assetId),
      )
      .filter(Boolean),
  ),
];
export const isDemoAsset = (id: string) => Object.hasOwn(demoAssets, id);
export function compareSites(before: Site, after: Site) {
  const lines: string[] = [];
  if (
    before.name !== after.name ||
    before.tagline !== after.tagline ||
    before.email !== after.email ||
    JSON.stringify(before.copy) !== JSON.stringify(after.copy)
  )
    lines.push("Artist identity or site writing changed");
  if (
    before.styleId !== after.styleId ||
    JSON.stringify(before.appearances) !== JSON.stringify(after.appearances)
  )
    lines.push("Style or visual identity changed");
  if (JSON.stringify(before.publication) !== JSON.stringify(after.publication))
    lines.push("Publication metadata changed");
  if (
    before.pages.map((p) => p.id).join("|") !==
    after.pages.map((p) => p.id).join("|")
  )
    lines.push("Pages added, removed, or reordered");
  for (const page of after.pages) {
    const old = before.pages.find((p) => p.id === page.id);
    if (old && JSON.stringify(old) !== JSON.stringify(page)) {
      const withoutMediaReferences = (p: typeof page) => ({
        ...p,
        blocks: p.blocks.map((b) => ({ ...b, assetId: "" })),
      });
      const referencesOnly =
        JSON.stringify(withoutMediaReferences(old)) ===
        JSON.stringify(withoutMediaReferences(page));
      lines.push(
        `${page.title || "Untitled page"}: ${referencesOnly ? "media references changed (file contents not compared)" : "writing, media, navigation, or composition changed"}`,
      );
    }
  }
  return lines;
}
