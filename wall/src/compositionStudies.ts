import { uid } from "./ids";
import type { Page, CompositionStudy, CompositionSection, Site } from "./model";
import {
  enableComposition,
  reconcileBlocks,
  patchSection,
} from "./composition";

export function captureStudy(
  page: Page,
  name: string,
  id: string = uid(),
): CompositionStudy {
  return {
    id,
    name: name.trim().slice(0, 80) || "Untitled study",
    createdAt: new Date().toISOString(),
    order: page.blocks.map((b) => b.id),
    composition: structuredClone(page.composition),
    ...(page.intentions
      ? { intentions: structuredClone(page.intentions) }
      : {}),
  };
}
export function keepStudy(page: Page, name: string): Page {
  if ((page.studies?.length ?? 0) >= 12)
    throw new Error(
      "This page holds 12 studies. Remove one you no longer need before keeping another.",
    );
  return {
    ...page,
    studies: [...(page.studies ?? []), captureStudy(page, name)],
  };
}
export function beginCanvas(page: Page): Page {
  if (page.kind === "home") return page;
  return enableComposition(
    page.studies?.length ? page : keepStudy(page, "Starting point"),
  );
}
/** A study owns arrangement only. Every surviving work uses its CURRENT words, media, fit and focal point. */
export function applyStudy(page: Page, study: CompositionStudy): Page {
  const ordered = study.order.flatMap(
    (id) => page.blocks.find((b) => b.id === id) ?? [],
  );
  const known = new Set(study.order);
  const blocks = [...ordered, ...page.blocks.filter((b) => !known.has(b.id))];
  return reconcileBlocks(
    {
      ...page,
      intentions: structuredClone(study.intentions),
      composition: structuredClone(study.composition),
    },
    blocks,
  );
}
export function studyChanges(page: Page, study: CompositionStudy) {
  const old = new Set(study.order),
    live = new Set(page.blocks.map((b) => b.id));
  return {
    added: page.blocks.filter((b) => !old.has(b.id)).length,
    removed: study.order.filter((id) => !live.has(id)).length,
  };
}
export function applyStudySafely(page: Page, study: CompositionStudy): Page {
  return applyStudy(keepStudy(page, `Before ${study.name}`), study);
}
export const arrangementOptions = [
  {
    id: "balanced",
    name: "In conversation",
    note: "Equal presence. A shared line and an even interval.",
  },
  {
    id: "leading",
    name: "A work leads",
    note: "One voice opens the composition. Its companions follow.",
  },
  {
    id: "quiet",
    name: "A slower reading",
    note: "A narrower sequence with room between each work.",
  },
] as const;
export const mobileArrangementOptions = [
  {
    id: "balanced",
    name: "One at a time",
    note: "A full-width stack with a clear, even reading rhythm.",
  },
  {
    id: "leading",
    name: "Side by side",
    note: "Pairs share the screen. Writing may read better in a stack.",
  },
  {
    id: "quiet",
    name: "A quieter column",
    note: "An inset stack with more room between works.",
  },
] as const;
export type ArrangementOption = (typeof arrangementOptions)[number]["id"];
export function proposeArrangement(
  page: Page,
  sectionId: string,
  option: ArrangementOption,
  mobile = false,
): Page {
  return patchSection(
    page,
    sectionId,
    (source) => {
      if (source.spatial?.enabled) return source;
      const { widthPercent, columnRatio, ...s } = source;
      void widthPercent;
      void columnRatio;
      if (mobile)
        return {
          ...s,
          layout: option === "leading" ? "columns" : "stack",
          width: option === "quiet" ? "inset" : "full",
          gap: option === "quiet" ? 40 : option === "leading" ? 12 : 24,
        };
      const single = s.blockIds.length === 1;
      return {
        ...s,
        layout:
          option === "quiet"
            ? "stack"
            : option === "leading"
              ? "emphasis-left"
              : "columns",
        width:
          option === "quiet"
            ? "reading"
            : option === "leading"
              ? "full"
              : "wide",
        align: option === "quiet" && single ? "left" : "center",
        gap: option === "quiet" ? 56 : 28,
        vertical: option === "leading" ? "center" : "start",
        // Deliberately retain all authored mobile decisions. Desktop proposals never rewrite them.
      };
    },
    mobile,
  );
}
/** Explicit flow conversion retains the dormant spatial frames for re-entry. */
export function flowArrangement(
  page: Page,
  sectionId: string,
  mobile = false,
): Page {
  return patchSection(
    page,
    sectionId,
    (s) =>
      s.spatial ? { ...s, spatial: { ...s.spatial, enabled: false } } : s,
    mobile,
  );
}
export function applyFlowSafely(
  page: Page,
  sectionId: string,
  mobile = false,
): Page {
  return flowArrangement(
    keepStudy(page, `Spatial before ${mobile ? "phone" : "desktop"} flow`),
    sectionId,
    mobile,
  );
}
export function publicWebsite(site: Site): Site {
  return {
    ...site,
    pages: site.pages.map((page) => {
      const { studies, intentions, ...publicPage } = page;
      void intentions;
      void studies;
      return publicPage;
    }),
  };
}
export const desktopWidths = ["reading", "wide", "full"] as const;
export const widthPercent = (s: CompositionSection) =>
  s.widthPercent ?? { reading: 64, wide: 84, full: 100, inset: 88 }[s.width];
export const columnRatio = (s: CompositionSection) =>
  s.columnRatio ??
  (s.layout === "emphasis-left" ? 60 : s.layout === "emphasis-right" ? 40 : 50);
export function resizeSection(
  s: CompositionSection,
  percentage: number,
): CompositionSection {
  return {
    ...s,
    widthPercent: Math.round(Math.min(100, Math.max(25, percentage)) * 10) / 10,
  };
}
export function ratioSection(
  s: CompositionSection,
  percentage: number,
): CompositionSection {
  return {
    ...s,
    columnRatio: Math.round(Math.min(80, Math.max(20, percentage)) * 10) / 10,
  };
}
