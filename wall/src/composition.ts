import {
  orderedSections,
  sectionBlocks,
  withSections,
} from "./compositionOrder";
export { orderedSections, sectionBlocks } from "./compositionOrder";
import { planGrouping } from "./regrouping";
import { reconcileSpatial } from "./spatial";
import { uid } from "./ids";
import type { Page, Block, CompositionSection } from "./model";
export const sectionFor = (
  blockIds: string[],
  id: string = uid(),
  mobile = false,
): CompositionSection => ({
  id,
  blockIds,
  layout: !mobile && blockIds.length > 1 ? "columns" : "stack",
  width: "full",
  align: "center",
  vertical: "start",
  gap: mobile ? 24 : 28,
  space: mobile ? 48 : 72,
});
export function enableComposition(page: Page): Page {
  if (page.kind === "home") return page;
  return {
    ...page,
    composition: page.composition
      ? { ...page.composition, enabled: true }
      : {
          enabled: true,
          desktop: page.blocks.map((b) => sectionFor([b.id])),
          mobile: page.blocks.map((b) => sectionFor([b.id], uid(), true)),
        },
  };
}
export function patchSection(
  page: Page,
  id: string,
  fn: (s: CompositionSection) => CompositionSection,
  mobile = false,
): Page {
  if (!page.composition) return page;
  return withSections(
    page,
    orderedSections(page.composition, mobile).map((s) =>
      s.id === id ? fn(s) : s,
    ),
    mobile,
  );
}
function selectedWorks(page: Page, ids: string[], mobile = false) {
  const sections = page.composition
    ? orderedSections(page.composition, mobile)
    : [];
  if (
    ids.length < 2 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !sections.some((s) => s.id === id))
  )
    return [];
  return sections.filter((s) => ids.includes(s.id)).flatMap((s) => s.blockIds);
}
export function canGroup(page: Page, ids: string[], mobile = false) {
  return planGrouping(
    page,
    selectedWorks(page, ids, mobile),
    "group",
    undefined,
    mobile,
  ).ok;
}
export function groupSections(
  page: Page,
  ids: string[],
  newId: string = uid(),
  mobile = false,
): Page {
  const plan = planGrouping(
    page,
    selectedWorks(page, ids, mobile),
    "group",
    newId,
    mobile,
  );
  return plan.ok ? plan.page : page;
}
export function ungroupSection(
  page: Page,
  id: string,
  makeId: () => string = uid,
  mobile = false,
): Page {
  const c = page.composition,
    old = c && orderedSections(c, mobile).find((s) => s.id === id);
  if (!c || !old || old.blockIds.length < 2 || old.spatial?.enabled)
    return page;
  const split = old.blockIds.map((blockId, i) => ({
    ...old,
    id: i === 0 ? id : makeId(),
    blockIds: [blockId],
    layout: "stack" as const,
  }));
  return withSections(
    page,
    orderedSections(c, mobile).flatMap((s) => (s.id === id ? split : [s])),
    mobile,
  );
}
export function moveSection(
  page: Page,
  id: string,
  delta: number,
  mobile = false,
): Page {
  if (!page.composition) return page;
  const sections = [...orderedSections(page.composition, mobile)],
    from = sections.findIndex((s) => s.id === id),
    to = from + delta;
  if (from < 0 || to < 0 || to >= sections.length) return page;
  sections.splice(to, 0, sections.splice(from, 1)[0]);
  return withSections(page, sections, mobile);
}
export function moveSectionBlock(
  page: Page,
  sectionId: string,
  blockId: string,
  delta: number,
  mobile = false,
): Page {
  return patchSection(
    page,
    sectionId,
    (s) => {
      const ids = [...s.blockIds],
        i = ids.indexOf(blockId),
        to = i + delta;
      if (i < 0 || to < 0 || to >= ids.length) return s;
      ids.splice(to, 0, ids.splice(i, 1)[0]);
      return { ...s, blockIds: ids };
    },
    mobile,
  );
}
/** Explicit duplication creates new shared works, never repeated references. */
export function duplicateSection(
  page: Page,
  id: string,
  makeId: () => string = uid,
  mobile = false,
): Page {
  const c = page.composition,
    old = c && orderedSections(c, mobile).find((s) => s.id === id);
  if (!c || !old || page.blocks.length + old.blockIds.length > 100) return page;
  const copies = sectionBlocks(page, old).map((b) => ({
    ...structuredClone(b),
    id: makeId(),
  }));
  const copy = {
    ...structuredClone(old),
    id: makeId(),
    blockIds: copies.map((b) => b.id),
  };
  if (copy.captions)
    copy.captions = copy.captions.map((c) => ({
      ...c,
      blockId: copies[old.blockIds.indexOf(c.blockId)].id,
    }));
  if (copy.spatial) {
    const remap = (id: string) => copies[old.blockIds.indexOf(id)].id;
    copy.spatial.frames = copy.spatial.frames.map((f) => ({
      ...f,
      blockId: remap(f.blockId),
    }));
    copy.spatial.layers = copy.spatial.layers.map(remap);
  }
  const next = {
    ...page,
    blocks: [...page.blocks, ...copies],
    composition: {
      ...c,
      [mobile ? "desktop" : "mobile"]: [
        ...orderedSections(c, !mobile),
        ...copies.map((b) => sectionFor([b.id], makeId(), !mobile)),
      ],
    },
  };
  const result = withSections(
    next,
    orderedSections(c, mobile).flatMap((s) => (s.id === id ? [s, copy] : [s])),
    mobile,
  );
  return mobile ? withSections(result, result.composition!.desktop) : result;
}
export function removeSection(page: Page, id: string, mobile = false): Page {
  if (!page.composition) return page;
  const old = orderedSections(page.composition, mobile).find(
    (s) => s.id === id,
  );
  if (!old) return page;
  return reconcileBlocks(
    page,
    page.blocks.filter((b) => !old.blockIds.includes(b.id)),
  );
}
/** Explicit content changes reconcile both independent partitions without regrouping survivors. */
export function reconcileBlocks(page: Page, blocks: Block[]): Page {
  page = {
    ...page,
    ...(page.intentions
      ? {
          intentions: page.intentions.filter(
            (r) =>
              blocks.some((b) => b.id === r.from) &&
              blocks.some((b) => b.id === r.to),
          ),
        }
      : {}),
  };
  const c = page.composition;
  if (!c) return { ...page, blocks };
  const valid = new Set(blocks.map((b) => b.id));
  const reconcile = (mobile: boolean) => {
    const sections = orderedSections(c, mobile)
      .map((s) => ({
        ...s,
        blockIds: s.blockIds.filter((id) => valid.has(id)),
      }))
      .filter((s) => s.blockIds.length)
      .map(reconcileSpatial);
    const known = new Set(sections.flatMap((s) => s.blockIds));
    const groupIds = new Set(sections.map((s) => s.id));
    for (const block of blocks.filter((b) => !known.has(b.id))) {
      const base = `added-${mobile ? "mobile" : "desktop"}-${block.id}`;
      let id = base,
        n = 1;
      while (groupIds.has(id)) id = `${base}-${n++}`;
      groupIds.add(id);
      sections.push(sectionFor([block.id], id, mobile));
    }
    return sections;
  };
  const next = {
    ...page,
    blocks,
    composition: { ...c, desktop: reconcile(false), mobile: reconcile(true) },
  };
  return withSections(next, next.composition.desktop);
}
