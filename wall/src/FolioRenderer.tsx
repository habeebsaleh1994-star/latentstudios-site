import { mediaCredit } from "./mediaDefinitions";
import { CompositionSections } from "./CompositionSections";
import { EditableText } from "./editing";
import { useSiteHref } from "./SiteRoutes";
import { useState } from "react";
import type { RenderSite, Page, Block } from "./model";
import { Media } from "./Media";
export function FolioRenderer({
  site,
  pageId,
  navigate,
  onEdit,
}: {
  site: RenderSite;
  pageId: string;
  navigate: (id: string) => void;
  onEdit?: (id: string) => void;
}) {
  const siteHref = useSiteHref();
  const [menu, setMenu] = useState(false);
  const page = site.pages.find((p) => p.id === pageId) ?? site.pages[0];
  const home = site.pages.find((p) => p.kind === "home")!;
  const projects = site.pages.filter((p) => p.kind === "project");
  function link(e: React.MouseEvent, id: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setMenu(false);
    navigate(id);
  }
  function renderBlock(block: Block, index: number) {
    return (
      <section
        key={block.id}
        className={`art-block block-${block.type} width-${block.width} fit-${block.fit}`}
        style={{ marginBlock: `${site.spacing}px` }}
      >
        {onEdit && (
          <button className="edit-overlay" onClick={() => onEdit(block.id)}>
            Edit {block.type === "image" ? "photograph" : block.type}
          </button>
        )}
        {block.type === "text" ? (
          <EditableText
            as="div"
            className="prose"
            target={{
              kind: "block",
              pageId: page.id,
              blockId: block.id,
              field: "text",
            }}
            value={block.text}
          />
        ) : (
          <figure>
            <Media block={block} />
            {block.caption && (
              <figcaption>
                <EditableText
                  target={{
                    kind: "block",
                    pageId: page.id,
                    blockId: block.id,
                    field: "caption",
                  }}
                  value={block.caption}
                />
                <span>{String(index + 1).padStart(2, "0")}</span>
              </figcaption>
            )}
          </figure>
        )}
      </section>
    );
  }
  function projectCard(project: Page, index: number) {
    const cover = project.blocks.find(
      (b) => b.type === "image" || b.type === "video",
    );
    return (
      <a
        className={`project-card project-${index}`}
        key={project.id}
        href={siteHref(project.id)}
        onClick={(e) => link(e, project.id)}
      >
        {cover && (
          <div className="project-image">
            <Media block={cover} thumb />
            <span className="project-open" aria-hidden="true">
              ↗
            </span>
          </div>
        )}
        <div className="project-description">
          <div>
            <span className="eyebrow">{project.meta}</span>
            <h2>{project.title}</h2>
          </div>
          <span className="project-arrow" aria-hidden="true">
            ↗
          </span>
        </div>
      </a>
    );
  }
  return (
    <div className={`artist-site theme-${site.theme} type-${site.typography}`}>
      <a className="skip-link" href="#site-main">
        Skip to content
      </a>
      <header className="site-header">
        <a
          className="artist-name"
          href={siteHref(home.id)}
          onClick={(e) => link(e, home.id)}
        >
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
        </a>
        <button
          className="menu-toggle"
          aria-expanded={menu}
          aria-label={menu ? "Close navigation" : "Open navigation"}
          onClick={() => setMenu(!menu)}
        >
          {menu ? "Close −" : "Menu +"}
        </button>
        <nav aria-label="Website navigation" className={menu ? "open" : ""}>
          {site.pages
            .filter((p) => p.inNav)
            .map((p) => (
              <a
                key={p.id}
                href={siteHref(p.id)}
                onClick={(e) => link(e, p.id)}
                aria-current={p.id === page.id ? "page" : undefined}
              >
                {p.label}
              </a>
            ))}
        </nav>
      </header>
      <main id="site-main" className={`site-main page-${page.kind}`}>
        {page.kind === "home" ? (
          <>
            <section className="home-intro">
              <div>
                <EditableText
                  className="eyebrow"
                  target={{ kind: "site", field: "eyebrow" }}
                  value={site.copy.eyebrow}
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
            </section>
            <div className="collection-heading">
              <EditableText
                className="eyebrow"
                target={{ kind: "page", pageId: page.id, field: "meta" }}
                value={page.meta}
              />
              <span aria-hidden="true">↓</span>
            </div>
            <div className="project-list">{projects.map(projectCard)}</div>
            {projects.length === 0 && (
              <p className="empty-work">
                Your work begins here. Add a project in the editor.
              </p>
            )}
            <aside className="closing-note">
              <EditableText
                className="eyebrow"
                target={{ kind: "site", field: "closingTitle" }}
                value={site.copy.closingTitle}
              />
              <EditableText
                as="p"
                target={{ kind: "site", field: "closingText" }}
                value={site.copy.closingText}
              />
              {site.pages.find((p) => p.kind === "writing") && (
                <a
                  href={siteHref(
                    site.pages.find((p) => p.kind === "writing")!.id,
                  )}
                  onClick={(e) =>
                    link(e, site.pages.find((p) => p.kind === "writing")!.id)
                  }
                >
                  <EditableText
                    target={{ kind: "site", field: "journalLink" }}
                    value={site.copy.journalLink}
                  />{" "}
                  ↗
                </a>
              )}
            </aside>
          </>
        ) : (
          <>
            <section className="page-intro">
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
            </section>
            <div className="page-sequence">
              {page.composition?.enabled ? (
                <CompositionSections page={page} />
              ) : (
                page.blocks.map(renderBlock)
              )}
            </div>
            {page.kind === "project" && projects.length > 1 && (
              <a
                className="next-project"
                href={siteHref(
                  projects[
                    (projects.findIndex((p) => p.id === page.id) + 1) %
                      projects.length
                  ].id,
                )}
                onClick={(e) =>
                  link(
                    e,
                    projects[
                      (projects.findIndex((p) => p.id === page.id) + 1) %
                        projects.length
                    ].id,
                  )
                }
              >
                <span className="eyebrow">Next body of work</span>
                <span>
                  {
                    projects[
                      (projects.findIndex((p) => p.id === page.id) + 1) %
                        projects.length
                    ].title
                  }{" "}
                  ↗
                </span>
              </a>
            )}
          </>
        )}
      </main>
      <footer className="site-footer">
        <span>
          {site.name}{" "}
          <span className="copyright">© {new Date().getFullYear()}</span>
        </span>
        {site.email && <a href={`mailto:${site.email}`}>Get in touch ↗</a>}
        {mediaCredit(site) && (
          <span className="demo-credit">{mediaCredit(site)}</span>
        )}
      </footer>
    </div>
  );
}
