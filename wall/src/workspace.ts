import { sampleIds, type SampleId } from "./sampleIds";
export function resolveWorkspace(search: string) {
  const value = new URLSearchParams(search).get("demo");
  return value && sampleIds.includes(value as SampleId)
    ? (value as SampleId)
    : null;
}
export const demoId = resolveWorkspace(
  typeof window === "undefined" ? "" : window.location.search,
);
export const storyWorkspaceId = (() => {
  const value = new URLSearchParams(
    typeof window === "undefined" ? "" : window.location.search,
  ).get("studio");
  return value && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(value)
    ? value
    : null;
})();
export const invalidStoryWorkspace =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("studio") &&
  !storyWorkspaceId;
export const activeWorkspaceId = storyWorkspaceId ?? demoId;
export const databaseName = (id: string | null) =>
  id
    ? sampleIds.includes(id as SampleId)
      ? `latent-studio-demo-${id}`
      : `latent-studio-story-${id}`
    : "latent-studio-v1";
export const channelName = (id: string | null) =>
  `latent-studio:${id ?? "draft"}`;
export function siteHref(pageId: string) {
  const p = new URLSearchParams({ view: "site", page: pageId });
  if (
    typeof document !== "undefined" &&
    document.getElementById("latent-document")
  )
    return `?page=${encodeURIComponent(pageId)}`;
  const current = new URLSearchParams(
    typeof window === "undefined" ? "" : window.location.search,
  );
  if (current.get("view") === "release" && current.has("revision")) {
    p.set("view", "release");
    p.set("revision", current.get("revision")!);
  }
  if (current.get("delivery") === "web") p.set("delivery", "web");
  if (storyWorkspaceId) p.set("studio", storyWorkspaceId);
  else if (demoId) p.set("demo", demoId);
  return `?${p}`;
}
export const editorHref = () =>
  storyWorkspaceId
    ? `?studio=${storyWorkspaceId}`
    : demoId
      ? `?demo=${demoId}`
      : "/";
