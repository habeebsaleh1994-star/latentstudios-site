import { useEffect, useState, useRef, type ReactNode } from "react";
import type { CompositionSection, Page } from "./model";
import { moveSection, moveSectionBlock, patchSection } from "./composition";
import { patchFrame, layerWork } from "./spatial";
import { patchCaption } from "./captions";
import { workLabel } from "./workLabels";
import type { ReadabilityNote } from "./readability";
export function PreciseNumber({
  label,
  value,
  min,
  max,
  step = 1,
  commit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  commit: (value: number) => void;
}) {
  const display = (n: number) => String(Math.round(n * 100) / 100);
  const [draft, setDraft] = useState(display(value));
  const dirty = useRef(false);
  const setDirty = (value: boolean) => {
    dirty.current = value;
  };
  useEffect(() => {
    setDraft(display(value));
    setDirty(false);
  }, [value]);
  return (
    <label>
      {label}
      <input
        aria-label={label}
        title={`Exact value: ${value}. Enter to apply.`}
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setDirty(true);
        }}
        onBlur={() => {
          const n = Number(draft);
          if (
            dirty.current &&
            draft !== "" &&
            Number.isFinite(n) &&
            n >= min &&
            n <= max
          ) {
            if (n !== value) commit(n);
          } else setDraft(display(value));
          setDirty(false);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(display(value));
            setDirty(false);
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
export function WorkSettings({
  page,
  section: s,
  id,
  mobile,
  change,
  previewFlow,
  snaps,
  setSnaps,
  notes = [],
  choose,
  roomBelow,
}: {
  page: Page;
  section: CompositionSection;
  id: string;
  mobile: boolean;
  change: (fn: (p: Page) => Page) => void;
  previewFlow: () => void;
  snaps?: boolean;
  setSnaps?: (v: boolean) => void;
  notes?: ReadabilityNote[];
  choose: (id: string) => void;
  roomBelow?: ReactNode;
}) {
  const [panel, setPanel] = useState("");
  const b = page.blocks.find((b) => b.id === id)!;
  const spatial = s.spatial?.enabled ? s.spatial : null;
  const frame = spatial?.frames.find((f) => f.blockId === id);
  const c = s.captions?.find((c) => c.blockId === id);
  const patch = (fn: (s: CompositionSection) => CompositionSection) =>
    change((p) => patchSection(p, s.id, fn, mobile));
  const caption = (v: Parameters<typeof patchCaption>[2]) =>
    patch((s) => patchCaption(s, id, v));
  return (
    <div className="work-settings">
      <div className="work-setting-tabs" aria-label="Adjust selected work">
        {(spatial ? ["Position", "Layers"] : [])
          .concat(
            b.type !== "text" ? ["Caption"] : [],
            ["Reading", "Section"],
            notes.length ? ["Readability"] : [],
          )
          .map((name) => (
            <button
              key={name}
              aria-expanded={panel === name}
              onClick={() => setPanel(panel === name ? "" : name)}
            >
              {name}
              {name === "Readability" ? ` · ${notes.length}` : ""}
            </button>
          ))}
      </div>
      {panel && (
        <div className="work-setting-body" data-settings-panel={panel}>
          {panel === "Position" && frame && (
            <>
              <span className="work-scope">
                This work · {mobile ? "Phone" : "Desktop"} placement
              </span>
              <div className="work-fields">
                <PreciseNumber
                  label="Across (%)"
                  value={frame.x}
                  min={0}
                  max={100 - frame.width}
                  step={0.1}
                  commit={(x) =>
                    patch((s) => patchFrame(s, id, (f) => ({ ...f, x })))
                  }
                />
                <PreciseNumber
                  label="Down (px)"
                  value={frame.y}
                  min={0}
                  max={100000}
                  commit={(y) =>
                    patch((s) => patchFrame(s, id, (f) => ({ ...f, y })))
                  }
                />
                <PreciseNumber
                  label="Width (%)"
                  value={frame.width}
                  min={10}
                  max={100 - frame.x}
                  step={0.1}
                  commit={(width) =>
                    patch((s) => patchFrame(s, id, (f) => ({ ...f, width })))
                  }
                />
              </div>
              <label className="work-check">
                <input
                  type="checkbox"
                  checked={snaps}
                  onChange={(e) => setSnaps?.(e.target.checked)}
                />
                Snap to nearby edges and equal gaps
              </label>
            </>
          )}
          {panel === "Caption" && (
            <>
              <span className="work-scope">
                This caption · {mobile ? "Phone" : "Desktop"} only · words stay
                shared
              </span>
              <div className="work-fields">
                <label>
                  Position
                  <select
                    aria-label="Caption position"
                    value={c?.position ?? "below"}
                    onChange={(e) =>
                      caption({ position: e.target.value as "above" | "below" })
                    }
                  >
                    <option value="below">Below image</option>
                    <option value="above">Above image</option>
                  </select>
                </label>
                <label>
                  Backing
                  <select
                    aria-label="Caption backing"
                    value={c?.backing ?? "none"}
                    onChange={(e) =>
                      caption({
                        backing: e.target.value as "none" | "paper" | "ink",
                      })
                    }
                  >
                    <option value="none">None</option>
                    <option value="paper">Light paper</option>
                    <option value="ink">Dark ink</option>
                  </select>
                </label>
                <label>
                  Text size
                  <select
                    aria-label="Caption size"
                    value={c?.size ?? ""}
                    onChange={(e) =>
                      caption({
                        size: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                  >
                    <option value="">Direction default</option>
                    {[12, 14, 16, 18, 20, 24].map((n) => (
                      <option key={n} value={n}>
                        {n}px
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button onClick={() => caption(null)} disabled={!c}>
                Reset caption treatment
              </button>
            </>
          )}
          {panel === "Layers" && spatial && (
            <>
              <p>
                Layer {spatial.layers.indexOf(id) + 1} of{" "}
                {spatial.layers.length} · front is highest. Reading order stays
                separate.
              </p>
              <div className="work-actions">
                <button
                  disabled={spatial.layers[0] === id}
                  onClick={() => patch((s) => layerWork(s, id, -1))}
                >
                  Send back
                </button>
                <button
                  disabled={spatial.layers.at(-1) === id}
                  onClick={() => patch((s) => layerWork(s, id, 1))}
                >
                  Bring forward
                </button>
              </div>
            </>
          )}
          {panel === "Reading" && (
            <>
              <p>
                Reading position {s.blockIds.indexOf(id) + 1} of{" "}
                {s.blockIds.length} · {mobile ? "Phone" : "Desktop"} only.
                Layers stay unchanged.
              </p>
              <div className="work-actions">
                <button
                  disabled={s.blockIds[0] === id}
                  onClick={() =>
                    change((p) => moveSectionBlock(p, s.id, id, -1, mobile))
                  }
                >
                  Read earlier
                </button>
                <button
                  disabled={s.blockIds.at(-1) === id}
                  onClick={() =>
                    change((p) => moveSectionBlock(p, s.id, id, 1, mobile))
                  }
                >
                  Read later
                </button>
              </div>
            </>
          )}
          {panel === "Section" && (
            <>
              <span className="work-scope">
                Whole section · {s.blockIds.length} works ·{" "}
                {mobile ? "Phone" : "Desktop"} only
              </span>
              <div className="work-fields">
                <PreciseNumber
                  label="Section width (%)"
                  value={
                    s.widthPercent ??
                    { full: 100, wide: 84, reading: 64, inset: 88 }[s.width]
                  }
                  min={25}
                  max={100}
                  commit={(widthPercent) =>
                    patch((s) => ({ ...s, widthPercent }))
                  }
                />
                <PreciseNumber
                  label="Space before (px)"
                  value={s.space}
                  min={0}
                  max={mobile ? 120 : 180}
                  commit={(space) => patch((s) => ({ ...s, space }))}
                />
                {spatial && (
                  <PreciseNumber
                    label="Minimum section height (px)"
                    value={spatial.minHeight}
                    min={0}
                    max={100000}
                    commit={(minHeight) =>
                      patch((s) => ({
                        ...s,
                        spatial: { ...s.spatial!, minHeight },
                      }))
                    }
                  />
                )}
                <label>
                  Align section
                  <select
                    aria-label="Align section"
                    value={s.align}
                    onChange={(e) =>
                      patch((s) => ({
                        ...s,
                        align: e.target.value as CompositionSection["align"],
                      }))
                    }
                  >
                    <option value="left">Left</option>
                    <option value="center">Centre</option>
                    <option value="right">Right</option>
                  </select>
                </label>
              </div>
              <div className="work-actions">
                {roomBelow}
                <button
                  onClick={() =>
                    change((p) => moveSection(p, s.id, -1, mobile))
                  }
                >
                  Section earlier
                </button>
                <button
                  onClick={() => change((p) => moveSection(p, s.id, 1, mobile))}
                >
                  Section later
                </button>
                {spatial && (
                  <button onClick={previewFlow}>Preview flow ↗</button>
                )}
              </div>
              <p>
                Height follows the works. Minimum height leaves extra room; it
                never clips content.
              </p>
            </>
          )}
          {panel === "Readability" && (
            <>
              <p>
                Potential issues at this actual viewport. Geometric overlap does
                not prove unreadability. Your composition stays unchanged.
              </p>
              {notes.map((n, i) => (
                <button
                  className="readability-note"
                  key={i}
                  onClick={() => choose(n.blockId)}
                >
                  <strong>
                    {workLabel(
                      page.blocks.find((b) => b.id === n.blockId)!,
                    ).slice(0, 45)}
                  </strong>
                  <span>{n.message}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
