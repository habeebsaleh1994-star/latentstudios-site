import { DeliveryPanel } from "./DeliveryPanel";
import { useEffect, useRef, useState } from "react";
import {
  X,
  ArrowUpRight,
  Download,
  History,
  Check,
  ArrowLeft,
} from "lucide-react";
import type { Site } from "./model";
import {
  localRevisions,
  collectMedia,
  type Revision,
  type RevisionLibrary,
} from "./revisions";
import { compareSites, type PreflightIssue } from "./publication";
import { preflight } from "./preflight";
import { FrozenMedia } from "./MediaSources";
import { PreviewFrame } from "./PreviewFrame";
import { SiteRenderer } from "./SiteRenderer";
import { demoId, storyWorkspaceId } from "./workspace";
import { exportBackup } from "./storage";
import "./publication.css";
type Studio = ReturnType<typeof import("./useStudio").useStudio>;
export function revisionHref(id: string) {
  const q = new URLSearchParams({ view: "release", revision: id });
  if (demoId) q.set("demo", demoId);
  if (storyWorkspaceId) q.set("studio", storyWorkspaceId);
  return "?" + q;
}
function date(value: string) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Retained from an earlier edition";
}
export function ReleasePanel({
  studio,
  close,
}: {
  studio: Studio;
  close: () => void;
}) {
  const site = studio.site!;
  const dialog = useRef<HTMLDialogElement>(null);
  const reviewing = useRef<AbortController | null>(null);
  const [view, setView] = useState<"release" | "history" | "import">("release");
  const [library, setLibrary] = useState<RevisionLibrary>({
    revisions: [],
    releaseId: null,
  });
  const [selected, setSelected] = useState<Revision | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [release, setRelease] = useState<Revision | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [canCancelReview, setCanCancelReview] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [report, setReport] = useState<{
    issues: PreflightIssue[];
    stamp: string;
  } | null>(null);
  const [paste, setPaste] = useState("");
  const [page, setPage] = useState(site.pages[0].id);
  const [mobile, setMobile] = useState(false);
  const [output, setOutput] = useState<{
    url: string;
    text?: string;
    filename: string;
    bytes: number;
  } | null>(null);
  async function refresh() {
    const next = await localRevisions.list();
    setLibrary(next);
    setRelease(
      next.releaseId ? await localRevisions.read(next.releaseId) : null,
    );
  }
  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    const modal = dialog.current;
    modal?.showModal();
    void refresh().catch((e) => setError(e.message));
    return () => {
      modal?.close();
      if (returnTo?.isConnected) returnTo.focus();
    };
  }, []);
  useEffect(
    () => () => {
      if (output) URL.revokeObjectURL(output.url);
    },
    [output],
  );
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "This operation could not finish. Your previous saved work remains available.",
      );
    } finally {
      reviewing.current = null;
      setCanCancelReview(false);
      setBusy(false);
    }
  }
  const changeMeta = (patch: Partial<Site["publication"]>) =>
    studio.update((s) => ({
      ...s,
      publication: { ...s.publication, ...patch },
    }));
  const ready =
    report?.stamp === JSON.stringify(site) &&
    !report.issues.some((i) => i.severity === "error");
  const changed = release ? compareSites(release.site, site) : [];
  async function choose(id: string) {
    await run(async () => {
      const r = await localRevisions.read(id);
      setSelected(r);
      setSelectedId(id);
      setPage(r.site.pages[0].id);
      setMobile(false);
      setOutput(null);
    });
  }
  async function prepareExport(r: Revision, backup = false) {
    await run(async () => {
      if (!backup && (await preflight(r)).some((i) => i.severity === "error"))
        throw new Error(
          "This checkpoint needs preflight repairs before website export. Restore it as a draft to make changes.",
        );
      const text = backup
        ? await exportBackup(r.site, r.assets)
        : await (await import("./portable")).portableHTML(r);
      setOutput({
        bytes: new Blob([text]).size,
        text,
        url: URL.createObjectURL(
          new Blob([text], { type: backup ? "application/json" : "text/html" }),
        ),
        filename: `latent-${r.id}.${backup ? "json" : "html"}`,
      });
      setMessage(
        "Your file is ready. Download it to keep a copy outside this browser.",
      );
    });
  }
  return (
    <dialog
      ref={dialog}
      className="release-dialog"
      aria-labelledby="release-heading"
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const elements = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            'button, a[href], input, textarea, select, [tabindex="0"]',
          ),
        ).filter(
          (el) =>
            !el.hasAttribute("disabled") && el.getClientRects().length > 0,
        );
        const first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else close();
      }}
    >
      <div className="release-top">
        <div>
          <span className="eyebrow">Latent Studio · on this device</span>
          <h1 id="release-heading">Keep the work. Choose the edition.</h1>
        </div>
        <button
          className="icon-button"
          aria-label="Close release and recovery"
          disabled={busy}
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      <div className="release-body">
        <nav className="release-nav" aria-label="Release workspace">
          <button
            aria-current={view === "release" ? "page" : undefined}
            onClick={() => {
              setView("release");
              setSelected(null);
              setOutput(null);
            }}
          >
            Local release <ArrowUpRight size={15} />
          </button>
          <button
            aria-current={view === "history" ? "page" : undefined}
            onClick={() => {
              setView("history");
              setOutput(null);
            }}
          >
            Revisions & recovery <History size={15} />
          </button>
          <button
            aria-current={view === "import" ? "page" : undefined}
            onClick={() => {
              setView("import");
              setOutput(null);
            }}
          >
            Restore a backup <ArrowLeft size={15} />
          </button>
          <p>
            This is local work.
            <br />
            Nothing here publishes a website or creates a share link.
          </p>
        </nav>
        <main className="release-content" aria-busy={busy}>
          {error && (
            <p className="release-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="release-message" role="status">
              {message}
            </p>
          )}
          {view === "release" && (
            <>
              <span className="eyebrow">01 / Prepare an edition</span>
              <h2>A deliberate pause before release.</h2>
              <p className="release-intro">
                Keep editing freely. A local release is a frozen copy of your
                words, composition and media, held separately from the working
                draft.
              </p>
              <div className="release-state">
                <div>
                  <span className="eyebrow">Current local release</span>
                  <h3>{release?.name ?? "No release yet"}</h3>
                  <p>
                    {release
                      ? date(release.createdAt)
                      : "Create your first edition when the work feels ready."}
                  </p>
                </div>
                {release && (
                  <a
                    className="view-site"
                    target="_blank"
                    rel="noreferrer"
                    href={revisionHref(library.releaseId!)}
                  >
                    Preview release <ArrowUpRight size={14} />
                  </a>
                )}
              </div>
              {release && (
                <p className="release-comparison">
                  {changed.length
                    ? `${changed.length} ${changed.length === 1 ? "area differs" : "areas differ"} from the release. Your draft edits have not changed it.`
                    : "Your draft matches this release."}
                </p>
              )}
              <fieldset disabled={busy} className="release-fields">
                <legend>Publication details</legend>
                <label className="field">
                  <span>Website title</span>
                  <input
                    value={site.publication.title}
                    maxLength={160}
                    onChange={(e) => changeMeta({ title: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Website description</span>
                  <textarea
                    value={site.publication.description}
                    maxLength={500}
                    rows={2}
                    onChange={(e) =>
                      changeMeta({ description: e.target.value })
                    }
                  />
                </label>
                <div className="release-field-pair">
                  <label className="field">
                    <span>Language tag</span>
                    <input
                      value={site.publication.language}
                      maxLength={35}
                      onChange={(e) => changeMeta({ language: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Public address · optional</span>
                    <input
                      value={site.publication.canonical}
                      maxLength={2048}
                      placeholder="Leave empty until connected"
                      onChange={(e) =>
                        changeMeta({ canonical: e.target.value })
                      }
                    />
                  </label>
                </div>
                <p className="micro-note">
                  This address is metadata only. It does not connect a domain.
                </p>
              </fieldset>
              <div className="release-divider" />
              <h3>Readiness, with the artist in control.</h3>
              <p>
                We check destinations, accessible descriptions, contrast and
                whether this browser can open every media file. Observations
                never rewrite or rearrange your work.
              </p>
              <button
                className="wide-button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await studio.withSaved(async (value, revision) => {
                      reviewing.current = new AbortController();
                      setCanCancelReview(true);
                      const signal = reviewing.current.signal;
                      const media = await collectMedia(value, signal);
                      const issues = await preflight(
                        {
                          format: "latent-studio-revision",
                          version: 1,
                          id: "review",
                          name: "Review",
                          createdAt: "",
                          sourceRevision: revision,
                          site: value,
                          ...media,
                        },
                        undefined,
                        signal,
                      );
                      setReport({ issues, stamp: JSON.stringify(value) });
                    });
                  })
                }
              >
                {busy ? "Working…" : "Review draft"}
              </button>
              {busy && canCancelReview && (
                <button
                  className="wide-button secondary"
                  onClick={() => reviewing.current?.abort()}
                >
                  Cancel media review
                </button>
              )}
              {report && (
                <div className="preflight-report" aria-live="polite">
                  <b>
                    {report.stamp !== JSON.stringify(site)
                      ? "The draft changed. Review it again."
                      : report.issues.some((i) => i.severity === "error")
                        ? "Resolve these problems before release."
                        : "Ready for a local release."}
                  </b>
                  {report.issues.length ? (
                    <ul>
                      {report.issues.map((i, index) => (
                        <li key={index} className={i.severity}>
                          <span>
                            {i.severity === "error" ? "Resolve" : "Review"}
                          </span>
                          {i.message}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      No issues found by these checks. Review the actual desktop
                      and mobile experience too.
                    </p>
                  )}
                </div>
              )}
              <label className="field">
                <span>Edition name</span>
                <input
                  value={name}
                  maxLength={120}
                  placeholder="First edition · October"
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <button
                className="dark-button"
                disabled={busy || !ready || !name.trim()}
                onClick={() =>
                  void run(async () => {
                    await studio.withSaved(async (value, revision) => {
                      await localRevisions.checkpoint(value, revision, name, {
                        expectedId: library.releaseId,
                      });
                    });
                    await refresh();
                    setMessage(
                      "Local release created. Nothing has been published online.",
                    );
                    setName("");
                  })
                }
              >
                Create local release <Check size={15} />
              </button>
              {release && (
                <DeliveryPanel
                  key={release.id}
                  revision={release}
                  releaseId={library.releaseId!}
                  busy={busy}
                  run={run}
                  ready={(blob, filename, text) => {
                    setOutput({
                      url: URL.createObjectURL(blob),
                      bytes: blob.size,
                      filename,
                      text,
                    });
                    setMessage(
                      "Your file is ready to download. Nothing has been published.",
                    );
                  }}
                />
              )}
              {release && (
                <div className="release-export">
                  <h3>Keep an editable original.</h3>
                  <p>
                    Your backup keeps the full original media, authored writing
                    and design. Website delivery copies never replace it.
                  </p>
                  <button
                    className="wide-button secondary"
                    disabled={busy}
                    onClick={() => void prepareExport(release, true)}
                  >
                    Prepare editable backup
                  </button>
                </div>
              )}
            </>
          )}
          {view === "history" && (
            <>
              <span className="eyebrow">02 / Revisions & recovery</span>
              <h2>Nothing has to be the last version.</h2>
              <p className="release-intro">
                Name a checkpoint before a significant change. Restoring one
                creates a new draft and keeps the current draft as another
                recovery point. The local release stays as it was.
              </p>
              <div className="checkpoint-form">
                <label className="field">
                  <span>Checkpoint name</span>
                  <input
                    value={name}
                    maxLength={120}
                    placeholder="Before a new sequence"
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <button
                  className="dark-button"
                  disabled={busy || !name.trim()}
                  onClick={() =>
                    void run(async () => {
                      await studio.withSaved((value, revision) =>
                        localRevisions.checkpoint(value, revision, name),
                      );
                      await refresh();
                      setName("");
                      setMessage("Checkpoint kept on this device.");
                    })
                  }
                >
                  Keep checkpoint
                </button>
              </div>
              <div className="revision-list">
                {library.revisions.length === 0 ? (
                  <p>No checkpoints yet. Make one above.</p>
                ) : (
                  library.revisions.map((r) => (
                    <button
                      key={r.id}
                      aria-pressed={selectedId === r.id}
                      disabled={busy}
                      onClick={() => void choose(r.id)}
                    >
                      <span>
                        {r.name}
                        {r.id === library.releaseId && (
                          <small>Local release</small>
                        )}
                        {r.legacy && <small>Earlier recovery record</small>}
                      </span>
                      <time>{date(r.createdAt)}</time>
                    </button>
                  ))
                )}
              </div>
              {selected && (
                <section className="revision-inspector">
                  <span className="eyebrow">Inspect / {selected.name}</span>
                  <h3>{selected.site.name}</h3>
                  <p>
                    Draft revision {selected.sourceRevision} ·{" "}
                    {selected.site.pages.length} pages ·{" "}
                    {selected.manifest.length} media files ·{" "}
                    {(
                      selected.manifest.reduce((n, m) => n + m.bytes, 0) /
                      1024 /
                      1024
                    ).toFixed(1)}{" "}
                    MB
                  </p>
                  {selected.manifest.some((m) => m.missing) && (
                    <p className="release-error">
                      Some media is missing from this recovery point.
                    </p>
                  )}
                  <h4>Compared with your current draft</h4>
                  <ul>
                    {compareSites(selected.site, site).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  {compareSites(selected.site, site).length === 0 && (
                    <p>The documents match.</p>
                  )}
                  <div className="revision-preview-toolbar">
                    <label>
                      Page{" "}
                      <select
                        aria-label="Checkpoint preview page"
                        value={page}
                        onChange={(e) => setPage(e.target.value)}
                      >
                        {selected.site.pages.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      aria-pressed={mobile}
                      onClick={() => setMobile(!mobile)}
                    >
                      {mobile ? "Desktop preview" : "Mobile preview"}
                    </button>
                    <a
                      href={revisionHref(selectedId)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open preview ↗
                    </a>
                  </div>
                  <div
                    className={`revision-preview ${mobile ? "is-mobile" : ""}`}
                  >
                    <PreviewFrame mobile={mobile} pageId={page}>
                      <FrozenMedia revision={selected}>
                        <SiteRenderer
                          site={selected.site}
                          href={(id) =>
                            revisionHref(selectedId) +
                            "&page=" +
                            encodeURIComponent(id)
                          }
                          pageId={page}
                          navigate={setPage}
                        />
                      </FrozenMedia>
                    </PreviewFrame>
                  </div>
                  <p className="micro-note">
                    Earlier recovery records use retained originals. Named
                    checkpoints and local releases contain frozen media.
                  </p>
                  <button
                    className="dark-button"
                    disabled={busy || selected.manifest.some((m) => m.missing)}
                    onClick={() =>
                      void run(async () => {
                        await studio.restore("", selectedId);
                        await refresh();
                        setSelected(null);
                        setSelectedId("");
                        setReport(null);
                        setMessage(
                          "Restored as a new draft. The previous draft is kept in recovery. Your local release is unchanged.",
                        );
                      })
                    }
                  >
                    Restore as new draft
                  </button>
                </section>
              )}
            </>
          )}
          {view === "import" && (
            <>
              <span className="eyebrow">03 / Portable recovery</span>
              <h2>Bring a saved draft home.</h2>
              <p className="release-intro">
                Paste a Latent Studio backup below. Versions 1–13 are supported.
                Your current draft is kept in recovery before a valid backup
                becomes the new draft. Invalid input leaves it untouched.
              </p>
              <label className="field">
                <span>Backup JSON</span>
                <textarea
                  className="backup-paste"
                  rows={10}
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  maxLength={90 * 1024 * 1024}
                  spellCheck={false}
                />
              </label>
              <button
                className="dark-button"
                disabled={busy || !paste.trim()}
                onClick={() =>
                  void run(async () => {
                    await studio.restore(paste);
                    await refresh();
                    setPaste("");
                    setReport(null);
                    setMessage(
                      "Backup restored as a new draft. The previous draft remains in recovery.",
                    );
                  })
                }
              >
                Validate and restore backup
              </button>
              <p className="micro-note">
                Maximum backup size: 90 MB. Media files: 30 MB each. Browser
                storage can be cleared or run out of space; keep a copy outside
                this browser.
              </p>
            </>
          )}
          {output && (
            <section className="export-receipt">
              <h3>Ready to download.</h3>
              <p>
                {(output.bytes / 1024 / 1024).toFixed(2)} MB ·{" "}
                {output.filename.endsWith(".zip")
                  ? "Website folder"
                  : output.filename.endsWith(".html")
                    ? "Complete local website"
                    : "Editable draft backup"}
              </p>
              <a
                className="dark-button"
                href={output.url}
                download={output.filename}
              >
                Download{" "}
                {output.filename.endsWith(".zip")
                  ? "website folder"
                  : output.filename.endsWith(".html")
                    ? "website"
                    : "backup"}{" "}
                <Download size={15} />
              </a>
              {output.text !== undefined && (
                <button
                  className="wide-button secondary"
                  onClick={() =>
                    void run(async () => {
                      await navigator.clipboard.writeText(output.text!);
                      setMessage(
                        "File contents copied. Save them to a file to keep a durable copy.",
                      );
                    })
                  }
                >
                  Copy file contents
                </button>
              )}
              <p className="micro-note">
                Creating this file does not host a website. Download completion
                and disk space are managed by your browser.
              </p>
            </section>
          )}
        </main>
      </div>
      <footer className="release-footer">
        <span>{studio.status}</span>
        <span>Local browser storage · keep an external backup</span>
      </footer>
    </dialog>
  );
}
