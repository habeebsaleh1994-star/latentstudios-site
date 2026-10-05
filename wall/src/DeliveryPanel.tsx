import { useEffect, useRef, useState } from "react";
import type { Revision } from "./revisions";
import {
  prepareDisplay,
  cachedDisplay,
  displayBytes,
  type DisplayRecord,
} from "./mediaDelivery";
import type { DeliveryMode, DeliveryReceipt } from "./portable";
import { demoId, storyWorkspaceId } from "./workspace";
interface DeliveryRow {
  id: string;
  record: DisplayRecord;
}
const size = (n: number) =>
  n < 1024 * 1024
    ? `${(n / 1024).toFixed(0)} KB`
    : `${(n / 1024 / 1024).toFixed(2)} MB`;
export function DeliveryPanel({
  revision,
  releaseId,
  busy,
  run,
  ready,
}: {
  revision: Revision;
  releaseId: string;
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
  ready: (blob: Blob, filename: string, text?: string) => void;
}) {
  const [rows, setRows] = useState<DeliveryRow[]>([]),
    [mode, setMode] = useState<DeliveryMode>("original"),
    [progress, setProgress] = useState(""),
    [receipt, setReceipt] = useState<DeliveryReceipt | null>(null),
    [canCancel, setCanCancel] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      const found: DeliveryRow[] = [];
      for (const [id, blob] of Object.entries(revision.assets)) {
        try {
          const record = await cachedDisplay(blob);
          if (record) found.push({ id, record });
        } catch {
          /* A cache is optional. */
        }
      }
      if (active) setRows(found);
    })();
    return () => {
      active = false;
      abort.current?.abort();
    };
  }, [revision]);
  const raster = Object.values(revision.assets).filter((b) =>
    ["image/jpeg", "image/png", "image/webp"].includes(b.type),
  ).length;
  const prepared =
    rows.filter((r) =>
      ["image/jpeg", "image/png", "image/webp"].includes(r.record.originalType),
    ).length === raster;
  const originalBytes = rows.reduce((n, r) => n + r.record.originalBytes, 0),
    largestBytes = rows.reduce((n, r) => n + displayBytes(r.record), 0);
  const preview = new URLSearchParams({
    view: "release",
    revision: releaseId,
    delivery: mode,
  });
  if (demoId) preview.set("demo", demoId);
  if (storyWorkspaceId) preview.set("studio", storyWorkspaceId);
  return (
    <section className="delivery-panel">
      <span className="eyebrow">Image delivery</span>
      <h3>A lighter way to carry the work.</h3>
      <p>
        Prepare uncropped display copies, up to 2400 pixels on the long edge.
        Originals stay intact in this release and in editable backups. Your
        selected crop and focal point remain live layout choices.
      </p>
      <button
        className="wide-button"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            abort.current = new AbortController();
            setCanCancel(true);
            const next: DeliveryRow[] = [];
            try {
              for (const [id, blob] of Object.entries(revision.assets)) {
                setProgress(
                  `Preparing ${next.length + 1} of ${Object.keys(revision.assets).length}`,
                );
                next.push({
                  id,
                  record: await prepareDisplay(blob, abort.current.signal),
                });
              }
              setRows(next);
              setMode("web");
              setProgress("Web copies are ready for visual review.");
            } catch (error) {
              setProgress(
                error instanceof Error && error.name === "AbortError"
                  ? "Preparation cancelled. Originals are unchanged."
                  : "Preparation stopped. Originals are unchanged; you can retry.",
              );
              throw error;
            } finally {
              setCanCancel(false);
              abort.current = null;
            }
          })
        }
      >
        Prepare web images
      </button>
      {busy && canCancel && (
        <button
          className="wide-button secondary"
          onClick={() => abort.current?.abort()}
        >
          Cancel image preparation
        </button>
      )}
      {progress && <p role="status">{progress}</p>}
      {rows.length > 0 && (
        <>
          <p className="micro-note">
            {rows.length} of {Object.keys(revision.assets).length} media files
            prepared.
          </p>
          <p className="delivery-totals">
            <b>{size(originalBytes)}</b> originals → <b>{size(largestBytes)}</b>{" "}
            largest display files
          </p>
          <p className="micro-note">
            This compares one largest file per image. A responsive package
            includes additional small sizes.
          </p>
          <details>
            <summary>Image preparation details</summary>
            <ul className="delivery-files">
              {rows.map(({ id, record: r }) => (
                <li key={id}>
                  <span>
                    {id.startsWith("demo-frozen:") ? id.split(":")[1] : id}
                  </span>
                  <span>
                    {r.width > 0 ? `${r.width} × ${r.height} · ` : ""}
                    {r.variants.length
                      ? `${r.variants.length} sizes · ${size(displayBytes(r))}`
                      : r.reason}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      <p className="micro-note">
        Browser-produced sRGB WebP, quality 88%. Review color, fine detail and
        transparency before using copies. Original profiles/metadata remain in
        original files. Animated images, vectors, films and images that would
        grow stay unchanged. This is local preparation, without a CDN or
        adaptive video service.
      </p>
      <fieldset disabled={busy}>
        <legend>Media in this website export</legend>
        <label>
          <input
            type="radio"
            name="media-delivery"
            checked={mode === "original"}
            onChange={() => setMode("original")}
          />{" "}
          Original files
        </label>
        <label>
          <input
            type="radio"
            name="media-delivery"
            checked={mode === "web"}
            disabled={!prepared}
            onChange={() => setMode("web")}
          />{" "}
          Prepared web copies
        </label>
      </fieldset>
      <a
        className="wide-button secondary"
        href={"?" + preview}
        target="_blank"
        rel="noreferrer"
      >
        Preview {mode === "web" ? "web copies" : "originals"} ↗
      </a>
      <button
        className="wide-button"
        disabled={busy || (mode === "web" && !prepared)}
        onClick={() =>
          void run(async () => {
            const result = await (
              await import("./portable")
            ).portablePackage(revision, mode);
            setReceipt(result.receipt);
            ready(result.blob, `latent-${revision.id}-${mode}.zip`);
          })
        }
      >
        Prepare website folder · ZIP
      </button>
      <p className="micro-note">
        Separate image/film files avoid base64 overhead. The web-copy folder
        includes responsive image sizes. Unzip it with its media folder before
        opening index.html.
      </p>
      <button
        className="wide-button secondary"
        disabled={busy || (mode === "web" && !prepared)}
        onClick={() =>
          void run(async () => {
            const text = await (
              await import("./portable")
            ).portableHTML(revision, mode);
            ready(
              new Blob([text], { type: "text/html" }),
              `latent-${revision.id}-${mode}.html`,
              text,
            );
          })
        }
      >
        Prepare single HTML file
      </button>
      {receipt && (
        <p role="status">
          Package media: {size(receipt.mediaBytes)} in {receipt.files} files.
          Original media: {size(receipt.originalBytes)}. No image crops were
          baked in.
        </p>
      )}
    </section>
  );
}
