import { useEditing } from "./editing";
import { useContext, useEffect, useRef, useState } from "react";
import type { Block } from "./model";
import { demoAssets } from "./mediaDefinitions";
import { readAsset } from "./mediaRepository";
import { MediaSources, MediaLoadMode, type MediaSource } from "./MediaSources";
export function Media({
  block,
  thumb = false,
}: {
  block: Block;
  thumb?: boolean;
}) {
  const editor = useEditing();
  const suppliedSources = useContext(MediaSources);
  const loading = useContext(MediaLoadMode);
  const owner = editor?.site.pages.find((p) =>
    p.blocks.some((b) => b.id === block.id),
  );
  const selectable = !!editor?.enabled && !!owner;
  const selected =
    selectable &&
    editor?.selection?.kind === "media" &&
    editor.selection.blockId === block.id;
  const select = (e: React.SyntheticEvent) => {
    if (selectable && owner) {
      e.preventDefault();
      e.stopPropagation();
      editor!.select({ kind: "media", pageId: owner.id, blockId: block.id });
    }
  };
  const editProps = {
    "aria-label": selectable
      ? `Select ${block.type === "video" ? "film" : "photograph"}: ${block.alt || block.caption || "untitled"}`
      : undefined,
    "data-edit-media": selectable ? block.id : undefined,
    "data-selected": selected || undefined,
    tabIndex: selectable ? 0 : undefined,
    onClick: select,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (selectable && (e.key === "Enter" || e.key === " ")) select(e);
    },
  };
  const [source, setSource] = useState<MediaSource>("");
  const imageRef = useRef<HTMLImageElement>(null);
  const [slotWidth, setSlotWidth] = useState(0);
  const details = typeof source === "string" ? { src: source } : source;
  useEffect(() => {
    const element = imageRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) =>
      setSlotWidth(Math.ceil(entries[0].contentRect.width)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [source]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    let url = "";
    setFailed(false);
    if (suppliedSources !== null) {
      setSource(
        Object.hasOwn(suppliedSources, block.assetId)
          ? suppliedSources[block.assetId]
          : "",
      );
      return;
    }
    setSource(
      Object.hasOwn(demoAssets, block.assetId) ? demoAssets[block.assetId] : "",
    );
    if (block.assetId && !Object.hasOwn(demoAssets, block.assetId))
      readAsset(block.assetId)
        .then((blob) => {
          if (!alive) return;
          if (blob) {
            url = URL.createObjectURL(blob);
            setSource(url);
          } else setFailed(true);
        })
        .catch(() => {
          if (alive) setFailed(true);
        });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [block.assetId, suppliedSources]);
  if (!details.src || failed)
    return (
      <div className="media-placeholder">
        {failed
          ? "Media unavailable"
          : block.type === "video"
            ? "Add your film"
            : "Add your photograph"}
      </div>
    );
  return block.type === "video" ? (
    <video
      {...editProps}
      src={details.src}
      controls={!thumb && !selectable && !editor?.arrange}
      muted={thumb}
      playsInline
      preload="metadata"
      aria-label={
        selectable ? editProps["aria-label"] : block.alt || "Artist film"
      }
      onError={() => setFailed(true)}
    />
  ) : (
    <img
      draggable={editor?.arrange ? false : undefined}
      {...editProps}
      src={
        details.srcSet && !slotWidth
          ? `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${details.width || 1} ${details.height || 1}"></svg>`)}`
          : details.src
      }
      ref={imageRef}
      srcSet={slotWidth ? details.srcSet : undefined}
      sizes={
        details.srcSet ? (slotWidth ? `${slotWidth}px` : "100vw") : undefined
      }
      width={details.width}
      height={details.height}
      alt={block.alt}
      style={{ objectPosition: `${block.focal.x}% ${block.focal.y}%` }}
      loading={loading}
      decoding="async"
      onError={() => {
        if (details.fallback) setSource(details.fallback);
        else setFailed(true);
      }}
    />
  );
}
