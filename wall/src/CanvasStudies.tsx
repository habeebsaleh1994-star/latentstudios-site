import { TypographyContext } from "./TypographyContext";
import { orderedSections } from "./compositionOrder";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Page, Site } from "./model";
import {
  arrangementOptions,
  mobileArrangementOptions,
  proposeArrangement,
  type ArrangementOption,
} from "./compositionStudies";
import { CompositionSections } from "./CompositionSections";
import { EditingContext } from "./editing";
import { identityTokens, colorsFor } from "./identity";
import { trapDialogTab } from "./dialogFocus";
import "./canvas-studies.css";
export function StudiesBar({
  page,
  comparing,
  compare,
  keep,
  remove,
}: {
  page: Page;
  comparing: string | null;
  compare: (id: string | null) => void;
  keep: (name: string) => void;
  remove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [name, setName] = useState("");
  const selected = page.studies?.find((s) => s.id === comparing);
  return (
    <div className="studies-bar">
      <div className="studies-summary">
        <button onClick={() => setOpen(!open)} aria-expanded={open}>
          Composition studies <span>{page.studies?.length ?? 0}</span>{" "}
          {open ? "−" : "+"}
        </button>
        <span>
          {selected
            ? `Viewing “${selected.name}”`
            : "Keep a possibility. Return when you wish."}
        </span>
      </div>
      {open && (
        <div className="studies-shelf">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (comparing) return;
              keep(name);
              setName("");
            }}
          >
            <label htmlFor="study-name">
              Keep the current draft arrangement
            </label>
            <div>
              <input
                disabled={!!comparing}
                id="study-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Study ${(page.studies?.length ?? 0) + 1}`}
                maxLength={80}
              />
              <button
                disabled={!!comparing || (page.studies?.length ?? 0) >= 12}
              >
                Keep study
              </button>
            </div>
            <small>
              Words, media and crops stay live. Up to 12 studies per page;
              remove one to make room.
            </small>
          </form>
          <ol>
            {page.studies?.map((study, i) => (
              <li key={study.id}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <button
                  aria-pressed={comparing === study.id}
                  onClick={() => {
                    compare(comparing === study.id ? null : study.id);
                    setOpen(false);
                  }}
                >
                  {study.name}
                  <small>
                    {study.order.length} works ·{" "}
                    {study.composition
                      ? `${study.composition.desktop.length} desktop / ${study.composition.mobile.length} phone groups`
                      : "Original layout"}
                  </small>
                </button>
                <button
                  disabled={!!comparing}
                  className="study-remove"
                  aria-label={`Remove study ${study.name}`}
                  onClick={() => remove(study.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
export function CompositionMiniature({
  site,
  page,
  mobile = false,
  maxHeight,
}: {
  site: Site;
  page: Page;
  mobile?: boolean;
  maxHeight?: number;
}) {
  const outer = useRef<HTMLDivElement>(null),
    inner = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 0.3, height: 240, left: 0 });
  useLayoutEffect(() => {
    const update = () => {
      if (!outer.current || !inner.current) return;
      const virtualWidth = mobile ? 360 : 900;
      const scale = Math.min(
        1,
        outer.current.clientWidth / virtualWidth,
        maxHeight ? maxHeight / Math.max(1, inner.current.scrollHeight) : 1,
      );
      setSize({
        scale,
        height: inner.current.scrollHeight * scale,
        left: (outer.current.clientWidth - virtualWidth * scale) / 2,
      });
    };
    const observer = new ResizeObserver(update);
    if (outer.current) observer.observe(outer.current);
    if (inner.current) observer.observe(inner.current);
    update();
    return () => observer.disconnect();
  }, [mobile, maxHeight]);
  const colors = colorsFor(site);
  return (
    <div
      ref={outer}
      className="arrangement-miniature"
      data-device-preview={mobile ? "mobile" : "desktop"}
      style={{ height: size.height, background: colors.canvas }}
      aria-hidden="true"
    >
      <div
        ref={inner}
        className="identity-surface"
        style={{
          ...identityTokens(site),
          width: mobile ? 360 : 900,
          marginLeft: size.left,
          transform: `scale(${size.scale})`,
          transformOrigin: "top left",
        }}
      >
        <div
          className="artist-site"
          style={
            {
              background: colors.canvas,
              color: colors.ink,
              "--paper": colors.canvas,
              "--ink": colors.ink,
              "--muted": colors.ink,
            } as React.CSSProperties
          }
        >
          <EditingContext.Provider value={null}>
            <TypographyContext.Provider
              value={{
                site: {
                  ...site,
                  pages: site.pages.map((p) => (p.id === page.id ? page : p)),
                },
                mobile,
              }}
            >
              <CompositionSections page={page} mobileOverride={mobile} />
            </TypographyContext.Provider>
          </EditingContext.Provider>
        </div>
      </div>
    </div>
  );
}
export function ArrangementsDialog({
  site,
  page,
  sectionId,
  initialMobile = false,
  close,
  apply,
}: {
  site: Site;
  page: Page;
  sectionId: string;
  initialMobile?: boolean;
  close: () => void;
  apply: (option: ArrangementOption, mobile: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      returnTo?.focus();
    };
  }, []);
  const mobile = initialMobile;
  const group = (
    page.composition ? orderedSections(page.composition, mobile) : []
  ).find((s) => s.id === sectionId);
  const options = mobile
    ? mobileArrangementOptions.filter(
        (option) =>
          option.id !== "leading" || (group?.blockIds.length ?? 0) > 1,
      )
    : arrangementOptions;
  const [chosen, setChosen] = useState<ArrangementOption>("balanced");
  return (
    <dialog
      ref={dialog}
      className="arrangements-dialog"
      aria-label={`${mobile ? "Mobile" : "Desktop"} arrangement alternatives`}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onKeyDown={trapDialogTab}
    >
      <header>
        <div>
          <span className="study-eyebrow">
            {mobile ? "MOBILE" : "DESKTOP"} COMPOSITION /{" "}
            {options.length === 3 ? "THREE" : "TWO"} POSSIBILITIES
          </span>
          <h2>
            The same works.
            <br />
            Another conversation.
          </h2>
        </div>
        <button aria-label="Close arrangements" onClick={close}>
          ×
        </button>
      </header>
      <p className="arrangement-intro">
        {group?.blockIds.length} selected{" "}
        {group?.blockIds.length === 1 ? "work" : "works"}. Original order,
        captions and crops. Your {mobile ? "desktop" : "mobile"} arrangement
        stays as authored.
      </p>
      <p className="composition-lock-note">
        Choose a group on the other device’s canvas to arrange it independently.
      </p>
      <p className="composition-lock-note">
        Reading order, source media and crops are locked. Only{" "}
        {mobile ? "mobile" : "desktop"} geometry changes.
      </p>
      <div
        className="arrangement-options"
        role="group"
        aria-label="Composition alternatives"
      >
        {options.map((option) => {
          const proposed = proposeArrangement(
              page,
              sectionId,
              option.id,
              mobile,
            ),
            section = orderedSections(proposed.composition!, mobile).find(
              (s) => s.id === sectionId,
            )!;
          const preview = {
            ...proposed,
            blocks: proposed.blocks.filter((b) =>
              section.blockIds.includes(b.id),
            ),
            composition: {
              enabled: true,
              desktop: [{ ...section, space: 32 }],
              mobile: [{ ...section, space: 24 }],
            },
          };
          return (
            <button
              key={option.id}
              className="arrangement-option"
              aria-pressed={chosen === option.id}
              onClick={() => setChosen(option.id)}
            >
              <span className="arrangement-option-heading">
                <span>{option.name}</span>
                <span>{chosen === option.id ? "●" : "○"}</span>
              </span>
              <CompositionMiniature
                site={site}
                page={preview}
                mobile={mobile}
              />
              <span className="arrangement-note">{option.note}</span>
            </button>
          );
        })}
      </div>
      <footer>
        <span>Only this section changes. One Undo returns it.</span>
        <div>
          <button onClick={close}>Keep my arrangement</button>
          <button
            className="apply-arrangement"
            onClick={() => apply(chosen, mobile)}
          >
            Use {options.find((o) => o.id === chosen)?.name}
          </button>
        </div>
      </footer>
    </dialog>
  );
}
