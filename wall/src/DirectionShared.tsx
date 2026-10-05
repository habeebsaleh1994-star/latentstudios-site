import { trapDialogTab } from "./dialogFocus";
import { mediaCredit } from "./mediaDefinitions";
import { CompositionSections } from "./CompositionSections";
import { EditableText } from "./editing";
import { useSiteHref } from "./SiteRoutes";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Media } from "./Media";
import type { Block, Page, RenderSite } from "./model";
export const number = (n: number) => String(n).padStart(2, "0");
export const coverOf = (page: Page) =>
  page.blocks.find((b) => b.type !== "text" && b.assetId) ??
  page.blocks.find((b) => b.type !== "text");
export function SiteLink({
  id,
  navigate,
  children,
  ...props
}: {
  id: string;
  navigate: (id: string) => void;
  children: ReactNode;
  className?: string;
  "aria-current"?: "page";
}) {
  const siteHref = useSiteHref();
  return (
    <a
      {...props}
      href={siteHref(id)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(id);
      }}
    >
      {children}
    </a>
  );
}
export function DirectionHeader({
  site,
  page,
  navigate,
  variant,
}: {
  site: RenderSite;
  page: Page;
  navigate: (id: string) => void;
  variant: string;
}) {
  const [open, setOpen] = useState(false);
  const home = site.pages.find((p) => p.kind === "home")!;
  return (
    <header className={`direction-header ${variant}-header`}>
      <SiteLink
        className="direction-name"
        id={home.id}
        navigate={(id) => {
          setOpen(false);
          navigate(id);
        }}
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
      </SiteLink>
      <button
        className="direction-menu"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Close −" : "Menu +"}
      </button>
      <nav aria-label="Website navigation" className={open ? "is-open" : ""}>
        {site.pages
          .filter((p) => p.inNav)
          .map((p) => (
            <SiteLink
              key={p.id}
              id={p.id}
              navigate={(id) => {
                setOpen(false);
                navigate(id);
              }}
              aria-current={p.id === page.id ? "page" : undefined}
            >
              {p.label}
            </SiteLink>
          ))}
      </nav>
      <span className="direction-edition">
        Selected works
        <br />
        {new Date().getFullYear()}
      </span>
    </header>
  );
}
export function DirectionFooter({ site }: { site: RenderSite }) {
  const credit = mediaCredit(site);
  return (
    <footer className="direction-footer">
      <span>
        {site.name} © {new Date().getFullYear()}
      </span>
      {site.email && <a href={`mailto:${site.email}`}>Correspondence ↗</a>}
      {credit && <span>{credit}</span>}
    </footer>
  );
}
export function Prose({
  text,
  block,
}: {
  text: string;
  block?: { pageId: string; blockId: string };
}) {
  return block ? (
    <EditableText
      as="div"
      className="direction-prose"
      target={{ kind: "block", ...block, field: "text" }}
      value={text}
    />
  ) : (
    <div className="direction-prose">
      {text.split("\n\n").map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
export function EditBlock({
  block,
  onEdit,
}: {
  block: Block;
  onEdit?: (id: string) => void;
}) {
  return onEdit ? (
    <button className="direction-edit" onClick={() => onEdit(block.id)}>
      Edit{" "}
      {block.type === "image"
        ? "photograph"
        : block.type === "video"
          ? "film"
          : "writing"}
    </button>
  ) : null;
}
export function ReadingPage({
  site,
  page,
  onEdit,
}: {
  site: RenderSite;
  page: Page;
  onEdit?: (id: string) => void;
}) {
  return (
    <article
      className={`direction-reading ${page.composition?.enabled ? "reading-arranged" : ""}`}
    >
      <header>
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
      ) : (
        page.blocks.map((b, i) => (
          <section
            className={`reading-block block-${b.type} fit-${b.fit} width-${b.width}`}
            key={b.id}
            style={{ marginBlock: site.spacing }}
          >
            <EditBlock block={b} onEdit={onEdit} />
            {b.type === "text" ? (
              <Prose text={b.text} block={{ pageId: page.id, blockId: b.id }} />
            ) : (
              <figure>
                <Media block={b} />
                <figcaption>
                  <EditableText
                    target={{
                      kind: "block",
                      pageId: page.id,
                      blockId: b.id,
                      field: "caption",
                    }}
                    value={b.caption}
                  />
                  <span>{number(i + 1)}</span>
                </figcaption>
              </figure>
            )}
          </section>
        ))
      )}
    </article>
  );
}
export function useSequence(page: Page, focusBlockId?: string | null) {
  const [selected, setSelected] = useState(page.blocks[0]?.id ?? "");
  useEffect(() => {
    if (focusBlockId && page.blocks.some((b) => b.id === focusBlockId))
      setSelected(focusBlockId);
  }, [focusBlockId, page.blocks]);
  const index = Math.max(
    0,
    page.blocks.findIndex((b) => b.id === selected),
  );
  const block = page.blocks[index];
  return {
    index,
    block,
    select: setSelected,
    previous: () => setSelected(page.blocks[Math.max(0, index - 1)]?.id ?? ""),
    next: () =>
      setSelected(
        page.blocks[Math.min(page.blocks.length - 1, index + 1)]?.id ?? "",
      ),
  };
}
export function Dialog({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const returnTo = dialog.ownerDocument.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (returnTo?.isConnected) returnTo.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`studio-dialog ${className}`}
      aria-label={title}
      onKeyDown={trapDialogTab}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const rect = ref.current!.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      {children}
    </dialog>
  );
}
