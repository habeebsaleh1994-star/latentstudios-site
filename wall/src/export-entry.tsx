import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { SiteRenderer } from "./SiteRenderer";
import { MediaSources } from "./MediaSources";
import type { Site } from "./model";
const data = JSON.parse(
  document.getElementById("latent-document")!.textContent!,
);
// The exporter validates this document before embedding it. No editor/schema runtime is needed to display it.
const site = data.site as Site;
function Website() {
  const [page, setPage] = useState(
    new URLSearchParams(location.search).get("page") || site.pages[0].id,
  );
  useEffect(() => {
    const back = () =>
      setPage(
        new URLSearchParams(location.search).get("page") || site.pages[0].id,
      );
    addEventListener("popstate", back);
    return () => removeEventListener("popstate", back);
  }, []);
  function navigate(id: string) {
    setPage(id);
    const url = new URL(location.href);
    url.search = "";
    url.searchParams.set("page", id);
    history.pushState({}, "", url);
    window.scrollTo(0, 0);
  }
  return (
    <MediaSources.Provider value={data.assets}>
      <SiteRenderer site={site} pageId={page} navigate={navigate} />
    </MediaSources.Provider>
  );
}
createRoot(document.getElementById("root")!).render(<Website />);
