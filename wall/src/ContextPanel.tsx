import { TextStylePanel } from "./TextStylePanel";
import type { Site } from "./model";
import {
  type TextTarget,
  targetLabel,
  targetValue,
  updateTarget,
  targetKey,
} from "./editing";
import { patchIdentity } from "./identity";
import { RangeControl } from "./IdentityPanel";
export function ContextPanel({
  site,
  target,
  update,
  done,
  identity,
  mobile = false,
  previewDevice,
}: {
  site: Site;
  mobile?: boolean;
  previewDevice?: (mobile: boolean) => void;
  target: TextTarget;
  update: (fn: (s: Site) => Site, group?: string) => void;
  done: () => void;
  identity: () => void;
}) {
  const i = site.appearances[site.styleId].identity;
  const heading = target.kind === "page" && target.field === "title";
  return (
    <div className="context-panel">
      <button className="back-link" onClick={done}>
        ← Done selecting
      </button>
      <div className="section-label">
        <span>Selected on canvas</span>
        <span className="selection-indicator" />
      </div>
      <h2>{targetLabel(target)}</h2>
      <p className="panel-hint">
        Type directly into the highlighted text, or edit here. Your wording
        stays yours.
      </p>
      <label className="field">
        <span>{targetLabel(target)}</span>
        <textarea
          aria-label={`Selected ${targetLabel(target).toLowerCase()}`}
          value={targetValue(site, target)}
          rows={target.kind === "block" && target.field === "text" ? 9 : 4}
          maxLength={
            target.kind === "block" && target.field === "text"
              ? 30000
              : target.kind === "page" && target.field === "subtitle"
                ? 5000
                : 500
          }
          onChange={(e) =>
            update(
              (s) => updateTarget(s, target, e.target.value),
              `copy:${targetKey(target)}`,
            )
          }
        />
      </label>
      {heading && (
        <>
          <div className="editor-divider" />
          <span className="eyebrow">Across all page titles</span>
          <RangeControl
            label="Heading scale"
            value={i.headingScale}
            min={75}
            max={135}
            step={1}
            suffix="%"
            change={(headingScale) =>
              update(
                (s) => patchIdentity(s, { headingScale }),
                `identity:${site.styleId}:headingScale`,
              )
            }
          />
          <label className="field">
            <span>Title alignment</span>
            <select
              value={i.alignment}
              onChange={(e) =>
                update((s) =>
                  patchIdentity(s, {
                    alignment: e.target.value as typeof i.alignment,
                  }),
                )
              }
            >
              <option value="style">Direction default</option>
              <option value="left">Left</option>
              <option value="center">Centered</option>
            </select>
          </label>
        </>
      )}
      {target.kind === "block" && target.field === "text" && (
        <TextStylePanel
          key={target.blockId}
          site={site}
          target={target}
          initialMobile={mobile}
          previewDevice={previewDevice}
          update={update}
        />
      )}
      <button className="wide-button" onClick={identity}>
        Global identity · all pages ↗
      </button>
      <div className="editor-note">
        <span>Connected to the original content.</span>
        <p>
          Selection edits the same saved field used by every style. Escape
          leaves selection. ⌘Z / Ctrl-Z undoes the edit.
        </p>
      </div>
    </div>
  );
}
