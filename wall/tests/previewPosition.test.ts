import { describe, it, expect } from "vitest";
import {
  placePreviewPosition,
  readPreviewPosition,
} from "../src/previewPosition";
function viewport(works: { id: string; top: number; height: number }[], y = 0) {
  const calls: ScrollToOptions[] = [];
  const win = {
    scrollY: y,
    scrollX: 0,
    innerHeight: 600,
    scrollTo(options: ScrollToOptions) {
      calls.push(options);
      // Model a site with smooth scrolling: only an instant restore has reached
      // its destination before the linked-pane handler inspects scrollY.
      if (options.behavior === "instant")
        this.scrollY = Math.max(0, options.top ?? 0);
    },
  };
  const doc = {
    defaultView: win,
    documentElement: { scrollHeight: 2600 },
    querySelectorAll: () =>
      works.map((w) => ({
        dataset: { compositionBlock: w.id },
        getBoundingClientRect: () => ({
          top: w.top - win.scrollY,
          bottom: w.top + w.height - win.scrollY,
          height: w.height,
        }),
      })),
  } as unknown as Document;
  return { doc, win, calls };
}
describe("comparison location contract", () => {
  it("matches the same work fraction across reordered, differently sized arrangements", () => {
    const a = viewport(
      [
        { id: "image", top: 400, height: 400 },
        { id: "text", top: 900, height: 100 },
      ],
      500,
    );
    const b = viewport([
      { id: "text", top: 100, height: 160 },
      { id: "image", top: 600, height: 200 },
    ]);
    const position = readPreviewPosition(a.doc);
    expect(position.blockId).toBe("image");
    expect(position.fraction).toBe(0.25);
    expect(placePreviewPosition(b.doc, position)).toBe(650);
    expect(readPreviewPosition(b.doc).fraction).toBe(0.25);
  });
  it("bypasses authored smooth scrolling instead of feeding intermediate coordinates back", () => {
    const target = viewport([{ id: "image", top: 800, height: 300 }]);
    expect(
      placePreviewPosition(target.doc, {
        blockId: "image",
        fraction: 0.5,
        pageFraction: 0.2,
      }),
    ).toBe(950);
    expect(target.calls[0].behavior).toBe("instant");
  });
  it("keeps an approaching work below the viewport top by the same relative amount", () => {
    const a = viewport([{ id: "image", top: 200, height: 400 }]);
    const b = viewport([{ id: "image", top: 600, height: 200 }]);
    const position = readPreviewPosition(a.doc);
    expect(position.fraction).toBe(-0.5);
    expect(placePreviewPosition(b.doc, position)).toBe(500);
    expect(readPreviewPosition(b.doc).fraction).toBe(-0.5);
  });
  it("uses page progress when an original direction has no matching rendered work", () => {
    const original = viewport([], 800);
    expect(readPreviewPosition(original.doc).pageFraction).toBe(0.4);
    const target = viewport([]);
    expect(
      placePreviewPosition(target.doc, {
        blockId: "removed",
        fraction: 0.5,
        pageFraction: 0.4,
      }),
    ).toBe(800);
  });
});
