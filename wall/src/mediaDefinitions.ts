import type { Site } from "./model";
export const demoAssets: Record<string, string> = {
  lake: "/media/lake.jpg",
  sea: "/media/sea.jpg",
  forest: "/media/forest.jpg",
  mountain: "/media/mountain.jpg",
  formBlue: "/media/form-blue.svg",
  formRed: "/media/form-red.svg",
  formYellow: "/media/form-yellow.svg",
  studyFilm: "/media/light-study.mp4",
};
export function mediaCredit(site: Site) {
  const ids = site.pages.flatMap((p) =>
    p.blocks.map((b) =>
      b.assetId.startsWith("demo-frozen:")
        ? b.assetId.split(":")[1]
        : b.assetId,
    ),
  );
  const photos = ids.some((id) =>
    ["sea", "lake", "forest", "mountain"].includes(id),
  );
  const originals = ids.some((id) =>
    ["formBlue", "formRed", "formYellow", "studyFilm"].includes(id),
  );
  return photos && originals
    ? "Licensed photos · Unsplash / Original demo works"
    : photos
      ? "Demo photographs · Unsplash"
      : originals
        ? "Original demo works"
        : "";
}
