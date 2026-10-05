import type { Composition, CompositionSection, Page } from "./model";
import { reconcileSpatial } from "./spatial";
export const orderedSections = (c: Composition, mobile = false) =>
  mobile ? c.mobile : c.desktop;
export const sectionBlocks = (page: Page, section: CompositionSection) =>
  section.blockIds.map((id) => page.blocks.find((b) => b.id === id)!);
/** Replace exactly one viewport. Authored records are never copied or edited here. */
export function withSections(
  page: Page,
  sections: CompositionSection[],
  mobile = false,
): Page {
  if (!page.composition) return page;
  sections = sections.map(reconcileSpatial);
  const ids = sections.flatMap((s) => s.blockIds);
  return {
    ...page,
    composition: {
      ...page.composition,
      [mobile ? "mobile" : "desktop"]: sections,
    },
    blocks:
      mobile ||
      (ids.length === page.blocks.length &&
        ids.every((id, i) => id === page.blocks[i]?.id))
        ? page.blocks
        : sections.flatMap((s) =>
            s.blockIds.map((id) => page.blocks.find((b) => b.id === id)!),
          ),
  };
}
