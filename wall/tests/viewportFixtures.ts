import {
  initialSite,
  blankBlock,
  type Page,
  type Site,
  type Composition,
} from "../src/model";
import { sectionFor } from "../src/composition";
export const fixturePage = (): Page => ({
  ...structuredClone(initialSite.pages.find((p) => p.id === "quiet")!),
  blocks: ["a", "b", "c", "d", "e", "f"].map((id, i) => ({
    ...blankBlock(i === 1 ? "text" : "image"),
    id,
    text: i === 1 ? "Original essay B" : "",
    assetId: i === 1 ? "" : "formBlue",
    caption: `Caption ${id}`,
    fit: "portrait",
    focal: { x: 17 + i, y: 83 - i },
  })),
  composition: {
    enabled: true,
    desktop: [
      sectionFor(["a", "b"], "first"),
      sectionFor(["c", "d", "e"], "second"),
      sectionFor(["f"], "last"),
    ],
    mobile: ["a", "c", "b", "d", "f", "e"].map((id) =>
      sectionFor([id], `phone-${id}`, true),
    ),
  },
});
export const fixtureSite = (p: Page): Site => ({
  ...structuredClone(initialSite),
  pages: [initialSite.pages[0], p],
});
/** Historical fixtures use an actual v8 shape. Only coupled layouts can be encoded. */
export function legacyComposition(c: Composition | null) {
  if (!c) return null;
  const sections = c.desktop.map((s) => {
    const m = c.mobile.find(
      (m) =>
        m.blockIds.length === s.blockIds.length &&
        m.blockIds.every((id) => s.blockIds.includes(id)),
    );
    if (!m) throw Error("Cannot encode independent groups as v8");
    const reverse =
      JSON.stringify(m.blockIds) === JSON.stringify([...s.blockIds].reverse());
    if (!reverse && JSON.stringify(m.blockIds) !== JSON.stringify(s.blockIds))
      throw Error("Cannot encode arbitrary order");
    return {
      ...s,
      mobile: {
        layout: m.layout,
        width: m.width,
        gap: m.gap,
        space: m.space,
        reverse,
      },
    };
  });
  return {
    enabled: c.enabled,
    sections,
    mobileOrder: c.mobile.map(
      (m) =>
        c.desktop.find(
          (s) =>
            s.blockIds.length === m.blockIds.length &&
            s.blockIds.every((id) => m.blockIds.includes(id)),
        )!.id,
    ),
  };
}
export const legacySite = ({ textStyles, ...site }: Site) => {
  void textStyles;
  return {
    ...site,
    version: 8,
    pages: site.pages.map(({ studies, ...p }) => ({
      ...p,
      composition: legacyComposition(p.composition),
      ...(studies
        ? {
            studies: studies.map((s) => ({
              ...s,
              composition: legacyComposition(s.composition),
            })),
          }
        : {}),
    })),
  };
};
