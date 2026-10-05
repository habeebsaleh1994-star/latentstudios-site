import { siteSchema } from "./model";
import { publicWebsite } from "./compositionStudies";
import newDirectionCSS from "./new-directions.css?raw";
import runtime from "virtual:export-runtime";
import siteCSS from "./site.css?raw";
import directionsCSS from "./directions.css?raw";
import identityCSS from "./identity.css?raw";
import compositionCSS from "./composition.css?raw";
import { toDataURL } from "./storage";
import { contentPreflight } from "./publication";
import type { Revision } from "./revisions";
import type { MediaSource } from "./MediaSources";
import {
  cachedDisplay,
  hashBlob,
  DISPLAY_RECIPE,
  type DisplayRecord,
} from "./mediaDelivery";
import { websiteZip, type ZipEntry } from "./zip";
export type DeliveryMode = "original" | "web";
export const escapeHTML = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const safeJSON = (value: unknown) =>
  JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
function validate(revision: Revision) {
  if (contentPreflight(revision.site).some((i) => i.severity === "error"))
    throw new Error(
      "Resolve publication details before exporting this website.",
    );
  if (revision.manifest.some((m) => m.missing))
    throw new Error("Missing media prevents a complete website export.");
}
function html(
  revision: Revision,
  assets: Record<string, MediaSource>,
  delivery: DeliveryMode,
) {
  const m = revision.site.publication;
  return `<!doctype html>
<html lang="${escapeHTML(m.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHTML(m.title)}</title><meta name="description" content="${escapeHTML(m.description)}">${m.canonical ? `<link rel="canonical" href="${escapeHTML(m.canonical)}">` : ""}
<meta name="generator" content="Latent Studio local export 2"><style>${siteCSS}\n${directionsCSS}\n${identityCSS}\n${compositionCSS}\n${newDirectionCSS}\nhtml,body{margin:0} *{box-sizing:border-box}</style></head><body><div id="root"></div><noscript>This artist website needs JavaScript to display its pages.</noscript><script id="latent-document" type="application/json">${safeJSON({ format: "latent-studio-website", version: 2, revision: revision.id, delivery, site: publicWebsite(revision.site), assets, routes: revision.site.pages.map((p) => ({ id: p.id, title: p.title, path: "?page=" + encodeURIComponent(p.id) })) })}</script><script>${runtime.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}
async function copies(
  blob: Blob,
  delivery: DeliveryMode,
): Promise<DisplayRecord | undefined> {
  if (
    delivery === "original" ||
    !["image/jpeg", "image/png", "image/webp"].includes(blob.type)
  )
    return;
  const record = await cachedDisplay(blob);
  if (!record)
    throw new Error(
      "Prepare web images for this release before choosing web-copy export.",
    );
  return record;
}
export async function portableHTML(
  revision: Revision,
  delivery: DeliveryMode = "original",
) {
  revision = { ...revision, site: siteSchema.parse(revision.site) };
  validate(revision);
  const assets: Record<string, MediaSource> = Object.create(null);
  for (const [id, blob] of Object.entries(revision.assets)) {
    const display = await copies(blob, delivery),
      variant = display?.variants.at(-1);
    assets[id] = variant
      ? {
          src: await toDataURL(variant.blob),
          width: display!.width,
          height: display!.height,
        }
      : await toDataURL(blob);
  }
  return html(revision, assets, delivery);
}
export interface DeliveryReceipt {
  format: "latent-studio-delivery";
  version: 1;
  revision: string;
  delivery: DeliveryMode;
  recipe: string | null;
  originalBytes: number;
  mediaBytes: number;
  files: number;
  assets: Array<{
    id: string;
    originalHash: string;
    originalBytes: number;
    width?: number;
    height?: number;
    files: Array<{
      path: string;
      bytes: number;
      width?: number;
      height?: number;
    }>;
    note?: string;
  }>;
}
export async function portablePackage(
  revision: Revision,
  delivery: DeliveryMode = "web",
) {
  revision = { ...revision, site: siteSchema.parse(revision.site) };
  validate(revision);
  const entries = new Map<string, Blob>(),
    assets: Record<string, MediaSource> = Object.create(null);
  const receipt: DeliveryReceipt = {
    format: "latent-studio-delivery",
    version: 1,
    revision: revision.id,
    delivery,
    recipe: delivery === "web" ? DISPLAY_RECIPE : null,
    originalBytes: 0,
    mediaBytes: 0,
    files: 0,
    assets: [],
  };
  async function file(blob: Blob) {
    const extension: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/svg+xml": "svg",
      "video/mp4": "mp4",
      "video/webm": "webm",
    };
    if (!extension[blob.type])
      throw new Error("Unsupported media type in website package.");
    const path = `media/${await hashBlob(blob)}.${extension[blob.type]}`;
    entries.set(path, blob);
    return path;
  }
  for (const [id, blob] of Object.entries(revision.assets)) {
    const originalHash = await hashBlob(blob),
      display = await copies(blob, delivery);
    const files: DeliveryReceipt["assets"][number]["files"] = [];
    if (display?.variants.length) {
      for (const v of display.variants)
        files.push({
          path: await file(v.blob),
          bytes: v.blob.size,
          width: v.width,
          height: v.height,
        });
      assets[id] = {
        src: files.at(-1)!.path,
        srcSet: files.map((v) => `${v.path} ${v.width}w`).join(", "),
        width: display.width,
        height: display.height,
      };
    } else {
      const path = await file(blob);
      files.push({ path, bytes: blob.size });
      assets[id] = path;
    }
    receipt.originalBytes += blob.size;
    receipt.assets.push({
      id,
      originalHash,
      originalBytes: blob.size,
      width: display?.width,
      height: display?.height,
      files,
      note:
        display?.reason ??
        (!blob.type.startsWith("image/")
          ? "Original film retained."
          : undefined),
    });
  }
  receipt.mediaBytes = [...entries.values()].reduce((n, b) => n + b.size, 0);
  receipt.files = entries.size;
  const output: ZipEntry[] = [
    {
      name: "index.html",
      blob: new Blob([html(revision, assets, delivery)], { type: "text/html" }),
    },
    {
      name: "delivery.json",
      blob: new Blob([JSON.stringify(receipt, null, 2)], {
        type: "application/json",
      }),
    },
    {
      name: "README.txt",
      blob: new Blob(
        [
          "Latent Studio local website package\n\nUnzip the entire folder. Open index.html in a browser, or serve the folder with any static web server. Keep the media folder beside index.html. JavaScript is required.\n\nThis package is a local artifact, not a live website or editable backup. No hosting or domain was connected. The delivery.json file records the included originals or display copies. Web copies are browser-produced sRGB WebP images, never baked crops. Original files remain in your studio/revision and editable backup; they are omitted from this package when web copies replace them. Films, animated images and vectors remain unchanged.\n",
        ],
        { type: "text/plain" },
      ),
    },
    ...[...entries].map(([name, blob]) => ({ name, blob })),
  ];
  return { blob: await websiteZip(output), receipt };
}
