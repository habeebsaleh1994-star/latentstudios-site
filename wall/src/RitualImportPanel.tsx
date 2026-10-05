import { useEffect, useMemo, useRef, useState } from "react";
import { decodePublication, type AdmittedStory } from "./ritualArchive";
import {
  composeStory,
  createStoryDraft,
  listStoryDrafts,
  type StoryDraftEntry,
} from "./ritualImport";
import { styleIds, type Site } from "./model";
import { PreviewFrame } from "./PreviewFrame";
import { SiteRenderer } from "./SiteRenderer";
import { MediaSources } from "./MediaSources";
import "./ritual-import.css";
export function RitualImportPanel({
  close,
  flush,
}: {
  close: () => void;
  flush: () => Promise<unknown>;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    ticket = useRef({ value: 0 });
  const [story, setStory] = useState<AdmittedStory | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(""),
    [style, setStyle] = useState<Site["styleId"]>("folio"),
    [mobile, setMobile] = useState(false),
    [previewPage, setPreviewPage] = useState("story"),
    [approved, setApproved] = useState(false),
    [created, setCreated] = useState<{ href: string; warning: string } | null>(
      null,
    ),
    [drafts, setDrafts] = useState<StoryDraftEntry[]>([]);
  useEffect(() => {
    dialog.current?.showModal();
    void listStoryDrafts()
      .then(setDrafts)
      .catch(() => {});
    const generation = ticket.current;
    return () => {
      generation.value++;
    };
  }, []);
  const site = useMemo(
    () => (story ? composeStory(story, name, style) : null),
    [story, name, style],
  );
  const [sources, setSources] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    let active = true;
    const urls = story
      ? Object.fromEntries(
          Object.entries(story.assets).map(([id, blob]) => [
            id,
            URL.createObjectURL(blob),
          ]),
        )
      : null;
    void Promise.resolve().then(() => {
      if (active) setSources(urls);
    });
    return () => {
      active = false;
      if (urls) Object.values(urls).forEach(URL.revokeObjectURL);
    };
  }, [story]);
  async function choose(file: File) {
    const request = ++ticket.current.value;
    setBusy(true);
    setStory(null);
    setError("");
    setApproved(false);
    setCreated(null);
    try {
      const result = await decodePublication(file);
      if (request === ticket.current.value) setStory(result);
    } catch (e) {
      if (request === ticket.current.value)
        setError(
          e instanceof Error ? e.message : "The Story could not be read.",
        );
    } finally {
      if (request === ticket.current.value) setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="ritual-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <header>
        <div>
          <span className="eyebrow">From the darkroom to a website</span>
          <h2>A place for your Story.</h2>
        </div>
        <button onClick={close} disabled={busy}>
          Close
        </button>
      </header>
      <div className="ritual-body">
        <aside>
          <p>
            Bring in the approved local ZIP from Ritual’s{" "}
            <b>Export Story for a Website…</b> command. Review its words,
            photographs and web layout before creating a separate draft.
          </p>
          {!created && (
            <label className="field">
              <span>Story ZIP · 80 MB package / 60 MB media</span>
              <input
                aria-label="Story publication ZIP"
                type="file"
                accept=".zip,application/zip"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void choose(file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          {busy && (
            <p role="status">
              {story
                ? "Saving your separate Story draft…"
                : "Checking the package and every photograph…"}
            </p>
          )}
          {error && (
            <p className="invalid" role="alert">
              {error}
            </p>
          )}
          {story && (
            <>
              <div className="ritual-receipt">
                <span className="eyebrow">Publication receipt · format 1</span>
                <h3>{story.manifest.story.title || "Untitled Story"}</h3>
                <p>{story.manifest.story.standfirst}</p>
                <small>
                  {story.manifest.story.frames.length} sequenced photographs ·{" "}
                  {story.manifest.assets.length} sRGB PNGs · Ritual{" "}
                  {story.manifest.producer.version}
                </small>
              </div>
              <label className="field">
                <span>Artist or studio name</span>
                <input
                  value={name}
                  maxLength={500}
                  disabled={!!created || busy}
                  placeholder="Your name"
                  onChange={(e) => {
                    setName(e.target.value);
                    setApproved(false);
                  }}
                />
              </label>
              <label className="field">
                <span>Website direction</span>
                <select
                  value={style}
                  disabled={!!created || busy}
                  onChange={(e) => {
                    setStyle(e.target.value as Site["styleId"]);
                    setApproved(false);
                  }}
                >
                  {styleIds.map((id) => (
                    <option key={id} value={id}>
                      {id[0].toUpperCase() + id.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <details open>
                <summary>How this Story becomes a web page</summary>
                <p>
                  The opening cover appears first and may repeat a sequenced
                  photograph. Adjacent pairs sit together on desktop and stack
                  left to right on mobile. Breath frames use a narrower column
                  and more space. Full-bleed frames use the available page
                  width. Unpaired left/right frames stand alone. Photographs
                  keep their approved proportions.
                </p>
                <p>
                  The original public receipt stays with the draft and its
                  backups. Later website edits do not rewrite that receipt.
                </p>
              </details>
              <details>
                <summary>Words and sequence · exact import</summary>
                <ol>
                  {story.manifest.story.frames.map((f, i) => (
                    <li key={f.id}>
                      <b>
                        {i + 1}. {f.role}
                      </b>
                      <p>
                        {f.caption.text ||
                          (f.caption.source === "silence"
                            ? "Deliberately silent"
                            : "No inherited caption")}
                      </p>
                      <small>Caption: {f.caption.source}</small>
                    </li>
                  ))}
                </ol>
              </details>
              {!created && (
                <>
                  <label className="ritual-approve">
                    <input
                      type="checkbox"
                      checked={approved}
                      disabled={busy}
                      onChange={(e) => setApproved(e.target.checked)}
                    />
                    I reviewed this Story and want a new, separate local draft.
                  </label>
                  <button
                    className="wide-button"
                    disabled={!approved || !name.trim() || busy}
                    onClick={async () => {
                      if (!site) return;
                      setBusy(true);
                      setError("");
                      try {
                        await flush();
                        setCreated(
                          await createStoryDraft(site, story.assets, approved),
                        );
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "The draft could not be created.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Create separate draft
                  </button>
                </>
              )}
              {created && (
                <div role="status">
                  <h3>Your Story draft is saved.</h3>
                  <p>
                    Your previous draft is unchanged. This new draft is stored
                    in this browser.
                  </p>
                  {created.warning && <p>{created.warning}</p>}
                  <a className="wide-button" href={created.href}>
                    Open Story draft ↗
                  </a>
                  <small>
                    Export a backup from Draft tools to keep a portable copy.
                  </small>
                </div>
              )}
            </>
          )}
          {!story && drafts.length > 0 && (
            <div className="ritual-library">
              <h3>Your imported Stories</h3>
              {drafts.map((d) => (
                <a key={d.id} href={`?studio=${d.id}`}>
                  {d.title || "Untitled Story"}
                  <small>{d.name}</small>
                </a>
              ))}
            </div>
          )}
        </aside>
        <section className="ritual-preview">
          {site && sources ? (
            <>
              <div className="ritual-preview-tools">
                <span>Website interpretation</span>
                <button aria-pressed={!mobile} onClick={() => setMobile(false)}>
                  Desktop
                </button>
                <button aria-pressed={mobile} onClick={() => setMobile(true)}>
                  Mobile
                </button>
              </div>
              <div className={`ritual-frame ${mobile ? "mobile" : ""}`}>
                <PreviewFrame
                  mobile={mobile}
                  pageId={previewPage === "home" ? "home" : site.pages[1].id}
                >
                  <MediaSources.Provider value={sources}>
                    <SiteRenderer
                      site={site}
                      pageId={
                        previewPage === "home" ? "home" : site.pages[1].id
                      }
                      navigate={(id) =>
                        setPreviewPage(id === "home" ? "home" : "story")
                      }
                      href={() => "#"}
                    />
                  </MediaSources.Provider>
                </PreviewFrame>
              </div>
            </>
          ) : (
            <div className="ritual-empty">
              <span>01 / A considered passage</span>
              <h3>
                The work arrives
                <br />
                in its own order.
              </h3>
              <p>
                Your current website stays intact.
                <br />
                Nothing is uploaded or published.
              </p>
            </div>
          )}
        </section>
      </div>
    </dialog>
  );
}
