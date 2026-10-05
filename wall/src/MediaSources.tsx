import { createContext, useEffect, useState } from "react";
export const MediaLoadMode = createContext<"lazy" | "eager">("lazy");
import type { Revision } from "./revisions";
import { cachedDisplay } from "./mediaDelivery";
export interface ImageSource {
  src: string;
  srcSet?: string;
  width?: number;
  height?: number;
  fallback?: string;
}
export type MediaSource = string | ImageSource;
export const MediaSources = createContext<Record<string, MediaSource> | null>(
  null,
);
export function FrozenMedia({
  revision,
  children,
  delivery = "original",
}: {
  revision: Revision;
  children: React.ReactNode;
  delivery?: "original" | "web";
}) {
  const [sources, setSources] = useState<Record<string, MediaSource>>({});
  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    const url = (blob: Blob) => {
      const value = URL.createObjectURL(blob);
      urls.push(value);
      return value;
    };
    void (async () => {
      const result: Record<string, MediaSource> = Object.create(null);
      for (const [id, blob] of Object.entries(revision.assets)) {
        const original = url(blob);
        let display;
        try {
          display = delivery === "web" ? await cachedDisplay(blob) : undefined;
        } catch {
          /* Cache failure never hides the original. */
        }
        if (!active) break;
        result[id] = display?.variants.length
          ? {
              src: url(display.variants.at(-1)!.blob),
              srcSet: display.variants
                .map((v) => `${url(v.blob)} ${v.width}w`)
                .join(", "),
              width: display.width,
              height: display.height,
              fallback: original,
            }
          : original;
      }
      if (active) setSources(result);
      else urls.forEach(URL.revokeObjectURL);
    })();
    return () => {
      active = false;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [revision, delivery]);
  return (
    <MediaSources.Provider value={sources}>{children}</MediaSources.Provider>
  );
}
