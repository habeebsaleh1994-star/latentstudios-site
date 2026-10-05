import type { Site } from "./model";
export type EditHistory = {
  present: Site;
  past: Site[];
  future: Site[];
  group: string | null;
  at: number;
};
export const createHistory = (site: Site): EditHistory => ({
  present: site,
  past: [],
  future: [],
  group: null,
  at: 0,
});
export function editHistory(
  history: EditHistory,
  next: Site,
  group?: string,
  now = Date.now(),
): EditHistory {
  if (
    next === history.present ||
    JSON.stringify(next) === JSON.stringify(history.present)
  )
    return history;
  const merge = !!group && group === history.group && now - history.at < 1200;
  return {
    present: next,
    past: merge ? history.past : [...history.past.slice(-99), history.present],
    future: [],
    group: group ?? null,
    at: now,
  };
}
export function undoHistory(h: EditHistory): EditHistory {
  const previous = h.past.at(-1);
  return previous
    ? {
        present: previous,
        past: h.past.slice(0, -1),
        future: [h.present, ...h.future],
        group: null,
        at: 0,
      }
    : h;
}
export function redoHistory(h: EditHistory): EditHistory {
  const next = h.future[0];
  return next
    ? {
        present: next,
        past: [...h.past, h.present],
        future: h.future.slice(1),
        group: null,
        at: 0,
      }
    : h;
}
