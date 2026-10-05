import { useEffect, useRef, useState } from "react";
import type { Site, Page, CompositionStudy } from "./model";
import { applyStudy, studyChanges } from "./compositionStudies";
import { EditingContext } from "./editing";
import { MediaLoadMode } from "./MediaSources";
import { PreviewFrame } from "./PreviewFrame";
import { SiteRenderer } from "./SiteRenderer";
import {
  readPreviewPosition,
  placePreviewPosition,
  type PreviewPosition,
} from "./previewPosition";

export function StudyComparison({
  site,
  page,
  study,
  mobile,
  zoom,
  initialPosition,
  close,
  apply,
  applyLabel,
  scopeNote,
  viewportWidth,
}: {
  site: Site;
  page: Page;
  study: CompositionStudy;
  mobile: boolean;
  zoom: "fit" | "actual";
  initialPosition: PreviewPosition;
  close: (position: PreviewPosition) => void;
  apply: () => void;
  applyLabel?: string;
  scopeNote?: string;
  viewportWidth?: number;
}) {
  const [a, setA] = useState<Document | null>(null),
    [b, setB] = useState<Document | null>(null);
  const [side, setSide] = useState<"a" | "b">("a");
  const position = useRef(initialPosition);
  const leader = useRef<"a" | "b">("a");
  function switchSide(next: "a" | "b") {
    const from = side === "a" ? a : b,
      to = next === "a" ? a : b;
    if (from) position.current = readPreviewPosition(from);
    leader.current = next;
    setSide(next);
    // Restore after visibility/layout settles. The hidden pane can have a
    // different intrinsic media height while its assets are decoding.
    requestAnimationFrame(() => {
      if (to) placePreviewPosition(to, position.current);
    });
  }
  const compared = {
    ...site,
    pages: site.pages.map((p) => (p.id === page.id ? applyStudy(p, study) : p)),
  };
  const changes = studyChanges(page, study);
  useEffect(() => {
    if (!a || !b) return;
    const documents = [a, b],
      applied = new Map<Document, number>();
    documents.forEach((doc) => {
      doc.documentElement.style.overflowAnchor = "none";
      // A linked restore must be atomic: the site's smooth scrolling would
      // otherwise report intermediate positions back through the other pane.
      doc.documentElement.style.scrollBehavior = "auto";
    });
    const restore = () =>
      documents.forEach((doc) =>
        applied.set(doc, placePreviewPosition(doc, position.current)),
      );
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(restore);
    });
    const listeners = documents.map((doc, index) => {
      const takeLead = () => {
        leader.current = index === 0 ? "a" : "b";
      };
      const scroll = () => {
        if ((index === 0 ? "a" : "b") !== leader.current) return;
        if (
          Math.abs(
            (doc.defaultView?.scrollY ?? 0) - (applied.get(doc) ?? -10000),
          ) < 1
        ) {
          return;
        }
        position.current = readPreviewPosition(doc);
        documents
          .filter((other) => other !== doc)
          .forEach((other) =>
            applied.set(other, placePreviewPosition(other, position.current)),
          );
      };
      const preventEdit = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close(position.current);
        }
        if (
          (e.metaKey || e.ctrlKey) &&
          ["z", "y"].includes(e.key.toLowerCase())
        )
          e.preventDefault();
      };
      doc.defaultView?.addEventListener("scroll", scroll, { passive: true });
      const interactions = [
        "wheel",
        "pointerdown",
        "touchstart",
        "keydown",
      ] as const;
      interactions.forEach((type) =>
        doc.defaultView?.addEventListener(type, takeLead, { passive: true }),
      );
      doc.defaultView?.addEventListener("keydown", preventEdit);
      return () => {
        doc.defaultView?.removeEventListener("scroll", scroll);
        doc.defaultView?.removeEventListener("keydown", preventEdit);
        interactions.forEach((type) =>
          doc.defaultView?.removeEventListener(type, takeLead),
        );
      };
    });
    const resize = new ResizeObserver(restore);
    documents.forEach((doc) => resize.observe(doc.documentElement));
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      listeners.forEach((remove) => remove());
    };
  }, [a, b, study.id, mobile, zoom, close]);
  return (
    <section
      className="study-ab"
      aria-label="Read-only arrangement comparison"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close(position.current);
        }
      }}
    >
      <div className="comparison-heading">
        <div>
          <strong>Compare arrangements</strong>
          <span>
            Read-only · matched scale ·{" "}
            {page.composition?.enabled && study.composition?.enabled
              ? "linked work position"
              : "linked page progress"}
          </span>
        </div>
        <button onClick={() => close(position.current)}>Return to draft</button>
        <button
          className="comparison-apply"
          disabled={(page.studies?.length ?? 0) >= 12}
          onClick={apply}
        >
          {applyLabel ?? "Use this arrangement"}
        </button>
      </div>
      <p className="comparison-scope">
        {scopeNote && <strong>{scopeNote} </strong>}
        Both use today’s words, media and crops. Studies restore arrangement and exploration intentions.
        Applying keeps your current arrangement as a study first.
        {(page.studies?.length ?? 0) >= 12 &&
          " The study shelf is full. Return to the draft and remove a study before applying."}
        {changes.added + changes.removed > 0 &&
          ` ${changes.added} new / ${changes.removed} removed works reconciled.`}
      </p>
      <div
        className="comparison-switch"
        role="group"
        aria-label="Same-position comparison view"
      >
        <button aria-pressed={side === "a"} onClick={() => switchSide("a")}>
          A · Current draft
        </button>
        <button aria-pressed={side === "b"} onClick={() => switchSide("b")}>
          B · {study.name}
        </button>
      </div>
      <div className="comparison-panes">
        {(
          [
            { id: "a", name: "Current draft", value: site, ready: setA },
            { id: "b", name: study.name, value: compared, ready: setB },
          ] as const
        ).map((item) => (
          <div
            key={item.id}
            className="comparison-pane"
            data-side={item.id}
            data-visible={side === item.id}
          >
            <h3>
              {item.id.toUpperCase()} <span>{item.name}</span>
            </h3>
            <div
              className={`comparison-paper ${mobile ? "is-mobile" : ""}`}
              onScroll={(e) => {
                const source = e.currentTarget;
                source
                  .closest(".comparison-panes")
                  ?.querySelectorAll<HTMLElement>(".comparison-paper")
                  .forEach((other) => {
                    if (
                      other !== source &&
                      Math.abs(other.scrollLeft - source.scrollLeft) > 1
                    )
                      other.scrollLeft = source.scrollLeft;
                  });
              }}
            >
              <EditingContext.Provider value={null}>
                <MediaLoadMode.Provider value="eager">
                  <PreviewFrame
                    viewportWidth={viewportWidth}
                    mobile={mobile}
                    zoom={zoom}
                    pageId={`${page.id}-${study.id}`}
                    label={`${item.id.toUpperCase()} ${mobile ? "Mobile" : "Desktop"} comparison`}
                    onReady={item.ready}
                  >
                    <SiteRenderer
                      site={item.value}
                      pageId={page.id}
                      navigate={() => {}}
                    />
                    <div aria-hidden="true" style={{ height: "100vh" }} />
                  </PreviewFrame>
                </MediaLoadMode.Provider>
              </EditingContext.Provider>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
