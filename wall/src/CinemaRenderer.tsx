import { CompositionSections } from "./CompositionSections";
import { EditableText } from "./editing";
import { useState } from "react";
import type { RendererProps } from "./rendererTypes";
import { Media } from "./Media";
import {
  coverOf,
  DirectionFooter,
  SiteLink,
  ReadingPage,
  Prose,
  EditBlock,
  useSequence,
  number,
  Dialog,
} from "./DirectionShared";
import type { Page } from "./model";
function CinemaSequence({
  page,
  onEdit,
  focusBlockId,
}: {
  page: Page;
  onEdit?: RendererProps["onEdit"];
  focusBlockId?: string | null;
}) {
  const { block, index, next, previous, select } = useSequence(
    page,
    focusBlockId,
  );
  const [indexOpen, setIndexOpen] = useState(false);
  return (
    <div className="cinema-sequence">
      <header className="cinema-project-title">
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
      </header>
      {page.composition?.enabled ? (
        <CompositionSections page={page} />
      ) : block ? (
        <>
          <section
            className={`cinema-screen fit-${block.fit} width-${block.width} block-${block.type}`}
            aria-label="Screening room"
            tabIndex={0}
            onKeyDown={(e) => {
              if (
                (e.target as HTMLElement).closest(
                  "button,video,input,textarea,[contenteditable]",
                )
              )
                return;
              if (e.key === "ArrowRight") {
                e.preventDefault();
                next();
              }
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                previous();
              }
            }}
          >
            <EditBlock block={block} onEdit={onEdit} />
            {block.type === "text" ? (
              <Prose
                text={block.text}
                block={{ pageId: page.id, blockId: block.id }}
              />
            ) : (
              <Media block={block} />
            )}
          </section>
          <div className="cinema-caption">
            <EditableText
              target={{
                kind: "block",
                pageId: page.id,
                blockId: block.id,
                field: "caption",
              }}
              value={block.caption}
            />

            <span>
              {number(index + 1)} / {number(page.blocks.length)}
            </span>
          </div>
          <nav className="cinema-controls" aria-label="Screening sequence">
            <button
              onClick={previous}
              disabled={index === 0}
              aria-label="Previous scene"
            >
              ← Previous
            </button>
            <button onClick={() => setIndexOpen(true)}>Sequence +</button>
            <button
              onClick={next}
              disabled={index === page.blocks.length - 1}
              aria-label="Next scene"
            >
              Next →
            </button>
          </nav>
          {indexOpen && (
            <Dialog
              title="Project sequence"
              className="cinema-dialog"
              onClose={() => setIndexOpen(false)}
            >
              <div className="cinema-dialog-header">
                <h2>Sequence</h2>
                <button
                  onClick={() => setIndexOpen(false)}
                  aria-label="Close sequence"
                >
                  Close ×
                </button>
              </div>
              <div className="cinema-scene-list">
                {page.blocks.map((b, i) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      select(b.id);
                      setIndexOpen(false);
                    }}
                    aria-current={block.id === b.id ? "true" : undefined}
                  >
                    <span>{number(i + 1)}</span>
                    <span>
                      {b.caption || b.text.slice(0, 70) || "Untitled scene"}
                    </span>
                    <span>
                      {b.type === "video"
                        ? "Film"
                        : b.type === "image"
                          ? "Photograph"
                          : "Interlude"}
                    </span>
                  </button>
                ))}
              </div>
            </Dialog>
          )}
        </>
      ) : (
        <p className="direction-empty">
          A screen waiting for a story. Add your first film, photograph, or
          text.
        </p>
      )}
    </div>
  );
}
export function CinemaRenderer({
  site,
  pageId,
  navigate,
  onEdit,
  focusBlockId,
}: RendererProps) {
  const page =
    site.pages.find((p) => p.id === pageId) ??
    site.pages.find((p) => p.kind === "home")!;
  const home = site.pages.find((p) => p.kind === "home")!;
  const projects = site.pages.filter((p) => p.kind === "project");
  const [selected, setSelected] = useState("");
  const [menu, setMenu] = useState(false);
  const active = projects.findIndex((p) => p.id === selected);
  const index = Math.max(0, active);
  const featured = projects[index];
  const cover = featured ? coverOf(featured) : undefined;
  return (
    <div
      className={`artist-site cinema-site page-${page.kind} theme-${site.theme} type-${site.typography}`}
    >
      <a className="skip-link" href="#site-main">
        Skip to content
      </a>
      <header className="cinema-header">
        <SiteLink className="cinema-name" id={home.id} navigate={navigate}>
          <EditableText
            className="identity-name"
            target={{ kind: "site", field: "name" }}
            value={site.name}
          />
          <EditableText
            className="identity-tagline"
            target={{ kind: "site", field: "tagline" }}
            value={site.tagline}
          />
        </SiteLink>
        <EditableText
          className="cinema-header-note"
          target={{ kind: "site", field: "programmeNote" }}
          value={site.copy.programmeNote}
        />
        <button aria-label="Open programme" onClick={() => setMenu(true)}>
          Programme <span>+</span>
        </button>
      </header>
      {menu && (
        <Dialog
          title="Website programme"
          className="cinema-dialog"
          onClose={() => setMenu(false)}
        >
          <div className="cinema-dialog-header">
            <h2>Programme</h2>
            <button aria-label="Close programme" onClick={() => setMenu(false)}>
              Close ×
            </button>
          </div>
          <nav className="cinema-programme" aria-label="Website navigation">
            {site.pages
              .filter((p) => p.inNav || p.kind === "project")
              .map((p, i) => (
                <SiteLink
                  key={p.id}
                  id={p.id}
                  navigate={(id) => {
                    setMenu(false);
                    navigate(id);
                  }}
                  aria-current={page.id === p.id ? "page" : undefined}
                >
                  <span>{number(i + 1)}</span>
                  {p.label}
                  <span>↗</span>
                </SiteLink>
              ))}
          </nav>
        </Dialog>
      )}
      <main id="site-main">
        {page.kind === "home" ? (
          <>
            <section className="cinema-cover">
              {cover && (
                <div className="cinema-cover-image" aria-hidden={!onEdit}>
                  <Media block={{ ...cover, alt: "" }} thumb />
                </div>
              )}
              <div className="cinema-cover-shade" />
              <div className="cinema-cover-copy">
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
                {featured && (
                  <SiteLink
                    className="cinema-enter"
                    id={featured.id}
                    navigate={navigate}
                  >
                    <span className="cinema-play" aria-hidden="true">
                      ↗
                    </span>
                    <span>
                      Enter the work<strong>{featured.title}</strong>
                    </span>
                  </SiteLink>
                )}
              </div>
              {featured && (
                <div className="cinema-cover-selector">
                  <button
                    aria-label="Previous featured project"
                    disabled={index === 0}
                    onClick={() => setSelected(projects[index - 1].id)}
                  >
                    ←
                  </button>
                  <span>
                    {number(index + 1)}
                    <span> / {number(projects.length)}</span>
                  </span>
                  <button
                    aria-label="Next featured project"
                    disabled={index === projects.length - 1}
                    onClick={() => setSelected(projects[index + 1].id)}
                  >
                    →
                  </button>
                </div>
              )}
            </section>
            <nav className="cinema-project-index" aria-label="All projects">
              {projects.map((p, i) => (
                <SiteLink key={p.id} id={p.id} navigate={navigate}>
                  <span>{number(i + 1)}</span>
                  <h2>{p.title}</h2>
                  <span>{p.meta}</span>
                  <span>↗</span>
                </SiteLink>
              ))}
            </nav>
            {!projects.length && (
              <p className="direction-empty">
                Begin your programme by adding a project.
              </p>
            )}
          </>
        ) : page.kind === "project" ? (
          <>
            <SiteLink className="cinema-back" id={home.id} navigate={navigate}>
              ← Back to programme
            </SiteLink>
            <CinemaSequence
              key={page.id}
              page={page}
              onEdit={onEdit}
              focusBlockId={focusBlockId}
            />
            <nav className="cinema-next-project" aria-label="Other projects">
              {projects
                .filter((p) => p.id !== page.id)
                .map((p) => (
                  <SiteLink key={p.id} id={p.id} navigate={navigate}>
                    {p.title} ↗
                  </SiteLink>
                ))}
            </nav>
          </>
        ) : (
          <ReadingPage site={site} page={page} onEdit={onEdit} />
        )}
      </main>
      <DirectionFooter site={site} />
    </div>
  );
}
