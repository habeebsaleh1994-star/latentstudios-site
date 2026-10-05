import { useState, useEffect } from "react";
import type { Site, TypeOverrides, TextStyle } from "./model";
import { fonts } from "./identity";
import {
  changeTypography,
  createTextStyle,
  inheritedTypography,
  patchType,
  styleUsers,
  typeFor,
  typographyAdvice,
  type WritingTarget,
} from "./typography";
import "./text-style.css";
function TypeNumber({
  label,
  unit,
  min,
  max,
  step,
  value,
  inherited,
  change,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number | undefined;
  inherited: number | undefined;
  change: (n: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  useEffect(
    () =>
      setDraft((previous) =>
        previous !== "" && Number(previous) === value
          ? previous
          : value === undefined
            ? ""
            : String(value),
      ),
    [value],
  );
  return (
    <label className="type-number">
      <span>
        {label}
        <small>{unit}</small>
      </span>
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        placeholder={inherited === undefined ? "Inherit" : String(inherited)}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          if (raw === "") change(undefined);
          else {
            const n = Number(raw);
            if (Number.isFinite(n) && n >= min && n <= max) change(n);
          }
        }}
        onBlur={() => {
          const n = Number(draft);
          if (draft !== "" && (!Number.isFinite(n) || n < min || n > max))
            setDraft(value === undefined ? "" : String(value));
        }}
      />
      <small>{value === undefined ? "Inherited" : "Override"}</small>
    </label>
  );
}
export function TextStylePanel({
  site,
  target,
  initialMobile = false,
  previewDevice,
  update,
}: {
  site: Site;
  target: WritingTarget;
  initialMobile?: boolean;
  previewDevice?: (mobile: boolean) => void;
  update: (fn: (s: Site) => Site, group?: string) => void;
}) {
  const [scope, setScope] = useState<"work" | "style">("work"),
    [mobile, setMobile] = useState(initialMobile),
    [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [role, setRole] = useState<TextStyle["role"]>("poem");
  useEffect(() => setMobile(initialMobile), [initialMobile]);
  const block = site.pages
    .find((p) => p.id === target.pageId)
    ?.blocks.find((b) => b.id === target.blockId);
  if (!block || block.type !== "text") return null;
  const t = block.typography ?? inheritedTypography(),
    style = site.textStyles.find((s) => s.id === t.styleId),
    shared = scope === "style" && !!style,
    layer = mobile ? "mobile" : "base",
    own = shared ? style[layer] : t[layer],
    resolved = typeFor(site, block, mobile),
    inherited = shared
      ? mobile
        ? style.base
        : {}
      : {
          ...style?.base,
          ...(mobile ? style?.mobile : {}),
          ...(mobile ? t.base : {}),
        },
    count = style ? styleUsers(site, style.id) : 0;
  const patch = (
    key: keyof TypeOverrides,
    value: TypeOverrides[keyof TypeOverrides] | undefined,
  ) =>
    update(
      (s) => patchType(s, target, shared ? style.id : null, mobile, key, value),
      `type:${shared ? style.id : target.blockId}:${layer}:${key}`,
    );
  const numeric = (
    key: "size" | "leading" | "tracking" | "measure",
    label: string,
    min: number,
    max: number,
    step: number,
    unit: string,
  ) => (
    <TypeNumber
      key={`${shared ? style.id : target.blockId}:${layer}:${key}`}
      label={label}
      unit={unit}
      min={min}
      max={max}
      step={step}
      value={own[key]}
      inherited={inherited[key]}
      change={(n) => patch(key, n)}
    />
  );
  return (
    <section className="text-style-panel" aria-label="Writing style">
      <div className="section-label">
        <span>Writing style</span>
        <span>{mobile ? "Phone" : "All devices"}</span>
      </div>
      <label className="field">
        <span>Use a named style</span>
        <select
          aria-label="Use a named text style"
          value={t.styleId ?? ""}
          onChange={(e) => {
            setScope("work");
            update((s) =>
              changeTypography(s, target, (t) => ({
                ...t,
                styleId: e.target.value || null,
              })),
            );
          }}
        >
          <option value="">Inherit site identity</option>
          {site.textStyles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.role}
            </option>
          ))}
        </select>
      </label>
      <div
        className="type-scope"
        role="group"
        aria-label="Typography editing scope"
      >
        <button aria-pressed={!shared} onClick={() => setScope("work")}>
          This work
        </button>
        <button
          disabled={!style}
          aria-pressed={shared}
          onClick={() => setScope("style")}
        >
          Named style{style ? ` · ${count}` : ""}
        </button>
      </div>
      {shared && (
        <details className="type-details">
          <summary>Name & role</summary>
          <label className="field">
            <span>Style name</span>
            <input
              key={style.id + style.name}
              aria-label="Rename text style"
              defaultValue={style.name}
              maxLength={60}
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (
                  name &&
                  !site.textStyles.some(
                    (s) =>
                      s.id !== style.id &&
                      s.name.toLowerCase() === name.toLowerCase(),
                  )
                )
                  update((s) => ({
                    ...s,
                    textStyles: s.textStyles.map((t) =>
                      t.id === style.id ? { ...t, name } : t,
                    ),
                  }));
                else e.target.value = style.name;
              }}
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select
              aria-label="Text style role"
              value={style.role}
              onChange={(e) =>
                update((s) => ({
                  ...s,
                  textStyles: s.textStyles.map((t) =>
                    t.id === style.id
                      ? { ...t, role: e.target.value as TextStyle["role"] }
                      : t,
                  ),
                }))
              }
            >
              <option value="poem">Poem</option>
              <option value="statement">Statement</option>
              <option value="note">Marginal note</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <p className="panel-hint">
            Renaming or changing the role keeps the typography and its
            subscribers.
          </p>
        </details>
      )}
      <label className="field type-device">
        <span>Presentation</span>
        <select
          aria-label="Typography device scope"
          value={mobile ? "mobile" : "base"}
          onChange={(e) => {
            const phone = e.target.value === "mobile";
            setMobile(phone);
            previewDevice?.(phone);
          }}
        >
          <option value="base">All devices</option>
          <option value="mobile">Phone only</option>
        </select>
      </label>
      <p className="type-scope-note" role="status">
        {shared
          ? `Editing “${style.name}” for ${count} subscribed ${count === 1 ? "work" : "works"}. Local overrides take priority.`
          : "Editing only this work. Its words stay shared across devices."}{" "}
        {mobile
          ? "Phone overrides inherit the shared presentation."
          : "Phone inherits these choices unless it has an override."}
      </p>
      <label className="field">
        <span>Font family</span>
        <select
          aria-label="Text font family"
          value={own.font ?? ""}
          onChange={(e) =>
            patch(
              "font",
              e.target.value
                ? (e.target.value as TypeOverrides["font"])
                : undefined,
            )
          }
        >
          <option value="">
            Inherit{inherited.font ? ` · ${fonts[inherited.font].label}` : ""}
          </option>
          {Object.entries(fonts).map(([id, font]) => (
            <option key={id} value={id}>
              {font.label}
            </option>
          ))}
        </select>
      </label>
      <div className="type-numbers">
        {numeric("size", "Text size", 10, 120, 1, "px")}
        {numeric("leading", "Line height", 0.8, 3, 0.05, "×")}
      </div>
      <details className="type-details">
        <summary>Spacing, alignment & line breaks</summary>
        <div className="type-numbers">
          {numeric("tracking", "Letter spacing", -0.08, 0.4, 0.01, "em")}
          {numeric("measure", "Line measure", 12, 120, 1, "ch")}
        </div>
        <label className="field">
          <span>Alignment</span>
          <select
            aria-label="Text alignment"
            value={own.align ?? ""}
            onChange={(e) =>
              patch(
                "align",
                e.target.value
                  ? (e.target.value as TypeOverrides["align"])
                  : undefined,
              )
            }
          >
            <option value="">Inherit</option>
            <option value="start">Start edge</option>
            <option value="center">Centered</option>
            <option value="end">End edge</option>
            <option value="justify">Justified</option>
          </select>
        </label>
        <label className="field">
          <span>Line breaks</span>
          <select
            aria-label="Text line breaks"
            value={own.flow ?? ""}
            onChange={(e) =>
              patch(
                "flow",
                e.target.value
                  ? (e.target.value as TypeOverrides["flow"])
                  : undefined,
              )
            }
          >
            <option value="">Inherit</option>
            <option value="prose">Prose · preserve newlines</option>
            <option value="poem">Poem · preserve newlines and spaces</option>
          </select>
        </label>
        <p className="panel-hint">
          Poems keep intentional breaks and indentation. Long lines can wrap to
          fit the reader’s screen. Presentation never changes source casing.
        </p>
      </details>
      <button
        className="text-button"
        disabled={!Object.keys(own).length}
        onClick={() =>
          update((s) =>
            shared
              ? {
                  ...s,
                  textStyles: s.textStyles.map((t) =>
                    t.id === style.id ? { ...t, [layer]: {} } : t,
                  ),
                }
              : changeTypography(s, target, (t) => ({ ...t, [layer]: {} })),
          )
        }
      >
        {shared ? "Reset style declarations" : "Reset local overrides"} ·{" "}
        {mobile ? "phone" : "all devices"}
      </button>
      {!shared && (
        <button
          className="text-button"
          disabled={!block.typography}
          onClick={() =>
            update((s) => changeTypography(s, target, () => undefined))
          }
        >
          Reset this work to site identity
        </button>
      )}
      {typographyAdvice(resolved).length > 0 && (
        <aside className="type-advice" aria-label="Readability advice">
          {typographyAdvice(resolved).map((note) => (
            <p key={note}>{note}</p>
          ))}
          <p>Your choices are retained.</p>
        </aside>
      )}
      <button
        className="text-button"
        aria-expanded={creating}
        onClick={() => setCreating(!creating)}
      >
        Create a named style {creating ? "−" : "+"}
      </button>
      {creating && (
        <form
          className="type-create"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !name.trim() ||
              site.textStyles.length >= 32 ||
              site.textStyles.some(
                (s) => s.name.toLowerCase() === name.trim().toLowerCase(),
              )
            )
              return;
            update((s) => createTextStyle(s, target, name, role));
            setName("");
            setCreating(false);
            setScope("work");
          }}
        >
          <label className="field">
            <span>Style name</span>
            <input
              aria-label="New text style name"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Starting role</span>
            <select
              aria-label="New text style role"
              value={role}
              onChange={(e) => setRole(e.target.value as TextStyle["role"])}
            >
              <option value="poem">Poem</option>
              <option value="statement">Statement</option>
              <option value="note">Marginal note</option>
              <option value="custom">Custom · inherit identity</option>
            </select>
          </label>
          <p className="panel-hint">
            Applies the new style to this work and clears its local overrides.
            Other works subscribe only when you choose this style for them.
          </p>
          <button
            disabled={
              !name.trim() ||
              site.textStyles.length >= 32 ||
              site.textStyles.some(
                (s) => s.name.toLowerCase() === name.trim().toLowerCase(),
              )
            }
          >
            Create and use style
          </button>
        </form>
      )}
      <p className="type-inheritance">
        Site identity → named style → this work. Blank fields inherit. Existing
        system fonts only.
      </p>
    </section>
  );
}
