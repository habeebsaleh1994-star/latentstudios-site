import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { CompositionSection, Page } from "./model";
import { moveSection, orderedSections, patchSection } from "./composition";
import {
  resizeSection,
  widthPercent,
  ratioSection,
  columnRatio,
} from "./compositionStudies";
import type { EditingState } from "./editing";

type Kind = "move" | "width" | "space" | "ratio";
type Gesture = {
  id: string;
  kind: Kind;
  section: CompositionSection;
  preview: CompositionSection;
  startX: number;
  startY: number;
  y: number;
  rootWidth: number;
  to: number;
  keyboard: boolean;
};
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export function useCanvasArrangement(
  page: Page,
  root: RefObject<HTMLDivElement | null>,
  mobile: boolean,
  editor: EditingState | null,
) {
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const current = useRef<Gesture | null>(null);
  const [announcement, announce] = useState("");
  const [guide, setGuide] = useState<number | null>(null);
  const active = !!editor?.arrange;
  const order = page.composition
    ? orderedSections(page.composition, mobile)
    : [];
  const set = useCallback((g: Gesture | null) => {
    current.current = g;
    setGesture(g);
    if (!g) setGuide(null);
  }, []);
  const cancel = () => {
    if (current.current)
      announce("Arrangement cancelled. Your draft is unchanged.");
    set(null);
  };
  const position = useCallback(
    (g: Gesture) => {
      const element = root.current;
      if (!element) return g;
      const boxes = [
        ...element.querySelectorAll<HTMLElement>(
          ":scope > .composition-section",
        ),
      ].filter((el) => el.dataset.sectionId !== g.id);
      const index = boxes.findIndex((el) => {
        const r = el.getBoundingClientRect();
        return g.y < r.top + r.height / 2;
      });
      const to = index < 0 ? boxes.length : index;
      const edge =
        boxes[to]?.getBoundingClientRect().top ??
        boxes.at(-1)?.getBoundingClientRect().bottom ??
        element.getBoundingClientRect().top;
      setGuide(edge - element.getBoundingClientRect().top - 12);
      return { ...g, to };
    },
    [root],
  );
  const clearWorks = editor?.arrange?.clearWorks;
  const undo = editor?.undo,
    redo = editor?.redo;
  useEffect(() => {
    set(null);
    const win = root.current?.ownerDocument.defaultView;
    if (!win || !active) return;
    const escape = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.stopPropagation();
        if (current.current) {
          set(null);
          announce("Arrangement cancelled. Your draft is unchanged.");
        } else if (event.shiftKey) redo?.();
        else undo?.();
        return;
      }
      if (event.key === "Escape" && !current.current) {
        clearWorks?.();
        return;
      }
      if (event.key === "Escape" && current.current) {
        event.preventDefault();
        event.stopPropagation();
        current.current = null;
        setGesture(null);
        setGuide(null);
        announce("Arrangement cancelled. Your draft is unchanged.");
      }
    };
    const blur = () => {
      current.current = null;
      setGesture(null);
      setGuide(null);
    };
    win.addEventListener("keydown", escape);
    win.addEventListener("blur", blur);
    win.addEventListener("resize", blur);
    return () => {
      win.removeEventListener("keydown", escape);
      win.removeEventListener("blur", blur);
      win.removeEventListener("resize", blur);
      current.current = null;
    };
  }, [
    active,
    mobile,
    page.id,
    page.composition,
    root,
    set,
    undo,
    redo,
    clearWorks,
  ]);
  const dragging = gesture?.kind === "move" && !gesture.keyboard;
  useEffect(() => {
    const win = root.current?.ownerDocument.defaultView;
    if (!win || !dragging) return;
    let frame = 0;
    const tick = () => {
      const g = current.current;
      if (g?.kind === "move" && !g.keyboard) {
        const speed =
          g.y < 70
            ? -Math.min(18, (70 - g.y) / 4)
            : g.y > win.innerHeight - 70
              ? Math.min(18, (g.y - win.innerHeight + 70) / 4)
              : 0;
        if (speed) {
          win.scrollBy(0, speed);
          set(position(g));
        }
      }
      frame = win.requestAnimationFrame(tick);
    };
    frame = win.requestAnimationFrame(tick);
    return () => win.cancelAnimationFrame(frame);
  }, [dragging, root, position, set]);
  function commit() {
    const g = current.current;
    if (!g || !editor?.arrange) return;
    set(null);
    editor.arrange.change(page.id, (p) => {
      if (g.kind === "move") {
        if (!p.composition) return p;
        const from = orderedSections(p.composition!, mobile).findIndex(
          (s) => s.id === g.id,
        );
        return moveSection(p, g.id, g.to - from, mobile);
      }
      return patchSection(
        p,
        g.id,
        (s) =>
          g.kind === "width"
            ? { ...s, widthPercent: g.preview.widthPercent }
            : g.kind === "ratio"
              ? { ...s, columnRatio: g.preview.columnRatio }
              : { ...s, space: g.preview.space },
        mobile,
      );
    });
    announce(
      g.kind === "move"
        ? `Section placed at ${g.to + 1}. ${mobile ? "Mobile order only." : "Desktop order updated."}`
        : `${g.kind === "width" ? "Width" : g.kind === "ratio" ? "Column ratio" : "Space"} set. Crop and focal point retained.`,
    );
    const action = g.kind,
      id = g.id;
    root.current?.ownerDocument.defaultView?.requestAnimationFrame(() => {
      const handle = [
        ...(root.current?.querySelectorAll<HTMLButtonElement>(
          "[data-canvas-action]",
        ) ?? []),
      ].find(
        (el) =>
          el.dataset.canvasSection === id && el.dataset.canvasAction === action,
      );
      handle?.focus({ preventScroll: true });
    });
  }
  function start(
    section: CompositionSection,
    kind: Kind,
    x = 0,
    y = 0,
    keyboard = false,
  ) {
    editor?.select({ kind: "section", pageId: page.id, sectionId: section.id });
    const g: Gesture = {
      id: section.id,
      kind,
      section,
      preview: section,
      startX: x,
      startY: y,
      y,
      rootWidth: root.current?.getBoundingClientRect().width || 1,
      to: order.findIndex((s) => s.id === section.id),
      keyboard,
    };
    set(g);
    return g;
  }
  function pointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    section: CompositionSection,
    kind: Kind,
  ) {
    if (event.button !== 0 || !active) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    start(section, kind, event.clientX, event.clientY);
  }
  function pointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const g = current.current;
    if (!g || g.keyboard) return;
    event.preventDefault();
    if (g.kind === "move") {
      set(position({ ...g, y: event.clientY }));
      return;
    }
    const delta = event.clientX - g.startX;
    const percent =
      widthPercent(g.section) +
      (delta / g.rootWidth) *
        100 *
        (g.section.align === "center"
          ? 2
          : g.section.align === "right"
            ? -1
            : 1);
    const space = clamp(
      Math.round((g.section.space + event.clientY - g.startY) / 4) * 4,
      0,
      mobile ? 120 : 180,
    );
    set({
      ...g,
      preview:
        g.kind === "width"
          ? resizeSection(g.section, percent)
          : g.kind === "ratio"
            ? ratioSection(
                g.section,
                columnRatio(g.section) +
                  (delta /
                    Math.max(
                      1,
                      (g.rootWidth * widthPercent(g.section)) / 100 -
                        g.section.gap,
                    )) *
                    100,
              )
            : { ...g.section, space },
    });
  }
  function keyboard(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    section: CompositionSection,
    kind: Kind,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel();
      return;
    }
    if (kind === "move") {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        if (current.current) commit();
        else {
          start(section, kind, 0, 0, true);
          announce(
            "Section picked up. Arrow keys move; Enter places; Escape cancels.",
          );
        }
        return;
      }
      if (
        current.current?.kind === "move" &&
        ["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)
      ) {
        event.preventDefault();
        event.stopPropagation();
        const to =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? order.length - 1
              : clamp(
                  current.current.to + (event.key === "ArrowUp" ? -1 : 1),
                  0,
                  order.length - 1,
                );
        set({ ...current.current, to });
        announce(
          `Position ${to + 1} of ${order.length}. Press Enter to place.`,
        );
      }
      return;
    }
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(event.key)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const g = current.current ?? start(section, kind, 0, 0, true),
      right = event.key === "ArrowRight" || event.key === "ArrowDown";
    const n =
      kind === "width"
        ? widthPercent(g.preview)
        : kind === "ratio"
          ? columnRatio(g.preview)
          : g.preview.space;
    const low = kind === "width" ? 25 : kind === "ratio" ? 20 : 0,
      high =
        kind === "width" ? 100 : kind === "ratio" ? 80 : mobile ? 120 : 180;
    const precision =
      kind === "space"
        ? event.altKey
          ? 1
          : event.shiftKey
            ? 16
            : 4
        : event.altKey
          ? 0.1
          : event.shiftKey
            ? 5
            : 1;
    const next =
      event.key === "Home"
        ? low
        : event.key === "End"
          ? high
          : n + (right ? 1 : -1) * precision;
    set({
      ...g,
      preview:
        kind === "width"
          ? resizeSection(g.preview, next)
          : kind === "ratio"
            ? ratioSection(g.preview, next)
            : { ...g.preview, space: clamp(next, low, high) },
    });
  }
  const handle = (section: CompositionSection, kind: Kind) => ({
    "data-canvas-action": kind,
    "data-canvas-section": section.id,
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) =>
      pointerDown(e, section, kind),
    onPointerMove: pointerMove,
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (current.current && !current.current.keyboard) commit();
    },
    onPointerCancel: cancel,
    onLostPointerCapture: () => {
      if (current.current && !current.current.keyboard) cancel();
    },
    onKeyDown: (e: ReactKeyboardEvent<HTMLButtonElement>) =>
      keyboard(e, section, kind),
    onKeyUp: (e: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (
        kind !== "move" &&
        current.current?.keyboard &&
        [
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
        ].includes(e.key)
      ) {
        e.preventDefault();
        commit();
      }
    },
    onBlur: () => {
      if (current.current?.keyboard) cancel();
    },
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
  });
  return {
    active,
    gesture,
    guide,
    announcement,
    handle,
    present: (s: CompositionSection) =>
      gesture?.id === s.id ? gesture.preview : s,
  };
}
