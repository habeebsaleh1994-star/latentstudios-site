import { createPortal } from "react-dom";
import { WorkSettings } from "./WorkSettings";
import { useReadability } from "./readability";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as Pointer,
  type KeyboardEvent as Key,
} from "react";
import type { CompositionSection, Page, SpatialFrame } from "./model";
import { useEditing } from "./editing";
import { CompositionWork } from "./CompositionWork";
import { patchSection } from "./composition";
import {
  boundFrame,
  resizeFrame,
  patchFrame,
  snapFrame,
  clamp,
  round,
  type SpatialGuide,
} from "./spatial";
import { workLabel } from "./workLabels";
type Kind = "move" | "width" | "height";
type Gesture = {
  id: string;
  kind: Kind;
  start: SpatialFrame;
  frame: SpatialFrame;
  startX: number;
  startY: number;
  width: number;
  top: number;
  left: number;
  offsetX: number;
  offsetY: number;
  minHeight: number;
  startHeight: number;
  keyboard: boolean;
  guides: SpatialGuide[];
};
export function SpatialSection({
  page,
  section: s,
  mobile,
}: {
  page: Page;
  section: CompositionSection;
  mobile: boolean;
}) {
  const editor = useEditing(),
    active = !!editor?.arrange,
    stage = useRef<HTMLDivElement>(null);
  const [snaps, setSnaps] = useState(true),
    [gesture, setGesture] = useState<Gesture | null>(null),
    [message, setMessage] = useState("");
  const revealId = editor?.arrange?.revealWorkId;
  const cancelReveal = useRef(editor?.arrange?.cancelReveal);
  cancelReveal.current = editor?.arrange?.cancelReveal;
  const current = useRef<Gesture | null>(null),
    dragged = useRef(false);
  const layout = s.spatial!,
    chosen =
      editor?.selection && "blockId" in editor.selection
        ? editor.selection.blockId
        : null,
    selected = chosen && s.blockIds.includes(chosen) ? chosen : s.blockIds[0],
    ownsSelection = chosen !== null && s.blockIds.includes(chosen);
  const choose = (id: string) =>
    editor?.select({ kind: "media", pageId: page.id, blockId: id });
  const notes = useReadability(stage, s, active);
  const frames = layout.frames.map((f) =>
      gesture?.id === f.blockId ? gesture.frame : f,
    ),
    frame = frames.find((f) => f.blockId === selected)!;
  void frame;
  const set = (g: Gesture | null) => {
    current.current = g;
    setGesture(g);
  };
  const change = (fn: (s: CompositionSection) => CompositionSection) =>
    editor?.arrange?.change(page.id, (p) => patchSection(p, s.id, fn, mobile));
  useEffect(() => {
    current.current = null;
    setGesture(null);
    const win = stage.current?.ownerDocument.defaultView;
    if (!win || !active) return;
    const cancel = () => {
      current.current = null;
      setGesture(null);
    };
    const key = (e: KeyboardEvent) => {
      if (
        (current.current || (revealId && e.key === "Escape")) &&
        (e.key === "Escape" ||
          ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z"))
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        cancel();
        cancelReveal.current?.();
        setMessage("Placement cancelled.");
      }
    };
    const outer = win.frameElement?.ownerDocument.defaultView;
    outer?.addEventListener("keydown", key, true);
    outer?.addEventListener("resize", cancel);
    win.addEventListener("keydown", key, true);
    win.addEventListener("blur", cancel);
    win.addEventListener("resize", cancel);
    return () => {
      outer?.removeEventListener("keydown", key, true);
      outer?.removeEventListener("resize", cancel);
      win.removeEventListener("keydown", key, true);
      win.removeEventListener("blur", cancel);
      win.removeEventListener("resize", cancel);
      current.current = null;
    };
  }, [active, mobile, page.id, s.spatial, revealId]);
  function start(id: string, kind: Kind, x = 0, y = 0, keyboard = false) {
    const box = stage.current!.getBoundingClientRect(),
      f = layout.frames.find((f) => f.blockId === id)!;
    choose(id);

    const g: Gesture = {
      id,
      kind,
      start: f,
      frame: f,
      startX: x,
      startY: y,
      width: box.width,
      top: box.top,
      left: box.left,
      offsetX: x - box.left - (f.x * box.width) / 100,
      offsetY: y - box.top - f.y,
      minHeight: kind === "height" ? box.height : layout.minHeight,
      startHeight: box.height,
      keyboard,
      guides: [],
    };
    set(g);
    return g;
  }
  function finish() {
    const g = current.current;
    if (!g) return;
    set(null);
    if (g.kind === "height")
      change((s) => ({
        ...s,
        spatial: { ...s.spatial!, minHeight: g.minHeight },
      }));
    else change((s) => patchFrame(s, g.id, () => g.frame));
    setMessage("Placement saved. Reading order, crop and typography retained.");
  }
  function coordinates(e: Pointer<HTMLElement>) {
    const doc = stage.current!.ownerDocument;
    if (e.currentTarget.ownerDocument === doc)
      return { x: e.clientX, y: e.clientY };
    const frame = doc.defaultView!.frameElement as HTMLIFrameElement;
    const box = frame.getBoundingClientRect(),
      scale = box.width / doc.defaultView!.innerWidth;
    return {
      x: (e.clientX - box.left) / scale,
      y: (e.clientY - box.top) / scale,
    };
  }
  function move(e: Pointer<HTMLElement>) {
    const g = current.current;
    if (!g || g.keyboard || !stage.current) return;
    const { x, y } = coordinates(e);
    e.preventDefault();
    e.stopPropagation();
    if (Math.abs(x - g.startX) + Math.abs(y - g.startY) > 2)
      dragged.current = true;
    if (g.kind === "height") {
      set({
        ...g,
        minHeight: Math.round(clamp(g.startHeight + y - g.startY, 0, 100000)),
      });
      return;
    }
    const box = stage.current!.getBoundingClientRect();
    let next =
      g.kind === "width"
        ? resizeFrame(g.start, g.start.width + ((x - g.startX) * 100) / g.width)
        : boundFrame({
            ...g.start,
            x: ((x - box.left - g.offsetX) * 100) / g.width,
            y: y - box.top - g.offsetY,
          });
    let guides: SpatialGuide[] = [];
    if (snaps && !e.altKey) {
      const heights = Object.fromEntries(
        [
          ...stage.current!.querySelectorAll<HTMLElement>(
            ":scope > [data-composition-block]",
          ),
        ].map((el) => [
          el.dataset.compositionBlock!,
          el.getBoundingClientRect().height,
        ]),
      );
      const result = snapFrame(
        next,
        layout.frames.filter((f) => f.blockId !== g.id),
        g.width,
        heights,
        g.kind === "width",
      );
      next = result.frame;
      guides = result.guides;
    }
    set({ ...g, frame: next, guides });
  }
  function key(e: Key<HTMLElement>, id: string, kind: Kind) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      choose(id);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      set(null);
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))
      return;
    e.preventDefault();
    e.stopPropagation();
    const g = current.current ?? start(id, kind, 0, 0, true),
      step = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
    const sign = ["ArrowLeft", "ArrowUp"].includes(e.key) ? -1 : 1;
    if (kind === "height")
      set({
        ...g,
        minHeight: round(clamp(g.minHeight + sign * step, 0, 100000)),
      });
    else if (kind === "width")
      set({
        ...g,
        frame: resizeFrame(
          g.frame,
          g.frame.width + (sign * step * 100) / g.width,
        ),
      });
    else
      set({
        ...g,
        frame: boundFrame({
          ...g.frame,
          ...(["ArrowLeft", "ArrowRight"].includes(e.key)
            ? { x: g.frame.x + (sign * step * 100) / g.width }
            : { y: g.frame.y + sign * step }),
        }),
      });
  }
  const handle = (id: string, kind: Kind) => ({
    "data-spatial-action": kind,
    onFocus: () => choose(id),
    onPointerDown: (e: Pointer<HTMLElement>) => {
      if (!active || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.focus({ preventScroll: true });
      e.currentTarget.setPointerCapture(e.pointerId);
      dragged.current = false;
      const point = coordinates(e);
      start(id, kind, point.x, point.y);
    },
    onPointerMove: move,
    onPointerUp: (e: Pointer<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (current.current && !current.current.keyboard) finish();
    },
    onPointerCancel: () => set(null),
    onLostPointerCapture: () => {
      if (current.current && !current.current.keyboard) set(null);
    },
    onKeyDown: (e: Key<HTMLElement>) => key(e, id, kind),
    onKeyUp: (e: Key<HTMLElement>) => {
      if (current.current?.keyboard && e.key.startsWith("Arrow")) {
        e.preventDefault();
        e.stopPropagation();
        finish();
      }
    },
    onBlur: () => {
      if (current.current?.keyboard) set(null);
    },
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      if (dragged.current) e.preventDefault();
      choose(id);
    },
  });
  return (
    <>
      {active &&
        ownsSelection &&
        editor?.arrange?.controlsHost &&
        createPortal(
          <div
            className="spatial-context-controls"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="work-actions spatial-actions">
              <button
                {...handle(selected, "move")}
                aria-label="Move selected work"
                title="Drag or use arrows. Shift 10px; Option/Alt 0.1px."
              >
                ✥ Move
              </button>
              <button
                {...handle(selected, "width")}
                aria-label="Resize selected work width"
                title="Drag or use arrows. Height follows the work."
              >
                ↔ Size
              </button>
              <span className="work-scope">
                This work · {mobile ? "Phone" : "Desktop"} only
              </span>
            </div>
            <WorkSettings
              page={page}
              section={s}
              id={selected}
              mobile={mobile}
              change={(fn) => editor.arrange?.change(page.id, fn)}
              choose={editor.arrange.locateWork ?? choose}
              previewFlow={() => editor.arrange?.previewFlow(s.id, mobile)}
              snaps={snaps}
              setSnaps={setSnaps}
              notes={notes}
              roomBelow={
                <button
                  {...handle(selected, "height")}
                  aria-label="Adjust section minimum height"
                >
                  ↕ Room below
                </button>
              }
            />
            <span className="canvas-sr-only" aria-live="polite">
              {message}
            </span>
          </div>,
          editor.arrange.controlsHost,
        )}
      <div
        ref={stage}
        className="composition-grid spatial-stage"
        data-spatial-stage={s.id}
        data-spatial-device={mobile ? "mobile" : "desktop"}
        style={{
          minHeight:
            gesture?.kind === "height" ? gesture.minHeight : layout.minHeight,
        }}
      >
        {s.blockIds.map((id) => {
          const b = page.blocks.find((b) => b.id === id)!,
            f = frames.find((f) => f.blockId === id)!;
          return (
            <div
              key={id}
              className={`composition-work spatial-work work-${b.type} fit-${b.fit} placement-${b.width}`}
              data-composition-block={id}
              data-spatial-selected={
                (active && ownsSelection && selected === id) || undefined
              }
              data-preview-reveal={
                (active && editor?.arrange?.revealWorkId === id) || undefined
              }
              data-layer={layout.layers.indexOf(id) + 1}
              style={{
                width: `${f.width}%`,
                marginLeft: `${f.x}%`,
                marginTop: f.y,
                zIndex:
                  active && editor?.arrange?.revealWorkId === id
                    ? 50
                    : layout.layers.indexOf(id) + 1,
              }}
              {...(active ? handle(id, "move") : {})}
              tabIndex={active ? 0 : undefined}
              role={active ? "group" : undefined}
              aria-label={active ? `Place ${workLabel(b)}` : undefined}
            >
              <CompositionWork
                block={b}
                pageId={page.id}
                caption={s.captions?.find((c) => c.blockId === id)}
              />
              {active && ownsSelection && selected === id && (
                <button
                  className="spatial-direct-size"
                  {...handle(id, "width")}
                  aria-label="Resize this work"
                >
                  ↔
                </button>
              )}
            </div>
          );
        })}
        {active &&
          editor?.arrange?.guides &&
          gesture?.guides.map((g, i) => (
            <i
              key={i}
              className={`spatial-guide axis-${g.axis}`}
              aria-hidden="true"
              style={g.axis === "x" ? { left: `${g.at}%` } : { top: g.at }}
            >
              <span>{g.label}</span>
            </i>
          ))}
      </div>
    </>
  );
}
