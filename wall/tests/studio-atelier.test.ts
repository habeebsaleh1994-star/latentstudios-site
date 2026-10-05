import { describe, it, expect } from "vitest";
import { studioSchema, toAtelierContent, fromAtelierContent, type StudioDocument, type RoomAsset } from "../src/studio/document";

const asset = (id: string): RoomAsset => ({ src: `/${id}`, w: 1600, h: 1200 });
const img = (id: string, extra: object = {}) => ({ id, type: "image", assetId: `m/${id}.jpg`, title: `Title ${id}`, caption: `Caption ${id}`, alt: `Alt ${id}`, ...extra });
const txt = (id: string, t: string, extra: object = {}) => ({ id, type: "text", assetId: "", text: t, ...extra });
const doc = (): StudioDocument => studioSchema.parse({
  version: 14, room: "atelier", name: "Common Form", tagline: "hello@example.com", email: "",
  theme: { palette: "silk", mode: "system", accent: "#B87B8A", type: "silk", mount: "bare", space: "standard", motion: "slow", read: "standard" },
  pages: [
    { id: "home", kind: "home", title: "Plain things, | made well", label: "Studio", subtitle: "A note.", meta: "Design studio", inNav: true, blocks: [] },
    { id: "p1", kind: "project", title: "Almond & Salt", label: "Identity", subtitle: "A bakery.", meta: "Almond & Salt · 2025", inNav: true,
      blocks: [img("o1"), img("o2"), img("s1", { role: "process", arrange: "with-next" }), img("s2", { role: "process" }), txt("f1", "Role: identity and packaging"), txt("f2", "Team: three")] },
    { id: "p2", kind: "project", title: "Field Notes", label: "Book", subtitle: "", meta: "Archive Press · 2024", inNav: true, blocks: [img("c1"), img("c2", { role: "process" })] },
    { id: "about", kind: "about", title: "The studio", label: "About", subtitle: "", meta: "", inNav: true,
      blocks: [txt("a1", "We make plain things well."), txt("q1", "Begin with the room.", { role: "pause" }), txt("q2", "Draw it by hand first.", { role: "pause" })] },
  ],
});

describe("atelier <-> document", () => {
  it("reads projects: outcome, process steps, facts, client and year, and the comparison", () => {
    const c = toAtelierContent(doc(), asset);
    expect(c.projects.map((p) => p.id)).toEqual(["p1", "p2"]);
    const [a, b] = c.projects;
    expect(a).toMatchObject({ title: "Almond & Salt", discipline: "Identity", client: "Almond & Salt", year: "2025", summary: "A bakery.", compare: true });
    expect(a.outcome.map((i) => i.assetId)).toEqual(["m/o1.jpg", "m/o2.jpg"]);
    expect(a.process.map((i) => i.title)).toEqual(["Title s1", "Title s2"]);
    expect(a.facts).toEqual(["Role: identity and packaging", "Team: three"]);
    expect(b.compare).toBe(false);
    expect(c.site).toMatchObject({ title: "Plain things,", titleEm: "made well", kicker: "Design studio", about: ["We make plain things well."], principles: ["Begin with the room.", "Draw it by hand first."] });
  });

  it("a comparison needs both an outcome and a process", () => {
    const d = doc(); d.pages[2].blocks = [img("c2", { role: "process", arrange: "with-next" })];
    expect(toAtelierContent(d, asset).projects[1].compare).toBe(false);
  });

  it("writing it straight back changes nothing that matters", () => {
    const d = doc(), back = fromAtelierContent(d, toAtelierContent(d, asset));
    const view = (x: StudioDocument) => x.pages.map((p) => [p.id, p.kind, p.title, p.label, p.meta, p.subtitle, p.blocks.map((b) => [b.type, b.assetId, b.title, b.caption, b.text, b.role, b.arrange])]);
    const norm = (v: unknown[][]) => v.map((r) => [r[0], r[1], r[2], r[3], r[4], r[5], (r[6] as unknown[][]).map((b) => [b[0], b[1], b[2], b[3], b[4], b[5], b[6]])]);
    expect(norm(view(back))).toEqual(norm(view(d)));
  });

  it("an edit lands in the document: reorder steps, add an image, turn the comparison off, edit principles, add a project", () => {
    const d = doc(), c = toAtelierContent(d, asset);
    const [s1, s2] = c.projects[0].process; c.projects[0].process = [s2, s1];
    c.projects[0].outcome.push({ assetId: "asset:abc", src: "blob:x", w: 900, h: 600, alt: "New", title: "New", caption: "" });
    c.projects[1].compare = true;
    c.projects[0].compare = false;
    c.site.principles.push("Leave room.");
    c.projects.push({ id: "n1", title: "Untitled", discipline: "Identity", client: "", year: "2026", summary: "", facts: [], outcome: [], process: [], compare: false });
    const back = fromAtelierContent(d, c);
    const p1 = back.pages.find((p) => p.id === "p1")!;
    expect(p1.blocks.filter((b) => b.role === "process").map((b) => b.title)).toEqual(["Title s2", "Title s1"]);
    expect(p1.blocks.filter((b) => b.role === "process")[0].arrange).toBe("alone");
    expect(p1.blocks.filter((b) => b.type === "image" && b.role !== "process")).toHaveLength(3);
    expect(back.pages.find((p) => p.id === "p2")!.blocks.find((b) => b.role === "process")!.arrange).toBe("with-next");
    expect(back.pages.map((p) => p.id)).toEqual(["home", "p1", "p2", "n1", "about"]);
    expect(back.pages.find((p) => p.kind === "about")!.blocks.filter((b) => b.role === "pause").map((b) => b.text)).toEqual(["Begin with the room.", "Draw it by hand first.", "Leave room."]);
  });

  it("keeps the client when there is no year, and the year when there is no client", () => {
    const d = doc(); d.pages[1].meta = "Almond & Salt"; d.pages[2].meta = "2024";
    const [a, b] = toAtelierContent(d, asset).projects;
    expect([a.client, a.year]).toEqual(["Almond & Salt", ""]);
    expect([b.client, b.year]).toEqual(["", "2024"]);
  });
});
