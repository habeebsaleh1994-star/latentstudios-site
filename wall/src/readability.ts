import { useLayoutEffect, useState, type RefObject } from "react";
import type { CompositionSection } from "./model";
export type ReadabilityNote = {
  blockId: string;
  kind: "occlusion" | "backdrop" | "small";
  message: string;
};
export type Rect = { left: number; right: number; top: number; bottom: number };
export const intersects = (a: Rect, b: Rect) =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
  Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
/** Geometric evidence only: image transparency and actual glyph contrast are unknown. */
export function measureReadability(
  stage: HTMLElement,
  s: CompositionSection,
): ReadabilityNote[] {
  const works = [
    ...stage.querySelectorAll<HTMLElement>(":scope > [data-composition-block]"),
  ];
  const media = works.map((el) => ({
    id: el.dataset.compositionBlock!,
    rect: el.querySelector(".composition-media")?.getBoundingClientRect(),
  }));
  const notes: ReadabilityNote[] = [];
  const layer = (id: string) =>
    s.spatial?.enabled ? s.spatial.layers.indexOf(id) : 0;
  for (const el of works) {
    const id = el.dataset.compositionBlock!,
      caption = el.querySelector<HTMLElement>("figcaption"),
      writing = el.querySelector<HTMLElement>(".direction-prose");
    const target = caption ?? writing;
    if (!target?.textContent?.trim()) continue;
    const doc = el.ownerDocument,
      walker = doc.createTreeWalker(target, 4),
      rects: Rect[] = [];
    while (walker.nextNode()) {
      const range = doc.createRange();
      range.selectNodeContents(walker.currentNode);
      rects.push(...range.getClientRects());
    }
    const overlaps = media.filter(
      (m) => m.id !== id && m.rect && rects.some((r) => intersects(r, m.rect!)),
    );
    if (overlaps.some((m) => layer(m.id) > layer(id)))
      notes.push({
        blockId: id,
        kind: "occlusion",
        message: `${caption ? "Caption" : "Writing"} may be covered by a higher layer at this width.`,
      });
    else if (
      caption &&
      overlaps.length &&
      (!s.captions?.find((c) => c.blockId === id)?.backing ||
        s.captions?.find((c) => c.blockId === id)?.backing === "none")
    )
      notes.push({
        blockId: id,
        kind: "backdrop",
        message:
          "Caption lies over another work; a backing may improve contrast.",
      });
    const size = parseFloat(doc.defaultView!.getComputedStyle(target).fontSize);
    if (caption && size < 12)
      notes.push({
        blockId: id,
        kind: "small",
        message: `Caption is ${Math.round(size * 10) / 10}px at this viewport. A larger size may help.`,
      });
  }
  return notes;
}
export function useReadability(
  stage: RefObject<HTMLDivElement | null>,
  s: CompositionSection,
  active: boolean,
) {
  const [notes, setNotes] = useState<ReadabilityNote[]>([]);
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el || !active) return;
    const win = el.ownerDocument.defaultView;
    if (!win || !el.isConnected) return;
    let raf = 0;
    const measure = () => {
      win.cancelAnimationFrame(raf);
      raf = win.requestAnimationFrame(() => {
        const next = measureReadability(el, s);
        setNotes((old) =>
          JSON.stringify(old) === JSON.stringify(next) ? old : next,
        );
      });
    };
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    [...el.children].forEach((w) => resize.observe(w));
    const mutation = new MutationObserver(measure);
    mutation.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    el.addEventListener("load", measure, true);
    el.addEventListener("loadedmetadata", measure, true);
    win.addEventListener("resize", measure);
    measure();
    return () => {
      win.cancelAnimationFrame(raf);
      resize.disconnect();
      mutation.disconnect();
      el.removeEventListener("load", measure, true);
      el.removeEventListener("loadedmetadata", measure, true);
      win.removeEventListener("resize", measure);
    };
  }, [stage, s, active]);
  return notes;
}
