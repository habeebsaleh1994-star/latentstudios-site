import { CompositionSections } from "./CompositionSections";
import { EditableText } from "./editing";
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
  useSequence,
  number,
} from "./DirectionShared";
import type { Page, RenderSite } from "./model";
function GalleryRoom({
  site,
  page,
  onEdit,
  focusBlockId,
}: {
  site: RenderSite;
  page: Page;
  onEdit?: RendererProps["onEdit"];
  focusBlockId?: string | null;
}) {
  const { index, block, select, previous, next } = useSequence(
    page,
    focusBlockId,
  );
  return (
    <div className="gallery-room">
      <header className="gallery-room-title">
        <div>
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
        </div>
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
            className={`gallery-wall fit-${block.fit} width-${block.width} block-${block.type}`}
            tabIndex={0}
            style={{ paddingBlock: site.spacing / 3 }}
            aria-label="Gallery artwork viewer"
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
          <div className="gallery-caption">
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
          <div className="gallery-room-controls">
            <button
              onClick={previous}
              disabled={index === 0}
              aria-label="Previous work"
            >
              ← Previous
            </button>
            <span className="eyebrow">Take your time here</span>
            <button
              onClick={next}
              disabled={index === page.blocks.length - 1}
              aria-label="Next work"
            >
              Next →
            </button>
          </div>
          <nav
            className="gallery-contact-strip"
            aria-label="Works in this project"
          >
            {page.blocks.map((b, i) => (
              <button
                key={b.id}
                aria-label={`View work ${i + 1}${b.caption ? `: ${b.caption}` : ""}`}
                aria-current={b.id === block.id ? "true" : undefined}
                onClick={() => select(b.id)}
              >
                {b.type === "text" ? (
                  <span className="text-thumb">Aa</span>
                ) : (
                  <Media block={b} thumb />
                )}
                <span>{number(i + 1)}</span>
              </button>
            ))}
          </nav>
        </>
      ) : (
        <p className="direction-empty">
          A room for your first work. Add a photograph, film, or piece of
          writing.
        </p>
      )}
    </div>
  );
}
export function GalleryRenderer({
  site,
  pageId,
  navigate,
  onEdit,
  focusBlockId,
}: RendererProps) {
  const page =
    site.pages.find((p) => p.id === pageId) ??
    site.pages.find((p) => p.kind === "home")!;
  const projects = site.pages.filter((p) => p.kind === "project");
  return (
    <div
      className={`artist-site gallery-site theme-${site.theme} type-${site.typography}`}
    >
      <a className="skip-link" href="#site-main">
        Skip to content
      </a>
      <DirectionHeader
        site={site}
        page={page}
        navigate={navigate}
        variant="gallery"
      />
      <main id="site-main" className="gallery-main">
        {page.kind === "home" ? (
          <>
            <section className="gallery-intro">
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
              <span className="gallery-intro-index">
                {number(projects.length)} bodies of work
              </span>
            </section>
            <div className="gallery-hang" style={{ rowGap: site.spacing }}>
              {projects.map((p, i) => {
                const cover = coverOf(p);
                return (
                  <SiteLink
                    key={p.id}
                    className={`gallery-piece gallery-piece-${i % 2}`}
                    id={p.id}
                    navigate={navigate}
                  >
                    <div className="gallery-plinth">
                      {cover ? (
                        <Media block={cover} thumb />
                      ) : (
                        <span>Project {number(i + 1)}</span>
                      )}
                    </div>
                    <div className="gallery-label">
                      <span>{number(i + 1)}</span>
                      <div>
                        <h2>{p.title}</h2>
                        <p>{p.meta}</p>
                      </div>
                      <span>↗</span>
                    </div>
                  </SiteLink>
                );
              })}
            </div>
            {!projects.length && (
              <p className="direction-empty">
                Your first exhibition begins with a project.
              </p>
            )}
          </>
        ) : page.kind === "project" ? (
          <>
            <SiteLink
              className="direction-back"
              id={site.pages.find((p) => p.kind === "home")!.id}
              navigate={navigate}
            >
              ← All works
            </SiteLink>
            <GalleryRoom
              key={page.id}
              site={site}
              page={page}
              onEdit={onEdit}
              focusBlockId={focusBlockId}
            />
            <nav className="gallery-other-projects" aria-label="Other projects">
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
