export type PreviewPosition = {
  blockId: string | null;
  fraction: number;
  pageFraction: number;
};
export const startPosition: PreviewPosition = {
  blockId: null,
  fraction: 0,
  pageFraction: 0,
};
export function readPreviewPosition(doc: Document): PreviewPosition {
  const win = doc.defaultView;
  if (!win) return startPosition;
  const candidates = [
    ...doc.querySelectorAll<HTMLElement>("[data-composition-block]"),
  ];
  const block = candidates.find((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 1 && r.top < win.innerHeight;
  });
  const bounds = block?.getBoundingClientRect();
  return {
    blockId: block?.dataset.compositionBlock ?? null,
    fraction: bounds ? -bounds.top / Math.max(1, bounds.height) : 0,
    pageFraction:
      win.scrollY /
      Math.max(1, doc.documentElement.scrollHeight - win.innerHeight),
  };
}
export function placePreviewPosition(doc: Document, position: PreviewPosition) {
  const win = doc.defaultView;
  if (!win) return 0;
  const block = [
    ...doc.querySelectorAll<HTMLElement>("[data-composition-block]"),
  ].find((el) => el.dataset.compositionBlock === position.blockId);
  const bounds = block?.getBoundingClientRect();
  const y = bounds
    ? win.scrollY + bounds.top + position.fraction * bounds.height
    : position.pageFraction *
      (doc.documentElement.scrollHeight - win.innerHeight);
  win.scrollTo({ left: win.scrollX, top: Math.max(0, y), behavior: "instant" });
  return win.scrollY;
}
