import { TypographyContext, useViewportMobile } from "./TypographyContext";
import { useEffect, useRef } from "react";
import { useEditing } from "./editing";
import { SiteRoutes } from "./SiteRoutes";
import { siteHref } from "./workspace";
import { identityTokens } from "./identity";
import {
  GazetteRenderer,
  HorizonRenderer,
  PosterRenderer,
  AtelierRenderer,
  JournalRenderer,
  MontageRenderer,
} from "./NewDirections";
import { FolioRenderer } from "./FolioRenderer";
import { GalleryRenderer } from "./GalleryRenderer";
import { CinemaRenderer } from "./CinemaRenderer";
import { ArchiveRenderer } from "./ArchiveRenderer";
import type { Site } from "./model";
import type { RendererProps } from "./rendererTypes";
export interface SiteRendererProps extends Omit<RendererProps, "site"> {
  site: Site;
  href?: (id: string) => string;
}
export const renderers = {
  folio: FolioRenderer,
  gallery: GalleryRenderer,
  cinema: CinemaRenderer,
  archive: ArchiveRenderer,
  gazette: GazetteRenderer,
  horizon: HorizonRenderer,
  poster: PosterRenderer,
  atelier: AtelierRenderer,
  journal: JournalRenderer,
  montage: MontageRenderer,
} satisfies Record<Site["styleId"], React.ComponentType<RendererProps>>;
export function SiteRenderer(props: SiteRendererProps) {
  const surface = useRef<HTMLDivElement>(null),
    previous = useRef(props.pageId),
    editor = useEditing();
  useEffect(() => {
    if (previous.current !== props.pageId && !editor) {
      const target = surface.current?.querySelector<HTMLElement>("h1, main");
      if (target) {
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
    }
    previous.current = props.pageId;
  }, [props.pageId, editor]);
  const mobile = useViewportMobile(surface);
  const Renderer = renderers[props.site.styleId];
  const appearance = props.site.appearances[props.site.styleId];
  return (
    <SiteRoutes.Provider value={props.href ?? siteHref}>
      <div
        ref={surface}
        className="identity-surface"
        style={identityTokens(props.site)}
      >
        <TypographyContext.Provider value={{ site: props.site, mobile }}>
          <Renderer {...props} site={{ ...props.site, ...appearance }} />
        </TypographyContext.Provider>
      </div>
    </SiteRoutes.Provider>
  );
}
