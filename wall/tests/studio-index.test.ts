import { describe, it, expect } from "vitest";
import { studioSchema, toIndexContent, fromIndexContent, splitTitle, type StudioDocument, type RoomAsset } from "../src/studio/document";

const asset = (id: string): RoomAsset => ({ src: `/${id}`, w: 1500, h: 1000 });
const text = (id: string, t: string, extra: object = {}) => ({ id, type: "text", assetId: "", text: t, ...extra });
const doc = (): StudioDocument => studioSchema.parse({
  version: 14, room: "index", name: "Noor Rahal", tagline: "hello@example.com", email: "",
  theme: { palette: "silk", mode: "system", accent: "#B87B8A", type: "silk", mount: "bare", space: "standard", motion: "slow", read: "standard" },
  pages: [
    { id: "home", kind: "home", title: "What the | door keeps", label: "Writing", subtitle: "A note.", meta: "Poems, essays", inNav: true, blocks: [] },
    { id: "door", kind: "writing", title: "The door remembers", label: "Poem", subtitle: "", meta: "Beirut, 2026", inNav: true,
      blocks: [{ id: "i1", type: "image", assetId: "img/9.jpg", title: "Wall, late light", alt: "A wall" }, text("t1", "The door remembers\nthe shape of every leaving")] },
    { id: "guest", kind: "writing", title: "A guest in my own language", label: "Essay", subtitle: "", meta: "Lisbon, 2025", inNav: true,
      blocks: [text("g1", "One.", { note: "Written in Lisbon." }), { id: "i2", type: "image", assetId: "img/6.jpg", title: "Under the leaves", alt: "A tree" }, text("g2", "Two."), text("g3", "Three.")] },
    { id: "about", kind: "about", title: "About", label: "About", subtitle: "", meta: "", inNav: true, blocks: [text("a1", "Noor writes.")] },
  ],
});

describe("index <-> document", () => {
  it("reads writing pages as pieces: form, place, year, paragraphs, margin, image position", () => {
    const c = toIndexContent(doc(), asset);
    expect(c.pieces.map((p) => p.id)).toEqual(["door", "guest"]);
    const [door, guest] = c.pieces;
    expect(door).toMatchObject({ kind: "poem", form: "Poem", place: "Beirut", year: "2026" });
    expect(door.paras).toEqual(["The door remembers\nthe shape of every leaving"]);
    expect(door.image?.at).toBe("cover");
    expect(guest.kind).toBe("essay");
    expect(guest.paras).toEqual(["One.", "Two.", "Three."]);
    expect(guest.image?.at).toBe(1);
    expect(guest.margin).toBe("Written in Lisbon.");
    expect(c.site).toMatchObject({ title: "What the", titleEm: "door keeps", kicker: "Poems, essays", about: ["Noor writes."] });
  });

  it("writing it straight back changes nothing that matters", () => {
    const d = doc(), back = fromIndexContent(d, toIndexContent(d, asset));
    const view = (x: StudioDocument) => x.pages.filter((p) => p.kind === "writing").map((p) => [p.id, p.title, p.label, p.meta, p.blocks.map((b) => [b.type, b.assetId, b.text, b.title])]);
    expect(view(back)).toEqual(view(d));
    expect(back.pages.map((p) => p.kind)).toEqual(["home", "writing", "writing", "about"]);
  });

  it("an edit lands in the document: new piece, retitle, reorder, delete, move the image", () => {
    const d = doc(), c = toIndexContent(d, asset);
    c.pieces.unshift({ id: "new1", title: "Untitled", form: "Fragment", place: "", year: "2026", kind: "fragment", paras: ["Words."], margin: "", image: null });
    c.pieces[1].title = "Renamed";
    c.pieces[2].image!.at = "cover";
    c.site.title = "After the"; c.site.titleEm = "door";
    const back = fromIndexContent(d, c);
    const w = back.pages.filter((p) => p.kind === "writing");
    expect(w.map((p) => p.id)).toEqual(["new1", "door", "guest"]);
    expect(w[1].title).toBe("Renamed");
    expect(w[2].blocks[0].type).toBe("image");
    expect(back.pages.find((p) => p.kind === "home")?.title).toBe("After the | door");
    expect(back.pages[back.pages.length - 1].kind).toBe("about");
    const gone = fromIndexContent(d, { ...c, pieces: c.pieces.filter((p) => p.id !== "door") });
    expect(gone.pages.some((p) => p.id === "door")).toBe(false);
  });

  it("keeps the other pages as they were", () => {
    const d = doc(), c = toIndexContent(d, asset);
    const back = fromIndexContent(d, { ...c, pieces: [] });
    expect(back.pages.find((p) => p.kind === "about")).toEqual(d.pages.find((p) => p.kind === "about"));
  });

  it("splits a title at the bar, or at the last word", () => {
    expect(splitTitle("What the | door keeps")).toEqual(["What the", "door keeps"]);
    expect(splitTitle("Before it disappears")).toEqual(["Before it", "disappears"]);
    expect(splitTitle("Alone")).toEqual(["Alone", ""]);
  });
});
