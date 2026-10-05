import { CompositionSections } from "./CompositionSections";
import { EditableText } from "./editing";
import { useState } from "react";
import type { RendererProps } from "./rendererTypes";
import { Media } from "./Media";
import {
  coverOf,
  DirectionHeader,
  DirectionFooter,
  SiteLink,
  ReadingPage,
  Prose,
  EditBlock,
  number,
  Dialog,
} from "./DirectionShared";
import type { Block, Page } from "./model";
function ArchiveRecord({
  page,
  onEdit,
}: {
  page: Page;
  onEdit?: RendererProps["onEdit"];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const index = page.blocks.findIndex((b) => b.id === selected);
  const block = page.blocks[index];
  const display = (b: Block) =>
    b.type === "text" ? (
      <Prose text={b.text} block={{ pageId: page.id, blockId: b.id }} />
    ) : (
      <Media block={b} />
    );
  return (
    <>
      <header className="archive-record-header">
        <EditableText
          className="eyebrow"
          target={{ kind: "page", pageId: page.id, field: "meta" }}
          value={page.meta}
        />
        <EditableText
          as="h1"
          target={{ kind: "page", pageId: page.id, field: "title" }}
          value={page.title}
        />
        <EditableText
          as="p"
          target={{ kind: "page", pageId: page.id, field: "subtitle" }}
          value={page.subtitle}
        />
        <div>
          <span>{number(page.blocks.length)} entries</span>
          <span>
            {page.composition?.enabled ? "Arranged works" : "Contact sheet"}
          </span>
        </div>
      </header>
      {page.composition?.enabled ? (
        <CompositionSections page={page} />
      ) : (
        <div className="archive-sheet">
          {page.blocks.map((b, i) => (
            <section key={b.id} className={`archive-entry block-${b.type}`}>
              <div className="archive-entry-top">
                <span>{number(i + 1)}</span>
                <EditBlock block={b} onEdit={onEdit} />
              </div>
              {b.type === "text" ? (
                <Prose
                  text={b.text}
                  block={{ pageId: page.id, blockId: b.id }}
                />
              ) : (
                <button
                  className="archive-image-button"
                  aria-label={`Open entry ${i + 1}${b.caption ? `: ${b.caption}` : ""}`}
                  onClick={() => setSelected(b.id)}
                >
                  <Media block={b} thumb />
                  <span className="archive-enlarge">View +</span>
                </button>
              )}
              <EditableText
                as="p"
                className="archive-entry-caption"
                target={{
                  kind: "block",
                  pageId: page.id,
                  blockId: b.id,
                  field: "caption",
                }}
                value={b.caption}
              />
            </section>
          ))}
        </div>
      )}
      {!page.blocks.length && !page.composition?.enabled && (
        <p className="direction-empty">
          The first entry belongs here. Add an image, text, or film.
        </p>
      )}
      {block && (
        <Dialog
          title={block.caption || "Archive entry"}
          className="archive-viewer"
          onClose={() => setSelected(null)}
        >
          <header>
            <span>
              {number(index + 1)} / {number(page.blocks.length)}
            </span>
            <button aria-label="Close entry" onClick={() => setSelected(null)}>
              Close ×
            </button>
          </header>
          <div className={`archive-viewer-media fit-${block.fit}`}>
            {display(block)}
          </div>
          <div className="archive-viewer-caption">
            <EditableText
              target={{
                kind: "block",
                pageId: page.id,
                blockId: block.id,
                field: "caption",
              }}
              value={block.caption}
            />
            <EditBlock
              block={block}
              onEdit={
                onEdit
                  ? () => {
                      setSelected(null);
                      onEdit(block.id);
                    }
                  : undefined
              }
            />
          </div>
          <nav aria-label="Archive entry navigation">
            <button
              aria-label="Previous entry"
              disabled={index === 0}
              onClick={() => setSelected(page.blocks[index - 1].id)}
            >
              ← Previous
            </button>
            <button
              aria-label="Next entry"
              disabled={index === page.blocks.length - 1}
              onClick={() => setSelected(page.blocks[index + 1].id)}
            >
              Next →
            </button>
          </nav>
        </Dialog>
      )}
    </>
  );
}
export function ArchiveRenderer({
  site,
  pageId,
  navigate,
  onEdit,
}: RendererProps) {
  const page =
    site.pages.find((p) => p.id === pageId) ??
    site.pages.find((p) => p.kind === "home")!;
  const home = site.pages.find((p) => p.kind === "home")!;
  const [filter, setFilter] = useState<"all" | "project" | "writing">("all");
  const [query, setQuery] = useState("");
  const [hovered, setHovered] = useState("");
  const records = site.pages.filter((p) => p.kind !== "home");
  const visible = records.filter(
    (p) =>
      (filter === "all" || p.kind === filter) &&
      `${p.title} ${p.meta} ${p.subtitle}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const featured =
    records.find((p) => p.id === hovered) ?? visible.find((p) => coverOf(p));
  const cover = featured ? coverOf(featured) : undefined;
  return (
    <div
      className={`artist-site archive-site theme-${site.theme} type-${site.typography}`}
    >
      <a className="skip-link" href="#site-main">
        Skip to content
      </a>
      <DirectionHeader
        variant="archive"
        site={site}
        page={page}
        navigate={navigate}
      />
      <main id="site-main" className="archive-main">
        {page.kind === "home" ? (
          <>
            <section className="archive-intro">
              <EditableText
                className="eyebrow"
                target={{ kind: "page", pageId: page.id, field: "meta" }}
                value={page.meta}
              />
              <EditableText
                as="h1"
                target={{ kind: "page", pageId: page.id, field: "title" }}
                value={page.title}
              />
              <EditableText
                as="p"
                target={{ kind: "page", pageId: page.id, field: "subtitle" }}
                value={page.subtitle}
              />
              <span className="archive-stamp">
                Index
                <br />
                {number(records.length)} records
              </span>
            </section>
            <div className="archive-tools">
              <div role="group" aria-label="Filter archive">
                {(["all", "project", "writing"] as const).map((f) => (
                  <button
                    key={f}
                    aria-pressed={filter === f}
                    onClick={() => {
                      setFilter(f);
                      setHovered("");
                    }}
                  >
                    {f === "all"
                      ? "All records"
                      : f === "project"
                        ? "Projects"
                        : "Writing"}
                    <span>
                      {f === "all"
                        ? records.length
                        : records.filter((p) => p.kind === f).length}
                    </span>
                  </button>
                ))}
              </div>
              <label className="archive-search">
                <span className="sr-only">Search archive</span>
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setHovered("");
                  }}
                  placeholder="Find a title or a place…"
                  type="search"
                />
              </label>
            </div>
            <div className="archive-catalogue">
              <div className="archive-rows">
                <div className="archive-column-labels">
                  <span>No.</span>
                  <span>Title / body of work</span>
                  <span>Type</span>
                </div>
                {visible.map((p) => {
                  const c = coverOf(p);
                  return (
                    <div
                      className="archive-row"
                      key={p.id}
                      onMouseEnter={() => setHovered(p.id)}
                      onFocus={() => setHovered(p.id)}
                    >
                      <SiteLink id={p.id} navigate={navigate}>
                        <span className="archive-row-number">
                          {number(records.findIndex((r) => r.id === p.id) + 1)}
                        </span>
                        <div className="archive-row-thumbnail">
                          {c ? <Media block={c} thumb /> : <span>Aa</span>}
                        </div>
                        <div className="archive-row-title">
                          <h2>{p.title}</h2>
                          <p>{p.meta || p.label}</p>
                        </div>
                        <span className="archive-row-type">
                          {p.kind === "project"
                            ? "Project"
                            : p.kind === "writing"
                              ? "Writing"
                              : "About"}
                        </span>
                        <span>↗</span>
                      </SiteLink>
                    </div>
                  );
                })}
                {!visible.length && (
                  <p className="direction-empty" role="status">
                    No records match “{query}”. Try another title.
                  </p>
                )}
                <div className="archive-count" aria-live="polite">
                  {visible.length} of {records.length} records
                </div>
              </div>
              <aside
                className="archive-specimen"
                aria-label="Selected record preview"
              >
                {cover && (
                  <>
                    <Media block={cover} thumb />
                    <span className="eyebrow">From the archive</span>
                    <h3>{featured?.title}</h3>
                    <p>{cover.caption}</p>
                  </>
                )}
                {!cover && (
                  <div className="archive-empty-specimen">
                    <span>Aa</span>
                    <p>Notes, images, and the connections between them.</p>
                  </div>
                )}
              </aside>
            </div>
          </>
        ) : (
          <>
            <SiteLink
              className="direction-back"
              id={home.id}
              navigate={navigate}
            >
              ← Back to index
            </SiteLink>
            {page.kind === "project" ? (
              <ArchiveRecord key={page.id} page={page} onEdit={onEdit} />
            ) : (
              <ReadingPage site={site} page={page} onEdit={onEdit} />
            )}
          </>
        )}
      </main>
      <DirectionFooter site={site} />
    </div>
  );
}
