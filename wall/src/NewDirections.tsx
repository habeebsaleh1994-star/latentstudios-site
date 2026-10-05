import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { RendererProps } from "./rendererTypes";
import type { Block, Page, RenderSite } from "./model";
import { EditableText } from "./editing";
import { Media } from "./Media";
import { CompositionSections } from "./CompositionSections";
import {
  coverOf,
  DirectionFooter,
  DirectionHeader,
  EditBlock,
  SiteLink,
  number,
  Prose,
} from "./DirectionShared";
export type NewDirection =
  | "gazette"
  | "horizon"
  | "poster"
  | "atelier"
  | "journal"
  | "montage";
function PageHeading({ page, home = false }: { page: Page; home?: boolean }) {
  return (
    <header className={home ? "edition-intro" : "edition-page-heading"}>
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
  );
}
function Entry({
  page,
  index,
  navigate,
  mode = "standard",
}: {
  page: Page;
  index: number;
  navigate: RendererProps["navigate"];
  mode?: string;
}) {
  const cover = coverOf(page);
  return (
    <article className={`edition-entry entry-${index % 6} entry-${mode}`}>
      <SiteLink id={page.id} navigate={navigate} className="entry-open">
        <span className="entry-number" aria-hidden="true">
          {number(index + 1)}
        </span>
        <div className="entry-heading">
          <span className="eyebrow">{page.meta || page.kind}</span>
          <h2>{page.title}</h2>
          <p>{page.subtitle}</p>
          <span className="entry-arrow" aria-hidden="true">
            ↗
          </span>
        </div>
        {cover ? (
          <figure className={`edition-cover fit-${cover.fit}`}>
            <Media block={cover} thumb />
          </figure>
        ) : (
          <div className="entry-text-cover" aria-hidden="true">
            {page.blocks.find((b) => b.type === "text")?.text.slice(0, 220) ||
              page.subtitle ||
              "↗"}
          </div>
        )}
      </SiteLink>
    </article>
  );
}
function SequenceBlock({
  page,
  block,
  index,
  onEdit,
}: {
  page: Page;
  block: Block;
  index: number;
  onEdit?: RendererProps["onEdit"];
}) {
  return (
    <article
      className={`edition-work block-${block.type} fit-${block.fit} width-${block.width}`}
      data-work-id={block.id}
    >
      <span className="work-number" aria-hidden="true">
        {number(index + 1)}
      </span>
      <EditBlock block={block} onEdit={onEdit} />
      {block.type === "text" ? (
        <Prose
          text={block.text}
          block={{ pageId: page.id, blockId: block.id }}
        />
      ) : (
        <figure>
          <Media block={block} />
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
          </figcaption>
        </figure>
      )}
    </article>
  );
}
function HorizonRail({
  children,
  label,
  focusId,
}: {
  children: React.ReactNode;
  label: string;
  focusId?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ first: true, last: false });
  const measure = () => {
    const el = ref.current;
    if (el)
      setEdges({
        first: el.scrollLeft < 2,
        last: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
      });
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    measure();
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!focusId) return;
    const el = ref.current,
      target = Array.from(el?.children ?? []).find(
        (c) => c.getAttribute("data-work-id") === focusId,
      ) as HTMLElement | undefined;
    if (el && target) {
      el.scrollLeft +=
        target.getBoundingClientRect().left - el.getBoundingClientRect().left;
      measure();
    }
  }, [focusId]);
  const move = (direction: number) => {
    const el = ref.current;
    if (el) {
      el.scrollBy({
        left: direction * el.clientWidth * 0.8,
        behavior: "instant",
      });
      measure();
    }
  };
  return (
    <section className="horizon-sequence" aria-label={label}>
      <div className="rail-instructions">
        <span>Explore the sequence →</span>
        <div>
          <button
            aria-label="Previous part of sequence"
            disabled={edges.first}
            onClick={() => move(-1)}
          >
            ←
          </button>
          <button
            aria-label="Next part of sequence"
            disabled={edges.last}
            onClick={() => move(1)}
          >
            →
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="horizon-rail"
        tabIndex={0}
        aria-label="Scrollable works"
        onScroll={measure}
        onKeyDown={(e) => {
          if (
            (e.target as HTMLElement).closest(
              "button,video,input,textarea,[contenteditable]",
            )
          )
            return;
          if (
            ref.current &&
            ref.current.scrollWidth > ref.current.clientWidth + 2 &&
            (e.key === "ArrowRight" || e.key === "ArrowLeft")
          ) {
            e.preventDefault();
            move(e.key === "ArrowRight" ? 1 : -1);
          }
        }}
      >
        {children}
      </div>
    </section>
  );
}
function NewHome({
  site,
  page,
  navigate,
  direction,
}: {
  site: RenderSite;
  page: Page;
  navigate: RendererProps["navigate"];
  direction: NewDirection;
}) {
  const entries = site.pages.filter(
    (p) => p.kind !== "home" && p.kind !== "about",
  );

  const cards = (list: Page[], mode?: string) =>
    list.map((p) => (
      <Entry
        key={p.id}
        page={p}
        index={entries.indexOf(p)}
        navigate={navigate}
        mode={mode}
      />
    ));
  if (direction === "gazette")
    return (
      <>
        <PageHeading page={page} home />
        <div className="gazette-issue">
          <section className="gazette-lead">
            {entries[0] && cards([entries[0]], "lead")}
          </section>
          <aside className="gazette-contents">
            <span className="eyebrow">In this edition</span>
            {entries.slice(1).map((p, i) => (
              <SiteLink id={p.id} navigate={navigate} key={p.id}>
                <span>{number(i + 2)}</span>
                <div>
                  <h2>{p.title}</h2>
                  <p>{p.meta}</p>
                </div>
                <span>↗</span>
              </SiteLink>
            ))}
          </aside>
        </div>
        <section className="gazette-grid" aria-label="Further works">
          {cards(entries.slice(1))}
        </section>
      </>
    );
  if (direction === "horizon")
    return (
      <>
        <PageHeading page={page} home />
        <HorizonRail label="Bodies of work">{cards(entries)}</HorizonRail>
      </>
    );
  if (direction === "poster")
    return (
      <>
        <PageHeading page={page} home />
        <section
          className="poster-billboards"
          aria-label="Selected projects and writing"
        >
          {cards(entries, "billboard")}
        </section>
      </>
    );
  if (direction === "atelier")
    return (
      <>
        <div className="atelier-opening">
          <span className="eyebrow">Independent practice</span>
          <PageHeading page={page} home />
        </div>
        <section className="atelier-cases" aria-label="Case studies">
          {cards(entries, "case")}
        </section>
      </>
    );
  if (direction === "journal")
    return (
      <>
        <PageHeading page={page} home />
        <div className="journal-home">
          <aside>
            <EditableText
              className="eyebrow"
              target={{ kind: "site", field: "eyebrow" }}
              value={site.copy.eyebrow}
            />
            <p>{site.tagline}</p>
            <span className="journal-rule" aria-hidden="true">
              ✳
            </span>
          </aside>
          <section
            className="journal-entries"
            aria-label="Entries in authored order"
          >
            {cards(entries, "essay")}
          </section>
        </div>
      </>
    );
  return (
    <>
      <PageHeading page={page} home />
      <section className="montage-board" aria-label="Works in authored order">
        {cards(entries, "collage")}
      </section>
    </>
  );
}
function EditionRenderer({
  site,
  pageId,
  navigate,
  onEdit,
  focusBlockId,
  direction,
}: RendererProps & { direction: NewDirection }) {
  const page = site.pages.find((p) => p.id === pageId) ?? site.pages[0],
    home = site.pages.find((p) => p.kind === "home")!,
    content = site.pages.filter((p) => p.kind !== "home");
  const index = content.findIndex((p) => p.id === page.id),
    next = content[index + 1];
  const works = page.blocks.map((block, i) => (
    <SequenceBlock
      key={block.id}
      page={page}
      block={block}
      index={i}
      onEdit={onEdit}
    />
  ));
  const arranged = !!page.composition?.enabled;
  return (
    <div
      className={`artist-site edition-site ${direction}-site theme-${site.theme} type-${site.typography} page-${page.kind}`}
      style={{ "--edition-space": `${site.spacing}px` } as CSSProperties}
    >
      <a className="skip-link" href="#site-main">
        Skip to content
      </a>
      <DirectionHeader
        site={site}
        page={page}
        navigate={navigate}
        variant={direction}
      />
      <main id="site-main" className="edition-main">
        {page.kind === "home" ? (
          <NewHome
            site={site}
            page={page}
            navigate={navigate}
            direction={direction}
          />
        ) : (
          <>
            <SiteLink className="edition-back" id={home.id} navigate={navigate}>
              ← {home.label || "All work"}
            </SiteLink>
            <div className={`edition-project ${arranged ? "is-arranged" : ""}`}>
              <PageHeading page={page} />
              {arranged ? (
                <CompositionSections page={page} />
              ) : direction === "horizon" && page.kind === "project" ? (
                <HorizonRail
                  key={page.id}
                  label={page.title}
                  focusId={focusBlockId}
                >
                  {works}
                </HorizonRail>
              ) : (
                <div className="edition-flow">{works}</div>
              )}
            </div>
            {next && (
              <nav className="edition-next" aria-label="Continue reading">
                <span className="eyebrow">Next / {next.kind}</span>
                <SiteLink id={next.id} navigate={navigate}>
                  {next.title} ↗
                </SiteLink>
              </nav>
            )}
          </>
        )}
      </main>
      <DirectionFooter site={site} />
    </div>
  );
}
export const GazetteRenderer = (props: RendererProps) => (
  <EditionRenderer {...props} direction="gazette" />
);
export const HorizonRenderer = (props: RendererProps) => (
  <EditionRenderer {...props} direction="horizon" />
);
export const PosterRenderer = (props: RendererProps) => (
  <EditionRenderer {...props} direction="poster" />
);
export const AtelierRenderer = (props: RendererProps) => (
  <EditionRenderer {...props} direction="atelier" />
);
export const JournalRenderer = (props: RendererProps) => (
  <EditionRenderer {...props} direction="journal" />
);
export const MontageRenderer = (props: RendererProps) => (
  <EditionRenderer {...props} direction="montage" />
);
