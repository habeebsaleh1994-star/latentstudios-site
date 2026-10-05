import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Page } from "./model";
import { orderedSections, sectionBlocks } from "./composition";
import { useEditing } from "./editing";
import { useCanvasArrangement } from "./CanvasArrangement";
import { useCanvasWorkDrag } from "./CanvasWorkDrag";
import { widthPercent, columnRatio } from "./compositionStudies";
import { workLabel } from "./workLabels";
import { CompositionWork } from "./CompositionWork";
import { SpatialSection } from "./SpatialSection";
import { measureSpatial } from "./spatial";
import { patchSection } from "./composition";
/** Uses the preview's own viewport; DOM order follows the authored mobile sequence. */
export function CompositionSections({
  page,
  mobileOverride,
}: {
  page: Page;
  mobileOverride?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null),
    editor = useEditing();
  const [viewportMobile, setMobile] = useState(false);
  const [placementError, setPlacementError] = useState("");
  useLayoutEffect(() => {
    const media =
      root.current?.ownerDocument.defaultView?.matchMedia("(max-width: 640px)");
    if (!media) return;
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const mobile = mobileOverride ?? viewportMobile;
  const arrangeActive = !!editor?.arrange;
  const chosen =
    editor?.selection && "blockId" in editor.selection
      ? editor.selection.blockId
      : null;
  const chosenRef = useRef(chosen);
  chosenRef.current = chosen;
  const locateRequest = editor?.arrange?.locateRequest;
  useLayoutEffect(() => {
    const chosen = chosenRef.current;
    if (!arrangeActive || !chosen) return;
    const node = [
      ...(root.current?.querySelectorAll<HTMLElement>(
        "[data-composition-block]",
      ) ?? []),
    ].find((el) => el.dataset.compositionBlock === chosen);
    const win = node?.ownerDocument.defaultView;
    const raf = win?.requestAnimationFrame(() =>
      node?.scrollIntoView({ block: "center", inline: "nearest" }),
    );
    return () => {
      if (raf) win?.cancelAnimationFrame(raf);
    };
  }, [locateRequest, mobile, arrangeActive]);
  const canvas = useCanvasArrangement(page, root, mobile, editor);
  const workDrag = useCanvasWorkDrag(page, root, mobile, editor);
  const c = page.composition;
  if (!c) return null;
  return (
    <div
      ref={root}
      className="composition-sequence"
      data-canvas-arrange={canvas.active || undefined}
      data-work-dragging={!!workDrag.drag || undefined}
      onDragStart={canvas.active ? (e) => e.preventDefault() : undefined}
      data-arranged-page={page.id}
      data-layout-viewport={mobile ? "mobile" : "desktop"}
      onClickCapture={
        workDrag.drag
          ? (e) => {
              if ((e.target as HTMLElement).closest("[data-canvas-cancel]"))
                return;
              e.preventDefault();
              e.stopPropagation();
            }
          : undefined
      }
    >
      {placementError && (
        <p className="spatial-error" role="alert">
          {placementError}
        </p>
      )}
      {orderedSections(c, mobile).map((source, index) => {
        const s = canvas.present(source);
        const blocks = sectionBlocks(page, s);
        const selected =
          editor?.selection?.kind === "section" &&
          editor.selection.sectionId === s.id;
        const select = () =>
          editor?.select({ kind: "section", pageId: page.id, sectionId: s.id });
        const width = `${widthPercent(s)}%`;
        const layout = s.layout;
        return (
          <section
            key={s.id}
            className={`composition-section align-${s.align} layout-${layout}`}
            data-section-id={s.id}
            data-spatial-section={s.spatial?.enabled || undefined}
            data-drop-into={
              workDrag.target?.kind === "into" &&
              workDrag.target.sectionId === s.id
                ? workDrag.valid
                  ? "valid"
                  : "blocked"
                : undefined
            }
            data-drop-before={
              workDrag.target?.kind === "between" &&
              workDrag.target.beforeId === s.id
                ? workDrag.valid
                  ? "valid"
                  : "blocked"
                : undefined
            }
            data-selected={
              (selected && (editor?.enabled || canvas.active)) || undefined
            }
            data-gesture={
              canvas.gesture?.id === s.id ? canvas.gesture.kind : undefined
            }
            style={
              {
                "--section-width": width,
                "--section-gap": `${s.gap}px`,
                "--section-space": `${s.space}px`,
                "--section-vertical": s.vertical,
              } as CSSProperties
            }
            aria-label={`Section ${index + 1}`}
            tabIndex={editor?.enabled || canvas.active ? 0 : undefined}
            onClick={(e) => {
              if (
                canvas.active ||
                (editor?.enabled && e.target === e.currentTarget)
              )
                select();
            }}
            onKeyDown={(e) => {
              if (
                e.target !== e.currentTarget ||
                (!editor?.enabled && !canvas.active)
              )
                return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                select();
              }
              if (e.key === "Escape") editor?.select(null);
            }}
          >
            {canvas.active && !s.spatial?.enabled && (
              <>
                <div className="canvas-section-tools">
                  <button
                    className="canvas-lift"
                    {...canvas.handle(source, "move")}
                    aria-label={`Move group ${index + 1}`}
                    aria-pressed={
                      canvas.gesture?.id === s.id &&
                      canvas.gesture.kind === "move"
                    }
                    title="Drag to move. Keyboard: Space to lift, arrows to move, Enter to place."
                  >
                    <span aria-hidden="true">≡</span> Group{" "}
                    {String(index + 1).padStart(2, "0")}
                  </button>
                  <button
                    className="canvas-place"
                    onClick={(e) => {
                      e.stopPropagation();
                      select();
                      editor?.arrange?.clearWorks();
                      if (s.spatial?.enabled) {
                        editor?.arrange?.previewFlow(s.id, mobile);
                        return;
                      }
                      try {
                        const spatial = s.spatial
                          ? { ...s.spatial, enabled: true }
                          : measureSpatial(
                              e.currentTarget.closest("section")!,
                              s.blockIds,
                            );
                        editor?.arrange?.change(page.id, (p) =>
                          patchSection(
                            p,
                            s.id,
                            (old) => ({ ...old, spatial }),
                            mobile,
                          ),
                        );
                        editor?.select({
                          kind: "media",
                          pageId: page.id,
                          blockId: s.blockIds[0],
                        });
                        setPlacementError("");
                      } catch (e) {
                        setPlacementError((e as Error).message);
                      }
                    }}
                  >
                    {s.spatial?.enabled
                      ? "Preview flow ↗"
                      : s.spatial
                        ? "Resume placement"
                        : "Place freely ↗"}
                  </button>
                  {!s.spatial?.enabled && (
                    <button
                      className="canvas-explore"
                      onClick={(e) => {
                        e.stopPropagation();
                        select();
                        editor?.arrange?.explore(s.id);
                      }}
                    >
                      <span className="canvas-explore-label">
                        Try arrangements{" "}
                      </span>
                      ↗
                    </button>
                  )}
                  {!s.spatial?.enabled &&
                    blocks.map((b) => (
                      <span className="canvas-work-tools" key={b.id}>
                        <button
                          className="canvas-work-pick"
                          type="button"
                          role="checkbox"
                          aria-checked={
                            editor?.arrange?.workIds.includes(b.id) ?? false
                          }
                          aria-label={`Select work: ${workLabel(b)}`}
                          data-work-choice={b.id}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            editor?.arrange?.pickWork(b.id, e.shiftKey, mobile);
                            if (editor?.arrange?.controlsHost)
                              editor.select({
                                kind: "media",
                                pageId: page.id,
                                blockId: b.id,
                              });
                          }}
                          onKeyDown={(e) => {
                            if (
                              ![
                                "ArrowLeft",
                                "ArrowRight",
                                "ArrowUp",
                                "ArrowDown",
                              ].includes(e.key)
                            )
                              return;
                            e.preventDefault();
                            e.stopPropagation();
                            const choices = [
                                ...(root.current?.querySelectorAll<HTMLButtonElement>(
                                  "[data-work-choice]",
                                ) ?? []),
                              ],
                              i = choices.indexOf(e.currentTarget),
                              next =
                                choices[
                                  i +
                                    (["ArrowLeft", "ArrowUp"].includes(e.key)
                                      ? -1
                                      : 1)
                                ];
                            next?.focus();
                            if (next && e.shiftKey)
                              editor?.arrange?.pickWork(
                                next.dataset.workChoice!,
                                true,
                                mobile,
                              );
                          }}
                        >
                          <span aria-hidden="true">
                            {editor?.arrange?.workIds.includes(b.id)
                              ? "✓"
                              : "○"}{" "}
                            {page.blocks.findIndex((work) => work.id === b.id) +
                              1}
                          </span>
                        </button>
                        {editor?.arrange?.workIds.includes(b.id) && (
                          <button
                            className="canvas-work-drag"
                            aria-label={`Move work selection from ${workLabel(b)}`}
                            title="Drag selected works: centre to group, edge to reorder. Space to lift, arrows choose a target, Enter places, Escape cancels."
                            {...workDrag.handle(b.id)}
                          >
                            <span aria-hidden="true">↗</span>
                            <span className="work-move-label">Move work</span>
                          </button>
                        )}
                      </span>
                    ))}
                  <button
                    className={`canvas-width-handle edge-${s.align}`}
                    {...canvas.handle(source, "width")}
                    aria-label={`Resize section ${index + 1} width`}
                    title="Drag width. Arrows: 1%; Shift: 5%; Option/Alt: 0.1%. Home: 25%; End: 100%."
                  >
                    <span aria-hidden="true">↔</span>
                    <span className="canvas-measure">{widthPercent(s)}%</span>
                  </button>
                  {!s.spatial?.enabled &&
                    blocks.length > 1 &&
                    layout !== "stack" && (
                      <button
                        className="canvas-ratio-handle"
                        {...canvas.handle(source, "ratio")}
                        aria-label={`Adjust section ${index + 1} column ratio`}
                        title="Drag the column balance. Arrows: 1%; Shift: 5%; Option/Alt: 0.1%."
                      >
                        <span aria-hidden="true">◫</span>
                        <span className="canvas-measure">
                          {columnRatio(s)}:
                          {Math.round((100 - columnRatio(s)) * 10) / 10}
                        </span>
                      </button>
                    )}
                  <button
                    className="canvas-space-handle"
                    {...canvas.handle(source, "space")}
                    aria-label={`Adjust section ${index + 1} space`}
                    title="Drag for space above. Arrow keys: 4px; Shift: 16px."
                  >
                    <span aria-hidden="true">↕</span>
                    <span className="canvas-measure">{s.space}px</span>
                  </button>
                </div>
              </>
            )}
            {editor?.enabled && (
              <button
                className="composition-select"
                aria-pressed={selected}
                onClick={select}
              >
                Arrange section {String(index + 1).padStart(2, "0")}{" "}
                <span>↗</span>
              </button>
            )}
            {editor?.arrange?.guides &&
              canvas.gesture?.kind === "ratio" &&
              canvas.gesture.id === s.id && (
                <div
                  className="canvas-ratio-guide"
                  aria-hidden="true"
                  style={{ left: `${columnRatio(s)}%` }}
                >
                  <span>
                    {columnRatio(s)}:
                    {Math.round((100 - columnRatio(s)) * 10) / 10}
                  </span>
                </div>
              )}
            {s.spatial?.enabled ? (
              <SpatialSection page={page} section={s} mobile={mobile} />
            ) : (
              <div
                className="composition-grid"
                style={
                  s.columnRatio !== undefined &&
                  layout !== "stack" &&
                  blocks.length > 1
                    ? {
                        gridTemplateColumns: `minmax(0, ${s.columnRatio}fr) minmax(0, ${100 - s.columnRatio}fr)`,
                      }
                    : undefined
                }
              >
                {blocks.map((b) => (
                  <div
                    key={b.id}
                    className={`composition-work work-${b.type} fit-${b.fit} placement-${b.width}`}
                    data-composition-block={b.id}
                    data-selected-work={
                      (canvas.active && chosen === b.id) || undefined
                    }
                    data-work-selected={
                      (canvas.active &&
                        editor?.arrange?.workIds.includes(b.id)) ||
                      undefined
                    }
                    onClick={(e) => {
                      if (canvas.active) {
                        e.preventDefault();
                        e.stopPropagation();
                        editor?.arrange?.pickWork(b.id, e.shiftKey, mobile);
                        if (editor?.arrange?.controlsHost)
                          editor.select({
                            kind: "media",
                            pageId: page.id,
                            blockId: b.id,
                          });
                      }
                    }}
                  >
                    <CompositionWork
                      block={b}
                      pageId={page.id}
                      caption={s.captions?.find((c) => c.blockId === b.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
      {canvas.active && (
        <>
          {workDrag.target?.kind === "between" &&
            workDrag.target.beforeId === null && (
              <div className="canvas-drop-end" data-valid={workDrag.valid}>
                Place after the last section
              </div>
            )}
          {workDrag.feedback && (
            <div
              className="canvas-drop-feedback"
              role="status"
              data-blocked={!!workDrag.drag && !workDrag.valid}
            >
              <span>
                {workDrag.feedback}
                {workDrag.drag?.keyboard &&
                  " · Arrows choose a target. Enter places. Esc cancels."}
              </span>
              {workDrag.drag && (
                <button data-canvas-cancel onClick={workDrag.cancel}>
                  Cancel move
                </button>
              )}
              {!workDrag.drag && workDrag.canUndo && (
                <button onClick={workDrag.undo}>Undo move</button>
              )}
              {!workDrag.drag && (
                <button
                  onClick={workDrag.clear}
                  aria-label="Dismiss move message"
                >
                  ×
                </button>
              )}
            </div>
          )}
          <span className="canvas-sr-only" aria-live="polite">
            {canvas.announcement}
          </span>
          {canvas.guide !== null && (
            <div
              className="canvas-insertion-guide"
              style={{ top: canvas.guide }}
            >
              <span>Place here {mobile ? "· mobile" : ""}</span>
            </div>
          )}
          {editor?.arrange?.guides && canvas.gesture?.kind === "width" && (
            <div className="canvas-width-guides" aria-hidden="true">
              {[25, 50, 75, 100].map((width) => (
                <i
                  key={width}
                  style={{
                    width: `${width}%`,
                    left:
                      canvas.gesture?.preview.align === "left"
                        ? 0
                        : canvas.gesture?.preview.align === "right"
                          ? "auto"
                          : "50%",
                    right:
                      canvas.gesture?.preview.align === "right" ? 0 : "auto",
                    transform:
                      canvas.gesture?.preview.align === "center"
                        ? "translateX(-50%)"
                        : "none",
                  }}
                >
                  <span>{width}%</span>
                </i>
              ))}
            </div>
          )}
          {canvas.gesture?.keyboard && canvas.gesture.kind === "move" && (
            <div className="canvas-keyboard-position" role="status">
              Position {canvas.gesture.to + 1} of{" "}
              {orderedSections(c, mobile).length} · Enter to place · Escape to
              cancel
            </div>
          )}
        </>
      )}
      {!orderedSections(c, mobile).length && (
        <p className="direction-empty">
          A place for your first work. Add an image, writing, or film from
          Pages.
        </p>
      )}
    </div>
  );
}
