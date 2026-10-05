import { randomUUID } from "node:crypto";
export async function seedCanvasFixture(page) {
  const workspace = randomUUID();
  await page.goto(`http://127.0.0.1:5181/?studio=${workspace}&page=quiet`);
  await page.evaluate(async (workspace) => {
    const { activeWorkspaceId } = await import("/src/workspace.ts");
    if (activeWorkspaceId !== workspace) throw Error("Refuse non-test");
    const { database } = await import("/src/database.ts");
    const db = await database();
    if (await db.get("documents", "site")) throw Error("Refuse existing");
    const { initialSite, blankBlock } = await import("/src/model.ts");
    const { sectionFor } = await import("/src/composition.ts");
    const { captureStudy } = await import("/src/compositionStudies.ts");
    const s = structuredClone(initialSite);
    s.name = "Mira Vale";
    s.styleId = "gallery";
    const p = s.pages.find((p) => p.id === "quiet");
    p.title = "The space between";
    p.subtitle = "Studies in colour, words and duration.";
    p.blocks = ["blue", "note", "red", "yellow"].map((id, i) => ({
      ...blankBlock(i === 1 ? "text" : "image"),
      id,
      assetId:
        i === 1
          ? ""
          : i === 0
            ? "formBlue"
            : i === 2
              ? "formRed"
              : "formYellow",
      text:
        i === 1
          ? "A colour becomes a place when you stay with it long enough."
          : "",
      caption: `${id} · Synthetic study`,
      alt: "Original geometric study",
      fit: "landscape",
    }));
    p.composition = {
      enabled: true,
      desktop: [
        sectionFor(["blue", "note"], "pair"),
        sectionFor(["red"], "red"),
        sectionFor(["yellow"], "yellow"),
      ],
      mobile: [
        sectionFor(["blue", "note"], "phone-pair", true),
        sectionFor(["yellow"], "phone-yellow", true),
        sectionFor(["red"], "phone-red", true),
      ],
    };
    p.composition.desktop[0].width = "reading";
    p.studies = [captureStudy(p, "Quiet reading", "quiet-study")];
    p.composition.desktop[0].width = "full";
    s.pages = [s.pages[0], p];
    await db.put("documents", { value: s, revision: 1 }, "site");
  }, workspace);

  await page.reload();
  return workspace;
}
