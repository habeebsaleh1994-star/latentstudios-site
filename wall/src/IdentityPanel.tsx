import { useState } from "react";
import type { Site, Identity } from "./model";
import {
  colorsFor,
  contrast,
  copyIdentityToAll,
  fonts,
  palettes,
  patchIdentity,
  suggestedInk,
} from "./identity";
export function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  change,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  change: (n: number) => void;
}) {
  return (
    <label className="field identity-range">
      <span>
        {label}
        <b>
          {value}
          {suffix}
        </b>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => change(Number(e.target.value))}
      />
    </label>
  );
}
function ColorField({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: (s: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [active, setActive] = useState(false);
  const shown = active ? draft : value;
  return (
    <label className="identity-color">
      <span>{label}</span>
      <input
        aria-label={`${label} colour picker`}
        type="color"
        value={value}
        onChange={(e) => change(e.target.value)}
      />
      <input
        aria-label={`${label} hex`}
        value={shown}
        maxLength={7}
        spellCheck={false}
        onFocus={() => {
          setDraft(value);
          setActive(true);
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          if (/^#[\da-f]{6}$/i.test(e.target.value)) change(e.target.value);
        }}
        onBlur={() => setActive(false)}
      />
    </label>
  );
}
export function IdentityPanel({
  site,
  update,
  compact = false,
}: {
  site: Site;
  update: (fn: (s: Site) => Site, group?: string) => void;
  compact?: boolean;
}) {
  const i = site.appearances[site.styleId].identity,
    c = colorsFor(site),
    ratio = contrast(c.canvas, c.ink),
    accentRatio = contrast(c.canvas, c.accent);
  const change = (patch: Partial<Identity>, key?: string) =>
    update(
      (s) => patchIdentity(s, patch),
      key ? `identity:${site.styleId}:${key}` : undefined,
    );
  return (
    <div className="identity-controls">
      <div className="section-label">
        <span>Your visual voice</span>
        <span className="quiet">{site.styleId}</span>
      </div>
      <p className="panel-hint">
        Across every page in this direction. Switching styles keeps each
        identity intact.
      </p>
      <div
        className="identity-specimen"
        style={{
          background: c.canvas,
          color: c.ink,
          fontFamily:
            i.headingFont === "style" ? undefined : fonts[i.headingFont].stack,
        }}
      >
        <span>Aa / 01</span>
        <strong>{site.name}</strong>
        <span>Your work. Your way of seeing.</span>
      </div>
      <details className="identity-section" open={!compact}>
        <summary>
          Type & rhythm <span>↘</span>
        </summary>
        <label className="field">
          <span>Heading typeface</span>
          <select
            value={i.headingFont}
            onChange={(e) =>
              change({ headingFont: e.target.value as Identity["headingFont"] })
            }
          >
            <option value="style">Direction default</option>
            {Object.entries(fonts).map(([id, font]) => (
              <option key={id} value={id}>
                {font.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Reading typeface</span>
          <select
            value={i.bodyFont}
            onChange={(e) =>
              change({ bodyFont: e.target.value as Identity["bodyFont"] })
            }
          >
            <option value="style">Direction default</option>
            {Object.entries(fonts).map(([id, font]) => (
              <option key={id} value={id}>
                {font.label}
              </option>
            ))}
          </select>
        </label>
        <RangeControl
          label="Heading scale"
          value={i.headingScale}
          min={75}
          max={135}
          step={1}
          suffix="%"
          change={(headingScale) => change({ headingScale }, "headingScale")}
        />
        <RangeControl
          label="Reading scale"
          value={i.bodyScale}
          min={90}
          max={125}
          step={1}
          suffix="%"
          change={(bodyScale) => change({ bodyScale }, "bodyScale")}
        />
        <label className="field">
          <span>Heading weight</span>
          <select
            value={i.weight}
            onChange={(e) =>
              change({ weight: e.target.value as Identity["weight"] })
            }
          >
            <option value="400">Regular</option>
            <option value="600">Semibold</option>
            <option value="700">Bold</option>
          </select>
        </label>
        <RangeControl
          label="Letter spacing"
          value={i.tracking}
          min={-6}
          max={8}
          suffix="%"
          change={(tracking) => change({ tracking }, "tracking")}
        />
        <RangeControl
          label="Reading line height"
          value={i.leading}
          min={1.35}
          max={2}
          step={0.05}
          change={(leading) => change({ leading }, "leading")}
        />
      </details>
      <details className="identity-section" open={!compact}>
        <summary>
          Colour & atmosphere <span>↘</span>
        </summary>
        <div className="identity-palettes">
          {palettes.map((p) => (
            <button
              key={p.name}
              aria-label={`Apply ${p.name} palette`}
              title={p.name}
              onClick={() =>
                change({ canvas: p.canvas, ink: p.ink, accent: p.accent })
              }
            >
              <i style={{ background: p.canvas }} />
              <i style={{ background: p.ink }} />
              <i style={{ background: p.accent }} />
            </button>
          ))}
        </div>
        <ColorField
          label="Canvas"
          value={c.canvas}
          change={(canvas) => change({ canvas }, "canvas")}
        />
        <ColorField
          label="Text"
          value={c.ink}
          change={(ink) => change({ ink }, "ink")}
        />
        <ColorField
          label="Accent"
          value={c.accent}
          change={(accent) => change({ accent }, "accent")}
        />
        <div
          className={`contrast-note ${ratio < 4.5 || accentRatio < 4.5 ? "needs-attention" : ""}`}
          role="status"
        >
          <strong>
            Text {ratio.toFixed(1)}:1 · Accent {accentRatio.toFixed(1)}:1
          </strong>
          <p>
            {ratio < 4.5
              ? "Text may be difficult to read. Your colours stay as chosen."
              : "Text meets the 4.5:1 contrast guideline on this canvas."}
            {accentRatio < 4.5
              ? " The accent needs stronger contrast for small links."
              : ""}
          </p>
          {ratio < 4.5 && (
            <button onClick={() => change({ ink: suggestedInk(c.canvas) })}>
              Use a legible text colour
            </button>
          )}
          {accentRatio < 4.5 && (
            <button onClick={() => change({ accent: c.ink })}>
              Use text colour for links
            </button>
          )}
        </div>
        {site.styleId === "cinema" && (
          <p className="panel-hint">
            Cinema keeps white text over its shaded cover photograph. Canvas
            colours apply to the programme and reading pages.
          </p>
        )}
      </details>
      <details className="identity-section" open={!compact}>
        <summary>
          Space & proportion <span>↘</span>
        </summary>
        <RangeControl
          label="Page margins"
          value={i.margin ?? (site.styleId === "gallery" ? 7 : 5.5)}
          min={3}
          max={12}
          step={0.5}
          suffix="vw"
          change={(margin) => change({ margin }, "margin")}
        />
        <RangeControl
          label="Space between works"
          value={site.appearances[site.styleId].spacing}
          min={50}
          max={130}
          step={10}
          suffix="px"
          change={(spacing) =>
            update(
              (s) => ({
                ...s,
                appearances: {
                  ...s.appearances,
                  [s.styleId]: { ...s.appearances[s.styleId], spacing },
                },
              }),
              `spacing:${site.styleId}`,
            )
          }
        />
        <RangeControl
          label="Image scale"
          value={i.imageScale}
          min={60}
          max={100}
          step={1}
          suffix="%"
          change={(imageScale) => change({ imageScale }, "imageScale")}
        />
        <label className="field">
          <span>Title alignment</span>
          <select
            value={i.alignment}
            onChange={(e) =>
              change({ alignment: e.target.value as Identity["alignment"] })
            }
          >
            <option value="style">Direction default</option>
            <option value="left">Left</option>
            <option value="center">Centered</option>
          </select>
        </label>
        <p className="panel-hint">
          Shared edges keep works aligned. Margins ease down on small screens.
          Image scale changes display size; originals and explicit crops stay
          intact.{" "}
          {site.styleId === "cinema" &&
            "Cinema’s opening cover remains full bleed; image scale shapes the screening room."}
        </p>
      </details>
      <button
        className="wide-button identity-apply"
        onClick={() => update(copyIdentityToAll)}
      >
        Use this identity across all ten
      </button>
      <p className="panel-hint">
        Replaces their type and colour choices. Layouts and work stay intact.
        Undo restores the previous identities.
      </p>
    </div>
  );
}
