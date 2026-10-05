import { useState } from "react";
import type { Page } from "./model";
import { Media } from "./Media";
import { workLabel } from "./workLabels";
import { WorkSettings } from "./WorkSettings";
export function WorkContext({
  page,
  id,
  mobile,
  viewport,
  choose,
  find,
  reveal,
  setReveal,
  host,
  change,
  previewFlow,
  exploreRelationship,
}: {
  exploreRelationship: (id: string) => void;
  page: Page;
  id: string | null;
  mobile: boolean;
  viewport: number;
  choose: (id: string) => void;
  find: () => void;
  reveal: string | null;
  setReveal: (id: string | null) => void;
  host: (el: HTMLDivElement | null) => void;
  change: (fn: (p: Page) => Page) => void;
  previewFlow: (id: string) => void;
}) {
  const [picker, setPicker] = useState(false);
  const b = page.blocks.find((b) => b.id === id);
  const sections = page.composition?.[mobile ? "mobile" : "desktop"] ?? [],
    section = sections.find((s) => s.blockIds.includes(id ?? ""));
  const spatial = !!section?.spatial?.enabled;
  return (
    <section
      className="work-context"
      aria-label="Selected work controls"
      data-work-id={b?.id}
    >
      <div className="work-context-heading">
        <button
          className="work-picker-toggle"
          aria-expanded={picker}
          onClick={() => setPicker(!picker)}
        >
          {b
            ? `${b.type === "text" ? "Writing" : b.type === "video" ? "Film" : "Image"} ${String(page.blocks.indexOf(b) + 1).padStart(2, "0")}`
            : "Choose a work"}{" "}
          <span aria-hidden="true">⌄</span>
        </button>
        <div className="selected-work-breadcrumb">
          <strong title={b ? workLabel(b) : undefined}>
            {b ? workLabel(b) : "Choose visually, including covered works"}
          </strong>
          <span>
            {mobile ? "Phone" : "Desktop"} layout · viewport {viewport}px
            {section ? ` · Section ${sections.indexOf(section) + 1}` : ""}
          </span>
        </div>
        {b && (
          <>
            <button onClick={find}>Find</button>
            {spatial && (
              <button
                aria-pressed={reveal === id}
                onClick={() => setReveal(reveal === id ? null : id)}
              >
                {reveal === id ? "End reveal" : "Reveal"}
              </button>
            )}
          </>
        )}
      </div>
      {picker && (
        <div className="work-picker" aria-label="Choose a work visually">
          {page.blocks.map((b, i) => (
            <button
              key={b.id}
              data-work-picker={b.id}
              aria-pressed={id === b.id}
              onClick={() => {
                choose(b.id);
                setPicker(false);
              }}
            >
              <span className={`work-thumbnail thumb-${b.type}`}>
                {b.type === "text" ? (
                  <span>{b.text || "Writing"}</span>
                ) : b.type === "video" ? (
                  <>
                    <span aria-hidden="true">▷</span>
                    <small>Film</small>
                  </>
                ) : (
                  <Media block={b} thumb />
                )}
              </span>
              <strong>
                {String(i + 1).padStart(2, "0")} ·{" "}
                {b.type === "text"
                  ? "Writing"
                  : b.type === "video"
                    ? "Film"
                    : "Image"}
              </strong>
              <span>{workLabel(b)}</span>
            </button>
          ))}
        </div>
      )}
      {reveal === id && id && (
        <p className="work-reveal-note" role="status">
          Temporary reveal · saved layers are unchanged. Escape or End reveal to
          return.
        </p>
      )}
      {b && (b.type === "image" || b.type === "text") && (
        <div className="relationship-context">
          <button onClick={() => exploreRelationship(b.id)}>
            Explore image + writing ↗
          </button>
          {(page.intentions ?? [])
            .filter((r) => r.from === b.id || r.to === b.id)
            .map((r) => (
              <button
                key={r.id}
                aria-label={`Remove ${r.kind} intention for ${r.scope}`}
                title="Guides exploration only. Remove without changing the canvas."
                onClick={() =>
                  change((p) => ({
                    ...p,
                    intentions: p.intentions?.filter((i) => i.id !== r.id),
                  }))
                }
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
        </div>
      )}
      <div ref={host} className="work-controls-host" />
      {b && section && !spatial && (
        <>
          <p className="work-flow-note">
            This work flows on {mobile ? "phone" : "desktop"}. Select its
            section to place it freely.
          </p>
          <WorkSettings
            page={page}
            section={section}
            id={b.id}
            mobile={mobile}
            change={change}
            choose={choose}
            previewFlow={() => previewFlow(section.id)}
          />
        </>
      )}
    </section>
  );
}
