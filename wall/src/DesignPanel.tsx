import { Check } from "lucide-react";
import { availableDirections } from "./styles";
import type { Site } from "./model";
export function DesignPanel({
  site,
  update,
}: {
  site: Site;
  update: (fn: (site: Site) => Site, group?: string) => void;
}) {
  const direction = availableDirections.find((d) => d.id === site.styleId)!;
  return (
    <>
      <div className="section-label">
        <span>A way of seeing</span>
        <span className="quiet">10 directions</span>
      </div>
      <div className="direction-options">
        {availableDirections.map((d, i) => (
          <button
            key={d.id}
            className="direction-choice"
            aria-pressed={site.styleId === d.id}
            aria-label={`Use ${d.name} style`}
            onClick={() => update((s) => ({ ...s, styleId: d.id }))}
          >
            <span className={`style-mini mini-${d.id}`} aria-hidden="true">
              <span>Aa</span>
              <img src="/media/sea.jpg" alt="" />
              <i />
              <i />
            </span>
            <span className="direction-choice-text">
              <strong>{d.name}</strong>
              <small>{d.short}</small>
            </span>
            <span className="direction-check">
              {site.styleId === d.id ? (
                <Check size={15} />
              ) : (
                String(i + 1).padStart(2, "0")
              )}
            </span>
          </button>
        ))}
      </div>
      <p className="panel-hint direction-explanation">
        {direction.composition}
      </p>
      <a
        className="wide-button examples-link"
        href="?examples=1"
        target="_blank"
        rel="noreferrer"
      >
        Explore ten artist studios ↗
      </a>
      <p className="panel-hint">
        Fictional practices, saved separately. Your current draft is never
        replaced.
      </p>
      <div className="editor-note">
        <span>Your work stays yours.</span>
        <p>
          Every direction uses the same pages, media, and sequence. Each
          remembers its own identity. Open Identity to shape type, colour, and
          proportion.
        </p>
      </div>
    </>
  );
}
