import { describe, it, expect } from "vitest";
import { accentsFrom, accentsAcross } from "../src/app/colour";

/** A picture made of blocks of colour, as pixels. */
function picture(blocks: [string, number][]): Uint8ClampedArray {
  const px: number[] = [];
  for (const [h, n] of blocks) { const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16); for (let i = 0; i < n; i++) px.push(r, g, b, 255); }
  return new Uint8ClampedArray(px);
}
const near = (a: string, b: string, tol = 24) => [1, 3, 5].every((i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= tol);

describe("colour from the work", () => {
  it("finds the colours that would hold as an accent, and leaves out paper, shadow and grey", () => {
    const sw = accentsFrom(picture([["#EEE9E7", 4000], ["#1A1A1A", 2000], ["#8A8A8A", 1500], ["#B8603A", 600], ["#4A6B8A", 300]]));
    expect(sw.length).toBe(2);
    expect(near(sw[0].hex, "#B8603A")).toBe(true);
    expect(near(sw[1].hex, "#4A6B8A")).toBe(true);
    expect(sw[0].weight).toBeGreaterThan(sw[1].weight);
  });
  it("merges near-duplicates and keeps distinct hues", () => {
    const sw = accentsFrom(picture([["#B8603A", 500], ["#BC6440", 500], ["#B55C36", 500], ["#3B7A5A", 400], ["#C9A227", 300]]), 4);
    expect(sw.length).toBe(3);
    expect(sw.map((s) => s.hex).filter((h) => near(h, "#B8603A", 30)).length).toBe(1);
  });
  it("gives nothing for a picture with no colour in it", () => {
    expect(accentsFrom(picture([["#FFFFFF", 100], ["#000000", 100], ["#777777", 100]]))).toEqual([]);
    expect(accentsFrom(new Uint8ClampedArray(0))).toEqual([]);
  });
  it("across a body of work, a colour that recurs comes first", () => {
    const a = [{ hex: "#B8603A", weight: 0.3 }, { hex: "#4A6B8A", weight: 0.5 }], b = [{ hex: "#B5603C", weight: 0.2 }, { hex: "#C9A227", weight: 0.6 }], c = [{ hex: "#BA5E38", weight: 0.1 }];
    const across = accentsAcross([a, b, c]);
    expect(near(across[0], "#B8603A")).toBe(true);
    expect(across.length).toBe(3);
  });
});
