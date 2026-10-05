import { widthPercent, columnRatio } from "./compositionStudies";
import { useState, useRef, useEffect } from "react";
import type { Page, CompositionSection } from "./model";
import {
  ungroupSection,
  moveSection,
  moveSectionBlock,
  duplicateSection,
  removeSection,
  orderedSections,
  sectionBlocks,
  patchSection,
  enableComposition,
} from "./composition";
import { RangeControl } from "./IdentityPanel";
import { Media } from "./Media";
export function CompositionPanel({
  page,
  change,
  reviewGroup,
  selectedId,
  select,
  editBlock,
  mobile,
  setMobile,
  done,
}: {
  page: Page;
  change: (fn: (p: Page) => Page, group?: string) => void;
  reviewGroup: (blockIds: string[]) => void;
  selectedId?: string;
  select: (id: string | null) => void;
  editBlock: (id: string) => void;
  mobile: boolean;
  setMobile: (v: boolean) => void;
  done?: () => void;
}) {
  const [included, setIncluded] = useState<string[]>([]);
  const detail = useRef<HTMLDivElement>(null);
  const c = page.composition,
    selected = (c ? orderedSections(c, mobile) : []).find(
      (s) => s.id === selectedId,
    );
  useEffect(() => {
    if (!selectedId) return;
    const target = detail.current?.querySelector<HTMLElement>(".section-label");
    const scroller = detail.current?.closest<HTMLElement>(".sidebar-scroll");
    // Keep the artist at the canvas. Scroll only the inspector's own clipped region.
    if (target && scroller && scroller.scrollHeight > scroller.clientHeight + 1)
      scroller.scrollTop +=
        target.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top;
  }, [selectedId]);
  if (!c?.enabled)
    return (
      <div className="composition-intro">
        <span className="section-label">Composition</span>
        <h3>Give the work a rhythm.</h3>
        <p className="panel-hint">
          Pair images, bring words alongside a work, and shape a different
          rhythm for mobile. Your source content stays intact.
        </p>
        <button
          className="wide-button"
          onClick={() => change(enableComposition)}
        >
          {c ? "Return to your arrangement" : "Arrange this page"} ↗
        </button>
        <p className="panel-hint">
          Uses a scrolling composition in all ten directions. The direction’s
          original viewer remains available.{" "}
          {c &&
            "Return to the saved arrangement to change section order; individual works can still be edited below."}
        </p>
      </div>
    );
  const list = orderedSections(c, mobile);
  const patch = (
    fn: (s: CompositionSection) => CompositionSection,
    key?: string,
  ) => {
    if (selected)
      change(
        (p) => patchSection(p, selected.id, fn, mobile),
        key
          ? `section:${selected.id}:${mobile ? "mobile" : "desktop"}:${key}`
          : undefined,
      );
  };
  return (
    <div className="composition-panel">
      {done && (
        <button className="back-link" onClick={done}>
          ← Back to page
        </button>
      )}
      <div className="section-label">
        <span>Composition</span>
        <span>{list.length} sections</span>
      </div>
      <h3>{page.label}</h3>
      <div className="composition-device" aria-label="Arrange for screen size">
        <button aria-pressed={!mobile} onClick={() => setMobile(false)}>
          Desktop layout
        </button>
        <button aria-pressed={mobile} onClick={() => setMobile(true)}>
          Mobile layout
        </button>
      </div>
      <p className="panel-hint">
        {mobile
          ? "Phone groups, order and spacing are independent. Content is shared."
          : "Group 2–4 neighbouring works. Arrangement changes are explicit and undoable."}
      </p>
      <ol className="composition-list">
        {list.map((s, index) => (
          <li key={s.id} className={s.id === selectedId ? "is-selected" : ""}>
            {
              <input
                type="checkbox"
                aria-label={`Include section ${index + 1} in group`}
                checked={included.includes(s.id)}
                onChange={(e) =>
                  setIncluded((ids) =>
                    e.target.checked
                      ? [...ids, s.id]
                      : ids.filter((id) => id !== s.id),
                  )
                }
              />
            }
            <button
              className="composition-row-select"
              aria-label={`Arrange section ${index + 1}`}
              aria-pressed={s.id === selectedId}
              onClick={() => select(s.id)}
            >
              <span className="sequence-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="composition-miniatures">
                {sectionBlocks(page, s).map((b) => (
                  <span key={b.id}>
                    {b.type === "text" ? "Aa" : <Media block={b} thumb />}
                  </span>
                ))}
              </span>
              <span>
                {s.blockIds.length === 1
                  ? "Single work"
                  : `${s.blockIds.length} works`}
              </span>
            </button>
            <span className="composition-move">
              <button
                aria-label={`Move ${mobile ? "mobile " : ""}section ${index + 1} up`}
                disabled={index === 0}
                onClick={() => change((p) => moveSection(p, s.id, -1, mobile))}
              >
                ↑
              </button>
              <button
                aria-label={`Move ${mobile ? "mobile " : ""}section ${index + 1} down`}
                disabled={index === list.length - 1}
                onClick={() => change((p) => moveSection(p, s.id, 1, mobile))}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>
      {
        <>
          <button
            className="wide-button"
            disabled={list.filter((s) => included.includes(s.id)).length < 2}
            onClick={() => {
              reviewGroup(
                list
                  .filter((s) => included.includes(s.id))
                  .flatMap((s) => s.blockIds),
              );
              setIncluded([]);
            }}
          >
            Review selected grouping ↗
          </button>
          <p className="panel-hint">
            Adjacent sections only, up to four works. The new group starts with
            a stack on phone or equal columns on desktop. The other device keeps
            its arrangement.
          </p>
        </>
      }
      {selected && (
        <div className="composition-detail" ref={detail}>
          <div className="section-label">
            <span>Selected section</span>
            <span>{mobile ? "Mobile" : "Desktop"}</span>
          </div>
          {selected.spatial?.enabled && (
            <p className="panel-hint">
              Free placement · use the work’s Move, Size and More controls on
              the canvas. Preview flow before regrouping; your placement is
              retained.
            </p>
          )}
          {!selected.spatial?.enabled && (
            <>
              <label className="field">
                <span>{mobile ? "Mobile arrangement" : "Arrangement"}</span>
                <select
                  value={selected.layout}
                  onChange={(e) =>
                    patch(({ columnRatio, ...s }) => {
                      void columnRatio;
                      return {
                        ...s,
                        layout: e.target.value as CompositionSection["layout"],
                      };
                    })
                  }
                >
                  <option value="stack">Stack · one after another</option>
                  <option value="columns">Equal columns · two across</option>
                  {!mobile && (
                    <>
                      <option value="emphasis-left">
                        Left work leads · 60 / 40
                      </option>
                      <option value="emphasis-right">
                        Right work leads · 40 / 60
                      </option>
                    </>
                  )}
                </select>
              </label>
            </>
          )}
          <label className="field">
            <span>{mobile ? "Mobile width" : "Section width"}</span>
            <select
              value={
                selected.widthPercent === undefined ? selected.width : "fine"
              }
              onChange={(e) =>
                patch(({ widthPercent, ...s }) => {
                  void widthPercent;
                  return {
                    ...s,
                    width: e.target.value as CompositionSection["width"],
                  };
                })
              }
            >
              {selected.widthPercent !== undefined && (
                <option value="fine" disabled>
                  Precise · {selected.widthPercent}%
                </option>
              )}
              <option value="full">Full available width</option>
              {mobile ? (
                <option value="inset">Inset · 88%</option>
              ) : (
                <>
                  <option value="wide">Gallery width · 84%</option>
                  <option value="reading">Reading width · 64%</option>
                </>
              )}
            </select>
          </label>
          <RangeControl
            label="Precise group width"
            value={widthPercent(selected)}
            min={25}
            max={100}
            step={0.1}
            suffix="%"
            change={(widthPercent) =>
              patch((s) => ({ ...s, widthPercent }), "widthPercent")
            }
          />
          {!selected.spatial?.enabled &&
            selected.blockIds.length > 1 &&
            selected.layout !== "stack" && (
              <RangeControl
                label="First column share"
                value={columnRatio(selected)}
                min={20}
                max={80}
                step={0.1}
                suffix="%"
                change={(columnRatio) =>
                  patch((s) => ({ ...s, columnRatio }), "columnRatio")
                }
              />
            )}
          {!mobile && (
            <>
              <label className="field">
                <span>Section alignment</span>
                <select
                  value={selected.align}
                  onChange={(e) =>
                    patch((s) => ({
                      ...s,
                      align: e.target.value as CompositionSection["align"],
                    }))
                  }
                >
                  <option value="left">Left edge</option>
                  <option value="center">Centered</option>
                  <option value="right">Right edge</option>
                </select>
              </label>
              {!selected.spatial?.enabled && (
                <>
                  <label className="field">
                    <span>Align works vertically</span>
                    <select
                      value={selected.vertical}
                      onChange={(e) =>
                        patch((s) => ({
                          ...s,
                          vertical: e.target
                            .value as CompositionSection["vertical"],
                        }))
                      }
                    >
                      <option value="start">Top</option>
                      <option value="center">Middle</option>
                      <option value="end">Bottom</option>
                    </select>
                  </label>{" "}
                </>
              )}
            </>
          )}
          {mobile && (
            <button
              disabled={selected.blockIds.length < 2}
              onClick={() =>
                patch((s) => ({ ...s, blockIds: [...s.blockIds].reverse() }))
              }
            >
              Reverse works in this phone group
            </button>
          )}
          {!selected.spatial?.enabled && (
            <>
              <RangeControl
                label={mobile ? "Mobile gap" : "Gap between works"}
                value={selected.gap}
                min={8}
                max={mobile ? 64 : 80}
                step={4}
                suffix="px"
                change={(gap) => patch((s) => ({ ...s, gap }), "gap")}
              />
            </>
          )}
          <RangeControl
            label={mobile ? "Mobile space before" : "Space before section"}
            value={selected.space}
            min={0}
            max={mobile ? 120 : 180}
            step={4}
            suffix="px"
            change={(space) => patch((s) => ({ ...s, space }), "space")}
          />
          <p className="panel-hint">
            Original proportions and your chosen crops stay intact. Two columns
            can make long writing narrow; choose a stack whenever it reads
            better.
          </p>
          <div className="section-label">
            <span>
              {selected.spatial?.enabled
                ? "Reading order · independent of layers"
                : "Works in this section"}
            </span>
          </div>
          {sectionBlocks(page, selected).map((b, i) => (
            <div className="composition-member" key={b.id}>
              <button onClick={() => editBlock(b.id)}>
                {String(i + 1).padStart(2, "0")} ·{" "}
                {b.type === "text"
                  ? b.text.slice(0, 38)
                  : b.caption || b.alt || b.type}{" "}
                ↗
              </button>
              <button
                aria-label={`Move work ${i + 1} earlier in section`}
                disabled={i === 0}
                onClick={() =>
                  change((p) =>
                    moveSectionBlock(p, selected.id, b.id, -1, mobile),
                  )
                }
              >
                ↑
              </button>
              <button
                aria-label={`Move work ${i + 1} later in section`}
                disabled={i === selected.blockIds.length - 1}
                onClick={() =>
                  change((p) =>
                    moveSectionBlock(p, selected.id, b.id, 1, mobile),
                  )
                }
              >
                ↓
              </button>
            </div>
          ))}
          <div className="composition-structure-actions">
            <button
              disabled={
                selected.blockIds.length < 2 || selected.spatial?.enabled
              }
              onClick={() => {
                change((p) =>
                  ungroupSection(p, selected.id, undefined, mobile),
                );
                setIncluded([]);
              }}
            >
              Ungroup into single works
            </button>
            <button
              disabled={page.blocks.length + selected.blockIds.length > 100}
              onClick={() =>
                change((p) =>
                  duplicateSection(p, selected.id, undefined, mobile),
                )
              }
            >
              Duplicate as new works on both devices
            </button>
            <button
              className="remove-button"
              onClick={() => {
                change((p) => removeSection(p, selected.id, mobile));
                select(null);
              }}
            >
              Delete these works from both devices
            </button>
          </div>
          <p className="panel-hint">
            Undo restores a removed section and all its works. Duplicate creates
            independent text and layout, using the same original media.
          </p>
        </div>
      )}
      <div className="editor-divider" />
      <button
        className="wide-button"
        onClick={() => {
          change((p) => ({
            ...p,
            composition: p.composition
              ? { ...p.composition, enabled: false }
              : null,
          }));
          select(null);
        }}
      >
        Use direction’s original layout
      </button>
      <p className="panel-hint">
        Keeps this arrangement for later. The original viewer follows the
        desktop source sequence. Covers and navigation keep their direction’s
        design.
      </p>
    </div>
  );
}
