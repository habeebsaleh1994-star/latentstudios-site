import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import type { Page } from "./model";
import type { EditingState } from "./editing";
import { orderedSections } from "./compositionOrder";
import { planWorkDrop, type WorkDrop } from "./workDrop";
import { uid } from "./ids";

type Drag = {
  ids: string[];
  origin: string;
  target: WorkDrop | null;
  keyboard: boolean;
  x: number;
  y: number;
  proposalId: string;
};
export function useCanvasWorkDrag(
  page: Page,
  root: RefObject<HTMLDivElement | null>,
  mobile: boolean,
  editor: EditingState | null,
) {
  const [drag, setDrag] = useState<Drag | null>(null),
    current = useRef<Drag | null>(null);
  const [message, setMessage] = useState("");
  const [undoTarget, setUndoTarget] = useState<string | null>(null);
  const active = !!editor?.arrange;
  const set = useCallback((value: Drag | null) => {
    current.current = value;
    setDrag(value);
  }, []);
  const cancel = useCallback(() => {
    if (current.current)
      setMessage("Move cancelled. Your draft and selection are unchanged.");
    set(null);
  }, [set]);
  useEffect(() => {
    set(null);
    const win = root.current?.ownerDocument.defaultView;
    if (!win || !active) return;
    const key = (e: globalThis.KeyboardEvent) => {
      if (
        current.current &&
        (e.key === "Escape" ||
          ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z"))
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        cancel();
      }
    };
    win.addEventListener("keydown", key, true);
    win.addEventListener("blur", cancel);
    win.addEventListener("resize", cancel);
    return () => {
      win.removeEventListener("keydown", key, true);
      win.removeEventListener("blur", cancel);
      win.removeEventListener("resize", cancel);
      current.current = null;
    };
  }, [root, active, mobile, page.id, page.composition, cancel, set]);
  const targetAt = useCallback(
    (x: number, y: number): WorkDrop | null => {
      const elements = [
        ...(root.current?.querySelectorAll<HTMLElement>(
          ":scope > .composition-section",
        ) ?? []),
      ];
      const bounds = root.current?.getBoundingClientRect();
      if (bounds && (x < bounds.left - 16 || x > bounds.right + 16))
        return null;
      for (const el of elements) {
        const r = el.getBoundingClientRect(),
          edge = Math.min(56, r.height * 0.2);
        if (y < r.top + edge)
          return { kind: "between", beforeId: el.dataset.sectionId! };
        if (y < r.bottom - edge && x >= r.left - 12 && x <= r.right + 12)
          return { kind: "into", sectionId: el.dataset.sectionId! };
        if (y < r.bottom) continue;
      }
      return elements.length ? { kind: "between", beforeId: null } : null;
    },
    [root],
  );
  const pointerDragging = !!drag && !drag.keyboard;
  useEffect(() => {
    const win = root.current?.ownerDocument.defaultView;
    if (!win || !pointerDragging) return;
    let frame = 0;
    const tick = () => {
      const g = current.current;
      if (g && !g.keyboard) {
        const speed =
          g.y < 64
            ? -Math.min(16, (64 - g.y) / 4)
            : g.y > win.innerHeight - 64
              ? Math.min(16, (g.y - win.innerHeight + 64) / 4)
              : 0;
        if (speed) {
          win.scrollBy(0, speed);
          set({ ...g, target: targetAt(g.x, g.y) });
        }
      }
      frame = win.requestAnimationFrame(tick);
    };
    frame = win.requestAnimationFrame(tick);
    return () => win.cancelAnimationFrame(frame);
  }, [pointerDragging, root, targetAt, set]);
  function start(origin: string, keyboard: boolean, x = 0, y = 0) {
    const ids = [...(editor?.arrange?.workIds ?? [])];
    if (!ids.includes(origin)) return;
    editor?.finish();
    const owner = (
      page.composition ? orderedSections(page.composition, mobile) : []
    ).find((s) => s.blockIds.includes(origin));
    setMessage("");
    setUndoTarget(null);
    set({
      ids,
      origin,
      keyboard,
      x,
      y,
      target: keyboard && owner ? { kind: "into", sectionId: owner.id } : null,
      proposalId: uid(),
    });
  }
  function commit() {
    const g = current.current;
    if (!g || !editor?.arrange) return;
    set(null);
    if (!g.target) {
      setMessage(
        "Choose a section centre to group, or a space between sections to move.",
      );
      return;
    }
    const plan = planWorkDrop(page, g.ids, g.target, mobile, g.proposalId);
    if (!plan.ok) {
      setMessage(plan.reason);
      return;
    }
    if (plan.review) {
      editor.arrange.reviewGrouping(plan.ids);
      return;
    }
    editor.arrange.change(page.id, (p) => {
      const latest = planWorkDrop(p, g.ids, g.target!, mobile, g.proposalId);
      return latest.ok && !latest.review ? latest.page : p;
    });
    setUndoTarget(JSON.stringify(plan.page));
    setMessage(`${plan.label}. Undo is available.`);
    root.current?.ownerDocument.defaultView?.requestAnimationFrame(() => {
      const handle = [
        ...(root.current?.querySelectorAll<HTMLButtonElement>(
          "[data-work-drag]",
        ) ?? []),
      ].find((el) => el.dataset.workDrag === g.origin);
      handle?.focus({ preventScroll: true });
    });
  }
  function key(e: KeyboardEvent<HTMLButtonElement>, id: string) {
    if ([" ", "Enter"].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      if (current.current) commit();
      else start(id, true);
      return;
    }
    if (
      !current.current?.keyboard ||
      ![
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
      ].includes(e.key)
    )
      return;
    e.preventDefault();
    e.stopPropagation();
    const g = current.current;
    const slots: WorkDrop[] = orderedSections(
      page.composition!,
      mobile,
    ).flatMap((s) => [
      { kind: "between" as const, beforeId: s.id },
      { kind: "into" as const, sectionId: s.id },
    ]);
    slots.push({ kind: "between", beforeId: null });
    const index = slots.findIndex(
      (t) => JSON.stringify(t) === JSON.stringify(g.target),
    );
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? slots.length - 1
          : Math.max(
              0,
              Math.min(
                slots.length - 1,
                index + (["ArrowUp", "ArrowLeft"].includes(e.key) ? -1 : 1),
              ),
            );
    set({ ...g, target: slots[next] });
    const t = slots[next],
      targetId = t.kind === "into" ? t.sectionId : t.beforeId;
    const destination = [
      ...(root.current?.querySelectorAll<HTMLElement>("[data-section-id]") ??
        []),
    ].find((el) => el.dataset.sectionId === targetId);
    const win = root.current?.ownerDocument.defaultView;
    if (destination && win) {
      const bounds = destination.getBoundingClientRect();
      win.scrollBy(
        0,
        bounds.top +
          Math.min(bounds.height / 2, win.innerHeight / 2) -
          win.innerHeight / 2,
      );
    }
  }
  const plan = drag?.target
    ? planWorkDrop(page, drag.ids, drag.target, mobile, drag.proposalId)
    : null;
  const feedback = drag
    ? plan
      ? plan.ok
        ? plan.label
        : plan.reason
      : "Drag to a section centre to group, or its edge to place between sections."
    : message;
  return {
    drag,
    feedback,
    valid: plan?.ok ?? false,
    target: drag?.target,
    clear: () => setMessage(""),
    cancel,
    canUndo: !!undoTarget && undoTarget === JSON.stringify(page),
    undo: () => {
      if (undoTarget === JSON.stringify(page)) editor?.undo();
      setUndoTarget(null);
      setMessage("Move undone.");
    },
    handle: (id: string) => ({
      "data-work-drag": id,
      "aria-pressed": drag?.origin === id,
      onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        // Route Escape to the canvas that owns the gesture, even after toolbar Undo.
        e.currentTarget.focus({ preventScroll: true });
        e.currentTarget.setPointerCapture(e.pointerId);
        start(id, false, e.clientX, e.clientY);
      },
      onPointerMove: (e: PointerEvent<HTMLButtonElement>) => {
        const g = current.current;
        if (!g || g.keyboard) return;
        e.preventDefault();
        e.stopPropagation();
        set({
          ...g,
          x: e.clientX,
          y: e.clientY,
          target: targetAt(e.clientX, e.clientY),
        });
      },
      onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (current.current && !current.current.keyboard) commit();
      },
      onPointerCancel: cancel,
      onLostPointerCapture: () => {
        if (current.current && !current.current.keyboard) cancel();
      },
      onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => key(e, id),
      onBlur: () => {
        if (current.current?.keyboard) cancel();
      },
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
      },
    }),
  };
}
