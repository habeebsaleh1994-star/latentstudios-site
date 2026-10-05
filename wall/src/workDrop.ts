import type { Page } from "./model";
import { orderedSections, withSections } from "./compositionOrder";
import { planGrouping, type GroupingAction } from "./regrouping";
import { uid } from "./ids";

export type WorkDrop =
  | { kind: "into"; sectionId: string }
  | { kind: "between"; beforeId: string | null };
export type WorkDropPlan =
  | { ok: false; reason: string }
  | { ok: true; page: Page; ids: string[]; review: boolean; label: string };

/** A partial old group has companions whose size can change: retain its review. */
export function needsGroupingReview(
  page: Page,
  ids: string[],
  action: GroupingAction,
  mobile = false,
) {
  return (
    (page.composition ? orderedSections(page.composition, mobile) : []).some(
      (s) =>
        s.blockIds.some((id) => ids.includes(id)) &&
        s.blockIds.some((id) => !ids.includes(id)) &&
        (action === "group" || s.blockIds.length > 2),
    ) ?? false
  );
}

/** A drop states its intent explicitly. Grouping locks reading orders; between
 * drops reorder whole selected sections on the current device only. */
export function planWorkDrop(
  page: Page,
  ids: string[],
  target: WorkDrop,
  mobile: boolean,
  id: string = uid(),
): WorkDropPlan {
  const c = page.composition;
  if (
    !c?.enabled ||
    !ids.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !page.blocks.some((b) => b.id === id))
  )
    return { ok: false, reason: "Select current works before moving them." };
  if (target.kind === "into") {
    const section = orderedSections(c, mobile).find(
      (s) => s.id === target.sectionId,
    );
    if (!section)
      return { ok: false, reason: "That section is no longer available." };
    const chosen = page.blocks
      .filter((b) => ids.includes(b.id) || section.blockIds.includes(b.id))
      .map((b) => b.id);
    const plan = planGrouping(page, chosen, "group", id, mobile);
    if (!plan.ok) return plan;
    const review = needsGroupingReview(page, chosen, "group", mobile);
    return {
      ok: true,
      page: plan.page,
      ids: chosen,
      review,
      label: review
        ? "Review regrouping · companions will resize"
        : `Group ${chosen.length} works here · ${mobile ? "phone" : "desktop"} only`,
    };
  }
  const selected = orderedSections(c, mobile).filter((s) =>
    s.blockIds.some((id) => ids.includes(id)),
  );
  if (selected.some((s) => s.blockIds.some((id) => !ids.includes(id))))
    return {
      ok: false,
      reason:
        "Select the whole group to move it between sections, or use Separate selected first. Its unselected companions will stay in place.",
    };
  const chosen = new Set(selected.map((s) => s.id));
  const rest = orderedSections(c, mobile).filter((s) => !chosen.has(s.id));
  const index =
    target.beforeId === null
      ? rest.length
      : rest.findIndex((s) => s.id === target.beforeId);
  if (index < 0)
    return {
      ok: false,
      reason: "Choose a space outside the selected sections.",
    };
  const moving = orderedSections(c, mobile).filter((s) => chosen.has(s.id));
  const next = [...rest.slice(0, index), ...moving, ...rest.slice(index)];
  const original = orderedSections(c, mobile);
  if (next.every((s, i) => s.id === original[i].id))
    return {
      ok: false,
      reason:
        "These works are already at this position. Choose another space or the centre of a section to group.",
    };
  return {
    ok: true,
    review: false,
    ids,
    label: `Place ${ids.length} ${ids.length === 1 ? "work" : "works"} between sections · ${mobile ? "phone order only" : "desktop order only"}`,
    page: withSections(page, next, mobile),
  };
}
