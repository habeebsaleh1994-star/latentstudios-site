import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Page, Site } from "./model";
import { EditingContext } from "./editing";
import { MediaLoadMode } from "./MediaSources";
import { PreviewFrame } from "./PreviewFrame";
import { SiteRenderer } from "./SiteRenderer";
import { trapDialogTab } from "./dialogFocus";
import { workLabel } from "./workLabels";
import {
  proposeRelationships,
  scopeLabel,
  type RelationshipRequest,
  type RelationshipScope,
} from "./relationships";

type Review = {
  ratio: number;
  issues: string[];
  widths: number[];
  textSize: number;
};
/** Review actual rendered work, including decoded original media and inherited/named typography. */
function RenderedPair({
  site,
  page,
  imageId,
  textId,
  width,
  label,
  review,
  dismiss,
  visible = false,
}: {
  site: Site;
  page: Page;
  imageId: string;
  textId: string;
  width: number;
  label: string;
  review?: (r: Review) => void;
  dismiss?: () => void;
  visible?: boolean;
}) {
  const [doc, setDoc] = useState<Document | null>(null);
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;
  const report = useRef(review);
  report.current = review;
  useEffect(() => {
    if (!doc) return;
    let cancelled = false,
      timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const inspect = async () => {
      if (cancelled) return;
      const nodes = [
        ...doc.querySelectorAll<HTMLElement>("[data-composition-block]"),
      ];
      const a = nodes.find((n) => n.dataset.compositionBlock === imageId),
        b = nodes.find((n) => n.dataset.compositionBlock === textId);
      const img = a?.querySelector<HTMLImageElement>("img"),
        text = b?.querySelector<HTMLElement>(".direction-prose");
      const siblings = a
        ?.closest(".composition-section")
        ?.querySelectorAll<HTMLImageElement>("img");
      if (
        !a ||
        !b ||
        !img?.complete ||
        !img.naturalWidth ||
        !text ||
        [...(siblings ?? [])].some((i) => !i.complete || !i.naturalWidth)
      ) {
        if (++attempts < 100) timer = setTimeout(() => void inspect(), 100);
        else
          report.current?.({
            ratio: 0,
            issues: [
              "The original media could not be loaded. Restore it before applying an alternative.",
            ],
            widths: [],
            textSize: 0,
          });
        return;
      }
      await doc.fonts.ready;
      if (cancelled) return;
      const x = a.getBoundingClientRect(),
        y = b.getBoundingClientRect(),
        t = text.getBoundingClientRect(),
        style = doc.defaultView!.getComputedStyle(text);
      const size = parseFloat(style.fontSize),
        issues: string[] = [];
      if (t.width < size * 8)
        issues.push(
          `${width}px: writing has less than about 16 characters of reading width. The type was kept unchanged.`,
        );
      if (
        text.scrollWidth > text.clientWidth + 2 ||
        doc.documentElement.scrollWidth > width + 2
      )
        issues.push(`${width}px: content overflows its available width.`);
      if (
        Math.min(x.right, y.right) - Math.max(x.left, y.left) > 2 &&
        Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 2
      )
        issues.push(`${width}px: the selected works overlap.`);
      const block = page.blocks.find((b) => b.id === imageId)!;
      const r = img.getBoundingClientRect();
      if (
        block.fit === "original" &&
        Math.abs(r.width / r.height - img.naturalWidth / img.naturalHeight) >
          0.04
      )
        issues.push(`${width}px: the uncropped image ratio was not preserved.`);
      report.current?.({
        ratio: img.naturalWidth / img.naturalHeight,
        issues,
        widths: [x.width, t.width],
        textSize: size,
      });
      if (visible) {
        doc.documentElement.style.scrollBehavior = "auto";
        a.closest(".composition-section")?.scrollIntoView({ block: "start" });
      }
    };
    timer = setTimeout(() => void inspect(), 120);
    const win = doc.defaultView;
    const guard = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissRef.current) {
        e.preventDefault();
        dismissRef.current();
      }
      if ((e.metaKey || e.ctrlKey) && ["z", "y"].includes(e.key.toLowerCase()))
        e.preventDefault();
    };
    win?.addEventListener("keydown", guard);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      win?.removeEventListener("keydown", guard);
    };
  }, [doc, page, imageId, textId, width, visible]);
  return (
    <EditingContext.Provider value={null}>
      <MediaLoadMode.Provider value="eager">
        <PreviewFrame
          mobile={width < 760}
          viewportWidth={width}
          pageId={`${page.id}-${label}`}
          label={label}
          onReady={setDoc}
        >
          <SiteRenderer
            site={{
              ...site,
              pages: site.pages.map((p) => (p.id === page.id ? page : p)),
            }}
            pageId={page.id}
            navigate={() => {}}
          />
        </PreviewFrame>
      </MediaLoadMode.Provider>
    </EditingContext.Provider>
  );
}
export function RelationshipExplorer({
  site,
  page,
  selected,
  mobile,
  close,
  apply,
  error,
}: {
  site: Site;
  page: Page;
  selected: string;
  mobile: boolean;
  error?: string;
  close: () => void;
  apply: (
    source: Page,
    q: RelationshipRequest,
    ratio: number,
    id: string,
  ) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const selectedWork = page.blocks.find((b) => b.id === selected);
  const images = page.blocks.filter((b) => b.type === "image"),
    texts = page.blocks.filter((b) => b.type === "text");
  const [imageId, setImageId] = useState(
    selectedWork?.type === "image" ? selected : (images[0]?.id ?? ""),
  );
  const [textId, setTextId] = useState(
    selectedWork?.type === "text" ? selected : (texts[0]?.id ?? ""),
  );
  const [scope, setScope] = useState<RelationshipScope>(
    mobile ? "mobile" : "desktop",
  );
  const [together, setTogether] = useState(true),
    [follows, setFollows] = useState(true),
    [remember, setRemember] = useState(true),
    [hold, setHold] = useState(false);
  const [explore, setExplore] = useState(false),
    [choice, setChoice] = useState("balance"),
    [width, setWidth] = useState(mobile ? 390 : 768),
    [original, setOriginal] = useState(false);
  const [ratio, setRatio] = useState(0),
    [probeError, setProbeError] = useState("");
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const q = useMemo<RelationshipRequest>(
    () => ({
      image: imageId,
      text: textId,
      scope,
      together,
      follows,
      remember,
      locked: hold ? [imageId, textId] : [],
    }),
    [imageId, textId, scope, together, follows, remember, hold],
  );
  const result = useMemo(
    () => proposeRelationships(site, page, q, ratio),
    [site, page, q, ratio],
  );
  const widths =
    scope === "both"
      ? [768, 1440, 390]
      : scope === "mobile"
        ? [390, 430]
        : [768, 1440];
  const valid = result.candidates.filter((c) =>
    widths.every((w) => reviews[`${c.id}-${w}`]?.issues.length === 0),
  );
  const checked = result.candidates.every((c) =>
    widths.every((w) => reviews[`${c.id}-${w}`]),
  );
  const chosen = valid.find((c) => c.id === choice) ?? valid[0];
  const reset = () => {
    setExplore(false);
    setReviews({});
    setOriginal(false);
  };
  const probe = useCallback((r: Review) => {
    setRatio(r.ratio);
    setProbeError(r.ratio ? "" : r.issues.join(" "));
  }, []);
  useEffect(() => {
    const el = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => el?.focus();
  }, []);
  const affected =
    page.composition?.[mobile ? "mobile" : "desktop"]
      .filter(
        (s) => s.blockIds.includes(imageId) || s.blockIds.includes(textId),
      )
      .flatMap((s) => s.blockIds) ?? [];
  const saved = (page.intentions ?? []).filter(
    (r) => [r.from, r.to].includes(imageId) || [r.from, r.to].includes(textId),
  );
  return (
    <dialog
      ref={dialog}
      className="relationship-explorer"
      data-exploring={explore}
      aria-label="Explore a relationship"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onKeyDown={trapDialogTab}
    >
      <header>
        <div>
          <span className="relationship-eyebrow">
            COMPOSITION / A RELATIONSHIP
          </span>
          <h2>Let these works speak together.</h2>
        </div>
        <button aria-label="Close relationship exploration" onClick={close}>
          ×
        </button>
      </header>
      {explore && (
        <button
          className="relationship-edit-intentions"
          onClick={() => setExplore(false)}
        >
          Edit intentions · {scopeLabel(scope)}
        </button>
      )}
      {explore && chosen && (
        <label className="relationship-mobile-choice">
          Alternative
          <select
            aria-label="Phone composition alternative"
            value={chosen.id}
            onChange={(e) => {
              setChoice(e.target.value);
              setOriginal(false);
            }}
          >
            {valid.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="relationship-body">
        <aside className="relationship-intentions">
          <p>
            Choose what matters. Explore with today’s content; your canvas stays
            as it is until you apply.
          </p>
          <label>
            Image
            <select
              aria-label="Relationship image"
              value={imageId}
              onChange={(e) => {
                setImageId(e.target.value);
                setRatio(0);
                reset();
              }}
            >
              {images.map((b) => (
                <option key={b.id} value={b.id}>
                  {workLabel(b)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Writing
            <select
              aria-label="Relationship writing"
              value={textId}
              onChange={(e) => {
                setTextId(e.target.value);
                setRatio(0);
                reset();
              }}
            >
              {texts.map((b) => (
                <option key={b.id} value={b.id}>
                  {workLabel(b).slice(0, 70)}
                </option>
              ))}
            </select>
          </label>
          <label className="relationship-check">
            <input
              type="checkbox"
              checked={together}
              onChange={(e) => {
                setTogether(e.target.checked);
                reset();
              }}
            />
            <span>
              Keep these works together
              <small>One section; nearby works may share it.</small>
            </span>
          </label>
          <label className="relationship-check">
            <input
              type="checkbox"
              checked={follows}
              onChange={(e) => {
                setFollows(e.target.checked);
                reset();
              }}
            />
            <span>
              This text follows this image
              <small>Immediately in reading order. Layers are separate.</small>
            </span>
          </label>
          <label>
            Apply to
            <select
              aria-label="Relationship scope"
              value={scope}
              onChange={(e) => {
                const s = e.target.value as RelationshipScope;
                setScope(s);
                setWidth(s === "mobile" ? 390 : 768);
                reset();
              }}
            >
              <option value="desktop">Desktop only</option>
              <option value="mobile">Phone only</option>
              <option value="both">Desktop + phone</option>
            </select>
          </label>
          <label className="relationship-check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => {
                setRemember(e.target.checked);
                reset();
              }}
            />
            <span>
              Remember on Apply
              <small>
                {remember
                  ? "Guide future explorations in this scope. Manual edits remain free."
                  : "Only this exploration. Existing saved intentions stay unchanged."}
              </small>
            </span>
          </label>
          <details>
            <summary>Preserve current placement</summary>
            <label className="relationship-check">
              <input
                type="checkbox"
                checked={hold}
                onChange={(e) => {
                  setHold(e.target.checked);
                  reset();
                }}
              />
              <span>
                Hold this pair’s current sections
                <small>
                  This exploration only. Includes position, peers and reading
                  order.
                </small>
              </span>
            </label>
          </details>
          <div className="relationship-preserved">
            Always kept: original files, image crop and focal point, words, type
            and site identity.
          </div>
          {saved.length > 0 && (
            <p className="relationship-existing">
              {saved.length} remembered intention{saved.length === 1 ? "" : "s"}{" "}
              touches this pair. Other pairs and devices remain in force.
            </p>
          )}
          {affected.length > 2 && (
            <p>
              {affected.length - 2} other work{affected.length === 3 ? "" : "s"}{" "}
              in these sections will also appear. Four works maximum.
            </p>
          )}
          <button
            className="relationship-primary"
            disabled={!imageId || !textId || !ratio || explore}
            onClick={() => {
              setExplore(true);
              setReviews({});
            }}
          >
            Explore compositions
          </button>
          {(!imageId || !textId) && (
            <p>
              Add one image and one writing work to this page before exploring
              their relationship.
            </p>
          )}
          {probeError && <p role="alert">{probeError}</p>}
        </aside>
        <main className="relationship-stage">
          {!explore ? (
            <>
              <div className="relationship-preview-heading">
                <strong>Current arrangement</strong>
                <span>Read-only · {width}px</span>
              </div>
              <div
                className="relationship-paper"
                style={{ width, maxWidth: "100%", marginInline: "auto" }}
              >
                <RenderedPair
                  site={site}
                  page={page}
                  imageId={imageId}
                  textId={textId}
                  width={width}
                  label="Current relationship preview"
                  dismiss={close}
                  visible
                />
              </div>
              <p className="relationship-explanation">
                Alternatives use responsive flow. A previous free placement is
                kept as a study on Apply. Source content is shared, never
                copied.
              </p>
            </>
          ) : (
            <>
              <div
                className="relationship-options"
                aria-label="Valid relationship alternatives"
              >
                {valid.map((c) => (
                  <button
                    key={c.id}
                    aria-pressed={chosen?.id === c.id}
                    onClick={() => {
                      setChoice(c.id);
                      setOriginal(false);
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              {!checked && result.candidates.length > 0 && (
                <p role="status">
                  Reviewing real images and writing at {widths.join(" / ")}px…
                </p>
              )}
              {checked && (
                <p className="relationship-result" role="status">
                  {valid.length} valid alternative
                  {valid.length === 1 ? "" : "s"} · {scopeLabel(scope)} ·{" "}
                  {remember
                    ? "Intentions remembered on Apply"
                    : "This exploration only"}
                </p>
              )}
              {result.reasons.map((reason) => (
                <p className="relationship-conflict" key={reason}>
                  {reason}
                </p>
              ))}
              {result.candidates.map((c) => {
                const issues = [
                  ...new Set(
                    widths.flatMap(
                      (w) => reviews[`${c.id}-${w}`]?.issues ?? [],
                    ),
                  ),
                ];
                return issues.length ? (
                  <p className="relationship-conflict" key={c.id}>
                    <strong>{c.name} unavailable.</strong> {issues.join(" ")}
                  </p>
                ) : null;
              })}
              {chosen && (
                <>
                  <div className="relationship-preview-heading">
                    <button
                      aria-pressed={original}
                      onClick={() => setOriginal(!original)}
                    >
                      {original ? "Show alternative" : "Compare current"}
                    </button>
                    <label>
                      Review
                      <select
                        aria-label="Relationship preview width"
                        value={width}
                        onChange={(e) => setWidth(Number(e.target.value))}
                      >
                        {[768, 1440, 390, 430].map((w) => (
                          <option key={w} value={w}>
                            {w < 760 ? "Phone" : "Desktop"} · {w}px
                            {!widths.includes(w) ? " · outside checks" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div
                    className="relationship-paper"
                    style={{ width, maxWidth: "100%", marginInline: "auto" }}
                  >
                    <RenderedPair
                      key={`${original}-${chosen.id}-${width}`}
                      site={site}
                      page={original ? page : chosen.page}
                      imageId={imageId}
                      textId={textId}
                      width={width}
                      label={
                        original
                          ? "Original relationship preview"
                          : `${chosen.name} relationship preview`
                      }
                      dismiss={close}
                      visible
                    />
                  </div>
                  <p className="relationship-explanation">
                    <strong>
                      {original ? "Current arrangement" : chosen.name}.
                    </strong>{" "}
                    {original ? "The live draft is unchanged." : chosen.note}{" "}
                    {width < 760 &&
                      "Phone uses a vertical reading sequence; alternatives vary scale and spacing."}{" "}
                    {!widths.includes(width) &&
                      " This width is a preview only; Apply changes only the stated scope."}
                  </p>
                </>
              )}
              {checked && !chosen && (
                <div className="relationship-empty">
                  <h3>Keep the intention. Reconsider the arrangement.</h3>
                  <p>
                    No candidate satisfies these choices. Nothing has been
                    relaxed or changed. Adjust an intention or placement hold,
                    then explore again.
                  </p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
      <footer>
        <span>
          {scopeLabel(scope)} ·{" "}
          {remember ? "Remembered intentions" : "Exploration only"}
          <small>
            Apply keeps the previous arrangement as a study. One Undo returns
            it.
          </small>
        </span>
        <button onClick={close}>Keep current</button>
        <button
          className="relationship-primary"
          disabled={!explore || !chosen || (page.studies?.length ?? 0) >= 12}
          onClick={() => chosen && apply(page, q, ratio, chosen.id)}
        >
          Apply {chosen?.name ?? "alternative"}
        </button>
      </footer>
      {error && (
        <p className="relationship-conflict" role="alert">
          {error}
        </p>
      )}
      {(page.studies?.length ?? 0) >= 12 && (
        <p role="alert">
          The study shelf is full. Keep current and remove a study before
          applying.
        </p>
      )}
      <div className="relationship-review-rack" aria-hidden="true" inert>
        <div style={{ width: 768, height: 900 }}>
          <RenderedPair
            key={`${imageId}-${textId}`}
            site={site}
            page={page}
            imageId={imageId}
            textId={textId}
            width={768}
            label="Relationship source measurement"
            review={probe}
          />
        </div>
        {explore &&
          result.candidates.flatMap((c) =>
            widths.map((w) => (
              <div key={`${c.id}-${w}`} style={{ width: w, height: 1000 }}>
                <RenderedPair
                  site={site}
                  page={c.page}
                  imageId={imageId}
                  textId={textId}
                  width={w}
                  label={`Measure ${c.id} ${w}`}
                  review={(r) =>
                    setReviews((old) => ({ ...old, [`${c.id}-${w}`]: r }))
                  }
                />
              </div>
            )),
          )}
      </div>
    </dialog>
  );
}
