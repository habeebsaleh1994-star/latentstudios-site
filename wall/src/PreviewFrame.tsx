import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import siteCss from "./site.css?inline";
import directionCss from "./directions.css?inline";
import identityCss from "./identity.css?inline";
import compositionCss from "./composition.css?inline";
import newDirectionCss from "./new-directions.css?inline";
const shell = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${siteCss}${directionCss}${identityCss}${compositionCss}${newDirectionCss}</style></head><body><div id="preview-root"></div></body></html>`;
export function PreviewFrame({
  children,
  mobile,
  pageId,
  zoom = "fit",
  label,
  onReady,
  viewportWidth,
  onViewport,
}: {
  children: ReactNode;
  mobile: boolean;
  pageId: string;
  zoom?: "fit" | "actual";
  label?: string;
  onReady?: (doc: Document) => void;
  viewportWidth?: number;
  onViewport?: (width: number) => void;
}) {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  useLayoutEffect(() => {
    const host = frame.current?.parentElement;
    if (!host) return;
    const measure = () => setAvailableWidth(host.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    measure();
    return () => observer.disconnect();
  }, []);
  // Viewport width determines wrapping; zoom only scales that actual viewport.
  const actualWidth =
    viewportWidth ?? (mobile ? 390 : Math.max(1024, availableWidth));
  const scale =
    zoom === "fit" && availableWidth > 0
      ? Math.min(1, availableWidth / actualWidth)
      : 1;
  useLayoutEffect(() => onViewport?.(actualWidth), [actualWidth, onViewport]);
  useLayoutEffect(() => {
    if (!mount) return;
    mount.style.setProperty("--canvas-control-scale", String(1 / scale));
    mount.dataset.compactCanvas = String(scale < 0.8);
  }, [mount, scale]);
  return (
    <iframe
      ref={frame}
      style={{
        width: actualWidth,
        minWidth: actualWidth,
        height: `${100 / scale}%`,
        transform: scale < 1 ? `scale(${scale})` : undefined,
        transformOrigin: "top left",
      }}
      key={`${mobile}-${pageId}`}
      title={
        label ?? (mobile ? "Mobile website preview" : "Desktop website preview")
      }
      srcDoc={shell}
      onLoad={(e) => {
        setMount(
          e.currentTarget.contentDocument!.getElementById("preview-root"),
        );
        onReady?.(e.currentTarget.contentDocument!);
      }}
    >
      {mount && createPortal(children, mount)}
    </iframe>
  );
}
