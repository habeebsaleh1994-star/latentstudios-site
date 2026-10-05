import type { CompositionSection, Page } from "./model";
import { orderedSections, withSections } from "./compositionOrder";
import { uid } from "./ids";
export type GroupingAction = "group" | "separate";
export type GroupingPlan =
  | { ok: true; page: Page; affectedIds: string[]; sectionId?: string }
  | { ok: false; reason: string };
export const readingOrder = (page: Page, mobile = false) =>
  page.composition
    ? orderedSections(page.composition, mobile).flatMap((s) => s.blockIds)
    : page.blocks.map((b) => b.id);
const equal = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);
/** Grouping locks only the selected viewport's reading order. */
function finish(
  page: Page,
  sections: CompositionSection[],
  affectedIds: string[],
  sectionId: string | undefined,
  mobile: boolean,
): GroupingPlan {
  const treatments = orderedSections(page.composition!, mobile).flatMap(
    (s) => s.captions ?? [],
  );
  const next = withSections(
    page,
    sections.map((s) => {
      const captions = treatments.filter((c) => s.blockIds.includes(c.blockId));
      return captions.length ? { ...s, captions } : s;
    }),
    mobile,
  );
  if (!equal(readingOrder(page, mobile), readingOrder(next, mobile)))
    return {
      ok: false,
      reason: "This change cannot retain the selected reading order.",
    };
  return { ok: true, page: next, affectedIds, sectionId };
}
/** Selecting works, rather than whole section IDs, permits safe regrouping across existing boundaries. */
export function planGrouping(
  page: Page,
  selected: string[],
  action: GroupingAction,
  id: string = uid(),
  mobile = false,
): GroupingPlan {
  const c = page.composition,
    chosen = new Set(selected),
    order = readingOrder(page, mobile);
  if (!c?.enabled)
    return { ok: false, reason: "Choose Arrange before grouping works." };
  if (
    !chosen.size ||
    selected.length !== chosen.size ||
    selected.some((key) => !order.includes(key))
  )
    return { ok: false, reason: "Select current works on this page." };
  const affected = orderedSections(c, mobile).filter((s) =>
      s.blockIds.some((key) => chosen.has(key)),
    ),
    affectedIds = affected.flatMap((s) => s.blockIds);
  if (affected.some((s) => s.spatial?.enabled))
    return {
      ok: false,
      reason:
        "Preview and apply Flow for the spatial section before regrouping. Its placement will be retained as a study.",
    };
  if (action === "group") {
    if (chosen.size < 2 || chosen.size > 4)
      return {
        ok: false,
        reason:
          "A group holds two to four works. Adjust the selection to keep the composition readable.",
      };
    const indexes = order.flatMap((key, i) => (chosen.has(key) ? [i] : []));
    if (indexes.at(-1)! - indexes[0] + 1 !== indexes.length)
      return {
        ok: false,
        reason: `Another work lies between your selected works in the ${mobile ? "phone" : "desktop"} reading order. Include it, or move the works together before grouping.`,
      };
    if (affected.length === 1 && affected[0].blockIds.length === chosen.size)
      return {
        ok: false,
        reason:
          "These works already form one group. Try another arrangement, or separate selected works.",
      };
    const first = affected[0],
      group: CompositionSection = {
        ...first,
        id,
        blockIds: order.filter((key) => chosen.has(key)),
        layout: mobile ? "stack" : "columns",
      };
    const sections: CompositionSection[] = [];
    let inserted = false,
      part = 0;
    for (const old of orderedSections(c, mobile)) {
      if (!affected.includes(old)) {
        sections.push(old);
        continue;
      }
      let chunk: string[] = [];
      let reused = false;
      const flush = () => {
        if (!chunk.length) return;
        sections.push({
          ...old,
          id: reused ? `${id}-remaining-${part++}` : old.id,
          blockIds: chunk,
          layout: chunk.length === 1 ? "stack" : old.layout,
          space: reused ? old.gap : old.space,
        });
        reused = true;
        chunk = [];
      };
      for (const key of old.blockIds) {
        if (chosen.has(key)) {
          flush();
          if (!inserted) {
            sections.push({ ...group, space: reused ? old.gap : group.space });
            inserted = true;
          }
        } else chunk.push(key);
      }
      flush();
    }
    return finish(page, sections, affectedIds, id, mobile);
  }
  if (!affected.some((s) => s.blockIds.length > 1))
    return {
      ok: false,
      reason: "The selected works are already separate sections.",
    };
  let part = 0;
  const sections = orderedSections(c, mobile).flatMap((old) => {
    if (!affected.includes(old) || old.blockIds.length === 1) return [old];
    const chunks: string[][] = [];
    let rest: string[] = [];
    for (const key of old.blockIds) {
      if (chosen.has(key)) {
        if (rest.length) chunks.push(rest);
        rest = [];
        chunks.push([key]);
      } else rest.push(key);
    }
    if (rest.length) chunks.push(rest);
    return chunks.map((blockIds, i) => ({
      ...old,
      id: i === 0 ? old.id : `${id}-separate-${part++}`,
      blockIds,
      layout: blockIds.length === 1 ? ("stack" as const) : old.layout,
      space: i === 0 ? old.space : old.gap,
    }));
  });
  return finish(page, sections, affectedIds, undefined, mobile);
}
export const selectionRange = (
  page: Page,
  anchor: string,
  id: string,
  mobile: boolean,
) => {
  const order = readingOrder(page, mobile),
    a = order.indexOf(anchor),
    b = order.indexOf(id);
  return a < 0 || b < 0
    ? [id]
    : order.slice(Math.min(a, b), Math.max(a, b) + 1);
};
