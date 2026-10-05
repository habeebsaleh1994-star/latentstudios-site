import { useEffect, useRef, useState } from "react";
import { orderedSections } from "./compositionOrder";
import type { Page, Site } from "./model";
import { uid } from "./ids";
import { planGrouping, readingOrder, type GroupingAction } from "./regrouping";
import { CompositionMiniature } from "./CanvasStudies";
import { trapDialogTab } from "./dialogFocus";
import "./canvas-grouping.css";
import { workLabel } from "./workLabels";
export function WorkSelectionBar({
  page,
  mobile,
  ids,
  message,
  review,
  clear,
  explore,
  relationship,
  removeIntention,
}: {
  page: Page;
  mobile: boolean;
  ids: string[];
  message: string;
  review: (action: GroupingAction) => void;
  clear: () => void;
  explore: (id: string) => void;
  relationship: () => void;
  removeIntention: (id: string) => void;
}) {
  const selected = page.blocks.filter((b) => ids.includes(b.id));
  const group = (
    page.composition ? orderedSections(page.composition, mobile) : []
  ).find(
    (s) =>
      s.blockIds.length === ids.length &&
      s.blockIds.every((id) => ids.includes(id)),
  );
  const separable = (
    page.composition ? orderedSections(page.composition, mobile) : []
  ).some(
    (s) => s.blockIds.length > 1 && s.blockIds.some((id) => ids.includes(id)),
  );
  return (
    <div className="work-selection-bar" aria-label="Selected works">
      <div className="work-selection-summary">
        <strong>
          {mobile ? "Phone" : "Desktop"} · {selected.length}{" "}
          {selected.length === 1 ? "work" : "works"} selected
        </strong>
        <span>{selected.map((b) => workLabel(b)).join(" / ")}</span>
      </div>
      <div className="work-selection-actions">
        <button
          onClick={relationship}
          disabled={
            !selected.some((b) => b.type === "image" || b.type === "text")
          }
        >
          Explore image + writing ↗
        </button>
        {(page.intentions ?? [])
          .filter((r) => ids.includes(r.from) || ids.includes(r.to))
          .map((r) => (
            <button
              key={r.id}
              title="Guides exploration only. Remove without changing the canvas."
              aria-label={`Remove ${r.kind} intention for ${r.scope}`}
              onClick={() => removeIntention(r.id)}
            >
              {r.kind === "together" ? "Together" : "Follows"} ·{" "}
              {r.scope === "mobile"
                ? "Phone"
                : r.scope === "both"
                  ? "Both"
                  : "Desktop"}{" "}
              ×
            </button>
          ))}
        {group && group.blockIds.length > 1 ? (
          <button onClick={() => explore(group.id)}>
            Try group arrangements ↗
          </button>
        ) : (
          <button disabled={ids.length < 2} onClick={() => review("group")}>
            Group selected
          </button>
        )}
        {separable && (
          <button onClick={() => review("separate")}>Separate selected</button>
        )}
        <button onClick={clear} aria-label="Clear work selection">
          Clear ×
        </button>
      </div>
      <p>
        Drag a selected work’s grip into a section to group, or between sections
        to move. Simple changes apply directly with one Undo. Only the selected
        device’s arrangement changes.
      </p>
      {message && (
        <p className="work-grouping-refusal" role="status">
          {message} Your draft is unchanged.
        </p>
      )}
    </div>
  );
}
export function groupingSubset(page: Page, ids: string[]): Page {
  const chosen = new Set(ids),
    c = page.composition!;
  let size = -1;
  while (size !== chosen.size) {
    size = chosen.size;
    for (const s of [...c.desktop, ...c.mobile])
      if (s.blockIds.some((id) => chosen.has(id)))
        s.blockIds.forEach((id) => chosen.add(id));
  }
  return {
    ...page,
    blocks: page.blocks.filter((b) => chosen.has(b.id)),
    composition: {
      ...c,
      desktop: c.desktop.filter((s) => s.blockIds.some((id) => chosen.has(id))),
      mobile: c.mobile.filter((s) => s.blockIds.some((id) => chosen.has(id))),
    },
  };
}
export function GroupingDialog({
  site,
  page,
  ids,
  action,
  initialMobile,
  close,
  apply,
}: {
  site: Site;
  page: Page;
  ids: string[];
  action: GroupingAction;
  initialMobile: boolean;
  close: () => void;
  apply: (action: GroupingAction, id: string, mobile: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [proposalId] = useState(uid),
    [mobile, setMobile] = useState(initialMobile),
    [overview, setOverview] = useState(true);
  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => returnTo?.focus();
  }, []);
  const plan = planGrouping(page, ids, action, proposalId, initialMobile);
  const orders = [
    { name: "Desktop", ids: readingOrder(page) },
    { name: "Mobile", ids: readingOrder(page, true) },
  ];
  return (
    <dialog
      ref={dialog}
      className="arrangements-dialog grouping-dialog"
      aria-labelledby="grouping-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onKeyDown={trapDialogTab}
    >
      <header>
        <div>
          <span className="study-eyebrow">
            {action === "group"
              ? "BRING WORKS TOGETHER"
              : "GIVE WORKS THEIR OWN SPACE"}
          </span>
          <h2 id="grouping-title">
            {action === "group"
              ? "A new relationship."
              : "A little more independence."}
          </h2>
        </div>
        <button onClick={close} aria-label="Close grouping review">
          ×
        </button>
      </header>
      <p className="arrangement-intro">
        {action === "group"
          ? `Selected works become one ${initialMobile ? "phone" : "desktop"} group. The other device keeps its arrangement.`
          : "Selected works become separate sections. Remaining groups split only where needed to keep the sequence intact."}{" "}
        Unselected companions can change size when their old group splits.
        Words, files, crops and focal points stay attached to each work.
      </p>
      <div className="grouping-locks">
        <span>
          ✓ {initialMobile ? "Phone" : "Desktop"} reading order locked
        </span>
        <span>✓ Other device unchanged</span>
        <span>✓ Media & crops locked</span>
      </div>
      {plan.ok ? (
        <>
          <div
            className="composition-choice-device"
            role="group"
            aria-label="Review device"
          >
            <button aria-pressed={!mobile} onClick={() => setMobile(false)}>
              Desktop reading
            </button>
            <button aria-pressed={mobile} onClick={() => setMobile(true)}>
              Mobile reading
            </button>
          </div>
          <div className="grouping-overview-control">
            <span>
              {overview
                ? "Overview · each composition scaled to fit"
                : "Inspect · width relative to its reading column"}
            </span>
            <button
              aria-pressed={!overview}
              onClick={() => setOverview(!overview)}
            >
              {overview ? "Inspect at full width" : "Fit overview"}
            </button>
          </div>
          <div className="grouping-comparison">
            <section data-grouping-preview="current">
              <h3>Current</h3>
              <CompositionMiniature
                site={site}
                page={groupingSubset(page, plan.affectedIds)}
                mobile={mobile}
                maxHeight={overview ? 360 : undefined}
              />
            </section>
            <section data-grouping-preview="proposed">
              <h3>
                Proposed{" "}
                <small>{mobile ? "Mobile" : "Desktop"} · same order</small>
              </h3>
              <CompositionMiniature
                site={site}
                page={groupingSubset(plan.page, plan.affectedIds)}
                mobile={mobile}
                maxHeight={overview ? 360 : undefined}
              />
            </section>
          </div>
          <p className="grouping-caption">
            Affected sections and their companions are shown. Only the{" "}
            {initialMobile ? "phone" : "desktop"} grouping changes; the other
            device is unchanged.
          </p>
        </>
      ) : (
        <div className="grouping-conflict" role="status">
          <h3>The reading order comes first.</h3>
          <p>{plan.reason}</p>
          <div>
            {orders.map((order) => (
              <section key={order.name}>
                <h4>{order.name} reading order</h4>
                <ol>
                  {order.ids.map((id) => {
                    const b = page.blocks.find((b) => b.id === id)!;
                    return (
                      <li key={id} data-chosen={ids.includes(id) || undefined}>
                        {workLabel(b)}
                        {ids.includes(id) && <span>selected</span>}
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        </div>
      )}
      <footer>
        <span>
          {plan.ok
            ? "One Apply. One Undo. Current words and crops retained."
            : "Your draft is unchanged. No order or crop lock was relaxed."}
        </span>
        <div>
          <button onClick={close}>Keep current grouping</button>
          {plan.ok && (
            <button
              className="apply-arrangement"
              onClick={() => apply(action, proposalId, initialMobile)}
            >
              {action === "group"
                ? `Group ${ids.length} works`
                : "Separate selected works"}
            </button>
          )}
        </div>
      </footer>
    </dialog>
  );
}
