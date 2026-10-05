import { useEffect, useState } from "react";
import { localRevisions, type Revision } from "./revisions";
import { FrozenMedia } from "./MediaSources";
import { SiteRenderer } from "./SiteRenderer";
import { editorHref } from "./workspace";
export function ReleaseViewer() {
  const params = new URLSearchParams(location.search);
  const id = params.get("revision") || "";
  const [revision, setRevision] = useState<Revision | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(params.get("page") || "home");
  useEffect(() => {
    let active = true;
    void localRevisions
      .read(id)
      .then((r) => {
        if (active) setRevision(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    const back = () =>
      setPage(new URLSearchParams(location.search).get("page") || "home");
    addEventListener("popstate", back);
    return () => removeEventListener("popstate", back);
  }, []);
  function navigate(pageId: string) {
    setPage(pageId);
    const url = new URL(location.href);
    url.searchParams.set("page", pageId);
    history.pushState({}, "", url);
    window.scrollTo(0, 0);
  }
  return (
    <>
      <div className="local-preview-bar">
        <a href={editorHref()}>← Return to editor</a>
        <span>
          {revision?.name || "Saved edition"} · frozen local preview · not
          published or shareable
        </span>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : revision ? (
        <FrozenMedia
          revision={revision}
          delivery={params.get("delivery") === "web" ? "web" : "original"}
        >
          <SiteRenderer
            site={revision.site}
            pageId={page}
            navigate={navigate}
          />
        </FrozenMedia>
      ) : (
        <p>Opening saved edition…</p>
      )}
    </>
  );
}
